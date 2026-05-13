import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

type WorkOrderStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
type ApiAmroErrorCode =
  | 'AMRO_TRANSITION_NOT_ALLOWED'
  | 'AMRO_COMPLIANCE_GATE_FAILED'
  | 'AMRO_CERTIFICATION_REQUIRED'
  | 'AMRO_AUTH_SCOPE_INVALID'
  | 'AMRO_IDEMPOTENCY_KEY_REQUIRED';

const ROLE_TRANSITION_POLICY: Record<string, ReadonlyArray<WorkOrderStatus>> = {
  platform_admin: ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'],
  admin: ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'],
  tenant_admin: ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'],
  franchise_manager: ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'],
  planner: ['planning', 'scheduled', 'blocked'],
  engineer: ['scheduled', 'in_progress', 'blocked'],
  technician: ['in_progress'],
  inspector: ['completed', 'blocked'],
};
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, ReadonlyArray<WorkOrderStatus>> = {
  planning: ['scheduled', 'blocked', 'cancelled'],
  scheduled: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked', 'cancelled'],
  completed: [],
  blocked: ['planning', 'scheduled', 'in_progress', 'cancelled'],
  cancelled: [],
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_WORK_PACKAGES_V2_ENABLED, false);
}

function parsePathId(req: ApiRequest): string {
  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = String(raw || '').trim();
  if (!id) throw new Error('Bad Request: id is required');
  return id;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parseStatus(value: unknown, fieldName: string): WorkOrderStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'planning'
    || normalized === 'scheduled'
    || normalized === 'in_progress'
    || normalized === 'completed'
    || normalized === 'blocked'
    || normalized === 'cancelled'
  ) {
    return normalized;
  }
  throw new Error(`${fieldName} must be a valid status`);
}

function parseHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function resolveIdempotencyKey(req: ApiRequest): string {
  const key = parseHeaderValue(req.headers['idempotency-key'] || req.headers['Idempotency-Key']);
  if (!key) {
    throw new Error('AMRO_IDEMPOTENCY_KEY_REQUIRED');
  }
  if (key.length < 8) {
    throw new Error('AMRO_IDEMPOTENCY_KEY_REQUIRED');
  }
  return key;
}

function resolveScopedRole(role: string): 'platform_admin' | 'admin' | 'tenant_admin' | 'franchise_manager' | 'planner' | 'engineer' | 'technician' | 'inspector' {
  const normalized = String(role || '').trim().toLowerCase();
  if (
    normalized === 'platform_admin'
    || normalized === 'admin'
    || normalized === 'tenant_admin'
    || normalized === 'franchise_manager'
    || normalized === 'planner'
    || normalized === 'engineer'
    || normalized === 'technician'
    || normalized === 'inspector'
  ) {
    return normalized;
  }
  throw new Error('AMRO_AUTH_SCOPE_INVALID');
}

function assertAbacScope(
  payload: Record<string, unknown>,
  tenantId: string,
  allowedRoles: Set<string>,
  scopedRole: string,
) {
  const aircraftScope = String(payload.aircraft_scope || '').trim();
  const station = String(payload.station || '').trim();
  const qualification = String(payload.qualification || '').trim();
  const regulatorProfile = String(payload.regulator_profile || '').trim().toUpperCase();
  if (aircraftScope && aircraftScope.includes(':') && !aircraftScope.startsWith(`${tenantId}:`)) {
    throw new Error('AMRO_AUTH_SCOPE_INVALID');
  }
  if (station && station.includes(':') && !station.startsWith(`${tenantId}:`)) {
    throw new Error('AMRO_AUTH_SCOPE_INVALID');
  }
  if (qualification && !['A', 'B', 'C', 'L1', 'L2', 'L3'].includes(qualification.toUpperCase())) {
    throw new Error('AMRO_AUTH_SCOPE_INVALID');
  }
  if (regulatorProfile && !['FAA', 'EASA', 'CAAC'].includes(regulatorProfile)) {
    throw new Error('AMRO_AUTH_SCOPE_INVALID');
  }
  if (!allowedRoles.has(scopedRole)) {
    throw new Error('AMRO_AUTH_SCOPE_INVALID');
  }
}

function sendApiAmroError(
  res: ApiResponse,
  correlationId: string,
  status: number,
  code: ApiAmroErrorCode,
  message: string,
  details: string[],
  retryable: boolean,
) {
  res.status(status).json({
    version: 'v2',
    code,
    message,
    details,
    trace_id: correlationId,
    retryable,
  });
}

function mapTransitionError(error: unknown, correlationId: string, res: ApiResponse): boolean {
  const message = error instanceof Error ? error.message : '';
  if (message === 'AMRO_IDEMPOTENCY_KEY_REQUIRED') {
    sendApiAmroError(
      res,
      correlationId,
      422,
      'AMRO_IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key header is required for mutating endpoints',
      ['Provide an Idempotency-Key header with at least 8 characters.'],
      false,
    );
    return true;
  }
  if (message === 'AMRO_AUTH_SCOPE_INVALID' || message === 'Forbidden') {
    sendApiAmroError(
      res,
      correlationId,
      403,
      'AMRO_AUTH_SCOPE_INVALID',
      'Actor scope is invalid for this transition',
      ['Verify role, aircraft scope, station scope, qualification, and regulator profile.'],
      false,
    );
    return true;
  }
  if (message === 'AMRO_TRANSITION_NOT_ALLOWED') {
    sendApiAmroError(
      res,
      correlationId,
      409,
      'AMRO_TRANSITION_NOT_ALLOWED',
      'Requested status transition is not allowed',
      ['Verify transition policy and role transition matrix.'],
      false,
    );
    return true;
  }
  if (message === 'AMRO_COMPLIANCE_GATE_FAILED') {
    sendApiAmroError(
      res,
      correlationId,
      409,
      'AMRO_COMPLIANCE_GATE_FAILED',
      'Compliance gate evaluation failed for requested transition',
      ['Resolve blockers and retry transition.'],
      true,
    );
    return true;
  }
  if (message === 'AMRO_CERTIFICATION_REQUIRED') {
    sendApiAmroError(
      res,
      correlationId,
      403,
      'AMRO_CERTIFICATION_REQUIRED',
      'Certification signature is required for requested transition',
      ['Submit mandatory certification signature and retry transition.'],
      false,
    );
    return true;
  }
  return false;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);

    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    const scopedRole = resolveScopedRole(authUser.role);
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const id = parsePathId(req);
    const idempotencyKey = resolveIdempotencyKey(req);

    const payload = parseBody(req.body);
    const fromStatus = parseStatus(payload.current_status || payload.from_status || 'planning', 'current_status');
    const toStatus = parseStatus(payload.target_status || payload.to_status, 'target_status');
    const reasonCode = assertNonEmpty(payload.reason_code, 'reason_code');
    const actorSignature = assertNonEmpty(payload.actor_signature || payload.signature, 'actor_signature');
    const notes = String(payload.notes || '').trim();
    const allowedTargets = ROLE_TRANSITION_POLICY[scopedRole] || [];
    assertAbacScope(payload, String(scopedAccess.tenantId || ''), new Set(Object.keys(ROLE_TRANSITION_POLICY)), scopedRole);
    if (!allowedTargets.includes(toStatus)) {
      throw new Error('AMRO_TRANSITION_NOT_ALLOWED');
    }
    if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new Error('AMRO_TRANSITION_NOT_ALLOWED');
    }
    const complianceGatePassed = String(payload.compliance_gate || 'pass').trim().toLowerCase() === 'pass';
    if (!complianceGatePassed) {
      throw new Error('AMRO_COMPLIANCE_GATE_FAILED');
    }
    if (toStatus === 'completed' && actorSignature.length < 8) {
      throw new Error('AMRO_CERTIFICATION_REQUIRED');
    }

    res.status(200).json({
      version: 'v2',
      interface: 'transition-work-order',
      correlationId: ctx.correlationId,
      output: {
        work_order_id: id,
        from_status: fromStatus,
        to_status: toStatus,
        reason_code: reasonCode,
        notes,
        actor_signature: actorSignature,
        idempotency_key: idempotencyKey,
        audit_event_id: `${scopedAccess.tenantId}-${id}-transition-${Date.now()}`,
        gate_results: [{ gate: 'policy', decision: 'pass' }],
      },
      api_guardrails: {
        class: 'transition/gate',
        p95_target_ms: 500,
        p99_target_ms: 900,
        availability_target: 99.95,
      },
    });
  } catch (error) {
    if (mapTransitionError(error, ctx.correlationId, res)) {
      return;
    }
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

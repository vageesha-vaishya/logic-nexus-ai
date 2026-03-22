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

type WorkPackageStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

const ROLE_TRANSITION_POLICY: Record<string, ReadonlyArray<WorkPackageStatus>> = {
  tenant_admin: ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'],
  planner: ['planning', 'scheduled', 'blocked'],
  engineer: ['scheduled', 'in_progress', 'blocked'],
  technician: ['in_progress'],
  inspector: ['completed', 'blocked'],
};
const ALLOWED_TRANSITIONS: Record<WorkPackageStatus, ReadonlyArray<WorkPackageStatus>> = {
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

function parseStatus(value: unknown, fieldName: string): WorkPackageStatus {
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
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const id = parsePathId(req);

    const payload = parseBody(req.body);
    const fromStatus = parseStatus(payload.current_status || payload.from_status || 'planning', 'current_status');
    const toStatus = parseStatus(payload.target_status || payload.to_status, 'target_status');
    const reasonCode = assertNonEmpty(payload.reason_code, 'reason_code');
    const actorSignature = assertNonEmpty(payload.actor_signature || payload.signature, 'actor_signature');
    const allowedTargets = ROLE_TRANSITION_POLICY[authUser.role] || [];
    if (!allowedTargets.includes(toStatus)) {
      throw new Error('AMRO_TRANSITION_NOT_ALLOWED');
    }
    if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new Error('AMRO_TRANSITION_NOT_ALLOWED');
    }

    res.status(200).json({
      version: 'v2',
      interface: 'transition-work-package',
      correlationId: ctx.correlationId,
      output: {
        work_package_id: id,
        from_status: fromStatus,
        to_status: toStatus,
        reason_code: reasonCode,
        actor_signature: actorSignature,
        audit_event_id: `${scopedAccess.tenantId}-${id}-transition`,
        gate_results: [{ gate: 'policy', decision: 'pass' }],
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

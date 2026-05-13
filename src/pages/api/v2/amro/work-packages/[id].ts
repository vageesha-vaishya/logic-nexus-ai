import type { ApiRequest, ApiResponse } from '../../../_utils/types';
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
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import {
  getRuntimeWorkOrder,
  isRuntimeWorkOrderDeleted,
  markRuntimeWorkOrderDeleted,
  patchRuntimeWorkOrder,
  upsertRuntimeWorkOrder,
} from '../work-order-runtime-store';

type WorkOrderStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

const ALLOWED_PATCH_FIELDS = new Set(['title', 'priority', 'maintenance_type', 'planned_start', 'planned_end', 'status']);
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
  return parseBoolean(process.env.AMRO_WORK_PACKAGES_V2_ENABLED, true);
}

function parsePathId(req: ApiRequest): string {
  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = String(raw || '').trim();
  if (!id) {
    throw new Error('Bad Request: id is required');
  }
  return id;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function resolveHeaderValue(req: ApiRequest, headerName: string): string {
  const value = req.headers?.[headerName];
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function parseIdempotencyKey(req: ApiRequest, payload: Record<string, unknown>, fallbackKey: string): string {
  const headerKey = resolveHeaderValue(req, 'idempotency-key');
  const bodyKey = String(payload.idempotency_key || '').trim();
  const key = headerKey || bodyKey || fallbackKey;
  if (key.length > 128) {
    throw new Error('idempotency key length exceeds max limit');
  }
  return key;
}

function parseScopeContext(
  payload: Record<string, unknown>,
  tenantId: string,
  franchiseId: string | null,
  role: string,
) {
  const raw = payload.scope_context;
  const scopeContext = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const payloadTenantId = String(scopeContext.tenant_id || tenantId).trim();
  const payloadFranchiseId = String(scopeContext.franchise_id || franchiseId || '').trim();
  const payloadDomainId = String(scopeContext.domain_id || 'amro').trim().toLowerCase();
  const payloadRole = String(scopeContext.role || role).trim().toLowerCase();
  if (payloadTenantId !== tenantId) {
    throw new Error('scope_context tenant_id violates tenant scope');
  }
  if (payloadFranchiseId !== String(franchiseId || '')) {
    throw new Error('scope_context franchise_id violates franchise scope');
  }
  if (payloadDomainId !== 'amro') {
    throw new Error('scope_context domain_id must be amro');
  }
  return {
    tenant_id: tenantId,
    franchise_id: franchiseId,
    domain_id: 'amro',
    role: payloadRole,
  };
}

function enforceWorkOrderMutationAccess(permissions: string[], role: string): void {
  try {
    enforceAnyPermission(permissions || [], ['dashboards.manage', 'reports.manage']);
    return;
  } catch (_error) {
    const normalizedRole = String(role || '').trim().toLowerCase();
    const allowedRoles = new Set(['tenant_admin', 'franchise_admin', 'planner', 'engineer', 'inspector', 'developer']);
    if (allowedRoles.has(normalizedRole)) {
      return;
    }
    throw new Error('Forbidden: missing work package mutation permission');
  }
}

function assertAllowedPatchFields(payload: Record<string, unknown>) {
  const metadataFields = new Set(['current_status', 'idempotency_key', 'decision_trace_id', 'scope_context']);
  const invalid = Object.keys(payload)
    .filter((key) => !metadataFields.has(key))
    .find((key) => !ALLOWED_PATCH_FIELDS.has(key));
  if (invalid) {
    throw new Error(`Bad Request: unsupported patch field ${invalid}`);
  }
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

function buildWorkOrderDetail(id: string, tenantId: string, franchiseId: string | null, userId: string) {
  const nowIso = new Date().toISOString();
  return {
    id,
    code: `WP-${id.slice(-6).toUpperCase()}`,
    title: 'AMRO Work Package',
    status: 'planning',
    maintenance_type: 'line',
    priority: 'high',
    aircraft_id: `${tenantId}:aircraft-primary`,
    planned_start: '2026-03-21T00:00:00.000Z',
    planned_end: '2026-03-21T08:00:00.000Z',
    station: `${tenantId}:station-a`,
    scope_items: ['inspection', 'lubrication'],
    tenant_id: tenantId,
    franchise_id: franchiseId,
    version: 1,
    created_at: nowIso,
    created_by: userId,
    updated_at: nowIso,
    updated_by: userId,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
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
    const domainAccess = await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const id = parsePathId(req);
    const scope = { tenantId: scopedAccess.tenantId, franchiseId: scopedAccess.franchiseId };
    if (isRuntimeWorkOrderDeleted(scope, id) && req.method === 'GET') {
      res.status(404).json({
        version: 'v2',
        interface: 'detail-work-order',
        correlationId: ctx.correlationId,
        error: 'work package not found',
      });
      return;
    }
    const runtimeRecord = getRuntimeWorkOrder(scope, id);

    if (req.method === 'GET') {
      const detail = runtimeRecord || buildWorkOrderDetail(id, scopedAccess.tenantId, scopedAccess.franchiseId, scopedAccess.userId);
      res.status(200).json({
        version: 'v2',
        interface: 'detail-work-order',
        correlationId: ctx.correlationId,
        data: {
          work_order: detail,
          domainAccess,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      enforceWorkOrderMutationAccess(authUser.permissions, authUser.role);
      const payload = parseBody(req.body);
      const idempotencyKey = parseIdempotencyKey(req, payload, `delete-work-order:${ctx.correlationId}`);
      const scopeContext = parseScopeContext(payload, scopedAccess.tenantId, scopedAccess.franchiseId, authUser.role);
      markRuntimeWorkOrderDeleted(scope, id);
      res.status(200).json({
        version: 'v2',
        interface: 'delete-work-order',
        correlationId: ctx.correlationId,
        data: {
          work_order_id: id,
          deleted: true,
          idempotency_key: idempotencyKey,
          scope_context: scopeContext,
          deleted_by: scopedAccess.userId,
          domainAccess,
        },
      });
      return;
    }

    const payload = parseBody(req.body);
    const idempotencyKey = parseIdempotencyKey(req, payload, `update-work-order:${ctx.correlationId}`);
    const decisionTraceId = String(payload.decision_trace_id || `decision-${ctx.correlationId}`).trim();
    const scopeContext = parseScopeContext(payload, scopedAccess.tenantId, scopedAccess.franchiseId, authUser.role);
    assertAllowedPatchFields(payload);
    const fromStatus = parseStatus(payload.current_status || 'planning', 'current_status');
    const toStatus = payload.status ? parseStatus(payload.status, 'status') : fromStatus;
    if (fromStatus !== toStatus && !ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new Error('AMRO_TRANSITION_NOT_ALLOWED');
    }

    const { current_status: _currentStatus, ...patchFields } = payload;
    const ensured = runtimeRecord || upsertRuntimeWorkOrder({
      ...buildWorkOrderDetail(id, scopedAccess.tenantId, scopedAccess.franchiseId, scopedAccess.userId),
      status: fromStatus,
    });
    const patched = patchRuntimeWorkOrder(
      scope,
      id,
      {
        ...patchFields,
        status: toStatus,
      },
      scopedAccess.userId,
    ) || ensured;

    res.status(200).json({
      version: 'v2',
      interface: 'update-work-order',
      correlationId: ctx.correlationId,
      data: {
        work_order: patched,
        from_status: fromStatus,
        to_status: toStatus,
        idempotency_key: idempotencyKey,
        decision_trace_id: decisionTraceId,
        scope_context: scopeContext,
        domainAccess,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

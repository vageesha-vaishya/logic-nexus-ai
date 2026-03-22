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

type WorkPackageStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

const ALLOWED_PATCH_FIELDS = new Set(['title', 'priority', 'maintenance_type', 'planned_start', 'planned_end', 'status']);
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
  if (!id) {
    throw new Error('Bad Request: id is required');
  }
  return id;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function assertAllowedPatchFields(payload: Record<string, unknown>) {
  const invalid = Object.keys(payload)
    .filter((key) => key !== 'current_status')
    .find((key) => !ALLOWED_PATCH_FIELDS.has(key));
  if (invalid) {
    throw new Error(`Bad Request: unsupported patch field ${invalid}`);
  }
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

function buildWorkPackageDetail(id: string, tenantId: string, franchiseId: string | null, userId: string) {
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

    if (req.method === 'GET') {
      const detail = buildWorkPackageDetail(id, scopedAccess.tenantId, scopedAccess.franchiseId, scopedAccess.userId);
      res.status(200).json({
        version: 'v2',
        interface: 'detail-work-package',
        correlationId: ctx.correlationId,
        data: {
          work_package: detail,
          domainAccess,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      enforceAnyPermission(authUser.permissions, ['dashboards.manage', 'reports.manage']);
      res.status(200).json({
        version: 'v2',
        interface: 'delete-work-package',
        correlationId: ctx.correlationId,
        data: {
          work_package_id: id,
          deleted: true,
          deleted_by: scopedAccess.userId,
          domainAccess,
        },
      });
      return;
    }

    const payload = parseBody(req.body);
    assertAllowedPatchFields(payload);
    const fromStatus = parseStatus(payload.current_status || 'planning', 'current_status');
    const toStatus = payload.status ? parseStatus(payload.status, 'status') : fromStatus;
    if (fromStatus !== toStatus && !ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new Error('AMRO_TRANSITION_NOT_ALLOWED');
    }

    const { current_status: _currentStatus, ...patchFields } = payload;
    const patched = {
      ...buildWorkPackageDetail(id, scopedAccess.tenantId, scopedAccess.franchiseId, scopedAccess.userId),
      ...patchFields,
      status: toStatus,
      updated_by: scopedAccess.userId,
    };

    res.status(200).json({
      version: 'v2',
      interface: 'update-work-package',
      correlationId: ctx.correlationId,
      data: {
        work_package: patched,
        from_status: fromStatus,
        to_status: toStatus,
        domainAccess,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

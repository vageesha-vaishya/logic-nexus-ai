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

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INVENTORY_V2_ENABLED, true);
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

function toLineItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('line_items must include at least one reservation line');
  }
  return value.map((item) => (item && typeof item === 'object' ? item as Record<string, unknown> : {}));
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['POST', 'DELETE']);
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
    const tenantId = String(scopedAccess.tenantId || '');

    const payload = parseBody(req.body);

    if (req.method === 'POST') {
      const workPackageId = assertNonEmpty(payload.work_package_id, 'work_package_id');
      const lineItems = toLineItems(payload.line_items || payload.demand_lines);
      const reservationId = `${tenantId}-${workPackageId}-reservation-${Date.now()}`;
      res.status(200).json({
        version: 'v2',
        interface: 'reserve-parts',
        correlationId: ctx.correlationId,
        output: {
          reservation_id: reservationId,
          work_package_id: workPackageId,
          status: 'reserved',
          line_count: lineItems.length,
          reserved_at: new Date().toISOString(),
        },
      });
      return;
    }

    const reservationId = assertNonEmpty(payload.reservation_id || req.query.reservation_id, 'reservation_id');
    res.status(200).json({
      version: 'v2',
      interface: 'cancel-reservation',
      correlationId: ctx.correlationId,
      output: {
        reservation_id: reservationId,
        status: 'released',
        released_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

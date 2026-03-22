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
  return parseBoolean(process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED, true);
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

function toObligationItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('obligations must include at least one obligation');
  }
  return value.map((item) => (item && typeof item === 'object' ? item as Record<string, unknown> : {}));
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
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
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;

    if (req.method === 'GET') {
      const workPackageId = String(req.query.work_package_id || '').trim();
      res.status(200).json({
        version: 'v2',
        interface: 'list-compliance-obligations',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          work_package_id: workPackageId || null,
          obligations: [
            {
              obligation_id: `${tenantId}-ad-sb-001`,
              obligation_type: 'ad',
              status: 'open',
              due_date: '2026-12-31',
            },
            {
              obligation_id: `${tenantId}-ad-sb-002`,
              obligation_type: 'sb',
              status: 'in_review',
              due_date: '2026-10-15',
            },
          ],
        },
      });
      return;
    }

    const payload = parseBody(req.body);
    const source = assertNonEmpty(payload.source || payload.feed_source, 'source');
    const obligations = toObligationItems(payload.obligations);
    const feedBatchId = assertNonEmpty(payload.feed_batch_id || `feed-${Date.now()}`, 'feed_batch_id');
    const acceptedAt = new Date().toISOString();

    res.status(200).json({
      version: 'v2',
      interface: 'ingest-ad-sb-obligations',
      correlationId: ctx.correlationId,
      output: {
        source,
        feed_batch_id: feedBatchId,
        accepted_count: obligations.length,
        accepted_at: acceptedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

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
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { computeEngineNextDue } from '../../engine-read-model-store';

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);
  try {
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
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;
    const engineId = String(req.query.id || '').trim();
    if (!engineId) throw new Error('engine id is required');
    const payload = parseBody(req.body);
    const usageMeters = payload.usage_meters && typeof payload.usage_meters === 'object'
      ? (payload.usage_meters as Record<string, number>)
      : {};
    const output = computeEngineNextDue(
      { tenantId, franchiseId },
      engineId,
      {
        usageMeters,
        policySnapshotId: String(payload.policy_snapshot_id || ''),
        includeCompliance: Boolean(payload.include_compliance ?? true),
      },
    );
    res.status(200).json({ version: 'v2', interface: 'compute-engine-next-due', correlationId: ctx.correlationId, output });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

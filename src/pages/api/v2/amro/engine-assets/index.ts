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
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { listEngineAssets, listEngineConfigurationEntries } from '../engine-read-model-store';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
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
    const scope = { tenantId, franchiseId };
    const assets = listEngineAssets(scope);
    const configEntries = listEngineConfigurationEntries(scope);
    res.status(200).json({
      version: 'v2',
      interface: 'list-engine-assets',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        assets,
        configuration_entries: configEntries,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { generateGatewayRouteInventory } from '../../_utils/route-inventory';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;

    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    logApiEvent('info', '[GatewayFacade] route decision', {
      correlationId: ctx.correlationId,
      route: '/api/v1/gateway/route-inventory',
      method: req.method || 'GET',
      tenantId: access.tenantId || null,
      franchiseId: access.franchiseId || null,
      apiVersion: compatDecision.apiVersion,
      compatMode: compatDecision.compatMode,
    });
    enforceRateLimit(req, access.tenantId || '');

    const inventory = generateGatewayRouteInventory();
    return res.status(200).json({
      data: inventory,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[GatewayFacade] route inventory failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}


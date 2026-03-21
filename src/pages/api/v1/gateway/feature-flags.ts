import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  getGatewayFeatureFlagConfigSnapshot,
  resolveGatewayFeatureFlag,
  updateGatewayFeatureFlagConfig,
} from '../../_utils/gateway-feature-flags';

type UpdateBody = {
  expectedVersion?: number;
  expectedChecksum?: string;
  nextVersion?: number;
  globalKillSwitch?: boolean;
  modules?: Record<string, {
    enabled?: boolean;
    emergencyKillSwitch?: boolean;
    rolloutPercent?: number;
    tenantCohorts?: string[];
    franchiseCohorts?: string[];
  }>;
};

function parseBody(req: ApiRequest): UpdateBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as UpdateBody;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'PATCH') {
      res.setHeader('Allow', ['GET', 'PATCH']);
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
    enforceAnyPermission(auth.permissions, ['dashboards.view', 'admin.franchises.manage']);

    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    enforceRateLimit(req, access.tenantId || '');

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      if (!body.nextVersion || typeof body.modules !== 'object') {
        throw new Error('Invalid feature flag update payload');
      }
      const updated = updateGatewayFeatureFlagConfig({
        expectedVersion: body.expectedVersion,
        expectedChecksum: body.expectedChecksum,
        nextVersion: Number(body.nextVersion),
        globalKillSwitch: body.globalKillSwitch,
        modules: body.modules || {},
      });
      logApiEvent('info', '[GatewayFeatureFlags] config updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
        franchiseId: access.franchiseId || null,
        updatedVersion: updated.version,
        checksum: updated.checksum,
      });
    }

    const config = getGatewayFeatureFlagConfigSnapshot();
    const routeInventoryDecision = resolveGatewayFeatureFlag({
      moduleKey: 'gateway.route-inventory',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    const monitoringDecision = resolveGatewayFeatureFlag({
      moduleKey: 'gateway.monitoring-baseline',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });

    return res.status(200).json({
      data: {
        config,
        rollout: {
          routeInventory: routeInventoryDecision,
          monitoringBaseline: monitoringDecision,
        },
      },
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[GatewayFeatureFlags] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

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
import { resolveGatewayFeatureFlag } from '../../_utils/gateway-feature-flags';
import {
  evaluateProjectionRead,
  getProjectionCachingStatus,
  getProjectionRollbackProfile,
  invalidateProjectionCache,
  listCacheInvalidationContracts,
  listProjectionPipelines,
  listStalenessBudgets,
  putProjectionCache,
  setProjectionRollbackProfile,
  upsertCacheInvalidationContract,
  upsertProjectionPipelineState,
  upsertStalenessBudget,
} from '../../_utils/projection-caching-strategy';

type ProjectionCacheBody = {
  pipelineUpsert?: {
    moduleKey: string;
    projectionKey: string;
    lagMs?: number;
    status?: 'healthy' | 'degraded' | 'disabled';
    lastEventAt?: string;
  };
  contractUpsert?: {
    moduleKey: string;
    projectionKey: string;
    cacheNamespace: string;
    keyVersion: number;
    allowedKeyPrefixes: string[];
    invalidateOnEvents: string[];
  };
  budgetUpsert?: {
    moduleKey: string;
    projectionKey: string;
    maxLagMs: number;
    maxReadLatencyMs: number;
  };
  rollbackProfile?: {
    disableStaleProjections?: boolean;
    reason?: string;
  };
  cachePut?: {
    moduleKey: string;
    projectionKey: string;
    keyPrefix: string;
    entityKey: string;
    valueChecksum: string;
    ttlSeconds?: number;
  };
  readProbe?: {
    moduleKey: string;
    projectionKey: string;
    keyPrefix: string;
    entityKey: string;
    observedReadLatencyMs?: number;
  };
  invalidate?: {
    moduleKey: string;
    projectionKey: string;
    eventName: string;
  };
};

function parseBody(req: ApiRequest): ProjectionCacheBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as ProjectionCacheBody;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH') {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
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
    enforceRateLimit(req, access.tenantId || '');

    const rollout = resolveGatewayFeatureFlag({
      moduleKey: 'gateway.projection-caching',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Projection and caching controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const body = parseBody(req);
    if (req.method === 'PATCH') {
      if (body.pipelineUpsert) upsertProjectionPipelineState(body.pipelineUpsert);
      if (body.contractUpsert) upsertCacheInvalidationContract(body.contractUpsert);
      if (body.budgetUpsert) upsertStalenessBudget(body.budgetUpsert);
      if (body.rollbackProfile) setProjectionRollbackProfile(body.rollbackProfile);
      logApiEvent('info', '[ProjectionCacheControl] projection governance updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
      });
      return res.status(200).json({
        data: {
          status: getProjectionCachingStatus(),
          pipelines: listProjectionPipelines(),
          budgets: listStalenessBudgets(),
          contracts: listCacheInvalidationContracts(),
          rollbackProfile: getProjectionRollbackProfile(),
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      if (body.cachePut) {
        const cacheRecord = putProjectionCache(body.cachePut);
        return res.status(200).json({
          data: { cacheRecord },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.readProbe) {
        const decision = evaluateProjectionRead(body.readProbe);
        return res.status(200).json({
          data: { decision },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.invalidate) {
        const invalidation = invalidateProjectionCache(body.invalidate);
        return res.status(200).json({
          data: { invalidation },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      throw new Error('Invalid projection cache payload');
    }

    return res.status(200).json({
      data: {
        status: getProjectionCachingStatus(),
        pipelines: listProjectionPipelines(),
        budgets: listStalenessBudgets(),
        contracts: listCacheInvalidationContracts(),
        rollbackProfile: getProjectionRollbackProfile(),
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[ProjectionCacheControl] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

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
  createDatastoreReplayArtifact,
  enforceModuleWriteBoundary,
  evaluateControlledReadPath,
  getDatastoreCutoverStatus,
  getDatastoreFallbackProfile,
  listCompatibilityViews,
  listDatastoreBoundaries,
  listReplayArtifacts,
  listWritePathPolicies,
  registerCompatibilityView,
  setDatastoreFallbackProfile,
  upsertModuleDatastoreBoundary,
  hardenModuleWritePath,
} from '../../_utils/module-datastore-cutover';

type DatastoreCutoverBody = {
  boundaryUpsert?: {
    moduleKey: string;
    schemaName?: string;
    ownedWriteTables?: string[];
    compatibilityReadViews?: string[];
    enforceOwnedWrites?: boolean;
  };
  writePolicy?: {
    moduleKey: string;
    hardened?: boolean;
    allowedActors?: string[];
    blockedCrossModuleTables?: string[];
  };
  compatibilityView?: {
    moduleKey: string;
    viewName: string;
    sourceTable: string;
    freshnessAt?: string;
    freshnessLagMs?: number;
  };
  fallbackProfile?: {
    enabled?: boolean;
    reason?: string;
    strictAuditLogging?: boolean;
    modules?: string[];
  };
  writeProbe?: {
    moduleKey: string;
    tableName: string;
    actor: string;
  };
  readProbe?: {
    moduleKey: string;
    maxAuthoritativeLagMs?: number;
    viewName?: string;
  };
};

function parseBody(req: ApiRequest): DatastoreCutoverBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as DatastoreCutoverBody;
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
      moduleKey: 'gateway.datastore-cutover',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Datastore cutover controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const body = parseBody(req);
    if (req.method === 'PATCH') {
      if (body.boundaryUpsert) upsertModuleDatastoreBoundary(body.boundaryUpsert);
      if (body.writePolicy) hardenModuleWritePath(body.writePolicy);
      if (body.compatibilityView) registerCompatibilityView(body.compatibilityView);
      if (body.fallbackProfile) setDatastoreFallbackProfile(body.fallbackProfile);
      logApiEvent('info', '[DatastoreCutover] cutover governance updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
      });
      return res.status(200).json({
        data: {
          status: getDatastoreCutoverStatus(),
          boundaries: listDatastoreBoundaries(),
          writePolicies: listWritePathPolicies(),
          fallbackProfile: getDatastoreFallbackProfile(),
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      if (body.writeProbe) {
        const decision = enforceModuleWriteBoundary(body.writeProbe);
        return res.status(200).json({
          data: { decision },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.readProbe) {
        const decision = evaluateControlledReadPath(body.readProbe);
        const replayArtifact = decision.replayRequired && body.readProbe.viewName
          ? createDatastoreReplayArtifact({ moduleKey: body.readProbe.moduleKey, viewName: body.readProbe.viewName })
          : null;
        return res.status(200).json({
          data: { decision, replayArtifact },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      throw new Error('Invalid datastore cutover payload');
    }

    const moduleKey = String(req.query.moduleKey || '').trim();
    const replayLimit = Math.max(1, Math.min(200, Number(req.query.replayLimit || 50)));
    return res.status(200).json({
      data: {
        status: getDatastoreCutoverStatus(),
        boundaries: listDatastoreBoundaries(),
        writePolicies: listWritePathPolicies(),
        compatibilityViews: listCompatibilityViews(moduleKey || undefined),
        fallbackProfile: getDatastoreFallbackProfile(),
        replayArtifacts: listReplayArtifacts(replayLimit),
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[DatastoreCutover] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

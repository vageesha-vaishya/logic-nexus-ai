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
  buildReconciliationReport,
  getDualRunShadowMode,
  getReconciliationArtifacts,
  setDualRunShadowMode,
} from '../../_utils/dual-run-reconciliation';
import type { VerticalModuleKey } from '../../_utils/vertical-extraction-acl';

type RunBody = {
  moduleKey: VerticalModuleKey;
  entityKey: string;
  thresholdPercent?: number;
  primaryRecords: Record<string, unknown>[];
  shadowRecords: Record<string, unknown>[];
  shadowMode?: {
    shadowReadsEnabled?: boolean;
    shadowWritesEnabled?: boolean;
  };
};

function parseModuleKey(value: unknown): VerticalModuleKey {
  const moduleKey = String(value || '').trim();
  if (moduleKey === 'module-crm' || moduleKey === 'module-logistics' || moduleKey === 'module-quotation' || moduleKey === 'module-finance') {
    return moduleKey;
  }
  throw new Error(`Invalid module key: ${moduleKey}`);
}

function parseBody(req: ApiRequest): RunBody {
  if (!req.body || typeof req.body !== 'object') {
    throw new Error('Invalid reconciliation payload');
  }
  return req.body as RunBody;
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

    const moduleKey = parseModuleKey(req.query.moduleKey || 'module-crm');
    const rollout = resolveGatewayFeatureFlag({
      moduleKey: 'gateway.dual-run-reconciliation',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Dual-run reconciliation is not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const mode = setDualRunShadowMode(parseModuleKey(body.moduleKey), {
        shadowReadsEnabled: body.shadowMode?.shadowReadsEnabled,
        shadowWritesEnabled: body.shadowMode?.shadowWritesEnabled,
      });
      return res.status(200).json({
        data: {
          mode,
          artifacts: getReconciliationArtifacts(30),
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const report = buildReconciliationReport({
        moduleKey: parseModuleKey(body.moduleKey),
        entityKey: String(body.entityKey || 'entity'),
        primaryRecords: body.primaryRecords || [],
        shadowRecords: body.shadowRecords || [],
        thresholdPercent: body.thresholdPercent,
      });
      logApiEvent('info', '[DualRunReconciliation] report generated', {
        correlationId: ctx.correlationId,
        moduleKey: report.moduleKey,
        entityKey: report.entityKey,
        diffRatePercent: report.diffRatePercent,
        withinThreshold: report.withinThreshold,
      });
      return res.status(200).json({
        data: {
          mode: getDualRunShadowMode(report.moduleKey),
          report,
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    return res.status(200).json({
      data: {
        mode: getDualRunShadowMode(moduleKey),
        artifacts: getReconciliationArtifacts(30),
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[DualRunReconciliation] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

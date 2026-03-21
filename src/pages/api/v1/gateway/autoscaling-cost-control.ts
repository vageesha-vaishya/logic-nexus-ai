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
  evaluateAutoscalingDecision,
  evaluateBudgetAlert,
  getAutoscalingCostControlStatus,
  getAutoscalingRollbackProfile,
  listBudgetAlertPolicies,
  listModuleHpaPolicies,
  listQuotaPolicies,
  recordModuleSpend,
  setAutoscalingRollbackProfile,
  upsertBudgetAlertPolicy,
  upsertModuleHpaPolicy,
  upsertQuotaPolicy,
} from '../../_utils/autoscaling-cost-controls';

type AutoscalingCostBody = {
  hpaPolicy?: {
    moduleKey: string;
    minReplicas?: number;
    maxReplicas?: number;
    targetCpuUtilizationPercent?: number;
    targetMemoryUtilizationPercent?: number;
    stabilizationWindowSeconds?: number;
    scaleUpStep?: number;
    scaleDownStep?: number;
    baselineStaticReplicas?: number;
  };
  budgetPolicy?: {
    moduleKey: string;
    monthlyBudgetUsd?: number;
    warningThresholdPercent?: number;
    criticalThresholdPercent?: number;
  };
  quotaPolicy?: {
    moduleKey: string;
    maxRps?: number;
    maxConcurrentWorkers?: number;
  };
  rollbackProfile?: {
    enabled?: boolean;
    reason?: string;
  };
  scalingProbe?: {
    moduleKey: string;
    currentReplicas: number;
    currentRps: number;
    cpuUtilizationPercent: number;
    memoryUtilizationPercent: number;
  };
  spendRecord?: {
    moduleKey: string;
    amountUsd: number;
    month?: string;
  };
  budgetProbe?: {
    moduleKey: string;
    month?: string;
  };
};

function parseBody(req: ApiRequest): AutoscalingCostBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as AutoscalingCostBody;
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
      moduleKey: 'gateway.autoscaling-cost-controls',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Autoscaling and cost controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const body = parseBody(req);
    if (req.method === 'PATCH') {
      if (body.hpaPolicy) upsertModuleHpaPolicy(body.hpaPolicy);
      if (body.budgetPolicy) upsertBudgetAlertPolicy(body.budgetPolicy);
      if (body.quotaPolicy) upsertQuotaPolicy(body.quotaPolicy);
      if (body.rollbackProfile) setAutoscalingRollbackProfile(body.rollbackProfile);
      logApiEvent('info', '[AutoscalingCostControl] scaling governance updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
      });
      return res.status(200).json({
        data: {
          status: getAutoscalingCostControlStatus(),
          hpaPolicies: listModuleHpaPolicies(),
          budgetPolicies: listBudgetAlertPolicies(),
          quotaPolicies: listQuotaPolicies(),
          rollbackProfile: getAutoscalingRollbackProfile(),
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      if (body.spendRecord) {
        const spend = recordModuleSpend(body.spendRecord);
        return res.status(200).json({
          data: { spend },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.scalingProbe) {
        const decision = evaluateAutoscalingDecision(body.scalingProbe);
        return res.status(200).json({
          data: { decision },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.budgetProbe) {
        const budget = evaluateBudgetAlert(body.budgetProbe);
        return res.status(200).json({
          data: { budget },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      throw new Error('Invalid autoscaling and cost payload');
    }

    return res.status(200).json({
      data: {
        status: getAutoscalingCostControlStatus(),
        hpaPolicies: listModuleHpaPolicies(),
        budgetPolicies: listBudgetAlertPolicies(),
        quotaPolicies: listQuotaPolicies(),
        rollbackProfile: getAutoscalingRollbackProfile(),
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[AutoscalingCostControl] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

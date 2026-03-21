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
  evaluateCentralPolicyDecision,
  getCentralPolicyRules,
  getPolicyAuditRecords,
  getPolicyBypassProfile,
  getPolicyCentralizationStatus,
  getPolicyRolloutState,
  introspectServiceToken,
  propagateMtlsIdentity,
  replaceCentralPolicyRules,
  setPolicyBypassProfile,
  setPolicyRolloutState,
  type PolicyAction,
  type PolicyRule,
} from '../../_utils/identity-policy-centralization';

type IdentityPolicyBody = {
  decision?: {
    callerService: string;
    targetService: string;
    action: PolicyAction;
    resource: string;
    token: string;
    tenantId?: string | null;
    franchiseId?: string | null;
    identity?: {
      serviceName?: string;
      serviceAccount?: string;
      tenantId?: string | null;
      franchiseId?: string | null;
      certFingerprint?: string | null;
    };
  };
  introspection?: {
    token: string;
  };
  identity?: {
    serviceName: string;
    serviceAccount?: string;
    tenantId?: string | null;
    franchiseId?: string | null;
    certFingerprint?: string | null;
  };
  bypassProfile?: {
    enabled?: boolean;
    reason?: string;
    strictAuditLogging?: boolean;
    expiresAt?: string | null;
  };
  rolloutState?: {
    stage?: 'canary' | 'progressive' | 'full';
    canaryPercent?: number;
    automaticRollback?: boolean;
  };
  rules?: PolicyRule[];
};

function parseBody(req: ApiRequest): IdentityPolicyBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as IdentityPolicyBody;
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
      moduleKey: 'gateway.identity-policy-centralization',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Identity and policy centralization controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const body = parseBody(req);
    if (req.method === 'PATCH') {
      if (body.bypassProfile) {
        setPolicyBypassProfile({
          enabled: body.bypassProfile.enabled,
          reason: body.bypassProfile.reason,
          strictAuditLogging: body.bypassProfile.strictAuditLogging,
          expiresAt: body.bypassProfile.expiresAt,
        });
      }
      if (body.rolloutState) {
        setPolicyRolloutState({
          stage: body.rolloutState.stage,
          canaryPercent: body.rolloutState.canaryPercent,
          automaticRollback: body.rolloutState.automaticRollback,
        });
      }
      if (body.rules) {
        replaceCentralPolicyRules(body.rules);
      }
      logApiEvent('info', '[IdentityPolicyCentralization] policy configuration updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
        franchiseId: access.franchiseId || null,
      });
      return res.status(200).json({
        data: {
          status: getPolicyCentralizationStatus(),
          rolloutState: getPolicyRolloutState(),
          bypassProfile: getPolicyBypassProfile(),
          ruleCount: getCentralPolicyRules().length,
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      if (body.introspection) {
        return res.status(200).json({
          data: {
            introspection: introspectServiceToken(body.introspection.token),
          },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.identity) {
        return res.status(200).json({
          data: {
            identity: propagateMtlsIdentity(body.identity),
          },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.decision) {
        const decision = evaluateCentralPolicyDecision({
          callerService: body.decision.callerService,
          targetService: body.decision.targetService,
          action: body.decision.action,
          resource: body.decision.resource,
          token: body.decision.token,
          tenantId: body.decision.tenantId ?? access.tenantId,
          franchiseId: body.decision.franchiseId ?? access.franchiseId,
          identity: body.decision.identity,
        });
        logApiEvent('info', '[IdentityPolicyCentralization] policy decision issued', {
          correlationId: ctx.correlationId,
          callerService: body.decision.callerService,
          targetService: body.decision.targetService,
          authorized: decision.authorized,
          reason: decision.reason,
        });
        return res.status(200).json({
          data: { decision },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      throw new Error('Invalid identity policy request body');
    }

    const auditLimit = Math.max(1, Math.min(300, Number(req.query.auditLimit || 50)));
    return res.status(200).json({
      data: {
        status: getPolicyCentralizationStatus(),
        rolloutState: getPolicyRolloutState(),
        bypassProfile: getPolicyBypassProfile(),
        rules: getCentralPolicyRules(),
        audits: getPolicyAuditRecords(auditLimit),
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[IdentityPolicyCentralization] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

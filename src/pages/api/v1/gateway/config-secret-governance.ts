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
  createSignedLocalConfigSnapshot,
  detectConfigDrift,
  getConfigSecretGovernanceStatus,
  getDynamicConfigBundle,
  issueSecretLease,
  listDynamicConfigBundles,
  listSecretLeases,
  listSecretMetadata,
  rotateSecretVersion,
  setSecretAccessPolicy,
  upsertDynamicConfigBundle,
  verifySignedLocalConfigSnapshot,
  type ConfigSnapshot,
} from '../../_utils/config-secret-governance';

type ConfigSecretBody = {
  bundleUpsert?: {
    bundleKey: string;
    policyTag: string;
    payload: Record<string, unknown>;
    pinnedServices?: string[];
    nextVersion?: number;
  };
  leaseIssue?: {
    secretKey: string;
    serviceName: string;
    ttlSeconds?: number;
  };
  snapshotCreate?: {
    bundleKeys?: string[];
  };
  snapshotVerify?: {
    snapshot: ConfigSnapshot;
  };
  secretRotate?: {
    secretKey: string;
    nextKeyId: string;
    overlapWindowSeconds?: number;
  };
  accessPolicy?: {
    secretKey: string;
    policyTag?: string;
    allowedServices?: string[];
  };
};

function parseBody(req: ApiRequest): ConfigSecretBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as ConfigSecretBody;
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
      moduleKey: 'gateway.config-secret-governance',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Config and secret governance controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const body = parseBody(req);
    if (req.method === 'PATCH') {
      if (body.secretRotate) {
        rotateSecretVersion(body.secretRotate);
      }
      if (body.accessPolicy) {
        setSecretAccessPolicy(body.accessPolicy);
      }
      logApiEvent('info', '[ConfigSecretGovernance] secret governance updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
      });
      return res.status(200).json({
        data: {
          status: getConfigSecretGovernanceStatus(),
          secrets: listSecretMetadata(),
          leases: listSecretLeases(100),
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      if (body.bundleUpsert) {
        const bundle = upsertDynamicConfigBundle(body.bundleUpsert);
        return res.status(200).json({
          data: { bundle },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.leaseIssue) {
        const lease = issueSecretLease(body.leaseIssue);
        return res.status(200).json({
          data: { lease },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.snapshotCreate) {
        const snapshot = createSignedLocalConfigSnapshot(body.snapshotCreate.bundleKeys);
        return res.status(200).json({
          data: { snapshot },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      if (body.snapshotVerify) {
        const snapshotValid = verifySignedLocalConfigSnapshot(body.snapshotVerify.snapshot);
        const drift = detectConfigDrift(body.snapshotVerify.snapshot);
        return res.status(200).json({
          data: { snapshotValid, drift },
          rollout,
          correlationId: ctx.correlationId,
          version: 'v1',
        });
      }
      throw new Error('Invalid config or secret governance payload');
    }

    const bundleKey = String(req.query.bundleKey || '').trim();
    const serviceName = String(req.query.serviceName || '').trim();
    const snapshot = createSignedLocalConfigSnapshot();
    return res.status(200).json({
      data: {
        status: getConfigSecretGovernanceStatus(),
        bundle: bundleKey ? getDynamicConfigBundle(bundleKey, serviceName || null) : null,
        bundles: listDynamicConfigBundles(),
        secrets: listSecretMetadata(),
        leases: listSecretLeases(50),
        signedSnapshot: snapshot,
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[ConfigSecretGovernance] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope, type AmroCapability } from './anti-corruption-adapter';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';
import { buildAmroMigrationDependencyEnvelope, evaluateAmroMigrationValidation } from './migration-dependency-map';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_MIGRATION_PLAN_V2_ENABLED, true);
}

function parseCapability(req: ApiRequest): AmroCapability {
  const value = Array.isArray(req.query.capability) ? req.query.capability[0] : req.query.capability;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'work-packages';
  if (normalized === 'work-packages' || normalized === 'tasks' || normalized === 'compliance-gates') {
    return normalized;
  }
  throw new Error('Bad Request: Invalid capability filter');
}

function parseNonNegativeInteger(req: ApiRequest, key: string, fallback: number): number {
  const raw = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Bad Request: Invalid ${key}`);
  }
  return Math.floor(parsed);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }
    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO migration-plan v2 endpoint is disabled',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const access = await resolveAndApplyAccessContext(req, ctx);
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const compatDecision = resolveGatewayCompatibility(req, { tenantId, franchiseId });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    const amroAccess = await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const capability = parseCapability(req);
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability,
    });
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability,
    });
    const isolationScope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability,
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });

    const replayCompared = parseNonNegativeInteger(req, 'replayCompared', 10_000);
    const replayMatched = parseNonNegativeInteger(req, 'replayMatched', replayCompared);
    if (replayMatched > replayCompared) {
      throw new Error('Bad Request: replayMatched cannot exceed replayCompared');
    }
    const complianceCompared = parseNonNegativeInteger(req, 'complianceCompared', 10_000);
    const complianceMatched = parseNonNegativeInteger(req, 'complianceMatched', complianceCompared);
    if (complianceMatched > complianceCompared) {
      throw new Error('Bad Request: complianceMatched cannot exceed complianceCompared');
    }

    const validation = evaluateAmroMigrationValidation({
      crossTenantLeakageCount: parseNonNegativeInteger(req, 'crossTenantLeakageCount', 0),
      replayCompared,
      replayMatched,
      complianceCompared,
      complianceMatched,
      switchbackSeconds: parseNonNegativeInteger(req, 'switchbackSeconds', 240),
    });
    const migration = buildAmroMigrationDependencyEnvelope({
      capability,
      tenantId,
      franchiseId,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
      validation,
    });

    return res.status(200).json({
      version: 'v2',
      compatMode: compatDecision.compatMode,
      mode: 'migration-plan',
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      serviceBoundaries,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
      data: {
        migration,
      },
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

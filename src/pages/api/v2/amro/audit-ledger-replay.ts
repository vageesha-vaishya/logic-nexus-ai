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
import {
  replayAmroAuditLedgerRecords,
  type AmroAuditLedgerCapability,
} from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_AUDIT_LEDGER_V2_ENABLED, true);
}

function parseCapability(req: ApiRequest): AmroAuditLedgerCapability | undefined {
  const value = Array.isArray(req.query.capability) ? req.query.capability[0] : req.query.capability;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'work-packages' || normalized === 'tasks' || normalized === 'compliance-gates') {
    return normalized;
  }
  throw new Error('Bad Request: Invalid capability filter');
}

function parseLimit(req: ApiRequest): number {
  const value = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  if (value === undefined) return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
    throw new Error('Bad Request: Invalid limit filter');
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
        error: 'AMRO audit-ledger replay v2 endpoint is disabled',
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
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    const amroAccess = await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const capability = parseCapability(req);
    const limit = parseLimit(req);
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: capability || 'compliance-gates',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO audit-ledger replay v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: capability || 'compliance-gates',
    });
    const records = cutoverState.enabled
      ? replayAmroAuditLedgerRecords({
        tenantId,
        franchiseId,
        capability,
        limit,
      })
      : [];

    return res.status(200).json({
      version: 'v2',
      compatMode: compatDecision.compatMode,
      mode: 'replay',
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      filters: { capability: capability || null, limit },
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
      data: {
        records,
      },
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

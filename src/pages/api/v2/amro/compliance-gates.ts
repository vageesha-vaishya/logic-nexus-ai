import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  adaptLegacyComplianceGates,
  adaptModuleComplianceGatesFromLegacy,
  type ComplianceDecision,
  type ComplianceGateItem,
  type LegacyComplianceGateRow,
} from './anti-corruption-adapter';
import {
  buildHistoricalBackfillMetadata,
  drainAmroReconciliationQueueForFallback,
  enqueueAmroReconciliationSnapshot,
} from './reconciliation-queue';
import { appendAmroAuditLedgerRecord } from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED, false);
}

function isDualRunEnabled(): boolean {
  return parseBoolean(process.env.AMRO_COMPLIANCE_GATES_DUAL_RUN, true);
}

function isLegacyFallbackEnabled(): boolean {
  return parseBoolean(process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED, false)
    || parseBoolean(process.env.AMRO_COMPLIANCE_GATES_LEGACY_FALLBACK_ENABLED, false);
}

function parseDecisionFilter(req: ApiRequest): ComplianceDecision | null {
  const value = Array.isArray(req.query.decision) ? req.query.decision[0] : req.query.decision;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'approved' || normalized === 'rejected' || normalized === 'pending') {
    return normalized;
  }
  throw new Error('Bad Request: Invalid decision filter');
}

function buildLegacyComplianceGateRows(tenantId: string, franchiseId: string | null): LegacyComplianceGateRow[] {
  return [
    {
      legacy_gate_id: 'legacy-gate-001',
      work_package_id: 'WP-001',
      task_code: 'T-001',
      decision: 'pending',
      decided_by: null,
      decided_at: null,
      tenant_id: tenantId,
      franchise_id: franchiseId,
    },
    {
      legacy_gate_id: 'legacy-gate-002',
      work_package_id: 'WP-001',
      task_code: 'T-002',
      decision: 'approved',
      decided_by: 'certifier-a',
      decided_at: '2026-03-20T10:30:00.000Z',
      tenant_id: tenantId,
      franchise_id: franchiseId,
    },
    {
      legacy_gate_id: 'legacy-gate-003',
      work_package_id: 'WP-002',
      task_code: 'T-003',
      decision: 'rejected',
      decided_by: 'certifier-b',
      decided_at: '2026-03-20T09:00:00.000Z',
      tenant_id: tenantId,
      franchise_id: franchiseId,
    },
  ];
}

function filterByDecision(items: ComplianceGateItem[], decision: ComplianceDecision | null): ComplianceGateItem[] {
  if (!decision) return items;
  return items.filter((item) => item.decision === decision);
}

function buildReconciliation(legacyItems: ComplianceGateItem[], moduleItems: ComplianceGateItem[]) {
  const legacyKeys = new Set(legacyItems.map((item) => `${item.workPackageId}:${item.taskCode}`));
  const moduleKeys = new Set(moduleItems.map((item) => `${item.workPackageId}:${item.taskCode}`));
  const missingInModule = legacyItems
    .filter((item) => !moduleKeys.has(`${item.workPackageId}:${item.taskCode}`))
    .map((item) => `${item.workPackageId}:${item.taskCode}`);
  const missingInLegacy = moduleItems
    .filter((item) => !legacyKeys.has(`${item.workPackageId}:${item.taskCode}`))
    .map((item) => `${item.workPackageId}:${item.taskCode}`);
  return {
    legacyCount: legacyItems.length,
    moduleCount: moduleItems.length,
    deltaCount: Math.abs(legacyItems.length - moduleItems.length) + missingInLegacy.length + missingInModule.length,
    missingInModule,
    missingInLegacy,
  };
}

function buildDefaultReconciliationForAudit(legacyItems: ComplianceGateItem[], moduleItems: ComplianceGateItem[]) {
  if (legacyItems.length || moduleItems.length) {
    return buildReconciliation(legacyItems, moduleItems);
  }
  return {
    legacyCount: 0,
    moduleCount: 0,
    deltaCount: 0,
    missingInModule: [],
    missingInLegacy: [],
  };
}

function appendComplianceGateAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  decision: ComplianceDecision | null;
  mode: 'dual-run' | 'module' | 'legacy-fallback';
  legacyItems: ComplianceGateItem[];
  moduleItems: ComplianceGateItem[];
  queueMode: 'redis' | 'memory' | 'disabled' | null;
  snapshotCheckpoint: string | null;
}) {
  const reconciliation = buildDefaultReconciliationForAudit(params.legacyItems, params.moduleItems);
  const historicalBackfill = buildHistoricalBackfillMetadata({
    capability: 'compliance-gates',
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    compatMode: params.compatMode,
    requestedFilters: { decision: params.decision },
    reconciliation,
  });

  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'compliance-gates',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'compliance-gate',
    entityId: params.decision ? `decision:${params.decision}` : 'decision:all',
    correlationId: params.correlationId,
    action: `${params.mode}.read`,
    compatMode: params.compatMode,
    sourceHash: historicalBackfill.sourceHash,
    migrationBatchId: historicalBackfill.migrationBatchId,
    replayCheckpoint: params.snapshotCheckpoint || historicalBackfill.replayCheckpoint,
    context: {
      mode: params.mode,
      requestedFilters: { decision: params.decision },
      queueMode: params.queueMode,
      reconciliation,
    },
  });
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
        error: 'AMRO compliance-gates v2 endpoint is disabled',
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
    const decision = parseDecisionFilter(req);
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'compliance-gates',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO compliance-gates v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'compliance-gates',
    });
    const dualRun = isDualRunEnabled();
    const legacyFallback = isLegacyFallbackEnabled();
    const legacyRows = buildLegacyComplianceGateRows(tenantId, franchiseId);
    const moduleItems = filterByDecision(adaptModuleComplianceGatesFromLegacy(legacyRows), decision);
    const legacyItems = filterByDecision(adaptLegacyComplianceGates(legacyRows), decision);

    if (legacyFallback) {
      const fallback = await drainAmroReconciliationQueueForFallback({
        capability: 'compliance-gates',
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        compatMode: compatDecision.compatMode,
      });
      const auditRecord = cutoverState.enabled
        ? appendComplianceGateAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          decision,
          mode: 'legacy-fallback',
          legacyItems,
          moduleItems,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
        })
        : null;
      if (auditRecord) {
        logApiEvent('info', '[AmroComplianceGatesV2] audit ledger appended', {
          correlationId: ctx.correlationId,
          tenantId,
          franchiseId,
          mode: 'legacy-fallback',
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        });
      }
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'legacy-fallback',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        filters: { decision },
        fallback: {
          legacyMode: true,
          queueDrained: fallback.drained,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
        },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { complianceGates: legacyItems },
        correlationId: ctx.correlationId,
      });
    }

    if (!dualRun) {
      const auditRecord = cutoverState.enabled
        ? appendComplianceGateAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          decision,
          mode: 'module',
          legacyItems,
          moduleItems,
          queueMode: null,
          snapshotCheckpoint: null,
        })
        : null;
      if (auditRecord) {
        logApiEvent('info', '[AmroComplianceGatesV2] audit ledger appended', {
          correlationId: ctx.correlationId,
          tenantId,
          franchiseId,
          mode: 'module',
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        });
      }
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        filters: { decision },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { complianceGates: moduleItems },
        correlationId: ctx.correlationId,
      });
    }

    const reconciliation = buildReconciliation(legacyItems, moduleItems);
    const queueResult = await enqueueAmroReconciliationSnapshot({
      capability: 'compliance-gates',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: { decision },
      reconciliation,
    });
    logApiEvent('info', '[AmroComplianceGatesV2] dual-run reconciliation', {
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      decision,
      reconciliation,
      queue: queueResult,
    });
    const auditRecord = cutoverState.enabled
      ? appendComplianceGateAuditRecord({
        tenantId,
        franchiseId,
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        decision,
        mode: 'dual-run',
        legacyItems,
        moduleItems,
        queueMode: queueResult.queueMode,
        snapshotCheckpoint: null,
      })
      : null;
    if (auditRecord) {
      logApiEvent('info', '[AmroComplianceGatesV2] audit ledger appended', {
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        mode: 'dual-run',
        eventType: auditRecord.eventType,
        recordId: auditRecord.recordId,
        chainHash: auditRecord.chainHash,
        replayCheckpoint: auditRecord.replayCheckpoint,
      });
    }

    return res.status(200).json({
      version: 'v2',
      compatMode: compatDecision.compatMode,
      mode: 'dual-run',
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      filters: { decision },
      data: { complianceGates: moduleItems },
      legacy: { complianceGates: legacyItems },
      reconciliation,
      queue: queueResult,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
      auditLedger: auditRecord ? {
        eventType: auditRecord.eventType,
        recordId: auditRecord.recordId,
        chainHash: auditRecord.chainHash,
        replayCheckpoint: auditRecord.replayCheckpoint,
      } : null,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

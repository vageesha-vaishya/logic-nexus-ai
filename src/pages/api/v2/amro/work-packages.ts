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
  adaptLegacyWorkPackages,
  adaptModuleWorkPackagesFromLegacy,
  type LegacyWorkPackageRow,
  type WorkPackageItem,
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
  return parseBoolean(process.env.AMRO_WORK_PACKAGES_V2_ENABLED, false);
}

function isDualRunEnabled(): boolean {
  return parseBoolean(process.env.AMRO_WORK_PACKAGES_DUAL_RUN, true);
}

function isLegacyFallbackEnabled(): boolean {
  return parseBoolean(process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED, false)
    || parseBoolean(process.env.AMRO_WORK_PACKAGES_LEGACY_FALLBACK_ENABLED, false);
}

function buildLegacyRows(tenantId: string, franchiseId: string | null): LegacyWorkPackageRow[] {
  return [
    {
      legacy_id: 'legacy-wp-001',
      legacy_code: 'WP-001',
      legacy_title: 'Legacy Structural Inspection',
      legacy_status: 'planned',
      tenant_id: tenantId,
      franchise_id: franchiseId,
    },
    {
      legacy_id: 'legacy-wp-002',
      legacy_code: 'WP-002',
      legacy_title: 'Legacy Avionics Reliability Check',
      legacy_status: 'in_progress',
      tenant_id: tenantId,
      franchise_id: franchiseId,
    },
  ];
}

function buildReconciliation(legacyItems: WorkPackageItem[], moduleItems: WorkPackageItem[]) {
  const legacyCodes = new Set(legacyItems.map((item) => item.code));
  const moduleCodes = new Set(moduleItems.map((item) => item.code));
  const missingInModule = legacyItems.filter((item) => !moduleCodes.has(item.code)).map((item) => item.code);
  const missingInLegacy = moduleItems.filter((item) => !legacyCodes.has(item.code)).map((item) => item.code);
  return {
    legacyCount: legacyItems.length,
    moduleCount: moduleItems.length,
    deltaCount: Math.abs(legacyItems.length - moduleItems.length) + missingInLegacy.length + missingInModule.length,
    missingInModule,
    missingInLegacy,
  };
}

function appendWorkPackageAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  mode: 'dual-run' | 'module' | 'legacy-fallback';
  legacyItems: WorkPackageItem[];
  moduleItems: WorkPackageItem[];
  queueMode: 'redis' | 'memory' | 'disabled' | null;
  snapshotCheckpoint: string | null;
}) {
  const reconciliation = buildReconciliation(params.legacyItems, params.moduleItems);
  const historicalBackfill = buildHistoricalBackfillMetadata({
    capability: 'work-packages',
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    compatMode: params.compatMode,
    requestedFilters: {},
    reconciliation,
  });

  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'work-packages',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'work-package',
    entityId: 'scope:all',
    correlationId: params.correlationId,
    action: `${params.mode}.read`,
    compatMode: params.compatMode,
    sourceHash: historicalBackfill.sourceHash,
    migrationBatchId: historicalBackfill.migrationBatchId,
    replayCheckpoint: params.snapshotCheckpoint || historicalBackfill.replayCheckpoint,
    context: {
      mode: params.mode,
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
        error: 'AMRO work packages v2 endpoint is disabled',
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
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'work-packages',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO work packages v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'work-packages',
    });
    const legacyRows = buildLegacyRows(tenantId, franchiseId);
    const moduleItems = adaptModuleWorkPackagesFromLegacy(legacyRows);
    const dualRun = isDualRunEnabled();
    const legacyItems = adaptLegacyWorkPackages(legacyRows);
    const legacyFallback = isLegacyFallbackEnabled();

    if (legacyFallback) {
      const fallback = await drainAmroReconciliationQueueForFallback({
        capability: 'work-packages',
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        compatMode: compatDecision.compatMode,
      });
      const auditRecord = cutoverState.enabled
        ? appendWorkPackageAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          mode: 'legacy-fallback',
          legacyItems,
          moduleItems,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'legacy-fallback',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
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
        data: { workPackages: legacyItems },
        correlationId: ctx.correlationId,
      });
    }

    if (!dualRun) {
      const auditRecord = cutoverState.enabled
        ? appendWorkPackageAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          mode: 'module',
          legacyItems,
          moduleItems,
          queueMode: null,
          snapshotCheckpoint: null,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { workPackages: moduleItems },
        correlationId: ctx.correlationId,
      });
    }

    const reconciliation = buildReconciliation(legacyItems, moduleItems);
    const queueResult = await enqueueAmroReconciliationSnapshot({
      capability: 'work-packages',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: {},
      reconciliation,
    });
    logApiEvent('info', '[AmroWorkPackagesV2] dual-run reconciliation', {
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      reconciliation,
      queue: queueResult,
    });
    const auditRecord = cutoverState.enabled
      ? appendWorkPackageAuditRecord({
        tenantId,
        franchiseId,
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'dual-run',
        legacyItems,
        moduleItems,
        queueMode: queueResult.queueMode,
        snapshotCheckpoint: null,
      })
      : null;

    return res.status(200).json({
      version: 'v2',
      compatMode: compatDecision.compatMode,
      mode: 'dual-run',
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      data: { workPackages: moduleItems },
      legacy: { workPackages: legacyItems },
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

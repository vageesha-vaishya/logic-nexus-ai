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
  sanitizeQueryId,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  adaptLegacyTasks,
  adaptModuleTasksFromLegacy,
  buildAmroIntegrationContractEnvelope,
  buildAmroServiceBoundaryEnvelope,
  createAmroIsolationScope,
  enforceAmroScopedLegacyRows,
  type LegacyTaskRow,
  type TaskItem,
} from './anti-corruption-adapter';
import {
  buildHistoricalBackfillMetadata,
  drainAmroReconciliationQueueForFallback,
  enqueueAmroDualWriteOperation,
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
  return parseBoolean(process.env.AMRO_TASKS_V2_ENABLED, false);
}

function isDualRunEnabled(): boolean {
  return parseBoolean(process.env.AMRO_TASKS_DUAL_RUN, true);
}

function isLegacyFallbackEnabled(): boolean {
  return parseBoolean(process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED, false)
    || parseBoolean(process.env.AMRO_TASKS_LEGACY_FALLBACK_ENABLED, false);
}

function buildLegacyTaskRows(tenantId: string, franchiseId: string | null): LegacyTaskRow[] {
  return [
    {
      legacy_id: 'legacy-task-001',
      work_package_id: 'WP-001',
      task_code: 'T-001',
      legacy_title: 'Legacy Fuselage Integrity Review',
      legacy_status: 'planned',
      certifier_authority_level: 'B',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
    {
      legacy_id: 'legacy-task-002',
      work_package_id: 'WP-001',
      task_code: 'T-002',
      legacy_title: 'Legacy Avionics Wiring Continuity Test',
      legacy_status: 'in_progress',
      certifier_authority_level: 'A',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
    {
      legacy_id: 'legacy-task-003',
      work_package_id: 'WP-002',
      task_code: 'T-003',
      legacy_title: 'Legacy Cabin Pressure Seal Validation',
      legacy_status: 'completed',
      certifier_authority_level: 'C',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
  ];
}

function reconcileTaskSurface(legacyTasks: TaskItem[], moduleTasks: TaskItem[]) {
  const legacyCodes = new Set(legacyTasks.map((item) => item.taskCode));
  const moduleCodes = new Set(moduleTasks.map((item) => item.taskCode));
  const missingInModule = legacyTasks.filter((item) => !moduleCodes.has(item.taskCode)).map((item) => item.taskCode);
  const missingInLegacy = moduleTasks.filter((item) => !legacyCodes.has(item.taskCode)).map((item) => item.taskCode);
  return {
    legacyCount: legacyTasks.length,
    moduleCount: moduleTasks.length,
    deltaCount: Math.abs(legacyTasks.length - moduleTasks.length) + missingInLegacy.length + missingInModule.length,
    missingInModule,
    missingInLegacy,
  };
}

function filterByWorkPackage(items: TaskItem[], workPackageId: string): TaskItem[] {
  if (!workPackageId) return items;
  return items.filter((item) => item.workPackageId === workPackageId);
}

function appendTaskAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  mode: 'dual-run' | 'module' | 'legacy-fallback';
  workPackageId: string;
  legacyTasks: TaskItem[];
  moduleTasks: TaskItem[];
  queueMode: 'redis' | 'memory' | 'disabled' | null;
  snapshotCheckpoint: string | null;
}) {
  const reconciliation = reconcileTaskSurface(params.legacyTasks, params.moduleTasks);
  const historicalBackfill = buildHistoricalBackfillMetadata({
    capability: 'tasks',
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    compatMode: params.compatMode,
    requestedFilters: { workPackageId: params.workPackageId || null },
    reconciliation,
  });

  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'tasks',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'task',
    entityId: params.workPackageId ? `workPackage:${params.workPackageId}` : 'workPackage:all',
    correlationId: params.correlationId,
    action: `${params.mode}.read`,
    compatMode: params.compatMode,
    sourceHash: historicalBackfill.sourceHash,
    migrationBatchId: historicalBackfill.migrationBatchId,
    replayCheckpoint: params.snapshotCheckpoint || historicalBackfill.replayCheckpoint,
    context: {
      mode: params.mode,
      requestedFilters: { workPackageId: params.workPackageId || null },
      queueMode: params.queueMode,
      reconciliation,
    },
  });
}

async function enqueueTaskDualWriteOperations(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  tasks: TaskItem[];
}) {
  const completedTasks = params.tasks.filter((item) => item.status === 'completed');
  const operations = await Promise.all(
    completedTasks.map(async (item) => {
      const result = await enqueueAmroDualWriteOperation({
        capability: 'tasks',
        tenantId: params.tenantId,
        franchiseId: params.franchiseId,
        compatMode: params.compatMode,
        correlationId: params.correlationId,
        entityType: 'task',
        entityId: item.id,
        eventType: 'amro.task.completed.v1',
        action: 'status-sync',
      });
      return {
        entityId: item.id,
        eventType: 'amro.task.completed.v1',
        idempotencyKey: result.idempotencyKey,
        queueMode: result.queueMode,
      };
    })
  );
  return {
    enabled: true,
    approvedEntityCount: completedTasks.length,
    operations,
  };
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
        error: 'AMRO tasks v2 endpoint is disabled',
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
    const workPackageId = sanitizeQueryId(req.query.workPackageId, 'workPackageId');
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const isolationScope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'tasks',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'tasks',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO tasks v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'tasks',
    });
    const dualRun = isDualRunEnabled();
    const legacyFallback = isLegacyFallbackEnabled();
    const legacyRows = enforceAmroScopedLegacyRows(buildLegacyTaskRows(tenantId, franchiseId), isolationScope);

    const moduleTasks = filterByWorkPackage(adaptModuleTasksFromLegacy(legacyRows), workPackageId);
    const legacyTasks = filterByWorkPackage(adaptLegacyTasks(legacyRows), workPackageId);
    const integrationContracts = buildAmroIntegrationContractEnvelope({
      capability: 'tasks',
      tenantId,
      franchiseId,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
    });
    const reconciliation = reconcileTaskSurface(legacyTasks, moduleTasks);
    const deterministicComparison = buildHistoricalBackfillMetadata({
      capability: 'tasks',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: { workPackageId: workPackageId || null },
      reconciliation,
    });
    const dualWrite = await enqueueTaskDualWriteOperations({
      tenantId,
      franchiseId,
      correlationId: ctx.correlationId,
      compatMode: compatDecision.compatMode,
      tasks: moduleTasks,
    });
    if (legacyFallback) {
      const fallback = await drainAmroReconciliationQueueForFallback({
        capability: 'tasks',
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        compatMode: compatDecision.compatMode,
      });
      const auditRecord = cutoverState.enabled
        ? appendTaskAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          mode: 'legacy-fallback',
          workPackageId,
          legacyTasks,
          moduleTasks,
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
        serviceBoundaries,
        integrationContracts,
        coexistence: {
          dualRead: {
            deterministicComparisonHash: deterministicComparison.sourceHash,
            replayCheckpoint: deterministicComparison.replayCheckpoint,
            reconciliation,
          },
          dualWrite,
        },
        filters: { workPackageId: workPackageId || null },
        fallback: {
          legacyMode: true,
          queueDrained: fallback.drained,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
          snapshotCheckpointRestore: {
            checkpoint: fallback.snapshotCheckpoint,
            restored: true,
          },
        },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { tasks: legacyTasks },
        correlationId: ctx.correlationId,
      });
    }
    if (!dualRun) {
      const auditRecord = cutoverState.enabled
        ? appendTaskAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          mode: 'module',
          workPackageId,
          legacyTasks,
          moduleTasks,
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
        serviceBoundaries,
        integrationContracts,
        coexistence: {
          dualRead: {
            deterministicComparisonHash: deterministicComparison.sourceHash,
            replayCheckpoint: deterministicComparison.replayCheckpoint,
            reconciliation,
          },
          dualWrite,
        },
        filters: { workPackageId: workPackageId || null },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { tasks: moduleTasks },
        correlationId: ctx.correlationId,
      });
    }

    const queueResult = await enqueueAmroReconciliationSnapshot({
      capability: 'tasks',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: { workPackageId: workPackageId || null },
      reconciliation,
    });
    logApiEvent('info', '[AmroTasksV2] dual-run reconciliation', {
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      workPackageId: workPackageId || null,
      reconciliation,
      queue: queueResult,
    });
    const auditRecord = cutoverState.enabled
      ? appendTaskAuditRecord({
        tenantId,
        franchiseId,
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'dual-run',
        workPackageId,
        legacyTasks,
        moduleTasks,
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
      serviceBoundaries,
      integrationContracts,
      coexistence: {
        dualRead: {
          deterministicComparisonHash: deterministicComparison.sourceHash,
          replayCheckpoint: deterministicComparison.replayCheckpoint,
          reconciliation,
        },
        dualWrite,
      },
      filters: { workPackageId: workPackageId || null },
      data: { tasks: moduleTasks },
      legacy: { tasks: legacyTasks },
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

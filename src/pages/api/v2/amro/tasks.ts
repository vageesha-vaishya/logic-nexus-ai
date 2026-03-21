import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
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
import { enforceAmroSequentialMilestoneForTaskInterface } from './phase-plan-model';

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

type TaskStepAction = 'start' | 'complete' | 'block' | 'reopen';
type TaskStepStatus = 'planned' | 'in_progress' | 'completed' | 'blocked';
type TaskExecutionStatus = 'planned' | 'in_progress' | 'completed' | 'blocked';

const ALLOWED_EVIDENCE_TYPES = new Set(['photo', 'video', 'document', 'inspection-report']);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'application/pdf']);
const ALLOWED_SIGNATURE_METHODS = new Set(['digital_cert', 'biometric', 'pin']);

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function parseTimestamp(value: unknown, fieldName: string): string {
  const normalized = assertNonEmpty(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }
  return new Date(parsed).toISOString();
}

function parseInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  return parsed;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function resolveStepStatus(action: TaskStepAction): TaskStepStatus {
  if (action === 'start') return 'in_progress';
  if (action === 'complete') return 'completed';
  if (action === 'block') return 'blocked';
  return 'planned';
}

function resolveTaskStatus(stepStatus: TaskStepStatus): TaskExecutionStatus {
  if (stepStatus === 'completed') return 'in_progress';
  return stepStatus;
}

function buildEventHash(parts: string[]): string {
  return Buffer.from(parts.join('|')).toString('base64url');
}

function assertStepOrderPolicy(body: Record<string, unknown>) {
  const expectedStepIndex = parseInteger(body.expected_step_index, 'expected_step_index');
  const actualStepIndex = parseInteger(body.actual_step_index, 'actual_step_index');
  if (actualStepIndex !== expectedStepIndex) {
    throw new Error('Step order policy enforced: out-of-order step update rejected');
  }
}

function assertNoConflictingStatus(body: Record<string, unknown>, nextStepStatus: TaskStepStatus) {
  const currentStepStatus = String(body.current_step_status || 'planned').trim().toLowerCase();
  if (!currentStepStatus) {
    throw new Error('current_step_status is required');
  }
  const allowedTransitions: Record<string, ReadonlyArray<TaskStepStatus>> = {
    planned: ['in_progress', 'blocked'],
    in_progress: ['completed', 'blocked', 'planned'],
    blocked: ['in_progress', 'planned'],
    completed: [],
  };
  if (!allowedTransitions[currentStepStatus]?.includes(nextStepStatus)) {
    throw new Error('conflicting status changes rejected');
  }
}

function assertEvidencePolicies(body: Record<string, unknown>) {
  const checksum = assertNonEmpty(body.checksum, 'checksum');
  if (checksum.length < 8) {
    throw new Error('checksum must satisfy minimum integrity requirements');
  }
  const metadata = parseBody(body.metadata);
  const mediaSizeBytes = Number(metadata.media_size_bytes || 0);
  const maxBytes = Number(process.env.AMRO_EVIDENCE_MAX_BYTES || 25 * 1024 * 1024);
  if (!Number.isFinite(mediaSizeBytes) || mediaSizeBytes <= 0 || mediaSizeBytes > maxBytes) {
    throw new Error('media size policy violation');
  }
  const mimeType = String(metadata.mime_type || '').trim().toLowerCase();
  if (!mimeType || !ALLOWED_EVIDENCE_MIME_TYPES.has(mimeType)) {
    throw new Error('MIME policy violation');
  }
}

function assertSignatureQualification(body: Record<string, unknown>, signerId: string) {
  const method = assertNonEmpty(body.method, 'method').toLowerCase();
  if (!ALLOWED_SIGNATURE_METHODS.has(method)) {
    throw new Error('signature method is not supported');
  }
  const actionTime = parseTimestamp(body.action_time || new Date().toISOString(), 'action_time');
  const qualification = parseBody(body.qualification);
  const validFrom = parseTimestamp(qualification.valid_from || actionTime, 'qualification.valid_from');
  const validTo = parseTimestamp(qualification.valid_to || actionTime, 'qualification.valid_to');
  const actionMs = Date.parse(actionTime);
  if (actionMs < Date.parse(validFrom) || actionMs > Date.parse(validTo)) {
    throw new Error('signer qualification must be valid at action time');
  }
  const privileges = parseStringArray(qualification.privileges);
  if (!privileges.includes('task_signature.submit')) {
    throw new Error('signer privilege must be valid at action time');
  }
  if (signerId.toLowerCase().includes('inactive')) {
    throw new Error('signer qualification must be valid at action time');
  }
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
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
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
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    if (req.method === 'POST') {
      enforceAmroSequentialMilestoneForTaskInterface(interfaceName);
    }

    if (req.method === 'POST' && interfaceName === 'update-task-step') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const stepId = assertNonEmpty(body.step_id, 'step_id');
      const action = assertNonEmpty(body.action, 'action').toLowerCase() as TaskStepAction;
      if (!['start', 'complete', 'block', 'reopen'].includes(action)) {
        throw new Error('action is not supported');
      }
      const performedAt = parseTimestamp(body.performed_at, 'performed_at');
      const deviceId = assertNonEmpty(body.device_id, 'device_id');
      assertStepOrderPolicy(body);
      const stepStatus = resolveStepStatus(action);
      assertNoConflictingStatus(body, stepStatus);
      return res.status(200).json({
        version: 'v2',
        interface: 'update-task-step',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          task_id: taskId,
          step_id: stepId,
          action,
          performed_at: performedAt,
          device_id: deviceId,
        },
        output: {
          step_status: stepStatus,
          task_status: resolveTaskStatus(stepStatus),
          event_hash: buildEventHash([tenantId, franchiseId || '', taskId, stepId, action, performedAt, deviceId]),
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'upload-evidence') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const evidenceType = assertNonEmpty(body.evidence_type, 'evidence_type').toLowerCase();
      if (!ALLOWED_EVIDENCE_TYPES.has(evidenceType)) {
        throw new Error('evidence_type is not supported');
      }
      const mediaRef = assertNonEmpty(body.media_ref, 'media_ref');
      assertEvidencePolicies(body);
      return res.status(200).json({
        version: 'v2',
        interface: 'upload-evidence',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          task_id: taskId,
          evidence_type: evidenceType,
          media_ref: mediaRef,
          checksum: String(body.checksum || '').trim(),
          metadata: parseBody(body.metadata),
        },
        output: {
          evidence_id: `${tenantId}-${taskId}-evidence-${Date.now()}`,
          integrity_status: 'verified',
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'submit-signature') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const signerId = assertNonEmpty(body.signer_id, 'signer_id');
      assertNonEmpty(body.signature_payload, 'signature_payload');
      assertSignatureQualification(body, signerId);
      const method = String(body.method || '').trim().toLowerCase();
      return res.status(200).json({
        version: 'v2',
        interface: 'submit-signature',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          task_id: taskId,
          signer_id: signerId,
          method,
        },
        output: {
          signature_id: `${tenantId}-${taskId}-signature-${Date.now()}`,
          non_repudiation_status: 'verified',
        },
      });
    }

    if (req.method === 'POST') {
      return res.status(400).json({
        error: 'Unsupported interface. Use update-task-step, upload-evidence, or submit-signature.',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

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

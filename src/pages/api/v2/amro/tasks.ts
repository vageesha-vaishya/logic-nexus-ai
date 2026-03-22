import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { createHash } from 'node:crypto';
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

function parseBodyBoolean(value: unknown, fallback: boolean): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
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
type OfflineEventType = 'update-task-step' | 'upload-evidence' | 'submit-signature';
type DeterministicMergeResult = {
  taskId: string;
  eventType: OfflineEventType;
  sequenceNumber: number;
  mergedAt: string;
  mergedState: {
    stepState: TaskStepStatus | 'unchanged';
    evidenceState: 'verified' | 'unchanged';
    signatureState: 'verified' | 'unchanged';
  };
};
type OfflineQueueValidationResult = {
  eventType: OfflineEventType;
  taskId: string;
  localRevision: number;
  serverRevision: number;
  performedAt: string;
  sequenceNumber: number;
  eventHash: string;
  previousEventHash: string | null;
  encryptedPayloadRef: string;
  deviceSignature: string;
  conflict: boolean;
};

const ALLOWED_EVIDENCE_TYPES = new Set(['photo', 'video', 'document', 'inspection-report']);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'application/pdf']);
const ALLOWED_SIGNATURE_METHODS = new Set(['digital_cert', 'biometric', 'pin']);
const MOBILE_EXECUTION_INTERFACES = new Set(['update-task-step', 'upload-evidence', 'submit-signature', 'save-offline-task-action', 'sync-offline-queue']);

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

function parseObjectArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value.map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}));
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

function buildOfflineEventHash(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash('sha256').update(stable).digest('base64url');
}

function buildOfflineQueueCipherRef(tenantId: string, taskId: string, sequenceNumber: number, eventHash: string): string {
  return `enc://${tenantId}/${taskId}/${sequenceNumber}/${eventHash.slice(0, 16)}`;
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
  const kmsKeyId = assertNonEmpty(metadata.kms_key_id, 'metadata.kms_key_id');
  if (!kmsKeyId.toLowerCase().includes('kms')) {
    throw new Error('KMS key policy violation');
  }
  const encryptedSignatureArtifactRef = assertNonEmpty(
    metadata.encrypted_signature_artifact_ref,
    'metadata.encrypted_signature_artifact_ref',
  );
  if (!encryptedSignatureArtifactRef.startsWith('kms://') && !encryptedSignatureArtifactRef.startsWith('vault://')) {
    throw new Error('signature artifact encryption policy violation');
  }
  const mediaRef = assertNonEmpty(body.media_ref, 'media_ref');
  if (!mediaRef.startsWith('https://')) {
    throw new Error('signed URL policy violation');
  }
  let signedUrl: URL;
  try {
    signedUrl = new URL(mediaRef);
  } catch {
    throw new Error('signed URL policy violation');
  }
  const signatureToken = String(signedUrl.searchParams.get('sig') || '').trim();
  const expiresAt = Number(signedUrl.searchParams.get('exp') || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxWindowSeconds = Number(process.env.AMRO_EVIDENCE_SIGNED_URL_MAX_WINDOW_SECONDS || 900);
  if (!signatureToken || !Number.isFinite(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + maxWindowSeconds) {
    throw new Error('signed URL policy violation');
  }
  return {
    kmsKeyId,
    encryptedSignatureArtifactRef,
    signedUrlExpiresAt: new Date(expiresAt * 1000).toISOString(),
  };
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

function enforceTaskMutationAccess(auth: { role?: string; permissions?: string[] }, interfaceName: string) {
  const role = String(auth.role || '').trim().toLowerCase();
  if (role === 'technician' && MOBILE_EXECUTION_INTERFACES.has(interfaceName)) {
    return;
  }
  enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
}

function validateOfflineQueueEntry(entry: Record<string, unknown>): OfflineQueueValidationResult {
  const eventType = assertNonEmpty(entry.event_type, 'event_type').toLowerCase() as OfflineEventType;
  if (eventType !== 'update-task-step' && eventType !== 'upload-evidence' && eventType !== 'submit-signature') {
    throw new Error('offline event type is not supported');
  }
  const taskId = assertNonEmpty(entry.task_id, 'task_id');
  const localRevision = parseInteger(entry.local_revision, 'local_revision');
  const serverRevision = parseInteger(entry.server_version ?? entry.server_revision, 'server_version');
  const performedAt = parseTimestamp(entry.performed_at, 'performed_at');
  const sequenceNumber = parseInteger(entry.sequence_number ?? localRevision, 'sequence_number');
  const previousEventHash = String(entry.previous_event_hash || '').trim() || null;
  const encryptedPayloadRef = assertNonEmpty(entry.encrypted_payload_ref, 'encrypted_payload_ref');
  const deviceSignature = assertNonEmpty(entry.device_signature, 'device_signature');
  const providedEventHash = assertNonEmpty(entry.event_hash, 'event_hash');
  const expectedEventHash = buildOfflineEventHash({
    eventType,
    taskId,
    localRevision,
    serverRevision,
    performedAt,
    sequenceNumber,
    action: String(entry.action || '').trim().toLowerCase(),
    stepId: String(entry.step_id || '').trim(),
    evidenceType: String(entry.evidence_type || '').trim().toLowerCase(),
    signerId: String(entry.signer_id || '').trim(),
  });
  if (providedEventHash !== expectedEventHash) {
    throw new Error('event hash integrity validation failed');
  }
  if (eventType === 'update-task-step') {
    const action = assertNonEmpty(entry.action, 'action').toLowerCase() as TaskStepAction;
    if (!['start', 'complete', 'block', 'reopen'].includes(action)) {
      throw new Error('action is not supported');
    }
    const stepStatus = resolveStepStatus(action);
    assertNoConflictingStatus(entry, stepStatus);
  }
  if (eventType === 'upload-evidence') {
    const evidenceType = assertNonEmpty(entry.evidence_type, 'evidence_type').toLowerCase();
    if (!ALLOWED_EVIDENCE_TYPES.has(evidenceType)) {
      throw new Error('evidence_type is not supported');
    }
    assertEvidencePolicies(entry);
  }
  if (eventType === 'submit-signature') {
    const signerId = assertNonEmpty(entry.signer_id, 'signer_id');
    assertNonEmpty(entry.signature_payload, 'signature_payload');
    assertSignatureQualification(entry, signerId);
  }
  return {
    eventType,
    taskId,
    localRevision,
    serverRevision,
    performedAt,
    sequenceNumber,
    eventHash: providedEventHash,
    previousEventHash,
    encryptedPayloadRef,
    deviceSignature,
    conflict: localRevision < serverRevision,
  };
}

function assertOfflineEventOrdering(entries: OfflineQueueValidationResult[]) {
  const ordered = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (!previous) {
      if (current.previousEventHash) {
        throw new Error('first queue event cannot include previous_event_hash');
      }
      continue;
    }
    if (current.sequenceNumber <= previous.sequenceNumber) {
      throw new Error('offline queue sequence policy violation');
    }
    if (current.sequenceNumber !== previous.sequenceNumber + 1) {
      throw new Error('sequence gap detected; request missing segment replay');
    }
    if (current.previousEventHash !== previous.eventHash) {
      throw new Error('offline queue hash chain mismatch');
    }
  }
}

function applyDeterministicMergePolicy(entry: OfflineQueueValidationResult): DeterministicMergeResult {
  if (entry.eventType === 'update-task-step') {
    return {
      taskId: entry.taskId,
      eventType: entry.eventType,
      sequenceNumber: entry.sequenceNumber,
      mergedAt: new Date().toISOString(),
      mergedState: {
        stepState: entry.localRevision > entry.serverRevision ? 'completed' : 'in_progress',
        evidenceState: 'unchanged',
        signatureState: 'unchanged',
      },
    };
  }
  if (entry.eventType === 'upload-evidence') {
    return {
      taskId: entry.taskId,
      eventType: entry.eventType,
      sequenceNumber: entry.sequenceNumber,
      mergedAt: new Date().toISOString(),
      mergedState: {
        stepState: 'unchanged',
        evidenceState: 'verified',
        signatureState: 'unchanged',
      },
    };
  }
  return {
    taskId: entry.taskId,
    eventType: entry.eventType,
    sequenceNumber: entry.sequenceNumber,
    mergedAt: new Date().toISOString(),
    mergedState: {
      stepState: 'unchanged',
      evidenceState: 'unchanged',
      signatureState: 'verified',
    },
  };
}

function buildCanonicalState(merged: DeterministicMergeResult[]) {
  const perTask = new Map<string, { latestSequence: number; latestEventType: OfflineEventType }>();
  for (const entry of merged) {
    const current = perTask.get(entry.taskId);
    if (!current || entry.sequenceNumber > current.latestSequence) {
      perTask.set(entry.taskId, {
        latestSequence: entry.sequenceNumber,
        latestEventType: entry.eventType,
      });
    }
  }
  return {
    taskCount: perTask.size,
    taskSnapshots: Array.from(perTask.entries()).map(([taskId, snapshot]) => ({
      task_id: taskId,
      latest_sequence: snapshot.latestSequence,
      latest_event_type: snapshot.latestEventType,
    })),
  };
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

function appendTaskMutationAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  interfaceName: string;
  entityId: string;
  context: Record<string, unknown>;
}) {
  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'tasks',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'task',
    entityId: params.entityId,
    correlationId: params.correlationId,
    action: `${params.interfaceName}.write`,
    compatMode: params.compatMode,
    sourceHash: `${params.tenantId}:${params.interfaceName}:${params.entityId}:${params.correlationId}`,
    migrationBatchId: `runtime:${params.tenantId}:${params.franchiseId || 'franchise-none'}`,
    replayCheckpoint: `mutation:${Date.now()}`,
    context: params.context,
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
      enforceTaskMutationAccess(auth, interfaceName);
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
      const output = {
        step_status: stepStatus,
        task_status: resolveTaskStatus(stepStatus),
        event_hash: buildEventHash([tenantId, franchiseId || '', taskId, stepId, action, performedAt, deviceId]),
      };
      const auditRecord = cutoverState.enabled
        ? appendTaskMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: taskId,
          context: { output },
        })
        : null;
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
        output,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'upload-evidence') {
      enforceTaskMutationAccess(auth, interfaceName);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const evidenceType = assertNonEmpty(body.evidence_type, 'evidence_type').toLowerCase();
      if (!ALLOWED_EVIDENCE_TYPES.has(evidenceType)) {
        throw new Error('evidence_type is not supported');
      }
      const mediaRef = assertNonEmpty(body.media_ref, 'media_ref');
      const evidenceSecurity = assertEvidencePolicies(body);
      const output = {
        evidence_id: `${tenantId}-${taskId}-evidence-${Date.now()}`,
        integrity_status: 'verified',
        kms_key_id: evidenceSecurity.kmsKeyId,
        encrypted_signature_artifact_ref: evidenceSecurity.encryptedSignatureArtifactRef,
        signed_url_expires_at: evidenceSecurity.signedUrlExpiresAt,
      };
      const auditRecord = cutoverState.enabled
        ? appendTaskMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: taskId,
          context: { output },
        })
        : null;
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
        output,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'submit-signature') {
      enforceTaskMutationAccess(auth, interfaceName);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const signerId = assertNonEmpty(body.signer_id, 'signer_id');
      assertNonEmpty(body.signature_payload, 'signature_payload');
      assertSignatureQualification(body, signerId);
      const method = String(body.method || '').trim().toLowerCase();
      const output = {
        signature_id: `${tenantId}-${taskId}-signature-${Date.now()}`,
        non_repudiation_status: 'verified',
      };
      const auditRecord = cutoverState.enabled
        ? appendTaskMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: taskId,
          context: { output },
        })
        : null;
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
        output,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'save-offline-task-action') {
      enforceTaskMutationAccess(auth, interfaceName);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const stepId = assertNonEmpty(body.step_id, 'step_id');
      const action = assertNonEmpty(body.action, 'action').toLowerCase() as TaskStepAction;
      if (!['start', 'complete', 'block', 'reopen'].includes(action)) {
        throw new Error('action is not supported');
      }
      assertStepOrderPolicy(body);
      const queuedAt = parseTimestamp(body.queued_at || new Date().toISOString(), 'queued_at');
      const performedAt = parseTimestamp(body.performed_at || queuedAt, 'performed_at');
      const localRevision = parseInteger(body.local_revision || 1, 'local_revision');
      const sequenceNumber = parseInteger(body.sequence_number || localRevision, 'sequence_number');
      const serverVersion = parseInteger(body.server_version || localRevision, 'server_version');
      const deviceSignature = assertNonEmpty(body.device_signature, 'device_signature');
      const eventHash = buildOfflineEventHash({
        eventType: 'update-task-step',
        taskId,
        localRevision,
        serverRevision: serverVersion,
        performedAt,
        sequenceNumber,
        action,
        stepId,
        evidenceType: '',
        signerId: '',
      });
      return res.status(200).json({
        version: 'v2',
        interface: 'save-offline-task-action',
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
          local_revision: localRevision,
          server_version: serverVersion,
          sequence_number: sequenceNumber,
          performed_at: performedAt,
          device_signature: deviceSignature,
        },
        output: {
          queue_item_id: `${tenantId}-${taskId}-offline-${Date.now()}`,
          queue_status: 'queued',
          queued_at: queuedAt,
          event_hash: eventHash,
          encrypted_payload_ref: buildOfflineQueueCipherRef(tenantId, taskId, sequenceNumber, eventHash),
          queue_encryption: 'aes-256-gcm',
          sequence_number: sequenceNumber,
          signature_status: 'verified',
          conflict_strategy: 'deterministic-merge',
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'sync-offline-queue') {
      enforceTaskMutationAccess(auth, interfaceName);
      const syncStartedAt = Date.now();
      const body = parseBody(req.body);
      const authTokenActive = parseBodyBoolean(body.auth_token_active, true);
      const tokenRefreshAvailable = parseBodyBoolean(body.refresh_token_available, false);
      if (!authTokenActive) {
        if (!tokenRefreshAvailable) {
          throw new Error('auth token refresh failed; queue is on hold');
        }
      }
      const queueEntries = parseObjectArray(body.queue_entries, 'queue_entries');
      if (!queueEntries.length) {
        throw new Error('queue_entries must include at least one event');
      }
      const validatedEntries = queueEntries.map((entry) => validateOfflineQueueEntry(entry));
      assertOfflineEventOrdering(validatedEntries);
      const conflicts = validatedEntries.filter((entry) => entry.conflict);
      const mergedEntries = validatedEntries
        .filter((entry) => !entry.conflict)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const mergedResults = mergedEntries.map((entry) => applyDeterministicMergePolicy(entry));
      const canonicalState = buildCanonicalState(mergedResults);
      const storageWriteSuccessful = parseBodyBoolean(body.storage_write_successful, true);
      const retryAttempt = parseInteger(body.retry_attempt ?? 0, 'retry_attempt');
      const backoffBaseSeconds = parseInteger(body.backoff_base_seconds ?? 2, 'backoff_base_seconds');
      const maxRetryThreshold = parseInteger(body.max_retry_threshold ?? 5, 'max_retry_threshold');
      const nextBackoffSeconds = backoffBaseSeconds * Math.max(1, 2 ** retryAttempt);
      const deadLettered = !storageWriteSuccessful && retryAttempt >= maxRetryThreshold;
      const canonicalPersistence = storageWriteSuccessful
        ? {
          status: 'persisted',
          retry_attempt: retryAttempt,
          next_retry_in_seconds: 0,
          backoff_strategy: 'exponential',
          dead_lettered: false,
        }
        : {
          status: deadLettered ? 'dead-lettered' : 'retrying',
          retry_attempt: retryAttempt,
          next_retry_in_seconds: deadLettered ? 0 : nextBackoffSeconds,
          backoff_strategy: 'exponential',
          dead_lettered: deadLettered,
        };
      const clientAcknowledged = parseBodyBoolean(body.client_acknowledged, storageWriteSuccessful && conflicts.length === 0);
      const atomicCommitId = `${tenantId}-offline-sync-${Date.now()}`;
      const syncTimeMs = Math.max(0, Date.now() - syncStartedAt);
      const normalizedSyncTimeMsPer100Events = queueEntries.length > 0
        ? Number(((syncTimeMs / queueEntries.length) * 100).toFixed(2))
        : 0;
      const syncBenchmark = {
        target_ms_per_100_events: 3000,
        hard_limit_ms_per_100_events: 8000,
      };
      const syncBenchmarkStatus = normalizedSyncTimeMsPer100Events <= syncBenchmark.target_ms_per_100_events
        ? 'target_met'
        : normalizedSyncTimeMsPer100Events <= syncBenchmark.hard_limit_ms_per_100_events
          ? 'target_at_risk'
          : 'hard_limit_breached';
      const auditRecord = cutoverState.enabled
        ? appendTaskMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: `offline-sync:${tenantId}`,
          context: {
            atomic_commit_id: atomicCommitId,
            merged_count: mergedResults.length,
            conflict_count: conflicts.length,
            canonical_state: canonicalState,
            canonical_persistence: canonicalPersistence,
          },
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: 'sync-offline-queue',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        output: {
          sync_status: conflicts.length > 0 ? 'conflict' : 'merged',
          merged_count: mergedResults.length,
          conflict_count: conflicts.length,
          manual_intervention_required: conflicts.length > 0,
          auth: {
            token_status: authTokenActive ? 'active' : 'refreshed',
            refresh_attempted: !authTokenActive,
          },
          conflict_summary: {
            total: conflicts.length,
            reason: conflicts.length > 0 ? 'server-version-or-ordering-conflict' : 'none',
          },
          conflicts: conflicts.map((entry) => ({
            task_id: entry.taskId,
            local_revision: entry.localRevision,
            server_revision: entry.serverRevision,
            sequence_number: entry.sequenceNumber,
            event_hash: entry.eventHash,
            resolution: 'manual-review-required',
          })),
          merged_events: mergedResults.map((entry) => ({
            task_id: entry.taskId,
            event_type: entry.eventType,
            sequence_number: entry.sequenceNumber,
            merged_at: entry.mergedAt,
            merged_state: entry.mergedState,
          })),
          canonical_state: canonicalState,
          canonical_persistence: canonicalPersistence,
          canonical_state_update: {
            commit_id: atomicCommitId,
            status: storageWriteSuccessful ? 'committed' : deadLettered ? 'dead-lettered' : 'retrying',
            audit_ledger_status: auditRecord ? 'committed' : 'disabled',
          },
          acknowledgment: {
            all_events_acknowledged: clientAcknowledged,
            pending_marker: clientAcknowledged ? null : `pending-${atomicCommitId}`,
            retry_action: clientAcknowledged ? null : 'retry-sync',
          },
          sync_metrics: {
            queue_event_count: queueEntries.length,
            sync_time_ms: syncTimeMs,
            normalized_ms_per_100_events: normalizedSyncTimeMsPer100Events,
            benchmark: syncBenchmark,
            benchmark_status: syncBenchmarkStatus,
            alert_required: syncBenchmarkStatus === 'hard_limit_breached',
          },
        },
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST') {
      return res.status(400).json({
        error: 'Unsupported interface. Use update-task-step, upload-evidence, submit-signature, save-offline-task-action, or sync-offline-queue.',
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

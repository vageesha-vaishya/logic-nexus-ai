import { logger } from '@/lib/logger';
import { createHash } from 'node:crypto';

export type AmroReconciliationQueueEntry = {
  idempotencyKey: string;
  capability: 'work-packages' | 'tasks' | 'compliance-gates';
  correlationId: string;
  tenantId: string;
  franchiseId: string | null;
  compatMode: string;
  requestedFilters: Record<string, string | null>;
  reconciliation: {
    legacyCount: number;
    moduleCount: number;
    deltaCount: number;
    missingInModule: string[];
    missingInLegacy: string[];
  };
  historicalBackfill: {
    sourceHash: string;
    migrationBatchId: string;
    replayCheckpoint: string;
  };
  createdAt: string;
};

type QueueRuntime = {
  queue: any;
};

type AmroReconciliationQueueInput = Omit<AmroReconciliationQueueEntry, 'idempotencyKey' | 'createdAt' | 'historicalBackfill'>;
type AmroFallbackDrainInput = Pick<AmroReconciliationQueueInput, 'capability' | 'tenantId' | 'franchiseId' | 'compatMode' | 'correlationId'>;
type AmroDualWriteEntityType = 'work-package' | 'task' | 'compliance-gate';
type AmroDualWriteInput = {
  capability: AmroReconciliationQueueEntry['capability'];
  tenantId: string;
  franchiseId: string | null;
  compatMode: string;
  correlationId: string;
  entityType: AmroDualWriteEntityType;
  entityId: string;
  eventType: 'amro.work_package.created.v1' | 'amro.task.completed.v1' | 'amro.compliance.gate_decided.v1';
  action: 'upsert' | 'status-sync' | 'gate-sync';
};

let runtimePromise: Promise<QueueRuntime | null> | null = null;
const memoryJobIds = new Set<string>();
const dualWriteMemoryJobIds = new Set<string>();

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isQueueEnabled(): boolean {
  return parseBoolean(process.env.AMRO_RECON_QUEUE_ENABLED, true);
}

function queueName(): string {
  return String(process.env.AMRO_RECON_QUEUE_NAME || 'amro-reconciliation-v2');
}

function shouldUseBullMq(): boolean {
  return Boolean(String(process.env.REDIS_URL || '').trim());
}

async function buildRuntime(): Promise<QueueRuntime | null> {
  if (!isQueueEnabled() || !shouldUseBullMq()) return null;

  const redisUrl = String(process.env.REDIS_URL || '').trim();
  const loadModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<Record<string, unknown>>;
  const { Queue } = await loadModule('bullmq') as { Queue: new (name: string, options: Record<string, unknown>) => any };
  const parsedUrl = new URL(redisUrl);
  const connection = {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379),
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db: parsedUrl.pathname ? Number(parsedUrl.pathname.replace('/', '') || 0) : 0,
    maxRetriesPerRequest: null as any,
  };
  const queue = new Queue(queueName(), {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });
  return { queue };
}

async function getRuntime(): Promise<QueueRuntime | null> {
  if (!runtimePromise) {
    runtimePromise = buildRuntime().catch((error) => {
      logger.error('[AmroReconciliationQueue] runtime init failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      runtimePromise = null;
      return null;
    });
  }
  return runtimePromise;
}

export function buildAmroReconciliationIdempotencyKey(entry: AmroReconciliationQueueInput): string {
  return [
    'amro',
    entry.capability,
    entry.tenantId || 'tenant-none',
    entry.franchiseId || 'franchise-none',
    entry.compatMode || 'compat-none',
    entry.correlationId || 'corr-none',
  ].join(':');
}

function toStableJson(input: unknown): string {
  if (Array.isArray(input)) {
    return `[${input.map((item) => toStableJson(item)).join(',')}]`;
  }
  if (input && typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, value]) => `${JSON.stringify(key)}:${toStableJson(value)}`).join(',')}}`;
  }
  return JSON.stringify(input);
}

function resolveMigrationBatchId(): string {
  const fromEnv = String(process.env.AMRO_MIGRATION_BATCH_ID || '').trim();
  if (fromEnv) return fromEnv;
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `amro-batch-${y}${m}${day}`;
}

export function buildHistoricalBackfillMetadata(entry: AmroReconciliationQueueInput): {
  sourceHash: string;
  migrationBatchId: string;
  replayCheckpoint: string;
} {
  const stableSource = toStableJson({
    capability: entry.capability,
    tenantId: entry.tenantId,
    franchiseId: entry.franchiseId,
    compatMode: entry.compatMode,
    requestedFilters: entry.requestedFilters,
    reconciliation: entry.reconciliation,
  });
  const sourceHash = createHash('sha256').update(stableSource).digest('hex');
  const migrationBatchId = resolveMigrationBatchId();
  const checkpointSeed = `${entry.capability}:${entry.tenantId}:${entry.franchiseId || 'franchise-none'}:${entry.correlationId}:${sourceHash}`;
  const replayCheckpoint = createHash('sha256').update(checkpointSeed).digest('hex').slice(0, 24);
  return { sourceHash, migrationBatchId, replayCheckpoint };
}

export async function drainAmroReconciliationQueueForFallback(entry: AmroFallbackDrainInput): Promise<{
  drained: boolean;
  queueMode: 'redis' | 'memory' | 'disabled';
  snapshotCheckpoint: string;
}> {
  const historicalBackfill = buildHistoricalBackfillMetadata({
    ...entry,
    requestedFilters: {},
    reconciliation: {
      legacyCount: 0,
      moduleCount: 0,
      deltaCount: 0,
      missingInLegacy: [],
      missingInModule: [],
    },
  });
  const snapshotCheckpoint = historicalBackfill.replayCheckpoint;

  if (!isQueueEnabled()) {
    return { drained: false, queueMode: 'disabled', snapshotCheckpoint };
  }

  const runtime = await getRuntime();
  if (runtime) {
    await runtime.queue.drain(true);
    return { drained: true, queueMode: 'redis', snapshotCheckpoint };
  }

  memoryJobIds.clear();
  return { drained: true, queueMode: 'memory', snapshotCheckpoint };
}

export async function enqueueAmroReconciliationSnapshot(
  entry: AmroReconciliationQueueInput
): Promise<{ queued: boolean; idempotencyKey: string; queueMode: 'redis' | 'memory' | 'disabled' }> {
  if (!isQueueEnabled()) {
    return {
      queued: false,
      idempotencyKey: buildAmroReconciliationIdempotencyKey(entry),
      queueMode: 'disabled',
    };
  }

  const idempotencyKey = buildAmroReconciliationIdempotencyKey(entry);
  const historicalBackfill = buildHistoricalBackfillMetadata(entry);
  const payload: AmroReconciliationQueueEntry = {
    ...entry,
    idempotencyKey,
    historicalBackfill,
    createdAt: new Date().toISOString(),
  };

  const runtime = await getRuntime();
  if (runtime) {
    const existing = await runtime.queue.getJob(idempotencyKey);
    if (!existing) {
      await runtime.queue.add('amro-reconciliation-snapshot', payload, { jobId: idempotencyKey });
    }
    return { queued: true, idempotencyKey, queueMode: 'redis' };
  }

  if (memoryJobIds.has(idempotencyKey)) {
    return { queued: true, idempotencyKey, queueMode: 'memory' };
  }
  memoryJobIds.add(idempotencyKey);
  logger.info('[AmroReconciliationQueue] snapshot queued in memory', {
    idempotencyKey,
    capability: payload.capability,
    tenantId: payload.tenantId,
    franchiseId: payload.franchiseId,
    compatMode: payload.compatMode,
    deltaCount: payload.reconciliation.deltaCount,
  });
  return { queued: true, idempotencyKey, queueMode: 'memory' };
}

export function buildAmroDualWriteIdempotencyKey(entry: AmroDualWriteInput): string {
  return [
    'amro',
    'dual-write',
    entry.capability,
    entry.tenantId || 'tenant-none',
    entry.franchiseId || 'franchise-none',
    entry.entityType,
    entry.entityId || 'entity-none',
    entry.eventType,
  ].join(':');
}

export async function enqueueAmroDualWriteOperation(
  entry: AmroDualWriteInput
): Promise<{ queued: boolean; idempotencyKey: string; queueMode: 'redis' | 'memory' | 'disabled' }> {
  if (!isQueueEnabled()) {
    return {
      queued: false,
      idempotencyKey: buildAmroDualWriteIdempotencyKey(entry),
      queueMode: 'disabled',
    };
  }

  const idempotencyKey = buildAmroDualWriteIdempotencyKey(entry);
  const runtime = await getRuntime();
  if (runtime) {
    const existing = await runtime.queue.getJob(idempotencyKey);
    if (!existing) {
      await runtime.queue.add(
        'amro-dual-write',
        {
          ...entry,
          idempotencyKey,
          createdAt: new Date().toISOString(),
        },
        { jobId: idempotencyKey }
      );
    }
    return { queued: true, idempotencyKey, queueMode: 'redis' };
  }

  if (dualWriteMemoryJobIds.has(idempotencyKey)) {
    return { queued: true, idempotencyKey, queueMode: 'memory' };
  }
  dualWriteMemoryJobIds.add(idempotencyKey);
  logger.info('[AmroReconciliationQueue] dual-write queued in memory', {
    idempotencyKey,
    capability: entry.capability,
    tenantId: entry.tenantId,
    franchiseId: entry.franchiseId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    eventType: entry.eventType,
  });
  return { queued: true, idempotencyKey, queueMode: 'memory' };
}

export function resetAmroReconciliationMemoryQueue() {
  memoryJobIds.clear();
  dualWriteMemoryJobIds.clear();
}

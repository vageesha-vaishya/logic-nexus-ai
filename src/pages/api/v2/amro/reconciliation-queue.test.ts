import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildAmroDualWriteIdempotencyKey,
  buildHistoricalBackfillMetadata,
  buildAmroReconciliationIdempotencyKey,
  drainAmroReconciliationQueueForFallback,
  enqueueAmroDualWriteOperation,
  enqueueAmroReconciliationSnapshot,
  resetAmroReconciliationMemoryQueue,
} from './reconciliation-queue';

describe('AMRO reconciliation queue', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.REDIS_URL;
    resetAmroReconciliationMemoryQueue();
  });

  it('builds stable idempotency keys from snapshot scope', () => {
    const key = buildAmroReconciliationIdempotencyKey({
      capability: 'tasks',
      correlationId: 'corr-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      requestedFilters: { workPackageId: 'WP-001' },
      reconciliation: {
        legacyCount: 1,
        moduleCount: 1,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });

    expect(key).toBe('amro:tasks:tenant-1:fr-1:v2-shadow:corr-1');
  });

  it('builds stable idempotency key for dual-write entities', () => {
    const key = buildAmroDualWriteIdempotencyKey({
      capability: 'compliance-gates',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      correlationId: 'corr-9',
      entityType: 'compliance-gate',
      entityId: 'amro-gate-002',
      eventType: 'amro.compliance.gate_decided.v1',
      action: 'gate-sync',
    });

    expect(key).toBe('amro:dual-write:compliance-gates:tenant-1:fr-1:compliance-gate:amro-gate-002:amro.compliance.gate_decided.v1');
  });

  it('returns disabled mode when queue is disabled by feature flag', async () => {
    process.env.AMRO_RECON_QUEUE_ENABLED = 'false';
    const result = await enqueueAmroReconciliationSnapshot({
      capability: 'work-packages',
      correlationId: 'corr-2',
      tenantId: 'tenant-1',
      franchiseId: null,
      compatMode: 'v2-shadow',
      requestedFilters: {},
      reconciliation: {
        legacyCount: 2,
        moduleCount: 2,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });

    expect(result).toEqual({
      queued: false,
      idempotencyKey: 'amro:work-packages:tenant-1:franchise-none:v2-shadow:corr-2',
      queueMode: 'disabled',
    });
  });

  it('builds historical backfill metadata with hash, batch id, and checkpoint', () => {
    process.env.AMRO_MIGRATION_BATCH_ID = 'batch-20260320-alpha';
    const metadata = buildHistoricalBackfillMetadata({
      capability: 'tasks',
      correlationId: 'corr-11',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      requestedFilters: { workPackageId: 'WP-001' },
      reconciliation: {
        legacyCount: 2,
        moduleCount: 2,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });

    expect(metadata.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.migrationBatchId).toBe('batch-20260320-alpha');
    expect(metadata.replayCheckpoint).toMatch(/^[a-f0-9]{24}$/);
  });

  it('deduplicates memory queue entries with same idempotency key', async () => {
    process.env.AMRO_RECON_QUEUE_ENABLED = 'true';
    const first = await enqueueAmroReconciliationSnapshot({
      capability: 'compliance-gates',
      correlationId: 'corr-3',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      requestedFilters: { decision: 'approved' },
      reconciliation: {
        legacyCount: 3,
        moduleCount: 3,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });
    const second = await enqueueAmroReconciliationSnapshot({
      capability: 'compliance-gates',
      correlationId: 'corr-3',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      requestedFilters: { decision: 'approved' },
      reconciliation: {
        legacyCount: 3,
        moduleCount: 3,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });

    expect(first.queueMode).toBe('memory');
    expect(second.queueMode).toBe('memory');
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.queued).toBe(true);
    expect(second.queued).toBe(true);
  });

  it('deduplicates dual-write operations per entity idempotency key', async () => {
    process.env.AMRO_RECON_QUEUE_ENABLED = 'true';
    const first = await enqueueAmroDualWriteOperation({
      capability: 'tasks',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      correlationId: 'corr-8',
      entityType: 'task',
      entityId: 'amro-task-003',
      eventType: 'amro.task.completed.v1',
      action: 'status-sync',
    });
    const second = await enqueueAmroDualWriteOperation({
      capability: 'tasks',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      correlationId: 'corr-8',
      entityType: 'task',
      entityId: 'amro-task-003',
      eventType: 'amro.task.completed.v1',
      action: 'status-sync',
    });

    expect(first.queueMode).toBe('memory');
    expect(second.queueMode).toBe('memory');
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.queued).toBe(true);
    expect(second.queued).toBe(true);
  });

  it('drains memory queue when legacy fallback mode is activated', async () => {
    process.env.AMRO_RECON_QUEUE_ENABLED = 'true';
    await enqueueAmroReconciliationSnapshot({
      capability: 'tasks',
      correlationId: 'corr-memory-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      requestedFilters: { workPackageId: 'WP-001' },
      reconciliation: {
        legacyCount: 2,
        moduleCount: 2,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });

    const drained = await drainAmroReconciliationQueueForFallback({
      capability: 'tasks',
      correlationId: 'corr-memory-drain',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'legacy-fallback',
    });
    const postDrain = await enqueueAmroReconciliationSnapshot({
      capability: 'tasks',
      correlationId: 'corr-memory-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      compatMode: 'v2-shadow',
      requestedFilters: { workPackageId: 'WP-001' },
      reconciliation: {
        legacyCount: 2,
        moduleCount: 2,
        deltaCount: 0,
        missingInLegacy: [],
        missingInModule: [],
      },
    });

    expect(drained.drained).toBe(true);
    expect(drained.queueMode).toBe('memory');
    expect(drained.snapshotCheckpoint).toMatch(/^[a-f0-9]{24}$/);
    expect(postDrain.queued).toBe(true);
    expect(postDrain.queueMode).toBe('memory');
  });

  it('returns disabled drain mode when queue feature is disabled', async () => {
    process.env.AMRO_RECON_QUEUE_ENABLED = 'false';
    const drained = await drainAmroReconciliationQueueForFallback({
      capability: 'work-packages',
      correlationId: 'corr-drain-disabled',
      tenantId: 'tenant-1',
      franchiseId: null,
      compatMode: 'legacy-fallback',
    });

    expect(drained.drained).toBe(false);
    expect(drained.queueMode).toBe('disabled');
    expect(drained.snapshotCheckpoint).toMatch(/^[a-f0-9]{24}$/);
  });
});

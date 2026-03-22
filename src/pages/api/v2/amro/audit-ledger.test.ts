import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendAmroAuditLedgerRecord,
  replayAmroAuditTamperAlerts,
  replayAmroAuditLedgerRecords,
  resetAmroAuditLedgerStore,
  validateAmroAuditLedgerIntegrity,
} from './audit-ledger';

describe('amro audit ledger', () => {
  beforeEach(() => {
    resetAmroAuditLedgerStore();
  });

  it('appends chain-linked records for tenant-franchise scope', () => {
    const first = appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:approved',
      correlationId: 'corr-1',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'hash-1',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-1',
      context: { mode: 'dual-run' },
    });
    const second = appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:pending',
      correlationId: 'corr-2',
      action: 'module.read',
      compatMode: 'v2-shadow',
      sourceHash: 'hash-2',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-2',
      context: { mode: 'module' },
    });

    expect(first.previousHash).toBeNull();
    expect(second.previousHash).toBe(first.chainHash);
  });

  it('replays records newest-first and applies filters', () => {
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'work-packages',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'work-package',
      entityId: 'decision:all',
      correlationId: 'corr-wp',
      action: 'module.read',
      compatMode: 'v2-shadow',
      sourceHash: 'hash-wp',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-wp',
      context: {},
    });
    const latest = appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:approved',
      correlationId: 'corr-cg',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'hash-cg',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-cg',
      context: {},
    });

    const filtered = replayAmroAuditLedgerRecords({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      limit: 10,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].recordId).toBe(latest.recordId);
  });

  it('records tamper alerts when hash chain is broken', () => {
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'tasks',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'task',
      entityId: 'task-1',
      correlationId: 'corr-a-1',
      action: 'module.write',
      compatMode: 'v2-shadow',
      sourceHash: 'hash-a1',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-a1',
      context: {},
    });
    const second = appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'tasks',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'task',
      entityId: 'task-2',
      correlationId: 'corr-a-2',
      action: 'module.write',
      compatMode: 'v2-shadow',
      sourceHash: 'hash-a2',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-a2',
      context: {},
    });
    const latestRecord = replayAmroAuditLedgerRecords({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'tasks',
      limit: 1,
    })[0];
    latestRecord.previousHash = 'forged-hash';

    const integrity = validateAmroAuditLedgerIntegrity({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'tasks',
    });
    const alerts = replayAmroAuditTamperAlerts({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      limit: 10,
    });

    expect(integrity.valid).toBe(false);
    expect(alerts[0]?.recordId).toBe(second.recordId);
    expect(alerts[0]?.actualPreviousHash).toBe('forged-hash');
  });
});

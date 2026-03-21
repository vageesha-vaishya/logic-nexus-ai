import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendAmroAuditLedgerRecord,
  replayAmroAuditLedgerRecords,
  resetAmroAuditLedgerStore,
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
});

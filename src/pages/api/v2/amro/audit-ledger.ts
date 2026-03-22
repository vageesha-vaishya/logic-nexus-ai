import { createHash, randomUUID } from 'node:crypto';

export type AmroAuditLedgerEventType =
  | 'amro.audit.recorded.v1'
  | 'amro.compliance.gate_decided.v1'
  | 'amro.certification.decision.submitted.v1'
  | 'amro.integration.payload.ingested.v1'
  | 'amro.forecast.risk.scored.v1';
export type AmroAuditLedgerCapability =
  | 'work-packages'
  | 'schedules'
  | 'tasks'
  | 'compliance-gates'
  | 'certification'
  | 'integration-hub'
  | 'forecast-reliability';

export type AmroAuditLedgerRecord = {
  recordId: string;
  tenantId: string;
  franchiseId: string | null;
  domainId: 'amro';
  version: 'v2';
  capability: AmroAuditLedgerCapability;
  eventType: AmroAuditLedgerEventType;
  entityType:
    | 'work-package'
    | 'task'
    | 'compliance-gate'
    | 'certification-action'
    | 'integration-job'
    | 'forecast-assessment';
  entityId: string;
  correlationId: string;
  action: string;
  compatMode: string;
  context: Record<string, unknown>;
  sourceHash: string;
  migrationBatchId: string;
  replayCheckpoint: string;
  previousHash: string | null;
  chainHash: string;
  createdAt: string;
};

type AmroAuditLedgerInput = {
  tenantId: string;
  franchiseId: string | null;
  capability: AmroAuditLedgerCapability;
  eventType: AmroAuditLedgerEventType;
  entityType:
    | 'work-package'
    | 'task'
    | 'compliance-gate'
    | 'certification-action'
    | 'integration-job'
    | 'forecast-assessment';
  entityId: string;
  correlationId: string;
  action: string;
  compatMode: string;
  context: Record<string, unknown>;
  sourceHash: string;
  migrationBatchId: string;
  replayCheckpoint: string;
};

type AmroAuditLedgerReplayFilter = {
  tenantId: string;
  franchiseId: string | null;
  capability?: AmroAuditLedgerCapability;
  limit?: number;
};

export type AmroAuditLedgerTamperAlert = {
  tenantId: string;
  franchiseId: string | null;
  recordId: string;
  expectedPreviousHash: string | null;
  actualPreviousHash: string | null;
  detectedAt: string;
  reason: 'hash_chain_mismatch';
};

const auditLedgerStore = new Map<string, AmroAuditLedgerRecord[]>();
const auditTamperAlerts = new Map<string, AmroAuditLedgerTamperAlert[]>();

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

function tenantScopeKey(tenantId: string, franchiseId: string | null): string {
  return `${tenantId}::${franchiseId || 'franchise-none'}`;
}

export function appendAmroAuditLedgerRecord(input: AmroAuditLedgerInput): AmroAuditLedgerRecord {
  const key = tenantScopeKey(input.tenantId, input.franchiseId);
  const records = auditLedgerStore.get(key) || [];
  const previous = records[records.length - 1] || null;
  const createdAt = new Date().toISOString();
  const chainPayload = toStableJson({
    tenantId: input.tenantId,
    franchiseId: input.franchiseId,
    capability: input.capability,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    action: input.action,
    compatMode: input.compatMode,
    context: input.context,
    sourceHash: input.sourceHash,
    migrationBatchId: input.migrationBatchId,
    replayCheckpoint: input.replayCheckpoint,
    previousHash: previous?.chainHash || null,
    createdAt,
  });
  const chainHash = createHash('sha256').update(chainPayload).digest('hex');
  const record: AmroAuditLedgerRecord = {
    recordId: randomUUID(),
    tenantId: input.tenantId,
    franchiseId: input.franchiseId,
    domainId: 'amro',
    version: 'v2',
    capability: input.capability,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    action: input.action,
    compatMode: input.compatMode,
    context: input.context,
    sourceHash: input.sourceHash,
    migrationBatchId: input.migrationBatchId,
    replayCheckpoint: input.replayCheckpoint,
    previousHash: previous?.chainHash || null,
    chainHash,
    createdAt,
  };
  records.push(record);
  auditLedgerStore.set(key, records);
  return record;
}

export function replayAmroAuditLedgerRecords(filter: AmroAuditLedgerReplayFilter): AmroAuditLedgerRecord[] {
  const key = tenantScopeKey(filter.tenantId, filter.franchiseId);
  const records = auditLedgerStore.get(key) || [];
  const capabilityFiltered = filter.capability
    ? records.filter((record) => record.capability === filter.capability)
    : records;
  const limit = Math.max(1, Math.min(Number(filter.limit || 100), 500));
  return capabilityFiltered.slice(-limit).reverse();
}

export function validateAmroAuditLedgerIntegrity(filter: {
  tenantId: string;
  franchiseId: string | null;
  capability?: AmroAuditLedgerCapability;
}) {
  const key = tenantScopeKey(filter.tenantId, filter.franchiseId);
  const records = auditLedgerStore.get(key) || [];
  const alerts: AmroAuditLedgerTamperAlert[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const previous = records[index - 1] || null;
    const expectedPreviousHash = previous?.chainHash || null;
    if ((record?.previousHash || null) !== expectedPreviousHash) {
      if (filter.capability && record.capability !== filter.capability) {
        continue;
      }
      alerts.push({
        tenantId: record.tenantId,
        franchiseId: record.franchiseId,
        recordId: record.recordId,
        expectedPreviousHash,
        actualPreviousHash: record.previousHash,
        detectedAt: new Date().toISOString(),
        reason: 'hash_chain_mismatch',
      });
    }
  }
  if (alerts.length > 0) {
    const existing = auditTamperAlerts.get(key) || [];
    const dedupe = new Set(existing.map((entry) => `${entry.recordId}:${entry.expectedPreviousHash || ''}:${entry.actualPreviousHash || ''}`));
    for (const alert of alerts) {
      const alertKey = `${alert.recordId}:${alert.expectedPreviousHash || ''}:${alert.actualPreviousHash || ''}`;
      if (!dedupe.has(alertKey)) {
        dedupe.add(alertKey);
        existing.push(alert);
      }
    }
    auditTamperAlerts.set(key, existing);
  }
  return {
    valid: alerts.length === 0,
    alerts,
  };
}

export function replayAmroAuditTamperAlerts(filter: {
  tenantId: string;
  franchiseId: string | null;
  limit?: number;
}) {
  const key = tenantScopeKey(filter.tenantId, filter.franchiseId);
  const alerts = auditTamperAlerts.get(key) || [];
  const limit = Math.max(1, Math.min(Number(filter.limit || 100), 500));
  return alerts.slice(-limit).reverse();
}

export function resetAmroAuditLedgerStore() {
  auditLedgerStore.clear();
  auditTamperAlerts.clear();
}

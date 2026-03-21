import { createHash } from 'node:crypto';

export type ProjectionPipelineState = {
  moduleKey: string;
  projectionKey: string;
  lagMs: number;
  status: 'healthy' | 'degraded' | 'disabled';
  lastEventAt: string;
  lastUpdatedAt: string;
};

export type CacheInvalidationContract = {
  moduleKey: string;
  projectionKey: string;
  cacheNamespace: string;
  keyVersion: number;
  allowedKeyPrefixes: string[];
  invalidateOnEvents: string[];
  updatedAt: string;
};

export type StalenessBudget = {
  moduleKey: string;
  projectionKey: string;
  maxLagMs: number;
  maxReadLatencyMs: number;
  updatedAt: string;
};

export type ProjectionRollbackProfile = {
  disableStaleProjections: boolean;
  reason: string;
  updatedAt: string;
};

export type ProjectionReadDecision = {
  mode: 'projection_cache' | 'authoritative_read';
  reason:
    | 'projection_healthy'
    | 'projection_stale'
    | 'projection_disabled'
    | 'rollback_profile'
    | 'cache_key_mismatch';
  lagMs: number;
  readLatencyMs: number;
  cacheKey: string;
};

type CacheRecord = {
  cacheKey: string;
  valueChecksum: string;
  expiresAt: string;
  createdAt: string;
};

const pipelineStore = new Map<string, ProjectionPipelineState>();
const contractStore = new Map<string, CacheInvalidationContract>();
const budgetStore = new Map<string, StalenessBudget>();
const latencySamples = new Map<string, number[]>();
const cacheStore = new Map<string, CacheRecord>();

let rollbackProfile: ProjectionRollbackProfile = {
  disableStaleProjections: true,
  reason: '',
  updatedAt: new Date().toISOString(),
};

const defaultPipelines: Array<Omit<ProjectionPipelineState, 'lastUpdatedAt'>> = [
  { moduleKey: 'module-crm', projectionKey: 'pipeline-board', lagMs: 1200, status: 'healthy', lastEventAt: new Date().toISOString() },
  { moduleKey: 'module-logistics', projectionKey: 'shipment-tracker', lagMs: 1700, status: 'healthy', lastEventAt: new Date().toISOString() },
  { moduleKey: 'module-quotation', projectionKey: 'quote-search', lagMs: 900, status: 'healthy', lastEventAt: new Date().toISOString() },
];

const defaultBudgets: Array<Omit<StalenessBudget, 'updatedAt'>> = [
  { moduleKey: 'module-crm', projectionKey: 'pipeline-board', maxLagMs: 5000, maxReadLatencyMs: 250 },
  { moduleKey: 'module-logistics', projectionKey: 'shipment-tracker', maxLagMs: 5000, maxReadLatencyMs: 300 },
  { moduleKey: 'module-quotation', projectionKey: 'quote-search', maxLagMs: 5000, maxReadLatencyMs: 200 },
];

function key(moduleKey: string, projectionKey: string): string {
  return `${moduleKey}|${projectionKey}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedPrefixes(prefixes: string[]): string[] {
  return Array.from(new Set((prefixes || []).map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizedEvents(events: string[]): string[] {
  return Array.from(new Set((events || []).map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function clampLag(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 600000) return 600000;
  return Math.floor(value);
}

function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index];
}

export function upsertProjectionPipelineState(input: {
  moduleKey: string;
  projectionKey: string;
  lagMs?: number;
  status?: ProjectionPipelineState['status'];
  lastEventAt?: string;
}): ProjectionPipelineState {
  const moduleKey = String(input.moduleKey || '').trim();
  const projectionKey = String(input.projectionKey || '').trim();
  if (!moduleKey || !projectionKey) throw new Error('Missing moduleKey or projectionKey');
  const existing = pipelineStore.get(key(moduleKey, projectionKey));
  const next: ProjectionPipelineState = {
    moduleKey,
    projectionKey,
    lagMs: clampLag(Number(input.lagMs ?? existing?.lagMs ?? 0)),
    status: input.status || existing?.status || 'healthy',
    lastEventAt: String(input.lastEventAt || existing?.lastEventAt || nowIso()),
    lastUpdatedAt: nowIso(),
  };
  pipelineStore.set(key(moduleKey, projectionKey), next);
  return { ...next };
}

export function upsertCacheInvalidationContract(input: {
  moduleKey: string;
  projectionKey: string;
  cacheNamespace: string;
  keyVersion: number;
  allowedKeyPrefixes: string[];
  invalidateOnEvents: string[];
}): CacheInvalidationContract {
  const moduleKey = String(input.moduleKey || '').trim();
  const projectionKey = String(input.projectionKey || '').trim();
  if (!moduleKey || !projectionKey) throw new Error('Missing moduleKey or projectionKey');
  const next: CacheInvalidationContract = {
    moduleKey,
    projectionKey,
    cacheNamespace: String(input.cacheNamespace || '').trim(),
    keyVersion: Math.max(1, Math.floor(Number(input.keyVersion || 1))),
    allowedKeyPrefixes: normalizedPrefixes(input.allowedKeyPrefixes),
    invalidateOnEvents: normalizedEvents(input.invalidateOnEvents),
    updatedAt: nowIso(),
  };
  contractStore.set(key(moduleKey, projectionKey), next);
  return { ...next };
}

export function upsertStalenessBudget(input: {
  moduleKey: string;
  projectionKey: string;
  maxLagMs: number;
  maxReadLatencyMs: number;
}): StalenessBudget {
  const moduleKey = String(input.moduleKey || '').trim();
  const projectionKey = String(input.projectionKey || '').trim();
  if (!moduleKey || !projectionKey) throw new Error('Missing moduleKey or projectionKey');
  const next: StalenessBudget = {
    moduleKey,
    projectionKey,
    maxLagMs: Math.max(100, Math.min(600000, Math.floor(Number(input.maxLagMs || 5000)))),
    maxReadLatencyMs: Math.max(10, Math.min(5000, Math.floor(Number(input.maxReadLatencyMs || 250)))),
    updatedAt: nowIso(),
  };
  budgetStore.set(key(moduleKey, projectionKey), next);
  return { ...next };
}

export function setProjectionRollbackProfile(patch: Partial<ProjectionRollbackProfile>): ProjectionRollbackProfile {
  rollbackProfile = {
    disableStaleProjections: patch.disableStaleProjections ?? rollbackProfile.disableStaleProjections,
    reason: patch.reason !== undefined ? String(patch.reason || '') : rollbackProfile.reason,
    updatedAt: nowIso(),
  };
  return { ...rollbackProfile };
}

export function getProjectionRollbackProfile(): ProjectionRollbackProfile {
  return { ...rollbackProfile };
}

function contractCacheKey(contract: CacheInvalidationContract, prefix: string, entityKey: string): string {
  return `${contract.cacheNamespace}:v${contract.keyVersion}:${prefix}:${entityKey}`;
}

function validateCachePrefix(contract: CacheInvalidationContract, prefix: string): boolean {
  return contract.allowedKeyPrefixes.includes(prefix);
}

export function putProjectionCache(input: {
  moduleKey: string;
  projectionKey: string;
  keyPrefix: string;
  entityKey: string;
  valueChecksum: string;
  ttlSeconds?: number;
}): CacheRecord {
  const contract = contractStore.get(key(input.moduleKey, input.projectionKey));
  if (!contract) throw new Error('Missing cache invalidation contract');
  if (!validateCachePrefix(contract, input.keyPrefix)) throw new Error('cache key prefix not allowed');
  const cacheKey = contractCacheKey(contract, input.keyPrefix, String(input.entityKey || '').trim());
  const ttlSeconds = Math.max(1, Math.min(86400, Math.floor(Number(input.ttlSeconds || 120))));
  const record: CacheRecord = {
    cacheKey,
    valueChecksum: String(input.valueChecksum || '').trim(),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
  cacheStore.set(cacheKey, record);
  return { ...record };
}

export function invalidateProjectionCache(input: {
  moduleKey: string;
  projectionKey: string;
  eventName: string;
}): { invalidated: number; eventMatched: boolean } {
  const contract = contractStore.get(key(input.moduleKey, input.projectionKey));
  if (!contract) return { invalidated: 0, eventMatched: false };
  const eventMatched = contract.invalidateOnEvents.includes(String(input.eventName || '').trim());
  if (!eventMatched) return { invalidated: 0, eventMatched: false };
  const namespacePrefix = `${contract.cacheNamespace}:v${contract.keyVersion}:`;
  let invalidated = 0;
  for (const cacheKey of Array.from(cacheStore.keys())) {
    if (cacheKey.startsWith(namespacePrefix)) {
      cacheStore.delete(cacheKey);
      invalidated += 1;
    }
  }
  return { invalidated, eventMatched: true };
}

export function evaluateProjectionRead(input: {
  moduleKey: string;
  projectionKey: string;
  keyPrefix: string;
  entityKey: string;
  observedReadLatencyMs?: number;
}): ProjectionReadDecision {
  const moduleKey = String(input.moduleKey || '').trim();
  const projectionKey = String(input.projectionKey || '').trim();
  const pipeline = pipelineStore.get(key(moduleKey, projectionKey));
  const budget = budgetStore.get(key(moduleKey, projectionKey));
  const contract = contractStore.get(key(moduleKey, projectionKey));
  if (!pipeline || !budget || !contract) throw new Error('Projection governance is incomplete for requested projection');
  const readLatencyMs = Math.max(0, Math.floor(Number(input.observedReadLatencyMs || 0)));
  const latencyKey = key(moduleKey, projectionKey);
  const samples = latencySamples.get(latencyKey) || [];
  samples.push(readLatencyMs);
  while (samples.length > 200) samples.shift();
  latencySamples.set(latencyKey, samples);
  if (!validateCachePrefix(contract, input.keyPrefix)) {
    return {
      mode: 'authoritative_read',
      reason: 'cache_key_mismatch',
      lagMs: pipeline.lagMs,
      readLatencyMs,
      cacheKey: '',
    };
  }
  const cacheKey = contractCacheKey(contract, input.keyPrefix, String(input.entityKey || '').trim());
  const cacheRecord = cacheStore.get(cacheKey);
  const staleByLag = pipeline.lagMs > budget.maxLagMs;
  const staleByLatency = readLatencyMs > budget.maxReadLatencyMs;
  if (rollbackProfile.disableStaleProjections && (staleByLag || staleByLatency)) {
    return {
      mode: 'authoritative_read',
      reason: 'rollback_profile',
      lagMs: pipeline.lagMs,
      readLatencyMs,
      cacheKey,
    };
  }
  if (pipeline.status === 'disabled') {
    return {
      mode: 'authoritative_read',
      reason: 'projection_disabled',
      lagMs: pipeline.lagMs,
      readLatencyMs,
      cacheKey,
    };
  }
  if (staleByLag || staleByLatency || !cacheRecord || Date.parse(cacheRecord.expiresAt) <= Date.now()) {
    return {
      mode: 'authoritative_read',
      reason: 'projection_stale',
      lagMs: pipeline.lagMs,
      readLatencyMs,
      cacheKey,
    };
  }
  return {
    mode: 'projection_cache',
    reason: 'projection_healthy',
    lagMs: pipeline.lagMs,
    readLatencyMs,
    cacheKey,
  };
}

export function listProjectionPipelines(): ProjectionPipelineState[] {
  return Array.from(pipelineStore.values())
    .sort((a, b) => key(a.moduleKey, a.projectionKey).localeCompare(key(b.moduleKey, b.projectionKey)))
    .map((entry) => ({ ...entry }));
}

export function listCacheInvalidationContracts(): CacheInvalidationContract[] {
  return Array.from(contractStore.values())
    .sort((a, b) => key(a.moduleKey, a.projectionKey).localeCompare(key(b.moduleKey, b.projectionKey)))
    .map((entry) => ({ ...entry }));
}

export function listStalenessBudgets(): StalenessBudget[] {
  return Array.from(budgetStore.values())
    .sort((a, b) => key(a.moduleKey, a.projectionKey).localeCompare(key(b.moduleKey, b.projectionKey)))
    .map((entry) => ({ ...entry }));
}

export function getProjectionCachingStatus() {
  const pipelines = listProjectionPipelines();
  const maxLagMs = pipelines.length ? Math.max(...pipelines.map((pipeline) => pipeline.lagMs)) : 0;
  const latency = Array.from(latencySamples.values()).flat();
  const p95ReadLatencyMs = p95(latency);
  return {
    pipelineCount: pipelines.length,
    contractCount: contractStore.size,
    budgetCount: budgetStore.size,
    maxLagMs,
    p95ReadLatencyMs,
    projectionLagWithinSlo: maxLagMs <= 5000,
    readLatencyWithinSlo: p95ReadLatencyMs <= 300,
    rollbackProfile: getProjectionRollbackProfile(),
  };
}

export function resetProjectionCachingStrategyState(): void {
  pipelineStore.clear();
  contractStore.clear();
  budgetStore.clear();
  latencySamples.clear();
  cacheStore.clear();
  rollbackProfile = {
    disableStaleProjections: true,
    reason: '',
    updatedAt: nowIso(),
  };
  for (const pipeline of defaultPipelines) {
    upsertProjectionPipelineState(pipeline);
    upsertCacheInvalidationContract({
      moduleKey: pipeline.moduleKey,
      projectionKey: pipeline.projectionKey,
      cacheNamespace: `${pipeline.moduleKey.replace(/^module-/, '')}:${pipeline.projectionKey}`,
      keyVersion: 1,
      allowedKeyPrefixes: ['tenant', 'franchise'],
      invalidateOnEvents: [`${pipeline.projectionKey}.updated`],
    });
  }
  for (const budget of defaultBudgets) {
    upsertStalenessBudget(budget);
  }
}

resetProjectionCachingStrategyState();

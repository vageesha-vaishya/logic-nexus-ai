import { createHash, randomUUID } from 'node:crypto';

export type ModuleDatastoreBoundary = {
  moduleKey: string;
  schemaName: string;
  ownedWriteTables: string[];
  compatibilityReadViews: string[];
  enforceOwnedWrites: boolean;
  updatedAt: string;
};

export type WritePathPolicy = {
  moduleKey: string;
  hardened: boolean;
  allowedActors: string[];
  blockedCrossModuleTables: string[];
  updatedAt: string;
};

export type CompatibilityFallbackProfile = {
  enabled: boolean;
  reason: string;
  strictAuditLogging: boolean;
  modules: string[];
  updatedAt: string;
};

export type ReadFreshnessIndicator = {
  moduleKey: string;
  authoritativeAt: string;
  projectionAt: string;
  lagMs: number;
};

export type ReplayArtifact = {
  replayId: string;
  moduleKey: string;
  viewName: string;
  requestedAt: string;
  baselineChecksum: string;
  replayChecksum: string;
};

export type WriteEnforcementDecision = {
  allowed: boolean;
  reason: 'owned_table' | 'cross_module_blocked' | 'unknown_module' | 'write_path_not_hardened';
  moduleKey: string;
  tableName: string;
  actor: string;
};

type CompatibilityViewEntry = {
  moduleKey: string;
  viewName: string;
  sourceTable: string;
  freshnessAt: string;
  freshnessLagMs: number;
};

type ControlledReadDecision = {
  mode: 'authoritative' | 'compatibility_view';
  reason: 'fresh_authoritative' | 'fallback_profile' | 'stale_authoritative';
  freshness: ReadFreshnessIndicator;
  replayRequired: boolean;
};

const boundaryStore = new Map<string, ModuleDatastoreBoundary>();
const writePolicyStore = new Map<string, WritePathPolicy>();
const compatibilityViewStore = new Map<string, CompatibilityViewEntry>();
const replayStore: ReplayArtifact[] = [];

let fallbackProfile: CompatibilityFallbackProfile = {
  enabled: false,
  reason: '',
  strictAuditLogging: true,
  modules: [],
  updatedAt: new Date().toISOString(),
};

const defaultBoundaries: Array<Omit<ModuleDatastoreBoundary, 'updatedAt'>> = [
  {
    moduleKey: 'module-crm',
    schemaName: 'crm',
    ownedWriteTables: ['crm_leads', 'crm_accounts', 'crm_contacts', 'crm_opportunities'],
    compatibilityReadViews: ['compat.crm_leads_vw', 'compat.crm_opportunities_vw'],
    enforceOwnedWrites: true,
  },
  {
    moduleKey: 'module-logistics',
    schemaName: 'logistics',
    ownedWriteTables: ['logistics_shipments', 'logistics_legs', 'logistics_tracking_events'],
    compatibilityReadViews: ['compat.logistics_shipments_vw'],
    enforceOwnedWrites: true,
  },
  {
    moduleKey: 'module-quotation',
    schemaName: 'quotation',
    ownedWriteTables: ['quotation_quotes', 'quotation_quote_items'],
    compatibilityReadViews: ['compat.quotation_quotes_vw'],
    enforceOwnedWrites: true,
  },
  {
    moduleKey: 'module-finance',
    schemaName: 'finance',
    ownedWriteTables: ['finance_invoices', 'finance_ledger_entries'],
    compatibilityReadViews: ['compat.finance_invoices_vw'],
    enforceOwnedWrites: true,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeList(values: string[]): string[] {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function replayChecksum(moduleKey: string, viewName: string, freshnessAt: string): string {
  return hash([moduleKey, viewName, freshnessAt].join('|'));
}

export function upsertModuleDatastoreBoundary(input: {
  moduleKey: string;
  schemaName?: string;
  ownedWriteTables?: string[];
  compatibilityReadViews?: string[];
  enforceOwnedWrites?: boolean;
}): ModuleDatastoreBoundary {
  const moduleKey = String(input.moduleKey || '').trim();
  if (!moduleKey) throw new Error('Missing moduleKey');
  const existing = boundaryStore.get(moduleKey);
  const next: ModuleDatastoreBoundary = {
    moduleKey,
    schemaName: String(input.schemaName || existing?.schemaName || moduleKey.replace(/^module-/, '')).trim(),
    ownedWriteTables: normalizeList(input.ownedWriteTables || existing?.ownedWriteTables || []),
    compatibilityReadViews: normalizeList(input.compatibilityReadViews || existing?.compatibilityReadViews || []),
    enforceOwnedWrites: input.enforceOwnedWrites ?? existing?.enforceOwnedWrites ?? true,
    updatedAt: nowIso(),
  };
  boundaryStore.set(moduleKey, next);
  return { ...next };
}

export function hardenModuleWritePath(input: {
  moduleKey: string;
  hardened?: boolean;
  allowedActors?: string[];
  blockedCrossModuleTables?: string[];
}): WritePathPolicy {
  const moduleKey = String(input.moduleKey || '').trim();
  if (!moduleKey) throw new Error('Missing moduleKey');
  const existing = writePolicyStore.get(moduleKey);
  const next: WritePathPolicy = {
    moduleKey,
    hardened: input.hardened ?? existing?.hardened ?? true,
    allowedActors: normalizeList(input.allowedActors || existing?.allowedActors || [`${moduleKey}-service`]),
    blockedCrossModuleTables: normalizeList(input.blockedCrossModuleTables || existing?.blockedCrossModuleTables || ['*']),
    updatedAt: nowIso(),
  };
  writePolicyStore.set(moduleKey, next);
  return { ...next };
}

export function registerCompatibilityView(input: {
  moduleKey: string;
  viewName: string;
  sourceTable: string;
  freshnessAt?: string;
  freshnessLagMs?: number;
}): CompatibilityViewEntry {
  const moduleKey = String(input.moduleKey || '').trim();
  const viewName = String(input.viewName || '').trim();
  if (!moduleKey || !viewName) throw new Error('Missing moduleKey or viewName');
  const entry: CompatibilityViewEntry = {
    moduleKey,
    viewName,
    sourceTable: String(input.sourceTable || '').trim(),
    freshnessAt: String(input.freshnessAt || nowIso()),
    freshnessLagMs: Math.max(0, Math.floor(Number(input.freshnessLagMs || 0))),
  };
  compatibilityViewStore.set(`${moduleKey}|${viewName}`, entry);
  return { ...entry };
}

export function setDatastoreFallbackProfile(patch: Partial<Omit<CompatibilityFallbackProfile, 'updatedAt'>>): CompatibilityFallbackProfile {
  fallbackProfile = {
    enabled: patch.enabled ?? fallbackProfile.enabled,
    reason: patch.reason !== undefined ? String(patch.reason || '') : fallbackProfile.reason,
    strictAuditLogging: patch.strictAuditLogging ?? fallbackProfile.strictAuditLogging,
    modules: patch.modules ? normalizeList(patch.modules) : fallbackProfile.modules,
    updatedAt: nowIso(),
  };
  return { ...fallbackProfile };
}

export function getDatastoreFallbackProfile(): CompatibilityFallbackProfile {
  return { ...fallbackProfile };
}

export function enforceModuleWriteBoundary(input: {
  moduleKey: string;
  tableName: string;
  actor: string;
}): WriteEnforcementDecision {
  const moduleKey = String(input.moduleKey || '').trim();
  const tableName = String(input.tableName || '').trim();
  const actor = String(input.actor || '').trim();
  const boundary = boundaryStore.get(moduleKey);
  const policy = writePolicyStore.get(moduleKey);
  if (!boundary) {
    return { allowed: false, reason: 'unknown_module', moduleKey, tableName, actor };
  }
  if (!policy?.hardened) {
    return { allowed: false, reason: 'write_path_not_hardened', moduleKey, tableName, actor };
  }
  if (!boundary.ownedWriteTables.includes(tableName)) {
    return { allowed: false, reason: 'cross_module_blocked', moduleKey, tableName, actor };
  }
  return { allowed: true, reason: 'owned_table', moduleKey, tableName, actor };
}

function latestFreshness(moduleKey: string): ReadFreshnessIndicator {
  const candidates = Array.from(compatibilityViewStore.values())
    .filter((entry) => entry.moduleKey === moduleKey)
    .sort((a, b) => b.freshnessAt.localeCompare(a.freshnessAt));
  const latest = candidates[0];
  const projectionAt = latest?.freshnessAt || nowIso();
  const lagMs = latest?.freshnessLagMs || 0;
  const authoritativeAt = new Date(Date.parse(projectionAt) - lagMs).toISOString();
  return {
    moduleKey,
    authoritativeAt,
    projectionAt,
    lagMs,
  };
}

export function evaluateControlledReadPath(input: {
  moduleKey: string;
  maxAuthoritativeLagMs?: number;
}): ControlledReadDecision {
  const moduleKey = String(input.moduleKey || '').trim();
  const freshness = latestFreshness(moduleKey);
  const maxLag = Math.max(0, Math.floor(Number(input.maxAuthoritativeLagMs || 2000)));
  const moduleFallback = fallbackProfile.enabled && (fallbackProfile.modules.length === 0 || fallbackProfile.modules.includes(moduleKey));
  if (moduleFallback) {
    return {
      mode: 'compatibility_view',
      reason: 'fallback_profile',
      freshness,
      replayRequired: fallbackProfile.strictAuditLogging,
    };
  }
  if (freshness.lagMs > maxLag) {
    return {
      mode: 'compatibility_view',
      reason: 'stale_authoritative',
      freshness,
      replayRequired: true,
    };
  }
  return {
    mode: 'authoritative',
    reason: 'fresh_authoritative',
    freshness,
    replayRequired: false,
  };
}

export function createDatastoreReplayArtifact(input: {
  moduleKey: string;
  viewName: string;
}): ReplayArtifact {
  const moduleKey = String(input.moduleKey || '').trim();
  const viewName = String(input.viewName || '').trim();
  const view = compatibilityViewStore.get(`${moduleKey}|${viewName}`);
  const freshnessAt = view?.freshnessAt || nowIso();
  const baselineChecksum = replayChecksum(moduleKey, viewName, freshnessAt);
  const artifact: ReplayArtifact = {
    replayId: randomUUID(),
    moduleKey,
    viewName,
    requestedAt: nowIso(),
    baselineChecksum,
    replayChecksum: hash(`${baselineChecksum}|${Date.now()}`),
  };
  replayStore.unshift(artifact);
  if (replayStore.length > 500) replayStore.length = 500;
  return { ...artifact };
}

export function listDatastoreBoundaries(): ModuleDatastoreBoundary[] {
  return Array.from(boundaryStore.values())
    .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey))
    .map((entry) => ({ ...entry }));
}

export function listWritePathPolicies(): WritePathPolicy[] {
  return Array.from(writePolicyStore.values())
    .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey))
    .map((entry) => ({ ...entry }));
}

export function listCompatibilityViews(moduleKey?: string): CompatibilityViewEntry[] {
  return Array.from(compatibilityViewStore.values())
    .filter((entry) => !moduleKey || entry.moduleKey === moduleKey)
    .sort((a, b) => `${a.moduleKey}|${a.viewName}`.localeCompare(`${b.moduleKey}|${b.viewName}`))
    .map((entry) => ({ ...entry }));
}

export function listReplayArtifacts(limit = 100): ReplayArtifact[] {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit || 100))));
  return replayStore.slice(0, safeLimit).map((entry) => ({ ...entry }));
}

export function getDatastoreCutoverStatus() {
  const boundaries = listDatastoreBoundaries();
  const writePolicies = listWritePathPolicies();
  const modulesFullyHardened = boundaries.filter((boundary) => {
    const policy = writePolicies.find((item) => item.moduleKey === boundary.moduleKey);
    return boundary.enforceOwnedWrites && Boolean(policy?.hardened);
  }).length;
  const totalModules = boundaries.length;
  return {
    totalModules,
    modulesFullyHardened,
    writeBoundaryEnforced: totalModules > 0 && modulesFullyHardened === totalModules,
    compatibilityViewCount: compatibilityViewStore.size,
    fallbackProfile: getDatastoreFallbackProfile(),
  };
}

export function resetModuleDatastoreCutoverState(): void {
  boundaryStore.clear();
  writePolicyStore.clear();
  compatibilityViewStore.clear();
  replayStore.length = 0;
  fallbackProfile = {
    enabled: false,
    reason: '',
    strictAuditLogging: true,
    modules: [],
    updatedAt: nowIso(),
  };
  for (const boundary of defaultBoundaries) {
    upsertModuleDatastoreBoundary(boundary);
    hardenModuleWritePath({
      moduleKey: boundary.moduleKey,
      hardened: true,
      allowedActors: [`${boundary.moduleKey}-service`],
      blockedCrossModuleTables: ['*'],
    });
    for (const viewName of boundary.compatibilityReadViews) {
      registerCompatibilityView({
        moduleKey: boundary.moduleKey,
        viewName,
        sourceTable: boundary.ownedWriteTables[0] || `${boundary.schemaName}.events`,
        freshnessAt: nowIso(),
        freshnessLagMs: 0,
      });
    }
  }
}

resetModuleDatastoreCutoverState();

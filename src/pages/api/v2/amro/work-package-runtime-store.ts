type WorkPackageStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

type WorkPackageScope = {
  tenantId: string;
  franchiseId: string | null;
};

export type RuntimeWorkPackageRecord = {
  id: string;
  code: string;
  title: string;
  status: WorkPackageStatus;
  maintenance_type: string;
  priority: string;
  aircraft_id: string;
  planned_start: string;
  planned_end: string;
  station: string;
  scope_items: string[];
  tenant_id: string;
  franchise_id: string | null;
  version: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

type RuntimeScopeStore = {
  records: Map<string, RuntimeWorkPackageRecord>;
  deletedIds: Set<string>;
};

const WORK_PACKAGE_RUNTIME_STATE = new Map<string, RuntimeScopeStore>();

function buildScopeKey(scope: WorkPackageScope): string {
  return `${scope.tenantId}::${scope.franchiseId || 'franchise-none'}`;
}

function ensureScopeStore(scope: WorkPackageScope): RuntimeScopeStore {
  const key = buildScopeKey(scope);
  const existing = WORK_PACKAGE_RUNTIME_STATE.get(key);
  if (existing) {
    return existing;
  }
  const created: RuntimeScopeStore = {
    records: new Map<string, RuntimeWorkPackageRecord>(),
    deletedIds: new Set<string>(),
  };
  WORK_PACKAGE_RUNTIME_STATE.set(key, created);
  return created;
}

export function listRuntimeWorkPackages(scope: WorkPackageScope): RuntimeWorkPackageRecord[] {
  const store = ensureScopeStore(scope);
  return Array.from(store.records.values()).sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function getRuntimeWorkPackage(scope: WorkPackageScope, id: string): RuntimeWorkPackageRecord | null {
  const store = ensureScopeStore(scope);
  return store.records.get(id) || null;
}

export function upsertRuntimeWorkPackage(record: RuntimeWorkPackageRecord): RuntimeWorkPackageRecord {
  const scope = { tenantId: record.tenant_id, franchiseId: record.franchise_id };
  const store = ensureScopeStore(scope);
  store.deletedIds.delete(record.id);
  store.records.set(record.id, {
    ...record,
    scope_items: Array.isArray(record.scope_items) ? [...record.scope_items] : [],
  });
  return store.records.get(record.id) as RuntimeWorkPackageRecord;
}

export function patchRuntimeWorkPackage(
  scope: WorkPackageScope,
  id: string,
  patch: Partial<Pick<RuntimeWorkPackageRecord, 'title' | 'priority' | 'maintenance_type' | 'planned_start' | 'planned_end' | 'status'>>,
  actorUserId: string,
): RuntimeWorkPackageRecord | null {
  const store = ensureScopeStore(scope);
  const existing = store.records.get(id);
  if (!existing) {
    return null;
  }
  const now = new Date().toISOString();
  const next: RuntimeWorkPackageRecord = {
    ...existing,
    ...patch,
    version: existing.version + 1,
    updated_at: now,
    updated_by: actorUserId,
  };
  store.records.set(id, next);
  return next;
}

export function transitionRuntimeWorkPackage(
  scope: WorkPackageScope,
  id: string,
  nextStatus: WorkPackageStatus,
  actorUserId: string,
): RuntimeWorkPackageRecord | null {
  return patchRuntimeWorkPackage(scope, id, { status: nextStatus }, actorUserId);
}

export function markRuntimeWorkPackageDeleted(scope: WorkPackageScope, id: string): void {
  const store = ensureScopeStore(scope);
  store.records.delete(id);
  store.deletedIds.add(id);
}

export function isRuntimeWorkPackageDeleted(scope: WorkPackageScope, id: string): boolean {
  const store = ensureScopeStore(scope);
  return store.deletedIds.has(id);
}

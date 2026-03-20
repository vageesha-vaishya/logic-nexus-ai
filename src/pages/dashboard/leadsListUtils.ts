import type { LeadApiFallbackReason } from '@/services/pipeline-service';

export type LeadsListUrlState = {
  searchQuery: string;
  statusFilter: string;
  ownerFilter: string;
  page: number;
};

export type LeadsImportExportState = {
  viewMode: string;
  searchQuery: string;
  statusFilter: string;
  scoreMin: string;
  scoreMax: string;
  createdStart: string;
  createdEnd: string;
  groupBy: string;
};

export type WorkspaceDetailsGroupBy = 'none' | 'owner' | 'status' | 'created_day' | 'created_week' | 'created_month' | 'source' | `custom:${string}`;
export type LeadFilterTextOp = 'contains' | 'equals' | 'startsWith' | 'endsWith';
export type LeadsFilterPlan = {
  eq: Array<{ column: string; value: string }>;
  ilike: Array<{ column: string; value: string }>;
  gte: Array<{ column: string; value: number | string }>;
  lte: Array<{ column: string; value: number | string }>;
  isNull: string[];
  or: string[];
};

export type LeadsWorkspaceFilterState = {
  statusFilter: string;
  ownerFilter: string;
  searchQuery: string;
  nameQuery: string;
  nameOp: LeadFilterTextOp;
  companyQuery: string;
  companyOp: LeadFilterTextOp;
  emailQuery: string;
  emailOp: LeadFilterTextOp;
  phoneQuery: string;
  phoneOp: LeadFilterTextOp;
  sourceQuery: string;
  sourceOp: LeadFilterTextOp;
  qualificationQuery: string;
  qualificationOp: LeadFilterTextOp;
  scoreFilter: string;
  scoreMin: string;
  scoreMax: string;
  valueMin: string;
  valueMax: string;
  createdStart: string;
  createdEnd: string;
  userId?: string | null;
};

type GroupableLead = {
  id: string;
  owner_id?: string | null;
  status?: string | null;
  source?: string | null;
  created_at?: string | null;
  custom_fields?: unknown;
};

export const LEGACY_ALL_STATUSES_VALUE = 'allStatuses';
export const NORMALIZED_ALL_STATUS_VALUE = 'all';
export const LEADS_FILTER_MIGRATION_KEY = 'leads.filters.migration.v1';

export type LeadsFallbackBannerCopy = {
  key: string;
};

export type CrmFallbackReason = LeadApiFallbackReason | 'relations_query_failed' | 'compatibility_mode';

export type CrmFallbackModule = 'leads' | 'quotes' | 'opportunities' | 'accounts' | 'contacts' | 'activities';

export type CrmFallbackBannerCopy = {
  key: string;
};

export function resolveCrmFallbackBannerCopy(
  module: CrmFallbackModule,
  reason: CrmFallbackReason | null | undefined
): CrmFallbackBannerCopy {
  if (reason === 'relations_query_failed') {
    return {
      key: `${module}.messages.relationsFallback`,
    };
  }
  if (reason === 'compatibility_mode') {
    return {
      key: `${module}.messages.compatibilityModeFallback`,
    };
  }
  if (!reason) {
    return {
      key: `${module}.messages.apiUnavailableFallback`,
    };
  }
  if (reason === 'api_unauthorized') {
    return {
      key: `${module}.messages.apiUnauthorizedFallback`,
    };
  }
  if (reason === 'forbidden_scope') {
    return {
      key: `${module}.messages.apiForbiddenScopeFallback`,
    };
  }
  if (reason === 'api_unreachable') {
    return {
      key: `${module}.messages.apiNetworkFallback`,
    };
  }
  if (reason === 'api_5xx') {
    return {
      key: `${module}.messages.apiServerFallback`,
    };
  }
  if (reason === 'missing_token') {
    return {
      key: `${module}.messages.apiMissingTokenFallback`,
    };
  }
  if (reason === 'missing_scope') {
    return {
      key: `${module}.messages.apiMissingScopeFallback`,
    };
  }
  return {
    key: `${module}.messages.apiUnavailableFallback`,
  };
}

export function resolveLeadsFallbackBannerCopy(reason: LeadApiFallbackReason | null | undefined): LeadsFallbackBannerCopy {
  return resolveCrmFallbackBannerCopy('leads', reason);
}

function escapeOrFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toLikePattern(value: string, op: LeadFilterTextOp): string {
  const escaped = escapeOrFilterValue(value);
  if (op === 'equals') return escaped;
  if (op === 'startsWith') return `${escaped}%`;
  if (op === 'endsWith') return `%${escaped}`;
  return `%${escaped}%`;
}

function buildTextFilterClause(column: string, query: string, op: LeadFilterTextOp): string {
  const pattern = toLikePattern(query, op);
  if (op === 'equals') return `${column}.eq.${pattern}`;
  return `${column}.ilike.${pattern}`;
}

function normalizeDateStart(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('T')) return trimmed;
  return `${trimmed}T00:00:00.000Z`;
}

function normalizeDateEnd(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('T')) return trimmed;
  return `${trimmed}T23:59:59.999Z`;
}

export function buildLeadsFilterPlan(state: LeadsWorkspaceFilterState): LeadsFilterPlan {
  const plan: LeadsFilterPlan = {
    eq: [],
    ilike: [],
    gte: [],
    lte: [],
    isNull: [],
    or: [],
  };

  if (state.statusFilter !== 'all') {
    plan.eq.push({ column: 'status', value: state.statusFilter });
  }

  if (state.ownerFilter === 'me' && state.userId) {
    plan.eq.push({ column: 'owner_id', value: state.userId });
  } else if (state.ownerFilter === 'unassigned') {
    plan.isNull.push('owner_id');
  }

  const trimmedSearch = state.searchQuery.trim();
  if (trimmedSearch) {
    plan.or.push([
      buildTextFilterClause('first_name', trimmedSearch, 'contains'),
      buildTextFilterClause('last_name', trimmedSearch, 'contains'),
      buildTextFilterClause('company', trimmedSearch, 'contains'),
      buildTextFilterClause('email', trimmedSearch, 'contains'),
      buildTextFilterClause('phone', trimmedSearch, 'contains'),
    ].join(','));
  }

  const trimmedName = state.nameQuery.trim();
  if (trimmedName) {
    plan.or.push([
      buildTextFilterClause('first_name', trimmedName, state.nameOp),
      buildTextFilterClause('last_name', trimmedName, state.nameOp),
    ].join(','));
  }

  const singleFieldTextFilters: Array<{
    column: string;
    query: string;
    op: LeadFilterTextOp;
  }> = [
    { column: 'company', query: state.companyQuery, op: state.companyOp },
    { column: 'email', query: state.emailQuery, op: state.emailOp },
    { column: 'phone', query: state.phoneQuery, op: state.phoneOp },
    { column: 'source', query: state.sourceQuery, op: state.sourceOp },
    { column: 'qualification_status', query: state.qualificationQuery, op: state.qualificationOp },
  ];

  singleFieldTextFilters.forEach(({ column, query, op }) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (op === 'equals') {
      plan.eq.push({ column, value: trimmed });
      return;
    }
    plan.ilike.push({ column, value: toLikePattern(trimmed, op) });
  });

  if (state.scoreFilter === 'high') {
    plan.gte.push({ column: 'lead_score', value: 70 });
  } else if (state.scoreFilter === 'medium') {
    plan.gte.push({ column: 'lead_score', value: 40 });
    plan.lte.push({ column: 'lead_score', value: 69 });
  } else if (state.scoreFilter === 'low') {
    plan.lte.push({ column: 'lead_score', value: 39 });
  }

  if (state.scoreMin) {
    plan.gte.push({ column: 'lead_score', value: Number(state.scoreMin) });
  }
  if (state.scoreMax) {
    plan.lte.push({ column: 'lead_score', value: Number(state.scoreMax) });
  }
  if (state.valueMin) {
    plan.gte.push({ column: 'estimated_value', value: Number(state.valueMin) });
  }
  if (state.valueMax) {
    plan.lte.push({ column: 'estimated_value', value: Number(state.valueMax) });
  }

  const createdFrom = normalizeDateStart(state.createdStart);
  if (createdFrom) {
    plan.gte.push({ column: 'created_at', value: createdFrom });
  }
  const createdTo = normalizeDateEnd(state.createdEnd);
  if (createdTo) {
    plan.lte.push({ column: 'created_at', value: createdTo });
  }

  return plan;
}

export function normalizeLeadsStatusFilterValue(value: string | null | undefined): string {
  if (!value) return NORMALIZED_ALL_STATUS_VALUE;
  const normalized = value.trim();
  if (!normalized) return NORMALIZED_ALL_STATUS_VALUE;
  if (normalized.toLowerCase() === LEGACY_ALL_STATUSES_VALUE.toLowerCase()) return NORMALIZED_ALL_STATUS_VALUE;
  return normalized;
}

export function serializeLeadsListUrlState(state: LeadsListUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.searchQuery) params.set('q', state.searchQuery);
  const normalizedStatus = normalizeLeadsStatusFilterValue(state.statusFilter);
  if (normalizedStatus !== NORMALIZED_ALL_STATUS_VALUE) params.set('status', normalizedStatus);
  if (state.ownerFilter !== 'any') params.set('owner', state.ownerFilter);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

export function deserializeLeadsListUrlState(params: URLSearchParams): Partial<LeadsListUrlState> {
  const searchQuery = params.get('q');
  const statusFilter = params.get('status');
  const ownerFilter = params.get('owner');
  const page = params.get('page');
  const next: Partial<LeadsListUrlState> = {};
  if (searchQuery !== null) next.searchQuery = searchQuery;
  if (statusFilter !== null) next.statusFilter = normalizeLeadsStatusFilterValue(statusFilter);
  if (ownerFilter !== null) next.ownerFilter = ownerFilter;
  if (page !== null) {
    const parsed = Number(page);
    if (Number.isFinite(parsed) && parsed > 0) next.page = Math.floor(parsed);
  }
  return next;
}

export function buildLeadsImportExportParams(state: LeadsImportExportState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('from', 'workspace');
  params.set('view', state.viewMode);
  if (state.searchQuery) params.set('q', state.searchQuery);
  const normalizedStatus = normalizeLeadsStatusFilterValue(state.statusFilter);
  if (normalizedStatus !== NORMALIZED_ALL_STATUS_VALUE) params.set('status', normalizedStatus);
  if (state.scoreMin) params.set('scoreMin', state.scoreMin);
  if (state.scoreMax) params.set('scoreMax', state.scoreMax);
  if (state.createdStart) params.set('createdFrom', state.createdStart);
  if (state.createdEnd) params.set('createdTo', state.createdEnd);
  if (state.groupBy && state.groupBy !== 'none') params.set('groupBy', state.groupBy);
  return params;
}

function getCustomPicklistValue(lead: GroupableLead, key: string): string {
  if (!lead.custom_fields || typeof lead.custom_fields !== 'object') return 'Not Specified';
  const rawValue = (lead.custom_fields as Record<string, unknown>)[key];
  if (typeof rawValue !== 'string') return 'Not Specified';
  const value = rawValue.trim();
  return value || 'Not Specified';
}

function getCreatedDateGroupingLabel(createdAtValue: string | null | undefined, mode: WorkspaceDetailsGroupBy): string {
  if (!createdAtValue) return 'Unknown Date';
  const createdAt = new Date(createdAtValue);
  if (Number.isNaN(createdAt.getTime())) return 'Unknown Date';
  if (mode === 'created_day') {
    return createdAt.toISOString().slice(0, 10);
  }
  if (mode === 'created_week') {
    const day = createdAt.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate()));
    weekStart.setUTCDate(weekStart.getUTCDate() + diff);
    return `Week of ${weekStart.toISOString().slice(0, 10)}`;
  }
  return `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getWorkspaceDetailsGroupLabel(lead: GroupableLead, mode: WorkspaceDetailsGroupBy): string {
  if (mode === 'none') return 'All';
  if (mode === 'owner') return lead.owner_id || 'Unassigned';
  if (mode === 'status') return lead.status || 'Unknown';
  if (mode === 'source') return lead.source || 'Unknown';
  if (mode === 'created_day' || mode === 'created_week' || mode === 'created_month') {
    return getCreatedDateGroupingLabel(lead.created_at, mode);
  }
  if (mode.startsWith('custom:')) {
    return getCustomPicklistValue(lead, mode.slice('custom:'.length));
  }
  return 'Unknown';
}

export function groupLeadsForWorkspaceDetails<T extends GroupableLead>(
  leads: T[],
  mode: WorkspaceDetailsGroupBy,
): Array<{ key: string; label: string; count: number; leads: T[] }> {
  if (mode === 'none') {
    return [{ key: 'none:all', label: 'All', count: leads.length, leads }];
  }
  const buckets = new Map<string, T[]>();
  for (const lead of leads) {
    const label = getWorkspaceDetailsGroupLabel(lead, mode);
    const list = buckets.get(label) || [];
    list.push(lead);
    buckets.set(label, list);
  }
  return Array.from(buckets.entries())
    .map(([label, grouped]) => ({
      key: `${mode}:${label}`,
      label,
      count: grouped.length,
      leads: grouped,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function migrateLegacyLeadsFilterPayload(value: unknown): { migrated: boolean; value: unknown } {
  if (!value || typeof value !== 'object') return { migrated: false, value };
  const payload = value as Record<string, unknown>;
  let migrated = false;
  const next: Record<string, unknown> = { ...payload };

  if (typeof next.status === 'string') {
    const normalized = normalizeLeadsStatusFilterValue(next.status);
    if (normalized !== next.status) {
      next.status = normalized;
      migrated = true;
    }
  }

  if (typeof next.statusFilter === 'string') {
    const normalized = normalizeLeadsStatusFilterValue(next.statusFilter);
    if (normalized !== next.statusFilter) {
      next.statusFilter = normalized;
      migrated = true;
    }
  }

  if (next.workspace && typeof next.workspace === 'object') {
    const workspace = { ...(next.workspace as Record<string, unknown>) };
    if (typeof workspace.statusFilter === 'string') {
      const normalized = normalizeLeadsStatusFilterValue(workspace.statusFilter);
      if (normalized !== workspace.statusFilter) {
        workspace.statusFilter = normalized;
        migrated = true;
      }
    }
    next.workspace = workspace;
  }

  return { migrated, value: next };
}

export function runOneTimeLeadsFilterMigration(storage: Storage): number {
  if (storage.getItem(LEADS_FILTER_MIGRATION_KEY) === 'done') return 0;
  let rewrites = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.toLowerCase().includes('lead')) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrateLegacyLeadsFilterPayload(parsed);
      if (!migrated.migrated) continue;
      storage.setItem(key, JSON.stringify(migrated.value));
      rewrites += 1;
    } catch {
      continue;
    }
  }
  storage.setItem(LEADS_FILTER_MIGRATION_KEY, 'done');
  return rewrites;
}

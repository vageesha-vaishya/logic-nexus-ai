import { ScopedDataAccess } from '@/lib/db/access';
import { Lead, LeadStatus } from '@/pages/dashboard/leads-data';
import { Opportunity, OpportunityStage } from '@/pages/dashboard/opportunities-data';

export type PipelineTransitionErrorCode = 'conflict' | 'forbidden' | 'validation' | 'unknown';
export type LeadMutationErrorCode = PipelineTransitionErrorCode | 'duplicate';

export type PipelineTransitionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PipelineTransitionErrorCode; message: string; current?: T | null };

export type LeadMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: LeadMutationErrorCode; message: string; current?: T | null };

export interface LeadMutationInput {
  first_name: string;
  last_name: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  status: LeadStatus;
  source: string;
  estimated_value?: string | number | null;
  expected_close_date?: string | null;
  description?: string | null;
  notes?: string | null;
  tenant_id: string;
  franchise_id?: string | null;
  service_id?: string | null;
  attachments?: Array<{ name?: string }>;
  custom_fields?: Record<string, unknown> | null;
}

export interface NormalizedLeadMutationInput {
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string;
  estimated_value: number | null;
  expected_close_date: string | null;
  description: string | null;
  notes: string | null;
  tenant_id: string;
  franchise_id: string | null;
  custom_fields: Record<string, unknown> | null;
}

export interface LeadPipelineQuery {
  page?: number;
  pageSize?: number;
  statuses?: LeadStatus[];
  search?: string;
  sources?: string[];
  customFieldFilters?: Array<{ key: string; value: string }>;
  franchiseId?: string;
  fromDate?: string;
  toDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface CrmApiLeadRequestContext {
  accessToken?: string | null;
  tenantId?: string | null;
  franchiseId?: string | null;
  userId?: string | null;
}

type LeadDataSource = 'api' | 'scopedDb';
export interface CrmApiFallbackTelemetry {
  httpStatus: number | null;
  backendCode: string | null;
  backendStatusCode: number | null;
  backendError: string | null;
  requestId: string | null;
}
export type LeadApiFallbackReason =
  | 'missing_token'
  | 'missing_scope'
  | 'forbidden_scope'
  | 'api_unauthorized'
  | 'api_unreachable'
  | 'api_5xx'
  | 'api_4xx'
  | 'api_invalid_payload';

type LeadApiFetchResult =
  | { ok: true; data: Lead[]; totalCount: number; source: LeadDataSource }
  | { ok: false; reason: LeadApiFallbackReason; telemetry: CrmApiFallbackTelemetry | null };

export interface OpportunityPipelineQuery {
  page?: number;
  pageSize?: number;
  stages?: OpportunityStage[];
  search?: string;
  accountId?: string;
  franchiseId?: string;
  minAmount?: number;
  maxAmount?: number;
  closeDateFrom?: string;
  closeDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface AccountPipelineQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  accountType?: string;
  franchiseId?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface ContactPipelineQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  accountId?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface ActivityPipelineQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  activityType?: string;
  ownerId?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export type OpportunityFetchFallbackReason = 'relations_query_failed';
export type AccountFetchFallbackReason = 'relations_query_failed';
export type ContactFetchFallbackReason = 'relations_query_failed';
export type ActivityFetchFallbackReason = 'relations_query_failed';

const mapErrorCode = (error: unknown): PipelineTransitionErrorCode => {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'PGRST301' || code === '42501') return 'forbidden';
  if (code === '23514' || code === '23502' || code === '22P02') return 'validation';
  return 'unknown';
};

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
};

const normalizePhone = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const compact = normalized.replace(/[^\d+]/g, '');
  return compact.length > 0 ? compact : null;
};

const normalizeLeadDateBoundary = (value: string, mode: 'start' | 'end'): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (mode === 'start') parsed.setHours(0, 0, 0, 0);
  if (mode === 'end') parsed.setHours(23, 59, 59, 999);
  return parsed.toISOString();
};

const textIncludes = (value: unknown, search: string): boolean => {
  if (typeof value !== 'string') return false;
  return value.toLowerCase().includes(search);
};

const leadMatchesSearch = (lead: Lead, rawSearch: string): boolean => {
  const search = rawSearch.trim().toLowerCase();
  if (!search) return true;
  return (
    textIncludes(lead.first_name, search) ||
    textIncludes(lead.last_name, search) ||
    textIncludes(lead.company, search) ||
    textIncludes(lead.email, search)
  );
};

const leadMatchesCustomFields = (lead: Lead, filters: Array<{ key: string; value: string }>): boolean => {
  if (filters.length === 0) return true;
  const customFields = lead.custom_fields && typeof lead.custom_fields === 'object'
    ? (lead.custom_fields as Record<string, unknown>)
    : {};
  return filters.every((filter) => {
    const value = customFields[filter.key];
    return String(value ?? '').toLowerCase() === filter.value.trim().toLowerCase();
  });
};

const toComparableValue = (lead: Lead, field: string): string | number => {
  const value = (lead as unknown as Record<string, unknown>)[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.toLowerCase();
  if (value instanceof Date) return value.getTime();
  return '';
};

const applyLeadPipelineFilters = (leads: Lead[], options: LeadPipelineQuery): Lead[] => {
  const {
    statuses = [],
    search = '',
    sources = [],
    customFieldFilters = [],
    franchiseId,
    fromDate,
    toDate,
  } = options;

  const normalizedSources = new Set(sources.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const createdAtStart = fromDate ? normalizeLeadDateBoundary(fromDate, 'start') : null;
  const createdAtEnd = toDate ? normalizeLeadDateBoundary(toDate, 'end') : null;

  return leads.filter((lead) => {
    if (statuses.length > 0 && !statuses.includes(lead.status)) return false;
    if (!leadMatchesSearch(lead, search)) return false;
    if (normalizedSources.size > 0 && !normalizedSources.has(String(lead.source || '').toLowerCase())) return false;
    if (!leadMatchesCustomFields(lead, customFieldFilters)) return false;
    if (franchiseId && franchiseId !== 'all' && lead.franchise_id !== franchiseId) return false;
    if (createdAtStart && lead.created_at < createdAtStart) return false;
    if (createdAtEnd && lead.created_at > createdAtEnd) return false;
    return true;
  });
};

const sortLeadResults = (leads: Lead[], field: string, direction: 'asc' | 'desc'): Lead[] => {
  const sorted = [...leads];
  sorted.sort((a, b) => {
    const left = toComparableValue(a, field);
    const right = toComparableValue(b, field);
    if (left < right) return direction === 'asc' ? -1 : 1;
    if (left > right) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
};

const getResponseHeader = (response: Response, name: string): string | null => {
  const headers = (response as { headers?: { get?: (header: string) => string | null } }).headers;
  if (!headers?.get) return null;
  const value = headers.get(name);
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toTextValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveCrmApiFallbackTelemetry = async (response: Response): Promise<CrmApiFallbackTelemetry> => {
  const payload = await response.json().catch(() => null);
  const candidateRequestId = getResponseHeader(response, 'x-request-id');
  const candidateCorrelationId = getResponseHeader(response, 'x-correlation-id');
  const backendCode = toTextValue(payload?.code);
  const backendError = toTextValue(payload?.error);
  const backendStatusCode = toNumericValue(payload?.statusCode);
  return {
    httpStatus: response.status ?? null,
    backendCode,
    backendStatusCode,
    backendError,
    requestId: candidateRequestId ?? candidateCorrelationId,
  };
};

const shouldRetryCrmApiStatus = (status: number): boolean => status >= 500;

const waitFor = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export const normalizeLeadMutationInput = (
  input: LeadMutationInput
): NormalizedLeadMutationInput => {
  const attachmentNames = Array.isArray(input.attachments)
    ? input.attachments
        .map((file) => (typeof file?.name === 'string' ? file.name : null))
        .filter((name): name is string => Boolean(name))
    : [];

  const serviceId = normalizeText(input.service_id);
  const customFields = {
    ...(input.custom_fields || {}),
    ...(serviceId ? { service_id: serviceId } : {}),
    ...(attachmentNames.length > 0 ? { attachments_names: attachmentNames } : {}),
  };

  const estimatedValue =
    typeof input.estimated_value === 'number'
      ? input.estimated_value
      : typeof input.estimated_value === 'string' && input.estimated_value.trim() !== ''
        ? Number(input.estimated_value)
        : null;

  return {
    first_name: normalizeText(input.first_name) || '',
    last_name: normalizeText(input.last_name) || '',
    company: normalizeText(input.company),
    title: normalizeText(input.title),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    status: input.status,
    source: input.source,
    estimated_value: Number.isFinite(estimatedValue) ? estimatedValue : null,
    expected_close_date: normalizeText(input.expected_close_date),
    description: normalizeText(input.description),
    notes: normalizeText(input.notes),
    tenant_id: input.tenant_id,
    franchise_id: normalizeText(input.franchise_id),
    custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
  };
};

export const validateLeadMutationInput = (
  input: NormalizedLeadMutationInput
): { valid: true } | { valid: false; message: string } => {
  if (!input.first_name || !input.last_name) {
    return { valid: false, message: 'First name and last name are required.' };
  }
  if (!input.email && !input.phone) {
    return { valid: false, message: 'Provide at least one contact method: email or phone.' };
  }
  if (input.estimated_value !== null && input.estimated_value < 0) {
    return { valid: false, message: 'Estimated value cannot be negative.' };
  }
  return { valid: true };
};

export const PipelineService = {
  async listLeadsFromCrmApi(
    context: CrmApiLeadRequestContext,
    options: LeadPipelineQuery = {}
  ): Promise<LeadApiFetchResult> {
    if (!context.accessToken) {
      return { ok: false, reason: 'missing_token', telemetry: null };
    }
    if (!context.tenantId) {
      return { ok: false, reason: 'missing_scope', telemetry: null };
    }

    const params = new URLSearchParams();
    if (options.search?.trim()) params.set('q', options.search.trim());
    if (options.statuses && options.statuses.length > 0) params.set('status', options.statuses.join(','));
    if (options.sources && options.sources.length > 0) params.set('source', options.sources.join(','));
    if (options.fromDate) params.set('from', options.fromDate);
    if (options.toDate) params.set('to', options.toDate);
    if (options.franchiseId && options.franchiseId !== 'all') params.set('franchise_id', options.franchiseId);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const requestInit: RequestInit = {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        'x-tenant-id': context.tenantId,
        ...(context.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
      },
    };

    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(`/api/crm/v1/leads${queryString}`, requestInit);
        if (!shouldRetryCrmApiStatus(response.status) || attempt === 1) {
          break;
        }
      } catch {
        if (attempt === 1) {
          break;
        }
      }
      await waitFor(200);
    }

    if (!response) {
      return { ok: false, reason: 'api_unreachable', telemetry: null };
    }

    if (!response.ok) {
      const telemetry = await resolveCrmApiFallbackTelemetry(response);
      if (response.status === 401) return { ok: false, reason: 'api_unauthorized', telemetry };
      if (response.status === 403) return { ok: false, reason: 'forbidden_scope', telemetry };
      if (response.status >= 500) return { ok: false, reason: 'api_5xx', telemetry };
      return { ok: false, reason: 'api_4xx', telemetry };
    }

    const payload = await response.json().catch(() => null);
    const rows = Array.isArray(payload?.data)
      ? (payload.data as Lead[])
      : Array.isArray(payload?.items)
        ? (payload.items as Lead[])
        : [];

    const filtered = applyLeadPipelineFilters(rows, options);
    const sortField = options.sortField || 'created_at';
    const sortDirection = options.sortDirection || 'desc';
    const sorted = sortLeadResults(filtered, sortField, sortDirection);

    const page = options.page || 1;
    const pageSize = options.pageSize || 500;
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize;
    const payloadCount = typeof payload?.count === 'number'
      ? payload.count
      : typeof payload?.totalCount === 'number'
        ? payload.totalCount
        : sorted.length;
    return {
      ok: true,
      data: sorted.slice(from, to),
      totalCount: payloadCount,
      source: 'api',
    };
  },

  async updateLeadViaCrmApi(
    context: CrmApiLeadRequestContext,
    params: {
      id: string;
      input: LeadMutationInput;
    }
  ): Promise<LeadMutationResult<Lead> | null> {
    if (!context.accessToken) return null;
    const response = await fetch(`/api/crm/v1/leads/${params.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        'x-tenant-id': context.tenantId,
        ...(context.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
      },
      body: JSON.stringify(params.input),
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => null);
    if (!payload?.data) {
      return { ok: false, code: 'unknown', message: 'Missing updated lead payload from CRM API' };
    }
    return { ok: true, data: payload.data as Lead };
  },

  async transitionLeadStageViaCrmApi(
    context: CrmApiLeadRequestContext,
    params: {
      id: string;
      toStatus: LeadStatus;
    }
  ): Promise<PipelineTransitionResult<Lead> | null> {
    if (!context.accessToken) return null;
    const response = await fetch(`/api/crm/v1/leads/${params.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        'x-tenant-id': context.tenantId,
        ...(context.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
      },
      body: JSON.stringify({ status: params.toStatus }),
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => null);
    if (!payload?.data) {
      return { ok: false, code: 'unknown', message: 'Missing transitioned lead payload from CRM API' };
    }
    return { ok: true, data: payload.data as Lead };
  },

  async deleteLeadViaCrmApi(
    context: CrmApiLeadRequestContext,
    id: string
  ): Promise<boolean | null> {
    if (!context.accessToken) return null;
    const response = await fetch(`/api/crm/v1/leads/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        'x-tenant-id': context.tenantId,
        ...(context.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
      },
    });
    if (!response.ok) {
      return null;
    }
    return true;
  },

  async deleteLeadsViaCrmApi(
    context: CrmApiLeadRequestContext,
    ids: string[]
  ): Promise<boolean | null> {
    if (!context.accessToken) return null;
    const response = await fetch('/api/crm/v1/leads', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        'x-tenant-id': context.tenantId,
        ...(context.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
      },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      return null;
    }
    return true;
  },

  async findDuplicateLead(
    scopedDb: ScopedDataAccess,
    params: {
      email?: string | null;
      phone?: string | null;
      excludeLeadId?: string;
    }
  ): Promise<Pick<Lead, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'updated_at'> | null> {
    const email = normalizeEmail(params.email);
    const phone = normalizePhone(params.phone);
    if (!email && !phone) return null;

    const conditions: string[] = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (phone) conditions.push(`phone.eq.${phone}`);

    let query = scopedDb
      .from('leads')
      .select('id,first_name,last_name,email,phone,updated_at')
      .or(conditions.join(','))
      .limit(1);

    if (params.excludeLeadId) {
      query = query.neq('id', params.excludeLeadId);
    }

    const { data, error } = await query;
    if (error) throw error;
    const duplicate = Array.isArray(data) ? data[0] : null;
    return duplicate
      ? {
          id: duplicate.id as string,
          first_name: duplicate.first_name as string,
          last_name: duplicate.last_name as string,
          email: (duplicate.email as string | null) || null,
          phone: (duplicate.phone as string | null) || null,
          updated_at: duplicate.updated_at as string,
        }
      : null;
  },

  async createLead(
    scopedDb: ScopedDataAccess,
    input: LeadMutationInput
  ): Promise<LeadMutationResult<Lead>> {
    const normalized = normalizeLeadMutationInput(input);
    const validation = validateLeadMutationInput(normalized);
    if (validation.valid === false) {
      return { ok: false, code: 'validation', message: validation.message };
    }

    try {
      const duplicate = await this.findDuplicateLead(scopedDb, {
        email: normalized.email,
        phone: normalized.phone,
      });
      if (duplicate) {
        return {
          ok: false,
          code: 'duplicate',
          message: `Potential duplicate found: ${duplicate.first_name} ${duplicate.last_name}`,
          current: duplicate as Lead,
        };
      }

      const { data, error } = await scopedDb.from('leads').insert(normalized).select('*').single();
      if (error) {
        return { ok: false, code: mapErrorCode(error), message: error.message };
      }
      return { ok: true, data: data as Lead };
    } catch (error) {
      return { ok: false, code: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async updateLead(
    scopedDb: ScopedDataAccess,
    params: {
      id: string;
      input: LeadMutationInput;
      expectedUpdatedAt?: string | null;
    },
    crmApiContext?: CrmApiLeadRequestContext
  ): Promise<LeadMutationResult<Lead>> {
    const normalized = normalizeLeadMutationInput(params.input);
    const validation = validateLeadMutationInput(normalized);
    if (validation.valid === false) {
      return { ok: false, code: 'validation', message: validation.message };
    }
    const apiResult = crmApiContext
      ? await this.updateLeadViaCrmApi(crmApiContext, { id: params.id, input: normalized })
      : null;
    if (apiResult) {
      return apiResult;
    }

    try {
      const duplicate = await this.findDuplicateLead(scopedDb, {
        email: normalized.email,
        phone: normalized.phone,
        excludeLeadId: params.id,
      });
      if (duplicate) {
        return {
          ok: false,
          code: 'duplicate',
          message: `Potential duplicate found: ${duplicate.first_name} ${duplicate.last_name}`,
          current: duplicate as Lead,
        };
      }

      let query = (scopedDb.from('leads') as any)
        .update(normalized)
        .eq('id', params.id);

      if (params.expectedUpdatedAt) {
        query = query.eq('updated_at', params.expectedUpdatedAt);
      }

      const { data, error } = await query.select('*');
      if (error) {
        return { ok: false, code: mapErrorCode(error), message: error.message };
      }

      if (!data || data.length === 0) {
        const { data: current } = await scopedDb.from('leads').select('*').eq('id', params.id).maybeSingle();
        return {
          ok: false,
          code: 'conflict',
          message: 'Lead was updated by another user.',
          current: (current as Lead | null) || null,
        };
      }

      return { ok: true, data: data[0] as Lead };
    } catch (error) {
      return { ok: false, code: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async listLeads(
    scopedDb: ScopedDataAccess,
    options: LeadPipelineQuery = {},
    crmApiContext?: CrmApiLeadRequestContext
  ): Promise<{
    data: Lead[];
    totalCount: number;
    source: LeadDataSource;
    fallbackReason: LeadApiFallbackReason | null;
    fallbackTelemetry: CrmApiFallbackTelemetry | null;
  }> {
    const {
      page = 1,
      pageSize = 500,
      statuses = [],
      search = '',
      sources = [],
      customFieldFilters = [],
      franchiseId,
      fromDate,
      toDate,
      sortField = 'created_at',
      sortDirection = 'desc',
    } = options;

    const apiResult = crmApiContext
      ? await this.listLeadsFromCrmApi(crmApiContext, options)
      : null;

    if (apiResult?.ok) {
      return { ...apiResult, fallbackReason: null, fallbackTelemetry: null };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = scopedDb.from('leads').select('*', { count: 'exact' });

    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }

    if (search.trim()) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (sources.length > 0) {
      query = query.in('source', sources);
    }

    if (customFieldFilters.length > 0) {
      for (const filter of customFieldFilters) {
        query = query.contains('custom_fields', { [filter.key]: filter.value });
      }
    }

    if (franchiseId && franchiseId !== 'all') {
      query = query.eq('franchise_id', franchiseId);
    }

    if (fromDate) {
      const start = new Date(fromDate);
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        query = query.gte('created_at', start.toISOString());
      }
    }

    if (toDate) {
      const end = new Date(toDate);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
    }

    const { data, error, count } = await query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as Lead[],
      totalCount: count || 0,
      source: 'scopedDb',
      fallbackReason: apiResult && !apiResult.ok ? apiResult.reason : null,
      fallbackTelemetry: apiResult && !apiResult.ok ? apiResult.telemetry : null,
    };
  },

  async listOpportunities(
    scopedDb: ScopedDataAccess,
    options: OpportunityPipelineQuery = {}
  ): Promise<{ data: Opportunity[]; totalCount: number; source: 'scopedDb'; fallbackReason: OpportunityFetchFallbackReason | null }> {
    const {
      page = 1,
      pageSize = 500,
      stages = [],
      search = '',
      accountId,
      franchiseId,
      minAmount,
      maxAmount,
      closeDateFrom,
      closeDateTo,
      createdFrom,
      createdTo,
      sortField = 'created_at',
      sortDirection = 'desc',
    } = options;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = scopedDb
      .from('opportunities')
      .select(
        `
          *,
          accounts:account_id(name),
          contacts:contact_id(first_name, last_name)
        `,
        { count: 'exact' }
      );

    if (stages.length > 0) {
      query = query.in('stage', stages);
    }

    if (search.trim()) {
      query = query.ilike('name', `%${search}%`);
    }

    if (accountId && accountId !== 'all') {
      query = query.eq('account_id', accountId);
    }

    if (franchiseId && franchiseId !== 'all') {
      query = query.eq('franchise_id', franchiseId);
    }

    if (typeof minAmount === 'number' && Number.isFinite(minAmount)) {
      query = query.gte('amount', minAmount);
    }

    if (typeof maxAmount === 'number' && Number.isFinite(maxAmount)) {
      query = query.lte('amount', maxAmount);
    }

    if (closeDateFrom) {
      query = query.gte('close_date', closeDateFrom);
    }

    if (closeDateTo) {
      query = query.lte('close_date', closeDateTo);
    }

    if (createdFrom) {
      query = query.gte('created_at', new Date(createdFrom).toISOString());
    }

    if (createdTo) {
      query = query.lte('created_at', new Date(createdTo).toISOString());
    }

    const { data: relationData, error: relationError, count: relationCount } = await query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (!relationError) {
      return {
        data: (relationData || []) as Opportunity[],
        totalCount: relationCount || 0,
        source: 'scopedDb',
        fallbackReason: null,
      };
    }

    let fallbackQuery = scopedDb
      .from('opportunities')
      .select('*', { count: 'exact' });

    if (stages.length > 0) {
      fallbackQuery = fallbackQuery.in('stage', stages);
    }

    if (search.trim()) {
      fallbackQuery = fallbackQuery.ilike('name', `%${search}%`);
    }

    if (accountId && accountId !== 'all') {
      fallbackQuery = fallbackQuery.eq('account_id', accountId);
    }

    if (franchiseId && franchiseId !== 'all') {
      fallbackQuery = fallbackQuery.eq('franchise_id', franchiseId);
    }

    if (typeof minAmount === 'number' && Number.isFinite(minAmount)) {
      fallbackQuery = fallbackQuery.gte('amount', minAmount);
    }

    if (typeof maxAmount === 'number' && Number.isFinite(maxAmount)) {
      fallbackQuery = fallbackQuery.lte('amount', maxAmount);
    }

    if (closeDateFrom) {
      fallbackQuery = fallbackQuery.gte('close_date', closeDateFrom);
    }

    if (closeDateTo) {
      fallbackQuery = fallbackQuery.lte('close_date', closeDateTo);
    }

    if (createdFrom) {
      fallbackQuery = fallbackQuery.gte('created_at', new Date(createdFrom).toISOString());
    }

    if (createdTo) {
      fallbackQuery = fallbackQuery.lte('created_at', new Date(createdTo).toISOString());
    }

    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (fallbackError) {
      throw fallbackError;
    }

    return {
      data: (fallbackData || []) as Opportunity[],
      totalCount: fallbackCount || 0,
      source: 'scopedDb',
      fallbackReason: 'relations_query_failed',
    };
  },

  async listAccounts(
    scopedDb: ScopedDataAccess,
    options: AccountPipelineQuery = {}
  ): Promise<{ data: unknown[]; totalCount: number; source: 'scopedDb'; fallbackReason: AccountFetchFallbackReason | null }> {
    const {
      page = 1,
      pageSize = 500,
      search = '',
      accountType,
      franchiseId,
      sortField = 'created_at',
      sortDirection = 'desc',
    } = options;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = scopedDb
      .from('accounts')
      .select('*, contacts:contacts(id)', { count: 'exact' });

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,industry.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (accountType && accountType !== 'all') {
      query = query.eq('account_type', accountType);
    }

    if (franchiseId && franchiseId !== 'all') {
      query = query.eq('franchise_id', franchiseId);
    }

    const { data: relationData, error: relationError, count: relationCount } = await query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (!relationError) {
      return {
        data: (relationData || []) as unknown[],
        totalCount: relationCount || 0,
        source: 'scopedDb',
        fallbackReason: null,
      };
    }

    let fallbackQuery = scopedDb
      .from('accounts')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      fallbackQuery = fallbackQuery.or(`name.ilike.%${search}%,industry.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (accountType && accountType !== 'all') {
      fallbackQuery = fallbackQuery.eq('account_type', accountType);
    }

    if (franchiseId && franchiseId !== 'all') {
      fallbackQuery = fallbackQuery.eq('franchise_id', franchiseId);
    }

    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (fallbackError) {
      throw fallbackError;
    }

    return {
      data: (fallbackData || []) as unknown[],
      totalCount: fallbackCount || 0,
      source: 'scopedDb',
      fallbackReason: 'relations_query_failed',
    };
  },

  async listContacts(
    scopedDb: ScopedDataAccess,
    options: ContactPipelineQuery = {}
  ): Promise<{ data: unknown[]; totalCount: number; source: 'scopedDb'; fallbackReason: ContactFetchFallbackReason | null }> {
    const {
      page = 1,
      pageSize = 500,
      search = '',
      accountId,
      sortField = 'created_at',
      sortDirection = 'desc',
    } = options;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = scopedDb
      .from('contacts')
      .select('*, accounts(name)', { count: 'exact' });

    if (search.trim()) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (accountId && accountId !== 'all') {
      query = query.eq('account_id', accountId);
    }

    const { data: relationData, error: relationError, count: relationCount } = await query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (!relationError) {
      return {
        data: (relationData || []) as unknown[],
        totalCount: relationCount || 0,
        source: 'scopedDb',
        fallbackReason: null,
      };
    }

    let fallbackQuery = scopedDb
      .from('contacts')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      fallbackQuery = fallbackQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (accountId && accountId !== 'all') {
      fallbackQuery = fallbackQuery.eq('account_id', accountId);
    }

    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (fallbackError) {
      throw fallbackError;
    }

    return {
      data: (fallbackData || []) as unknown[],
      totalCount: fallbackCount || 0,
      source: 'scopedDb',
      fallbackReason: 'relations_query_failed',
    };
  },

  async listActivities(
    scopedDb: ScopedDataAccess,
    options: ActivityPipelineQuery = {}
  ): Promise<{ data: unknown[]; totalCount: number; source: 'scopedDb'; fallbackReason: ActivityFetchFallbackReason | null }> {
    const {
      page = 1,
      pageSize = 500,
      search = '',
      activityType,
      ownerId,
      sortField = 'due_date',
      sortDirection = 'asc',
    } = options;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = scopedDb
      .from('activities')
      .select(
        `
          *,
          leads (
            id,
            first_name,
            last_name,
            company,
            status
          ),
          accounts (
            id,
            name,
            account_type
          ),
          contacts (
            id,
            first_name,
            last_name
          )
        `,
        { count: 'exact' }
      );

    if (search.trim()) {
      query = query.ilike('subject', `%${search}%`);
    }

    if (activityType && activityType !== 'any') {
      query = query.eq('activity_type', activityType);
    }

    if (ownerId && ownerId !== 'any') {
      if (ownerId === 'unassigned') {
        query = query.is('assigned_to', null);
      } else {
        query = query.eq('assigned_to', ownerId);
      }
    }

    const { data: relationData, error: relationError, count: relationCount } = await query
      .order(sortField, { ascending: sortDirection === 'asc', nullsFirst: false })
      .range(from, to);

    if (!relationError) {
      return {
        data: (relationData || []) as unknown[],
        totalCount: relationCount || 0,
        source: 'scopedDb',
        fallbackReason: null,
      };
    }

    let fallbackQuery = scopedDb
      .from('activities')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      fallbackQuery = fallbackQuery.ilike('subject', `%${search}%`);
    }

    if (activityType && activityType !== 'any') {
      fallbackQuery = fallbackQuery.eq('activity_type', activityType);
    }

    if (ownerId && ownerId !== 'any') {
      if (ownerId === 'unassigned') {
        fallbackQuery = fallbackQuery.is('assigned_to', null);
      } else {
        fallbackQuery = fallbackQuery.eq('assigned_to', ownerId);
      }
    }

    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
      .order(sortField, { ascending: sortDirection === 'asc', nullsFirst: false })
      .range(from, to);

    if (fallbackError) {
      throw fallbackError;
    }

    return {
      data: (fallbackData || []) as unknown[],
      totalCount: fallbackCount || 0,
      source: 'scopedDb',
      fallbackReason: 'relations_query_failed',
    };
  },

  async transitionLeadStage(
    scopedDb: ScopedDataAccess,
    params: {
      id: string;
      toStatus: LeadStatus;
      expectedUpdatedAt?: string | null;
    },
    crmApiContext?: CrmApiLeadRequestContext
  ): Promise<PipelineTransitionResult<Lead>> {
    const { id, toStatus, expectedUpdatedAt } = params;
    const apiResult = crmApiContext
      ? await this.transitionLeadStageViaCrmApi(crmApiContext, { id, toStatus })
      : null;
    if (apiResult) {
      return apiResult;
    }

    if (!expectedUpdatedAt) {
      return { ok: false, code: 'validation', message: 'Missing expectedUpdatedAt' };
    }

    try {
      const { data, error } = await (scopedDb.from('leads') as any)
        .update({ status: toStatus })
        .eq('id', id)
        .eq('updated_at', expectedUpdatedAt)
        .select('*');

      if (error) {
        return { ok: false, code: mapErrorCode(error), message: error.message };
      }

      if (!data || data.length === 0) {
        const { data: current } = await scopedDb.from('leads').select('*').eq('id', id).maybeSingle();
        return { ok: false, code: 'conflict', message: 'Stale update detected', current: (current as Lead | null) || null };
      }

      return { ok: true, data: data[0] as Lead };
    } catch (error) {
      return { ok: false, code: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async deleteLead(
    scopedDb: ScopedDataAccess,
    id: string,
    crmApiContext?: CrmApiLeadRequestContext
  ): Promise<boolean> {
    const apiResult = crmApiContext
      ? await this.deleteLeadViaCrmApi(crmApiContext, id)
      : null;
    if (apiResult) {
      return true;
    }
    const { error } = await scopedDb.from('leads').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async deleteLeads(
    scopedDb: ScopedDataAccess,
    ids: string[],
    crmApiContext?: CrmApiLeadRequestContext
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const apiResult = crmApiContext
      ? await this.deleteLeadsViaCrmApi(crmApiContext, ids)
      : null;
    if (apiResult) {
      return ids.length;
    }
    const { error } = await scopedDb.from('leads').delete().in('id', ids);
    if (error) throw error;
    return ids.length;
  },

  async transitionOpportunityStage(
    scopedDb: ScopedDataAccess,
    params: {
      id: string;
      toStage: OpportunityStage;
      expectedUpdatedAt?: string | null;
    }
  ): Promise<PipelineTransitionResult<Opportunity>> {
    const { id, toStage, expectedUpdatedAt } = params;

    if (!expectedUpdatedAt) {
      return { ok: false, code: 'validation', message: 'Missing expectedUpdatedAt' };
    }

    try {
      const { data, error } = await (scopedDb.from('opportunities') as any)
        .update({ stage: toStage })
        .eq('id', id)
        .eq('updated_at', expectedUpdatedAt)
        .select('*');

      if (error) {
        return { ok: false, code: mapErrorCode(error), message: error.message };
      }

      if (!data || data.length === 0) {
        const { data: current } = await scopedDb.from('opportunities').select('*').eq('id', id).maybeSingle();
        return {
          ok: false,
          code: 'conflict',
          message: 'Stale update detected',
          current: (current as Opportunity | null) || null,
        };
      }

      return { ok: true, data: data[0] as Opportunity };
    } catch (error) {
      return { ok: false, code: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

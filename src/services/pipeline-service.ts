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
  franchiseId?: string;
  fromDate?: string;
  toDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

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
    }
  ): Promise<LeadMutationResult<Lead>> {
    const normalized = normalizeLeadMutationInput(params.input);
    const validation = validateLeadMutationInput(normalized);
    if (validation.valid === false) {
      return { ok: false, code: 'validation', message: validation.message };
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
    options: LeadPipelineQuery = {}
  ): Promise<{ data: Lead[]; totalCount: number }> {
    const {
      page = 1,
      pageSize = 500,
      statuses = [],
      search = '',
      franchiseId,
      fromDate,
      toDate,
      sortField = 'created_at',
      sortDirection = 'desc',
    } = options;

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

    if (franchiseId && franchiseId !== 'all') {
      query = query.eq('franchise_id', franchiseId);
    }

    if (fromDate) {
      query = query.gte('created_at', new Date(fromDate).toISOString());
    }

    if (toDate) {
      query = query.lte('created_at', new Date(toDate).toISOString());
    }

    const { data, error, count } = await query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (error) {
      throw error;
    }

    return { data: (data || []) as Lead[], totalCount: count || 0 };
  },

  async listOpportunities(
    scopedDb: ScopedDataAccess,
    options: OpportunityPipelineQuery = {}
  ): Promise<{ data: Opportunity[]; totalCount: number }> {
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

    const { data, error, count } = await query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (error) {
      throw error;
    }

    return { data: (data || []) as Opportunity[], totalCount: count || 0 };
  },

  async transitionLeadStage(
    scopedDb: ScopedDataAccess,
    params: {
      id: string;
      toStatus: LeadStatus;
      expectedUpdatedAt?: string | null;
    }
  ): Promise<PipelineTransitionResult<Lead>> {
    const { id, toStatus, expectedUpdatedAt } = params;

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

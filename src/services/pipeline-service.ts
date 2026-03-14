import { ScopedDataAccess } from '@/lib/db/access';
import { Lead, LeadStatus } from '@/pages/dashboard/leads-data';
import { Opportunity, OpportunityStage } from '@/pages/dashboard/opportunities-data';

export type PipelineTransitionErrorCode = 'conflict' | 'forbidden' | 'validation' | 'unknown';

export type PipelineTransitionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PipelineTransitionErrorCode; message: string; current?: T | null };

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

export const PipelineService = {
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

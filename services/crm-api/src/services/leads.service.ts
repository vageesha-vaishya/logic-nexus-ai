import { createClient } from '@supabase/supabase-js';
import { CreateLeadRequest, LeadRecord, UpdateLeadRequest } from '../types/crm.types.js';

export class LeadsService {
  private getClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw this.toServiceError(
        500,
        'MISSING_ENV',
        'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY'
      );
    }
    return createClient(supabaseUrl, supabaseServiceKey);
  }

  async getLeads(tenantId: string, franchiseId?: string | null): Promise<LeadRecord[]> {
    const supabase = this.getClient();
    let query = supabase.from('leads').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { data, error } = await query;
    if (error) {
      throw this.toServiceError(500, 'LEADS_FETCH_FAILED', error.message);
    }
    return (data as LeadRecord[]) || [];
  }

  async getLead(tenantId: string, id: string, franchiseId?: string | null): Promise<LeadRecord> {
    const supabase = this.getClient();
    let query = supabase.from('leads').select('*').eq('tenant_id', tenantId).eq('id', id);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw this.toServiceError(500, 'LEAD_FETCH_FAILED', error.message);
    }
    if (!data) {
      throw this.toServiceError(404, 'LEAD_NOT_FOUND', `Lead ${id} not found`);
    }
    return data as LeadRecord;
  }

  async createLead(
    tenantId: string,
    userId: string,
    payload: CreateLeadRequest,
    franchiseId?: string | null
  ): Promise<LeadRecord> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('leads')
      .insert({
        ...payload,
        tenant_id: tenantId,
        franchise_id: franchiseId ?? null,
        created_by: userId
      })
      .select('*')
      .single();
    if (error) {
      throw this.toServiceError(500, 'LEAD_CREATE_FAILED', error.message);
    }
    return data as LeadRecord;
  }

  async updateLead(
    tenantId: string,
    id: string,
    payload: UpdateLeadRequest,
    franchiseId?: string | null
  ): Promise<LeadRecord> {
    const supabase = this.getClient();
    let query = supabase.from('leads').update(payload).eq('tenant_id', tenantId).eq('id', id);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { data, error } = await query.select('*').maybeSingle();
    if (error) {
      throw this.toServiceError(500, 'LEAD_UPDATE_FAILED', error.message);
    }
    if (!data) {
      throw this.toServiceError(404, 'LEAD_NOT_FOUND', `Lead ${id} not found`);
    }
    return data as LeadRecord;
  }

  async deleteLead(tenantId: string, id: string, franchiseId?: string | null): Promise<boolean> {
    const supabase = this.getClient();
    let query = supabase.from('leads').delete().eq('tenant_id', tenantId).eq('id', id);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { error, data } = await query.select('id');
    if (error) {
      throw this.toServiceError(500, 'LEAD_DELETE_FAILED', error.message);
    }
    return Array.isArray(data) && data.length > 0;
  }

  async deleteLeads(tenantId: string, ids: string[], franchiseId?: string | null): Promise<number> {
    const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    if (uniqueIds.length === 0) return 0;
    const supabase = this.getClient();
    let query = supabase.from('leads').delete().eq('tenant_id', tenantId).in('id', uniqueIds);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { error, data } = await query.select('id');
    if (error) {
      throw this.toServiceError(500, 'LEADS_DELETE_FAILED', error.message);
    }
    return Array.isArray(data) ? data.length : 0;
  }

  private toServiceError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
    const err = new Error(message) as Error & { statusCode: number; code: string };
    err.statusCode = statusCode;
    err.code = code;
    return err;
  }
}

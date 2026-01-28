
import { supabase } from '@/integrations/supabase/client';
import { TaxJurisdiction, TaxCode, TaxRule } from './types';

export const TaxManagementService = {
  // ==========================================
  // Tax Jurisdictions
  // ==========================================

  async getJurisdictions(parentId?: string): Promise<TaxJurisdiction[]> {
    let query = supabase.schema('finance').from('tax_jurisdictions').select('*');
    
    if (parentId) {
      query = query.eq('parent_id', parentId);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) throw error;
    return (data || []).map(this.mapJurisdiction);
  },

  async getJurisdictionById(id: string): Promise<TaxJurisdiction | null> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) return null;
    return this.mapJurisdiction(data);
  },

  async getJurisdictionByCode(code: string): Promise<TaxJurisdiction | null> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .select('*')
      .eq('code', code)
      .single();
      
    if (error) return null;
    return this.mapJurisdiction(data);
  },

  async createJurisdiction(jurisdiction: Omit<TaxJurisdiction, 'id'>): Promise<TaxJurisdiction> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .insert({
        code: jurisdiction.code,
        name: jurisdiction.name,
        type: jurisdiction.type,
        parent_id: jurisdiction.parentId
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapJurisdiction(data);
  },

  async updateJurisdiction(id: string, updates: Partial<Omit<TaxJurisdiction, 'id'>>): Promise<TaxJurisdiction> {
    const dbUpdates: any = {};
    if (updates.code) dbUpdates.code = updates.code;
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;

    const { data, error } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapJurisdiction(data);
  },

  async deleteJurisdiction(id: string): Promise<void> {
    const { error } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==========================================
  // Tax Codes (Product Categories)
  // ==========================================

  async getTaxCodes(): Promise<TaxCode[]> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_codes')
      .select('*')
      .order('code');

    if (error) throw error;
    return (data || []).map(this.mapTaxCode);
  },

  async createTaxCode(taxCode: Omit<TaxCode, 'id'>): Promise<TaxCode> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_codes')
      .insert({
        code: taxCode.code,
        description: taxCode.description,
        is_active: taxCode.isActive
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTaxCode(data);
  },

  // ==========================================
  // Tax Rules
  // ==========================================

  async getTaxRules(jurisdictionId: string): Promise<TaxRule[]> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .select('*')
      .eq('jurisdiction_id', jurisdictionId)
      .order('priority', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapTaxRule);
  },

  async createTaxRule(rule: Omit<TaxRule, 'id'>): Promise<TaxRule> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .insert({
        jurisdiction_id: rule.jurisdictionId,
        tax_code_id: rule.taxCodeId,
        rate: rule.rate,
        priority: rule.priority,
        effective_from: rule.effectiveFrom.toISOString(),
        effective_to: rule.effectiveTo?.toISOString(),
        rule_type: rule.ruleType
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTaxRule(data);
  },

  // ==========================================
  // Mappers
  // ==========================================

  mapJurisdiction(row: any): TaxJurisdiction {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      parentId: row.parent_id
    };
  },

  mapTaxCode(row: any): TaxCode {
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      isActive: row.is_active
    };
  },

  mapTaxRule(row: any): TaxRule {
    return {
      id: row.id,
      jurisdictionId: row.jurisdiction_id,
      taxCodeId: row.tax_code_id,
      rate: Number(row.rate),
      priority: row.priority,
      effectiveFrom: new Date(row.effective_from),
      effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
      ruleType: row.rule_type
    };
  }
};

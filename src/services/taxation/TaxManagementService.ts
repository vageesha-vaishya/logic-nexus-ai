
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
    
    return (data || []).map(item => ({
      id: item.id,
      code: item.code,
      description: item.description || '',
      isActive: item.is_active || false
    }));
  },

  // ==========================================
  // Tax Rules
  // ==========================================

  async getTaxRules(jurisdictionId?: string): Promise<TaxRule[]> {
    let query = supabase.schema('finance').from('tax_rules').select('*');

    if (jurisdictionId) {
      query = query.eq('jurisdiction_id', jurisdictionId);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapTaxRule);
  },

  async getTaxRuleById(id: string): Promise<TaxRule | null> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return this.mapTaxRule(data);
  },

  async createTaxRule(rule: Omit<TaxRule, 'id'>): Promise<TaxRule> {
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .insert({
        jurisdiction_id: rule.jurisdictionId,
        tax_code_id: rule.taxCodeId || null,
        rate: rule.rate,
        priority: rule.priority,
        effective_from: rule.effectiveFrom.toISOString(),
        effective_to: rule.effectiveTo?.toISOString() || null,
        rule_type: rule.ruleType
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTaxRule(data);
  },

  async updateTaxRule(id: string, updates: Partial<Omit<TaxRule, 'id'>>): Promise<TaxRule> {
    const dbUpdates: any = {};
    if (updates.jurisdictionId) dbUpdates.jurisdiction_id = updates.jurisdictionId;
    if (updates.taxCodeId !== undefined) dbUpdates.tax_code_id = updates.taxCodeId || null;
    if (updates.rate !== undefined) dbUpdates.rate = updates.rate;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.effectiveFrom) dbUpdates.effective_from = updates.effectiveFrom.toISOString();
    if (updates.effectiveTo !== undefined) dbUpdates.effective_to = updates.effectiveTo?.toISOString() || null;
    if (updates.ruleType) dbUpdates.rule_type = updates.ruleType;

    const { data, error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapTaxRule(data);
  },

  async deleteTaxRule(id: string): Promise<void> {
    const { error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==========================================
  // Mappers
  // ==========================================

  mapJurisdiction(data: any): TaxJurisdiction {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      type: data.type,
      parentId: data.parent_id
    };
  },

  mapTaxRule(data: any): TaxRule {
    return {
      id: data.id,
      jurisdictionId: data.jurisdiction_id,
      taxCodeId: data.tax_code_id,
      rate: Number(data.rate),
      priority: data.priority,
      effectiveFrom: new Date(data.effective_from),
      effectiveTo: data.effective_to ? new Date(data.effective_to) : undefined,
      ruleType: data.rule_type
    };
  }
};

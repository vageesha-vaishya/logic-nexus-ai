import { supabase } from '@/integrations/supabase/client';
import { TaxCalculationRequest, TaxCalculationResult, NexusDeterminationRequest, NexusDeterminationResult } from './types';

export class TaxEngine {
  /**
   * Determines if the tenant has tax nexus in the destination jurisdiction.
   * This is the first step in the tax calculation workflow.
   */
  static async determineNexus(request: NexusDeterminationRequest): Promise<NexusDeterminationResult> {
    const jurisdictions: string[] = [];
    const { destination, tenantId } = request;

    // 1. Identify Potential Jurisdictions based on Destination
    // In a real system, we would use a GIS service to map address -> jurisdiction IDs
    // For this implementation, we construct codes from the address fields
    
    // Country Level
    if (destination.country) {
      jurisdictions.push(destination.country.toUpperCase());
    }

    // State/Province Level (e.g., 'US-CA')
    if (destination.country === 'US' && destination.state) {
      jurisdictions.push(`US-${destination.state.toUpperCase()}`);
    }

    // 2. Fetch Tenant's Registered Nexus List
    const tenantNexusList = await this.getTenantNexus(tenantId);

    // 3. Intersect Potential Jurisdictions with Registered Nexus
    const activeNexus = jurisdictions.filter(j => tenantNexusList.includes(j));

    return {
      hasNexus: activeNexus.length > 0,
      jurisdictions: activeNexus
    };
  }

  /**
   * Calculates tax for a given set of items in a specific jurisdiction.
   */
  static async calculate(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    const { jurisdictionCode, items } = request;
    console.log(`Calculating tax for jurisdiction: ${jurisdictionCode}`);
    
    // 1. Fetch effective tax rules for this jurisdiction
    const { data: rules, error } = await supabase
      .schema('finance')
      .from('tax_rules')
      .select(`
        rate,
        rule_type,
        tax_codes (
          code
        ),
        tax_jurisdictions!inner (
          code
        )
      `)
      .eq('tax_jurisdictions.code', jurisdictionCode)
      .lte('effective_from', new Date().toISOString())
      .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching tax rules:', error);
      throw error;
    }

    // 2. Determine base rate (Standard Rate)
    // Find rule where tax_code_id is null (Standard Rate)
    const standardRule = rules?.find(r => !r.tax_codes);
    const standardRate = standardRule ? Number(standardRule.rate) : 0;

    let totalTax = 0;
    const breakdown: TaxCalculationResult['breakdown'] = [];
    const lineItems: TaxCalculationResult['lineItems'] = [];

    // 3. Calculate tax for each item
    for (const item of items) {
      let applicableRate = standardRate;

      // If item has a specific tax code, check for overrides
      if (item.taxCode) {
        const specificRule = rules?.find(r => {
          // tax_codes is returned as an array by Supabase client for this relationship
          const taxCodes = r.tax_codes as any;
          const code = Array.isArray(taxCodes) ? taxCodes[0]?.code : taxCodes?.code;
          return code === item.taxCode;
        });
        if (specificRule) {
          applicableRate = Number(specificRule.rate);
        }
      }

      const itemTax = item.amount * applicableRate;
      totalTax += itemTax;
      
      lineItems.push({
        id: item.id,
        taxAmount: itemTax,
        taxRate: applicableRate
      });
    }
    
    // 4. Create breakdown (Simplified for Phase 2.5)
    // Real breakdown would require recursive jurisdiction lookup (State + City + District)
    if (totalTax > 0) {
        breakdown.push({
            level: 'JURISDICTION', // e.g. "US-TX"
            rate: parseFloat((totalTax / items.reduce((a,b) => a + b.amount, 0)).toFixed(4)),
            amount: parseFloat(totalTax.toFixed(2))
        });
    }

    return {
      totalTax: parseFloat(totalTax.toFixed(2)),
      breakdown,
      lineItems
    };
  }

  // Helper to fetch tenant settings
  private static async getTenantNexus(tenantId: string): Promise<string[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .schema('finance')
      .from('tenant_nexus')
      .select(`
        jurisdiction_id,
        tax_jurisdictions (
          code
        )
      `)
      .eq('tenant_id', tenantId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`);

    if (error) {
      console.error('Error fetching tenant nexus:', error);
      return [];
    }

    // Map the nested result to just the jurisdiction codes
    return (data || []).map((item: any) => item.tax_jurisdictions?.code).filter(Boolean);
  }
}

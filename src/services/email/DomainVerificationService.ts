import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabase-functions";

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain_name: string;
  is_verified: boolean;
  spf_record?: string;
  spf_verified: boolean;
  dkim_record?: string;
  dkim_verified: boolean;
  dmarc_record?: string;
  dmarc_verified: boolean;
  provider_metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface VerificationResult {
  success: boolean;
  domain: string;
  results: {
    spf: boolean;
    dmarc: boolean;
    dkim: boolean;
  };
  updates: Partial<TenantDomain>;
  error?: string;
}

export const DomainVerificationService = {
  /**
   * Fetch all domains for the current tenant scope
   */
  async getDomains(): Promise<TenantDomain[]> {
    const { data, error } = await (supabase as any)
      .from('tenant_domains')
      .select('*')
      .order('domain_name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Add a new domain via Edge Function (handles provider registration)
   */
  async addDomain(domainName: string, tenantId: string): Promise<{ domain: TenantDomain; dkim_tokens: string[]; instructions: any }> {
    const { data, error } = await invokeFunction('domains-register', {
      body: { domain_name: domainName, tenant_id: tenantId }
    });

    if (error) throw error;
    // invokeFunction returns { data: T, error: any }, so data contains the success/error payload
    if (data?.error) throw new Error(data.error);
    
    return data;
  },

  /**
   * Delete a domain
   */
  async deleteDomain(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('tenant_domains')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Trigger verification via Edge Function
   */
  async verifyDomain(domainId: string): Promise<VerificationResult> {
    const { data, error } = await invokeFunction('domains-verify', {
      body: { domain_id: domainId }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  }
};

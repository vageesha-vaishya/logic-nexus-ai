import { supabase } from '@/integrations/supabase/client';
import { resolveTenantBranding, type ResolvedTenantBranding, type TenantBrandingQuery } from './brandingResolver';
import type { BrandingSettings } from '@/services/quotation/QuotationConfigurationService';

type TenantBrandingRequestQuery = TenantBrandingQuery & { tenantId?: string };

async function updateBrandingDirectly(brandingSettings: BrandingSettings, tenantId: string): Promise<BrandingSettings> {
  const { data: existingTenant, error: readError } = await supabase
    .from('tenants')
    .select('id, settings')
    .eq('id', tenantId)
    .limit(1)
    .maybeSingle();

  if (readError) throw readError;
  if (!existingTenant) throw new Error('Tenant not found');

  const mergedSettings = {
    ...((existingTenant as any).settings || {}),
    branding_settings: brandingSettings,
  };

  const { data: updated, error: updateError } = await supabase
    .from('tenants')
    .update({
      branding_settings: brandingSettings,
      settings: mergedSettings,
    })
    .eq('id', tenantId)
    .select('branding_settings')
    .limit(1)
    .maybeSingle();

  if (updateError) throw updateError;
  return ((updated as any)?.branding_settings || brandingSettings) as BrandingSettings;
}

async function resolveBrandingDirectly(query: TenantBrandingRequestQuery): Promise<ResolvedTenantBranding> {
  let tenantId = query.tenantId || '';

  if (!tenantId) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || '';
    if (userId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();
      tenantId = String((profileData as { tenant_id?: string | null } | null)?.tenant_id || '').trim();
    }
  }

  let tenantQuery = supabase
    .from('tenants')
    .select('id, name, slug, domain, logo_url, branding_settings, settings')
    .limit(1);

  if (tenantId) {
    tenantQuery = tenantQuery.eq('id', tenantId);
  }

  const { data: tenant, error } = await tenantQuery.maybeSingle();
  if (error) throw error;
  if (!tenant) throw new Error('Tenant not found');

  return resolveTenantBranding(
    {
      tenantId: String((tenant as any).id || ''),
      tenantName: String((tenant as any).name || ''),
      tenantSlug: String((tenant as any).slug || ''),
      domain: String((tenant as any).domain || ''),
      logoUrl: String((tenant as any).logo_url || ''),
      brandingSettings: (tenant as any).branding_settings || {},
      tenantSettings: (tenant as any).settings || {},
    },
    {
      hostname: query.hostname,
      domainCode: query.domainCode,
      franchiseId: query.franchiseId,
    }
  );
}

export const TenantBrandingService = {
  async getResolvedBranding(query: TenantBrandingRequestQuery = {}): Promise<ResolvedTenantBranding> {
    return await resolveBrandingDirectly(query);
  },

  async updateBranding(brandingSettings: BrandingSettings, tenantId?: string): Promise<BrandingSettings> {
    if (!tenantId) {
      throw new Error('Tenant scope required');
    }
    return await updateBrandingDirectly(brandingSettings, tenantId);
  },
};

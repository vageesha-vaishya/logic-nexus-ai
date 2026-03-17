import { supabase } from '@/integrations/supabase/client';
import type { ResolvedTenantBranding, TenantBrandingQuery } from './brandingResolver';
import type { BrandingSettings } from '@/services/quotation/QuotationConfigurationService';

const BRANDING_API_PATH = '/api/v1/tenant-branding';
type TenantBrandingRequestQuery = TenantBrandingQuery & { tenantId?: string };

export const TenantBrandingService = {
  async getResolvedBranding(query: TenantBrandingRequestQuery = {}): Promise<ResolvedTenantBranding> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || '';
    const search = new URLSearchParams();
    if (query.hostname) search.set('hostname', query.hostname);
    if (query.domainCode) search.set('domain_code', query.domainCode);
    if (query.franchiseId) search.set('franchise_id', query.franchiseId);
    if (query.tenantId) search.set('tenant_id', query.tenantId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await fetch(`${BRANDING_API_PATH}${suffix}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load tenant branding';
      const correlationId = typeof payload?.correlationId === 'string' ? payload.correlationId : '';
      if (correlationId) throw new Error(`${message} (ref: ${correlationId})`);
      throw new Error(message);
    }
    const payload = await response.json();
    return payload?.data as ResolvedTenantBranding;
  },

  async updateBranding(brandingSettings: BrandingSettings, tenantId?: string): Promise<BrandingSettings> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || '';
    const search = new URLSearchParams();
    if (tenantId) search.set('tenant_id', tenantId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await fetch(`${BRANDING_API_PATH}${suffix}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ brandingSettings }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = typeof payload?.error === 'string' ? payload.error : 'Failed to update tenant branding';
      const correlationId = typeof payload?.correlationId === 'string' ? payload.correlationId : '';
      if (correlationId) throw new Error(`${message} (ref: ${correlationId})`);
      throw new Error(message);
    }

    const payload = await response.json();
    return (payload?.data?.brandingSettings || {}) as BrandingSettings;
  },
};

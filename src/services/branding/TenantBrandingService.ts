import { supabase } from '@/integrations/supabase/client';
import { resolveTenantBranding, type ResolvedTenantBranding, type TenantBrandingQuery } from './brandingResolver';
import type { BrandingSettings } from '@/services/quotation/QuotationConfigurationService';

const BRANDING_API_PATH = '/api/v1/tenant-branding';
const BRANDING_API_UNAVAILABLE_RETRY_MS = 30_000;
let brandingApiUnavailableUntil = 0;
type TenantBrandingRequestQuery = TenantBrandingQuery & { tenantId?: string };

function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return normalized.includes('failed to fetch') || normalized.includes('networkerror') || normalized.includes('econnrefused');
}

function isBrandingApiTemporarilyUnavailable(): boolean {
  return Date.now() < brandingApiUnavailableUntil;
}

function markBrandingApiTemporarilyUnavailable() {
  brandingApiUnavailableUntil = Date.now() + BRANDING_API_UNAVAILABLE_RETRY_MS;
}

export function shouldUseTenantBrandingStylesheetEndpoint(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }
  return !isBrandingApiTemporarilyUnavailable();
}

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
    if (!shouldUseTenantBrandingStylesheetEndpoint()) {
      return await resolveBrandingDirectly(query);
    }
    if (isBrandingApiTemporarilyUnavailable()) {
      return await resolveBrandingDirectly(query);
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || '';
    const search = new URLSearchParams();
    if (query.hostname) search.set('hostname', query.hostname);
    if (query.domainCode) search.set('domain_code', query.domainCode);
    if (query.franchiseId) search.set('franchise_id', query.franchiseId);
    if (query.tenantId) search.set('tenant_id', query.tenantId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    try {
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
        const fallbackEligible =
          response.status === 404 ||
          response.status === 405 ||
          (typeof payload?.error !== 'string' && typeof payload?.correlationId !== 'string');
        if (fallbackEligible) {
          return await resolveBrandingDirectly(query);
        }
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load tenant branding';
        const correlationId = typeof payload?.correlationId === 'string' ? payload.correlationId : '';
        if (correlationId) throw new Error(`${message} (ref: ${correlationId})`);
        throw new Error(message);
      }
      const payload = await response.json();
      return payload?.data as ResolvedTenantBranding;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markBrandingApiTemporarilyUnavailable();
      }
      return await resolveBrandingDirectly(query);
    }
  },

  async updateBranding(brandingSettings: BrandingSettings, tenantId?: string): Promise<BrandingSettings> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || '';
    const search = new URLSearchParams();
    if (tenantId) search.set('tenant_id', tenantId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const request = async () =>
      fetch(`${BRANDING_API_PATH}${suffix}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ brandingSettings }),
      });

    try {
      const response = await request();
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const fallbackEligible =
          Boolean(tenantId) &&
          (response.status === 404 ||
            response.status === 405 ||
            (typeof payload?.error !== 'string' && typeof payload?.correlationId !== 'string'));
        if (fallbackEligible && tenantId) {
          return await updateBrandingDirectly(brandingSettings, tenantId);
        }
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to update tenant branding';
        const correlationId = typeof payload?.correlationId === 'string' ? payload.correlationId : '';
        if (correlationId) throw new Error(`${message} (ref: ${correlationId})`);
        throw new Error(message);
      }

      const payload = await response.json();
      return (payload?.data?.brandingSettings || {}) as BrandingSettings;
    } catch (error) {
      if (tenantId) {
        return await updateBrandingDirectly(brandingSettings, tenantId);
      }
      throw error;
    }
  },
};

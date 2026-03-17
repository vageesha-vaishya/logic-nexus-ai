import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useDomain } from '@/contexts/DomainContext';
import { TenantBrandingService } from '@/services/branding/TenantBrandingService';
import type { ResolvedTenantBranding } from '@/services/branding/brandingResolver';
import { buildTenantBrandingCssVariables } from '@/services/branding/brandingResolver';
import { logger } from '@/lib/logger';

type TenantBrandingContextType = {
  branding: ResolvedTenantBranding | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const TenantBrandingContext = createContext<TenantBrandingContextType | undefined>(undefined);

function applyCssVariables(branding: ResolvedTenantBranding | null) {
  const root = document.documentElement;
  const vars = branding ? buildTenantBrandingCssVariables(branding) : {};
  root.style.setProperty('--tenant-brand-primary', vars['--tenant-brand-primary'] || '#2563EB');
  root.style.setProperty('--tenant-brand-secondary', vars['--tenant-brand-secondary'] || '#1D4ED8');
  root.style.setProperty('--tenant-brand-accent', vars['--tenant-brand-accent'] || '#F59E0B');
  root.style.setProperty('--tenant-brand-font', vars['--tenant-brand-font'] || 'Inter, system-ui, sans-serif');
}

function ensureStylesheet(hostname: string, domainCode: string, franchiseId: string) {
  const id = 'tenant-branding-css-endpoint';
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  const params = new URLSearchParams();
  if (hostname) params.set('hostname', hostname);
  if (domainCode) params.set('domain_code', domainCode);
  if (franchiseId) params.set('franchise_id', franchiseId);
  const href = `/api/v1/tenant-branding.css${params.toString() ? `?${params.toString()}` : ''}`;
  if (existing) {
    if (existing.href.endsWith(href)) return;
    existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function applyFavicon(branding: ResolvedTenantBranding | null) {
  const id = 'tenant-branding-favicon';
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  const href = branding?.faviconUrl || '';
  if (!href) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'icon';
  link.href = href;
  document.head.appendChild(link);
}

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const { context } = useCRM();
  const { currentDomain } = useDomain();
  const [branding, setBranding] = useState<ResolvedTenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : ''), []);

  const refresh = async () => {
    if (!context?.tenantId) {
      setBranding(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await TenantBrandingService.getResolvedBranding({
        hostname,
        domainCode: currentDomain?.code || '',
        franchiseId: context?.franchiseId || '',
      });
      setBranding(data);
      applyCssVariables(data);
      applyFavicon(data);
      ensureStylesheet(hostname, currentDomain?.code || '', context?.franchiseId || '');
    } catch (error) {
      logger.error('[TenantBrandingContext] failed to load branding', {
        component: 'TenantBrandingContext',
        message: error instanceof Error ? error.message : 'unknown',
      });
      setBranding(null);
      applyCssVariables(null);
      applyFavicon(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [context?.tenantId, context?.franchiseId, currentDomain?.code, hostname]);

  return (
    <TenantBrandingContext.Provider value={{ branding, loading, refresh }}>
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding() {
  const context = useContext(TenantBrandingContext);
  if (context === undefined) {
    throw new Error('useTenantBranding must be used within a TenantBrandingProvider');
  }
  return context;
}

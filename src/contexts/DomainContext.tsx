import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DomainService, PlatformDomain } from '../services/DomainService';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useCRM } from '@/hooks/useCRM';

interface DomainContextType {
  currentDomain: PlatformDomain | null;
  setDomain: (code: string) => Promise<void>;
  refreshDomains: (forceRefresh?: boolean) => Promise<PlatformDomain[]>;
  availableDomains: PlatformDomain[];
  showDomainSelector: boolean;
  tenantDomainCount: number;
  isPlatformAdmin: boolean;
  isLoading: boolean;
}

const DomainContext = createContext<DomainContextType | undefined>(undefined);

export function DomainContextProvider({ children }: { children: React.ReactNode }) {
  const { context, preferences } = useCRM();
  const [currentDomain, setCurrentDomainState] = useState<PlatformDomain | null>(null);
  const [availableDomains, setAvailableDomains] = useState<PlatformDomain[]>([]);
  const [showDomainSelector, setShowDomainSelector] = useState(false);
  const [tenantDomainCount, setTenantDomainCount] = useState(0);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scopeSignatureRef = useRef<string | null>(null);

  const loadDomains = useCallback(async (forceRefresh = false): Promise<PlatformDomain[]> => {
    try {
      setIsLoading(true);
      logger.debug('Loading platform domains...', { component: 'DomainContext' });
      const authorized = await DomainService.getAuthorizedDomains(forceRefresh, {
        tenantId: preferences?.tenant_id || context.tenantId || null,
        franchiseId: preferences?.franchise_id || context.franchiseId || null,
      });
      const domains = authorized.domains;
      setAvailableDomains(domains);
      setTenantDomainCount(authorized.tenantDomainCount);
      setIsPlatformAdmin(authorized.isPlatformAdmin);
      setShowDomainSelector(authorized.isPlatformAdmin || authorized.tenantDomainCount > 1);

      const savedCode = localStorage.getItem('active_domain_code');
      const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;
      const prefersAmroRoute = currentPath.startsWith('/dashboard/amro');
      const targetDomain =
        (prefersAmroRoute ? domains.find((d) => d.code.toUpperCase() === 'AMRO') : undefined) ||
        domains.find(d => d.code === savedCode) ||
        domains.find(d => d.code === 'LOGISTICS') ||
        domains[0];

      if (targetDomain) {
        setCurrentDomainState(targetDomain);
        logger.info('Platform domain set', { domain: targetDomain.code, component: 'DomainContext' });
      } else {
        logger.warn('No suitable platform domain found', { component: 'DomainContext' });
      }
      return domains;
    } catch (error: any) {
      logger.error('Failed to load domains', { error: error.message, component: 'DomainContext' });
      toast.error(error?.message || 'Failed to load platform domains');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [context.franchiseId, context.tenantId, preferences?.franchise_id, preferences?.tenant_id]);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    const nextSignature = [
      preferences?.tenant_id || context.tenantId || 'none',
      preferences?.franchise_id || context.franchiseId || 'none',
      (preferences?.admin_override_enabled ?? context.adminOverrideEnabled) ? 'override' : 'global',
    ].join(':');

    if (scopeSignatureRef.current === null) {
      scopeSignatureRef.current = nextSignature;
      return;
    }

    if (scopeSignatureRef.current !== nextSignature) {
      scopeSignatureRef.current = nextSignature;
      void loadDomains(true);
    }
  }, [context.adminOverrideEnabled, context.franchiseId, context.tenantId, loadDomains, preferences?.admin_override_enabled, preferences?.franchise_id, preferences?.tenant_id]);

  const setDomain = useCallback(async (code: string) => {
    let domain = availableDomains.find(d => d.code === code);
    if (!domain) {
      const refreshedDomains = await loadDomains(true);
      domain = refreshedDomains.find(d => d.code === code);
    }
    if (domain) {
      setCurrentDomainState(domain);
      localStorage.setItem('active_domain_code', code);
      toast.success(`Switched to ${domain.name}`);
    } else {
      console.warn(`Domain ${code} not found`);
    }
  }, [availableDomains, loadDomains]);

  const value = useMemo(
    () => ({
      currentDomain,
      setDomain,
      refreshDomains: loadDomains,
      availableDomains,
      showDomainSelector,
      tenantDomainCount,
      isPlatformAdmin,
      isLoading,
    }),
    [
      availableDomains,
      currentDomain,
      isLoading,
      isPlatformAdmin,
      loadDomains,
      setDomain,
      showDomainSelector,
      tenantDomainCount,
    ],
  );

  return (
    <DomainContext.Provider
      value={value}
    >
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain() {
  const context = useContext(DomainContext);
  if (context === undefined) {
    throw new Error('useDomain must be used within a DomainContextProvider');
  }
  return context;
}

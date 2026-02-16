import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { useDebug } from '@/hooks/useDebug';
import { PortsService } from '@/services/PortsService';
import { quoteKeys } from './queryKeys';

export function useQuoteData() {
  const { context, supabase, scopedDb } = useCRM();
  const { roles } = useAuth();
  const debug = useDebug('Sales', 'useQuoteData');
  
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  
  // Resolved labels (kept for compatibility)
  const [resolvedContactLabels, setResolvedContactLabels] = useState<Record<string, string>>({});
  const [resolvedServiceLabels, setResolvedServiceLabels] = useState<Record<string, string>>({});
  const [resolvedCarrierLabels, setResolvedCarrierLabels] = useState<Record<string, string>>({});
  const [resolvedPackageCategoryLabels, setResolvedPackageCategoryLabels] = useState<Record<string, string>>({});
  const [resolvedPackageSizeLabels, setResolvedPackageSizeLabels] = useState<Record<string, string>>({});
  const [injectedAccounts, setInjectedAccounts] = useState<any[]>([]);
  const [injectedContacts, setInjectedContacts] = useState<any[]>([]);
  const [injectedOpportunities, setInjectedOpportunities] = useState<any[]>([]);
  const [injectedServices, setInjectedServices] = useState<any[]>([]);

  const tenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id;

  // 1. Fetch Ports (Global Resource)
  const recordTelemetry = (table: string, status: 'success' | 'failure', attempts: number, durationMs: number, errorMsg?: string) => {
    try {
      const w = window as any;
      w.__lnxTelemetry = w.__lnxTelemetry || {};
      const bucket = (w.__lnxTelemetry.quote_data_query = w.__lnxTelemetry.quote_data_query || {});
      const prev = bucket[table] || { successes: 0, failures: 0, totalAttempts: 0 };
      const updated = {
        ...prev,
        successes: prev.successes + (status === 'success' ? 1 : 0),
        failures: prev.failures + (status === 'failure' ? 1 : 0),
        totalAttempts: prev.totalAttempts + attempts,
        lastAttempts: attempts,
        lastDurationMs: durationMs,
        lastError: errorMsg || null,
        lastAt: Date.now()
      };
      bucket[table] = updated;
      debug.debug(`[Telemetry] ${table}: ${status} in ${durationMs}ms after ${attempts} attempts`);
    } catch {
    }
  };

  const { data: ports = [] } = useQuery({
    queryKey: quoteKeys.reference.ports(),
    queryFn: async () => {
      const start = Date.now();
      const portsService = new PortsService(scopedDb);
      try {
        const data = await portsService.getAllPorts();
        console.log(`[useQuoteData] Ports loaded: ${Array.isArray(data) ? data.length : 0}`);
        recordTelemetry('ports_locations', 'success', 1, Date.now() - start);
        return (Array.isArray(data) ? data : []).map((p: any) => ({
          id: p.id,
          name: p.location_name,
          code: p.location_code,
          country_code: p.country
        }));
      } catch (e: any) {
        debug.error('Failed to load ports', { error: e });
        console.error('[useQuoteData] Failed to load ports', e);
        recordTelemetry('ports_locations', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  // 2. Fetch Carriers (Global Resource)
  const { data: carriers = [] } = useQuery({
    queryKey: quoteKeys.reference.carriers(),
    queryFn: async () => {
      const start = Date.now();
      try {
        const { data, error } = await supabase
          .from('carriers')
          .select('id, carrier_name, scac, carrier_type')
          .eq('is_active', true)
          .order('carrier_name');
        if (error) throw error;
        recordTelemetry('carriers', 'success', 1, Date.now() - start);
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load carriers', { error: e });
        console.error('[useQuoteData] Failed to load carriers', e);
        recordTelemetry('carriers', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  // 3. Fetch Accounts (Scoped)
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: quoteKeys.reference.accounts(tenantId),
    queryFn: async () => {
      const start = Date.now();
      // Use scopedDb to automatically enforce tenant isolation
      try {
        const { data, error } = await scopedDb
          .from('accounts')
          .select('id, name')
          .order('name');
        if (error) throw error;
        recordTelemetry('accounts', 'success', 1, Date.now() - start);
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load accounts', { error: e, tenantId });
        console.error('[useQuoteData] Failed to load accounts', e);
        recordTelemetry('accounts', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    enabled: !!tenantId || !!context.tenantId, // Ensure we have a scope context
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  // 4. Fetch Opportunities (Scoped)
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery({
    queryKey: quoteKeys.reference.opportunities(tenantId),
    queryFn: async () => {
      const start = Date.now();
      try {
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('id, name, account_id, contact_id, stage, amount, probability')
          .order('created_at', { ascending: false });
        if (error) throw error;
        recordTelemetry('opportunities', 'success', 1, Date.now() - start);
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load opportunities', { error: e, tenantId });
        console.error('[useQuoteData] Failed to load opportunities', e);
        recordTelemetry('opportunities', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    enabled: !!tenantId || !!context.tenantId,
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  // 5. Fetch Services & Types (Scoped)
  const serviceQuery: any = useQuery({
    queryKey: quoteKeys.reference.services(tenantId),
    queryFn: async () => {
      const start = Date.now();
      // Logic from original fetchServiceData but using scopedDb
      const query = scopedDb
        .from('service_type_mappings')
        .select('service_type_id, service_id, is_default, priority')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      // Note: scopedDb automatically handles tenant_id filtering, 
      // but service_type_mappings might be a shared table with tenant_id override logic.
      // If scopedDb handles it, we don't need manual eq('tenant_id', ...).
      // Assuming scopedDb handles it.

      try {
        const { data: mappingsData, error: mappingsError } = await query;
        if (mappingsError) {
            debug.error('Failed to fetch service mappings', { error: mappingsError });
            throw mappingsError;
        }
        
        const mappingRows = Array.isArray(mappingsData) ? mappingsData : [];
        const serviceIds = [...new Set(mappingRows.map((m: any) => m.service_id).filter(Boolean))];
    
        const servicesById: Record<string, any> = {};
        if (serviceIds.length > 0) {
          const { data: svcData, error: svcErr } = await supabase
            .from('services')
            .select('id, service_name, is_active')
            .in('id', serviceIds)
            .eq('is_active', true);
          if (svcErr) {
              debug.error('Failed to fetch services details', { error: svcErr });
              throw svcErr;
          }
          for (const s of svcData || []) servicesById[String(s.id)] = s;
        }
        
        const uniqueTypeIds = [...new Set(mappingRows
          .map((m: any) => m.service_type_id)
          .filter((id: any) => id !== null && id !== undefined)
          .map(String)
        )];
    
        let serviceTypesForDropdown: { id: string; code: string; name: string }[] = [];
        if (uniqueTypeIds.length > 0) {
          const { data: typeRows, error: typesErr } = await supabase
            .from('service_types')
            .select('id, name, code')
            .in('id', uniqueTypeIds);
          if (!typesErr && Array.isArray(typeRows)) {
            serviceTypesForDropdown = typeRows.map((t: any) => ({
              id: String(t.id),
              code: String(t.code),
              name: t.name || String(t.code),
            }));
          }
        }
        
        const servicesForDropdown = mappingRows
          .map((m: any) => {
            const svc = servicesById[String(m.service_id)];
            if (!svc) return null;
            return {
              id: svc.id,
              service_name: svc.service_name,
              service_type_id: m.service_type_id,
              is_default: m.is_default,
              priority: m.priority,
            };
          })
          .filter(Boolean) as any[];
    
        recordTelemetry('service_type_mappings', 'success', 1, Date.now() - start);
        return { services: servicesForDropdown, serviceTypes: serviceTypesForDropdown };
      } catch (e: any) {
        debug.error('Failed to load services/types', { error: e, tenantId });
        console.error('[useQuoteData] Failed to load services/types', e);
        recordTelemetry('service_type_mappings', 'failure', 1, Date.now() - start, String(e?.message || e));
        return { services: [], serviceTypes: [] };
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });
  const serviceData = serviceQuery.data ?? { services: [], serviceTypes: [] };

  // 6. Fetch Contacts (Scoped)
  const { data: contacts = [] } = useQuery({
    queryKey: quoteKeys.reference.contacts(tenantId),
    queryFn: async () => {
      const start = Date.now();
      try {
        const { data, error } = await scopedDb
          .from('contacts')
          .select('id, first_name, last_name, account_id')
          .order('first_name');
        if (error) throw error;
        recordTelemetry('contacts', 'success', 1, Date.now() - start);
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load contacts', { error: e, tenantId });
        console.error('[useQuoteData] Failed to load contacts', e);
        recordTelemetry('contacts', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    enabled: !!tenantId || !!context.tenantId,
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  // 7. Fetch Shipping Terms (Global Resource)
  const { data: shippingTerms = [] } = useQuery({
    queryKey: quoteKeys.reference.shippingTerms(),
    queryFn: async () => {
      const start = Date.now();
      try {
        const { data, error } = await supabase
          .from('incoterms')
          .select('id, name:incoterm_name, code:incoterm_code, description')
          .eq('is_active', true)
          .order('incoterm_code');
        if (error) throw error;
        recordTelemetry('incoterms', 'success', 1, Date.now() - start);
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load shipping terms', { error: e });
        console.error('[useQuoteData] Failed to load shipping terms', e);
        recordTelemetry('incoterms', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  // 8. Fetch Currencies (Global Resource)
  const { data: currencies = [] } = useQuery({
    queryKey: quoteKeys.reference.currencies(),
    queryFn: async () => {
      const start = Date.now();
      try {
        const { data, error } = await supabase
          .from('currencies')
          .select('id, code, name, symbol')
          .eq('is_active', true)
          .order('code');
        if (error) throw error;
        recordTelemetry('currencies', 'success', 1, Date.now() - start);
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load currencies', { error: e });
        console.error('[useQuoteData] Failed to load currencies', e);
        recordTelemetry('currencies', 'failure', 1, Date.now() - start, String(e?.message || e));
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    retryDelay: attemptIndex => Math.min(800 * Math.pow(2, attemptIndex), 4000),
  });

  return {
    currencies,
    ports,
    carriers,
    shippingTerms,
    accounts: [...accounts, ...injectedAccounts],
    opportunities: [...opportunities, ...injectedOpportunities],
    contacts: [...contacts, ...injectedContacts],
    serviceTypes: serviceData.serviceTypes,
    services: [...serviceData.services, ...injectedServices],
    
    // Legacy support
    isLoading: serviceQuery.isLoading,
    isLoadingOpportunities,
    setAccounts: setInjectedAccounts,
    setContacts: setInjectedContacts,
    setOpportunities: setInjectedOpportunities,
    setServices: setInjectedServices,
    resolvedContactLabels,
    resolvedServiceLabels,
    resolvedCarrierLabels,
    setResolvedContactLabels,
    setResolvedServiceLabels,
    setResolvedCarrierLabels,
    setResolvedTenantId,
    resolvedTenantId,
    refetchAccounts,
    
    // Injection methods
    injectAccount: (acc: any) => setInjectedAccounts(prev => [...prev, acc]),
    injectContact: (con: any) => setInjectedContacts(prev => [...prev, con]),
    injectOpportunity: (opp: any) => setInjectedOpportunities(prev => [...prev, opp]),
  };
}

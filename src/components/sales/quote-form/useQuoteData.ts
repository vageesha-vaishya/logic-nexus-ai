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
  const { data: ports = [] } = useQuery({
    queryKey: quoteKeys.reference.ports(),
    queryFn: async () => {
      const portsService = new PortsService(scopedDb);
      const data = await portsService.getAllPorts();
      
      return data.map((p: any) => ({
        id: p.id,
        name: p.location_name,
        code: p.location_code,
        country_code: p.country
      }));
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 2. Fetch Carriers (Global Resource)
  const { data: carriers = [] } = useQuery({
    queryKey: quoteKeys.reference.carriers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carriers')
        .select('id, carrier_name, scac, carrier_type')
        .eq('is_active', true)
        .order('carrier_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 3. Fetch Accounts (Scoped)
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: quoteKeys.reference.accounts(tenantId),
    queryFn: async () => {
      // Use scopedDb to automatically enforce tenant isolation
      const { data, error } = await scopedDb
        .from('accounts')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId || !!context.tenantId, // Ensure we have a scope context
  });

  // 4. Fetch Opportunities (Scoped)
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery({
    queryKey: quoteKeys.reference.opportunities(tenantId),
    queryFn: async () => {
      const { data, error } = await scopedDb
        .from('opportunities')
        .select('id, name, account_id, contact_id, stage, amount, probability')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId || !!context.tenantId,
  });

  // 5. Fetch Services & Types (Scoped)
  const serviceQuery: any = useQuery({
    queryKey: quoteKeys.reference.services(tenantId),
    queryFn: async () => {
      // Logic from original fetchServiceData but using scopedDb
      let query = scopedDb
        .from('service_type_mappings')
        .select('service_type_id, service_id, is_default, priority')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      // Note: scopedDb automatically handles tenant_id filtering, 
      // but service_type_mappings might be a shared table with tenant_id override logic.
      // If scopedDb handles it, we don't need manual eq('tenant_id', ...).
      // Assuming scopedDb handles it.

      const { data: mappingsData, error: mappingsError } = await query;
      if (mappingsError) {
          debug.error('Failed to fetch service mappings', { error: mappingsError });
          throw mappingsError;
      }
      
      const mappingRows = Array.isArray(mappingsData) ? mappingsData : [];
      const serviceIds = [...new Set(mappingRows.map((m: any) => m.service_id).filter(Boolean))];

      const servicesById: Record<string, any> = {};
      if (serviceIds.length > 0) {
        // Services table might be global or scoped. Assuming global reference but filtered by mapping.
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

      return { services: servicesForDropdown, serviceTypes: serviceTypesForDropdown };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const serviceData = serviceQuery.data ?? { services: [], serviceTypes: [] };

  // 6. Fetch Contacts (Scoped)
  const { data: contacts = [] } = useQuery({
    queryKey: quoteKeys.reference.contacts(tenantId),
    queryFn: async () => {
      const { data, error } = await scopedDb
        .from('contacts')
        .select('id, first_name, last_name, account_id')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId || !!context.tenantId,
  });

  return {
    ports,
    carriers,
    accounts: [...accounts, ...injectedAccounts],
    opportunities: [...opportunities, ...injectedOpportunities],
    contacts: [...contacts, ...injectedContacts],
    serviceTypes: serviceData.serviceTypes,
    services: [...serviceData.services, ...injectedServices],
    
    // Legacy support
    isLoading: serviceQuery.isLoading,
    resolvedContactLabels,
    resolvedServiceLabels,
    resolvedCarrierLabels,
    setResolvedContactLabels,
    setResolvedServiceLabels,
    setResolvedCarrierLabels,
    setResolvedTenantId,
    refetchAccounts,
    
    // Injection methods
    injectAccount: (acc: any) => setInjectedAccounts(prev => [...prev, acc]),
    injectContact: (con: any) => setInjectedContacts(prev => [...prev, con]),
    injectOpportunity: (opp: any) => setInjectedOpportunities(prev => [...prev, opp]),
  };
}

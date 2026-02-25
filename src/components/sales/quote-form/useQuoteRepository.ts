import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UseFormReturn } from 'react-hook-form';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { useDebug } from '@/hooks/useDebug';
import { toast } from 'sonner';
import { PortsService } from '@/services/PortsService';
import { quoteKeys } from './queryKeys';
import {
  QuoteFormValues,
  PortOption,
  CarrierOption,
  AccountOption,
  ContactOption,
  OpportunityOption,
  ServiceOption,
  ServiceTypeOption,
} from './types';
import { useQuoteContext } from './QuoteContext';
import { parseTransitTimeToHours } from '@/lib/transit-time';
import { dbField } from '@/lib/schemas/field-registry';
import { useAppFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function deduplicateById<T extends { id: string }>(injected: T[], queried: T[]): T[] {
  const merged = [...injected, ...queried];
  const seen = new Set<string>();
  return merged.filter(item => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface QuoteRepositoryContextData {
  serviceTypes: ServiceTypeOption[];
  services: ServiceOption[];
  carriers: CarrierOption[];
  ports: PortOption[];
  shippingTerms: any[];
  currencies: any[];
  chargeCategories: any[];
  chargeSides: any[];
  chargeBases: any[];
  serviceModes: any[];
   tradeDirections: any[];
   serviceLegCategories: any[];
  containerTypes: any[];
  containerSizes: any[];
  accounts: AccountOption[];
  contacts: ContactOption[];
  opportunities: OpportunityOption[];
  isLoadingOpportunities: boolean;
  isLoadingServices: boolean;
  resolvedTenantId: string | null;
  setResolvedTenantId: (id: string | null) => void;
  setAccounts: (updater: (prev: AccountOption[]) => AccountOption[]) => void;
  setContacts: (updater: (prev: ContactOption[]) => ContactOption[]) => void;
  setOpportunities: (updater: (prev: OpportunityOption[]) => OpportunityOption[]) => void;
  setServices: (updater: (prev: ServiceOption[]) => ServiceOption[]) => void;
}

export interface SaveQuoteParams {
  quoteId?: string;
  data: QuoteFormValues;
}

export const buildMissingOptionsOrChargesAnomaly = (
  version: any,
  quoteId: string,
  opts?: { strictGuards?: boolean }
) => {
  const options = Array.isArray(version.quotation_version_options)
    ? version.quotation_version_options
    : [];

  const optionCount = options.length;

  const chargeCount = options.reduce((sum: number, opt: any) => {
    const legs = Array.isArray(opt.quotation_version_option_legs)
      ? opt.quotation_version_option_legs
      : [];
    const legCharges = legs.reduce((innerSum: number, leg: any) => {
      const charges = Array.isArray(leg.quotation_version_option_leg_charges)
        ? leg.quotation_version_option_leg_charges
        : [];
      return innerSum + charges.length;
    }, 0);
    return sum + legCharges;
  }, 0);

  const hasMissingOptionsOrCharges = optionCount === 0 || chargeCount === 0;
  const strictGuards = opts?.strictGuards ?? false;

  return {
    type: 'MISSING_OPTIONS_OR_CHARGES',
    severity: strictGuards && hasMissingOptionsOrCharges ? 'ERROR' : 'WARNING',
    message:
      strictGuards && hasMissingOptionsOrCharges
        ? 'Quote version saved with missing options or charges (Phase2 Guard)'
        : 'Quote version saved without options or charges',
    timestamp: new Date().toISOString(),
    quote_id: quoteId,
    version_id: version.id,
    version_number: version.version_number,
    tenant_id: version.tenant_id,
    option_count: optionCount,
    charge_count: chargeCount,
  };
};

export interface QuoteRepositoryFormOps {
  isHydrating: boolean;
  saveQuote: (params: SaveQuoteParams) => Promise<string>;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// A. Context-level hook: reference data + entity injection
//    Called by QuoteDataProvider (no form instance needed)
// ---------------------------------------------------------------------------

export function useQuoteRepositoryContext(): QuoteRepositoryContextData {
  const { context, supabase, scopedDb } = useCRM();
  const { roles } = useAuth();
  const debug = useDebug('Sales', 'useQuoteRepository');

  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [injectedAccounts, setInjectedAccounts] = useState<AccountOption[]>([]);
  const [injectedContacts, setInjectedContacts] = useState<ContactOption[]>([]);
  const [injectedOpportunities, setInjectedOpportunities] = useState<OpportunityOption[]>([]);
  const [injectedServices, setInjectedServices] = useState<ServiceOption[]>([]);

  const tenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id;

  // 1. Ports
  const { data: ports = [] } = useQuery<PortOption[]>({
    queryKey: quoteKeys.reference.ports(),
    queryFn: async () => {
      const portsService = new PortsService(scopedDb);
      try {
        const data = await portsService.getAllPorts();
        console.log(`[useQuoteRepository] Ports loaded: ${data.length}`);
        return data.map((p: any) => ({
          id: p.id,
          name: p.location_name,
          code: p.location_code,
          country_code: p.country,
        }));
      } catch (err: any) {
        console.error('[useQuoteRepository] Failed to load ports', err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour for global ports
  });

  // 2. Carriers
  const { data: carriers = [] } = useQuery<CarrierOption[]>({
    queryKey: quoteKeys.reference.carriers(),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('carriers')
          .select('id, carrier_name, scac, carrier_type')
          .eq('is_active', true)
          .order('carrier_name');
        if (error) throw error;
        return (data || []) as CarrierOption[];
      } catch (e: any) {
        debug.error('Failed to load carriers', { error: e });
        console.error('[useQuoteRepository] Failed to load carriers', e);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 3. Accounts
  const { data: accounts = [] } = useQuery<AccountOption[]>({
    queryKey: quoteKeys.reference.accounts(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .order('name');
        if (error) throw error;
        return (data || []) as AccountOption[];
      } catch (e: any) {
        debug.error('Failed to load accounts', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load accounts', e);
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // 4. Opportunities
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery<OpportunityOption[]>({
    queryKey: quoteKeys.reference.opportunities(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await (supabase as any)
          .from('opportunities')
          .select('id, name, account_id, contact_id, stage, amount, probability')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as OpportunityOption[];
      } catch (e: any) {
        debug.error('Failed to load opportunities', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load opportunities', e);
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // 5. Services & Types
  const serviceQuery = useQuery({
    queryKey: quoteKeys.reference.services(tenantId),
    queryFn: async () => {
      let query = (supabase as any)
        .from('service_type_mappings')
        .select('service_type_id, service_id, is_default, priority')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (tenantId) {
        // Fetch mappings for this tenant OR global mappings
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      } else {
        query = query.is('tenant_id', null);
      }

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
          const { data: svcData, error: svcErr } = await (supabase as any)
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

        debug.log('Fetched services data', {
          tenantId,
          mappingsCount: mappingRows.length,
          servicesCount: Object.keys(servicesById).length,
        });

        const uniqueTypeIds = [...new Set(
          mappingRows
            .map((m: any) => m.service_type_id)
            .filter((id: any) => id !== null && id !== undefined)
            .map(String),
        )];

        let serviceTypesForDropdown: ServiceTypeOption[] = [];
        if (uniqueTypeIds.length > 0) {
          const { data: typeRows, error: typesErr } = await (supabase as any)
            .from('service_types')
            .select('id, name, code, transport_modes:transport_modes(code)')
            .in('id', uniqueTypeIds);
          if (!typesErr && Array.isArray(typeRows)) {
            serviceTypesForDropdown = typeRows.map((t: any) => ({
              id: String(t.id),
              code: String(t.code),
              name: t.name || String(t.code),
              transport_modes: t.transport_modes,
            }));
          }
        }

        const servicesForDropdown: ServiceOption[] = mappingRows
          .map((m: any) => {
            const svc = servicesById[String(m.service_id)];
            if (!svc) return null;
            return {
              id: String(svc.id),
              service_name: svc.service_name,
              service_type_id: String(m.service_type_id),
              is_default: m.is_default,
              priority: m.priority,
            };
          })
          .filter(Boolean) as ServiceOption[];

        return { services: servicesForDropdown, serviceTypes: serviceTypesForDropdown };
      } catch (e: any) {
        debug.error('Failed to load services/types', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load services/types', e);
        return { services: [], serviceTypes: [] };
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const serviceData = serviceQuery.data ?? { services: [], serviceTypes: [] };

  // 6. Contacts
  const { data: contacts = [] } = useQuery<ContactOption[]>({
    queryKey: quoteKeys.reference.contacts(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, account_id')
          .eq('tenant_id', tenantId)
          .order('first_name');
        if (error) throw error;
        return (data || []) as ContactOption[];
      } catch (e: any) {
        debug.error('Failed to load contacts', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load contacts', e);
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // 7. Shipping Terms
  const { data: shippingTerms = [] } = useQuery<any[]>({
    queryKey: quoteKeys.reference.shippingTerms(),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('incoterms')
          .select('id, name:incoterm_name, code:incoterm_code, description')
          .eq('is_active', true)
          .order('incoterm_code');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load shipping terms', { error: e });
        console.error('[useQuoteRepository] Failed to load shipping terms', e);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  // 8. Currencies
  const { data: currencies = [] } = useQuery<any[]>({
    queryKey: quoteKeys.reference.currencies(),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('currencies')
          .select('id, code, name, symbol')
          .eq('is_active', true)
          .order('code');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load currencies', { error: e });
        console.error('[useQuoteRepository] Failed to load currencies', e);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  // 9. Charge Categories
  const { data: chargeCategories = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'charge_categories'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('charge_categories', true)
          .select('id, code, name');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load charge categories', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load charge categories', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 10. Charge Sides
  const { data: chargeSides = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'charge_sides'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('charge_sides', true)
          .select('id, code, name');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load charge sides', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load charge sides', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 11. Charge Bases
  const { data: chargeBases = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'charge_bases'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('charge_bases', true)
          .select('id, code, name');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load charge bases', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load charge bases', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 12. Service Modes
  const { data: serviceModes = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'service_modes'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('service_modes', true)
          .select('id, code, name');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load service modes', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load service modes', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 13. Trade Directions
  const { data: tradeDirections = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'trade_directions'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('trade_directions', true)
          .select('id, code, name');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load trade directions', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load trade directions', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 14. Service Leg Categories
  const { data: serviceLegCategories = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'service_leg_categories'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('service_leg_categories', true)
          .select('id, name, code, description, sort_order');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load service leg categories', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load service leg categories', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 15. Container Types
  const { data: containerTypes = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'container_types'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('container_types', true)
          .select('id, name, code');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load container types', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load container types', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  // 16. Container Sizes
  const { data: containerSizes = [] } = useQuery<any[]>({
    queryKey: ['quote', 'reference', 'container_sizes'],
    queryFn: async () => {
      try {
        const { data, error } = await scopedDb
          .from('container_sizes', true)
          .select('id, name, code');
        if (error) throw error;
        return data || [];
      } catch (e: any) {
        debug.error('Failed to load container sizes', { error: e, tenantId });
        console.error('[useQuoteRepository] Failed to load container sizes', e);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 60,
  });

  return {
    serviceTypes: serviceData.serviceTypes,
    services: deduplicateById(injectedServices, serviceData.services),
    carriers,
    ports,
    shippingTerms,
    currencies,
    chargeCategories,
    chargeSides,
    chargeBases,
    serviceModes,
    tradeDirections,
    serviceLegCategories,
    containerTypes,
    containerSizes,
    accounts: deduplicateById(injectedAccounts, accounts),
    contacts: deduplicateById(injectedContacts, contacts),
    opportunities: deduplicateById(injectedOpportunities, opportunities),
    isLoadingOpportunities,
    isLoadingServices: serviceQuery.isLoading,
    setResolvedTenantId,
    resolvedTenantId: tenantId ?? null,
    setAccounts: (updater) => setInjectedAccounts(updater),
    setContacts: (updater) => setInjectedContacts(updater),
    setOpportunities: (updater) => setInjectedOpportunities(updater),
    setServices: (updater) => setInjectedServices(updater),
  };
}

// ---------------------------------------------------------------------------
// B. Form-level hook: hydration + save mutation
//    Called by QuoteFormContent (needs form instance + quoteId)
// ---------------------------------------------------------------------------

export function useQuoteRepositoryForm(opts: {
  form: UseFormReturn<QuoteFormValues>;
  quoteId?: string;
}): QuoteRepositoryFormOps {
  const { form, quoteId } = opts;
  const { supabase, scopedDb, context } = useCRM();
  const { roles } = useAuth();
  const debug = useDebug('Sales', 'useQuoteRepositoryForm');
  const queryClient = useQueryClient();
  const { enabled: phase2GuardsEnabled } = useAppFeatureFlag(
    FEATURE_FLAGS.QUOTATION_PHASE2_GUARDS,
    false
  );
  const hydratedQuoteId = useRef<string | null>(null);
  const {
    resolvedTenantId,
    setResolvedTenantId,
    setServices,
    setAccounts,
    setContacts,
    setOpportunities,
    accounts,
    contacts,
    opportunities,
    serviceTypes,
  } = useQuoteContext();

  // --- Hydration: fetch existing quote via React Query ---

  const coreQuery = useQuery({
    queryKey: quoteKeys.hydration(quoteId!)?.concat(['core']),
    queryFn: async ({ signal }) => {
      const start = performance.now();
      const [quoteResult, itemsResult, cargoResult] = await Promise.all([
        scopedDb.from('quotes').select('*').eq('id', quoteId!).maybeSingle().abortSignal(signal as any),
        scopedDb.from('quote_items', true).select('*').eq('quote_id', quoteId!).order('line_number', { ascending: true }).abortSignal(signal as any),
        scopedDb.from('quote_cargo_configurations', true).select('*').eq('quote_id', quoteId!).abortSignal(signal as any),
      ]);
      
      if (quoteResult.error) throw quoteResult.error;
      if (!quoteResult.data) return null;

      const duration = performance.now() - start;
      if (duration > 1000) {
        console.warn(`[useQuoteRepository] Slow hydration: ${duration.toFixed(2)}ms`);
      } else {
        console.log(`[useQuoteRepository] Hydration took: ${duration.toFixed(2)}ms`);
      }

      return {
        quote: quoteResult.data,
        items: itemsResult.data,
        cargo: cargoResult.data,
      };
    },
    enabled: !!quoteId,
    staleTime: 0, // Always fetch fresh data on mount to support cross-module switches
    refetchOnMount: true,
  });

  const versionsQuery = useQuery({
    queryKey: quoteKeys.hydration(quoteId!)?.concat(['versions']),
    queryFn: async ({ signal }) => {
      const start = performance.now();
      const { data, error } = await scopedDb.from('quotation_versions')
            .select(`
                id, 
                version_number, 
                quotation_version_options (
                    id, 
                    is_selected, 
                    total_amount, 
                    quote_currency:quote_currency_id (code),
                    total_transit_days, 
                    quotation_version_option_legs (
                        id,
                        sort_order,
                        mode,
                        provider_id,
                        origin_location,
                        destination_location,
                        origin_location_id,
                        destination_location_id,
                        transit_time_hours,
                        flight_number,
                        voyage_number,
                        departure_date,
                        arrival_date,
                        quotation_version_option_leg_charges:quote_charges (
                            id,
                            amount,
                            rate,
                            quantity,
                            currency_id,
                            currency:currencies(code),
                            charge_code:category_id,
                            charge_sides(code),
                            charge_side_id,
                            basis:charge_bases(code),
                            unit:charge_bases(code),
                            description:charge_categories(name),
                            note
                        )
                    )
                )
            `)
            .eq('quote_id', quoteId!)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle()
            .abortSignal(signal as any);

      if (error) throw error;
      
      const duration = performance.now() - start;
      if (duration > 1000) {
        console.warn(`[useQuoteRepository] Slow versions hydration: ${duration.toFixed(2)}ms`);
      } else {
        console.log(`[useQuoteRepository] Versions hydration took: ${duration.toFixed(2)}ms`);
      }
      
      return data;
    },
    enabled: !!quoteId,
    staleTime: 0, // Always fetch fresh versions
  });

  // Log hydration data for debugging
  useEffect(() => {
    if (coreQuery.data) {
        console.log('[useQuoteRepository] Core Data Loaded:', {
            quoteId,
            itemsCount: coreQuery.data.items?.length,
            cargoCount: coreQuery.data.cargo?.length
        });
    }
  }, [coreQuery.data, quoteId]);

  // Combine loading states
  // We only block UI for core data. Versions can load in background.
  const isHydrating = coreQuery.isLoading; 



  // --- Side effect: populate form + inject missing CRM entities ---

  useEffect(() => {
    if (!coreQuery.data) return;

    const { quote, items, cargo: cargoConfigs } = coreQuery.data;
    const latestVersion = versionsQuery.data;

    // Map Options and Legs (Moved up for progressive loading)
        const mappedOptions = latestVersion?.quotation_version_options?.map((opt: any) => {
        // Calculate total from leg charges if option total is missing/zero
        const legs = opt.quotation_version_option_legs || [];
        const chargesTotal = legs.reduce((acc: number, leg: any) => {
            const legCharges = leg.quotation_version_option_leg_charges || [];
            return acc + legCharges.reduce((sum: number, c: any) => {
                const side = c.charge_sides?.code?.toLowerCase();
                if (side === 'sell' || side === 'revenue') {
                    return sum + (Number(c.amount) || 0);
                }
                return sum;
            }, 0);
        }, 0);
        
        const effectiveTotal = (Number(opt.total_amount) > 0) ? Number(opt.total_amount) : chargesTotal;
        
        return {
            id: opt.id,
            is_primary: opt.is_selected,
            total_amount: effectiveTotal,
            currency: opt.quote_currency?.code || 'USD',
            transit_time_days: (opt.total_transit_days == null ? undefined : Number(opt.total_transit_days)),
            legs: legs.map((leg: any) => ({
                id: leg.id,
                sequence_number: leg.sort_order,
                transport_mode: leg.mode,
                carrier_id: leg.provider_id ? String(leg.provider_id) : undefined,
                origin_location_id: leg.origin_location_id ? String(leg.origin_location_id) : undefined,
                destination_location_id: leg.destination_location_id ? String(leg.destination_location_id) : undefined,
                origin_location_name: leg.origin_location,
                destination_location_name: leg.destination_location,
                origin: leg.origin_location,
                destination: leg.destination_location,
                flight_number: leg.flight_number,
                voyage_number: leg.voyage_number,
                departure_date: leg.departure_date,
                arrival_date: leg.arrival_date,
                transit_time_days: leg.transit_time_hours ? Math.ceil(leg.transit_time_hours / 24) : undefined,
                charges: (leg.quotation_version_option_leg_charges || []).map((c: any) => ({
                    id: c.id,
                    description: c.description?.name || 'Charge',
                    amount: Number(c.amount || 0),
                    currency: c.currency?.code || 'USD',
                    charge_code: c.charge_code,
                    basis: c.basis?.code,
                    unit_price: Number(c.rate || 0),
                    quantity: Number(c.quantity || 1),
                    note: c.note
                }))
            })).sort((a: any, b: any) => a.sequence_number - b.sequence_number) || []
        };
    }) || [];

    // Progressive Loading Logic
    const isDirty = form.formState.isDirty;
    const currentOptions = form.getValues('options');
    const hasOptions = currentOptions && currentOptions.length > 0;

    // Case 1: Progressive Injection (Dirty form, but options just arrived)
    if (isDirty && !hasOptions && mappedOptions.length > 0) {
        console.log('[useQuoteRepository] Progressive hydration: Injecting late-arriving options');
        form.reset({
            ...form.getValues(),
            options: mappedOptions
        }, { keepDirty: true });
        return;
    }

    // Case 2: Dirty form check
    // If we haven't hydrated this quote ID yet, we MUST hydrate even if dirty (e.g. from default values)
    // If we HAVE hydrated this ID, and it's dirty, AND the data hasn't changed significantly, we skip.
    // However, if the user explicitly saved or we need to ensure fresh data (like switching modes), we should allow re-hydration.
    // We'll relax the check: Only skip if it's the SAME quote ID and we've already done an initial hydration.
    if (isDirty && hydratedQuoteId.current === quote.id) {
        // Double check if we really should skip. If the form is dirty, we usually don't want to overwrite user work.
        // But if the "work" was just default values, we should overwrite.
        // For now, we'll assume that if the user is switching context, the parent component handles the reset (which clears isDirty).
        // So this check is mainly for background re-fetches.
        debug.log('[useQuoteRepository] Skipping hydration because form is dirty and already hydrated');
        return;
    }

    // Case 3: Full Reset (Clean form)
    if (quote.tenant_id) {
      setResolvedTenantId(String(quote.tenant_id));
    }

    debug.log('[useQuoteRepository] Hydrating form with quote data:', {
      id: quote.id,
      version: latestVersion?.version_number
    });

    const primaryOption = mappedOptions.find((o: any) => o.is_primary) || mappedOptions[0];
    const initialShippingAmount = primaryOption?.total_amount 
        ? String(primaryOption.total_amount) 
        : (quote.shipping_amount ? String(quote.shipping_amount) : '0');

    const normalizeModeKey = (value: string | undefined | null) => {
      const v = (value || '').toLowerCase();
      if (!v) return '';
      if (v.includes('ocean') || v.includes('sea') || v.includes('maritime')) return 'ocean';
      if (v.includes('air')) return 'air';
      if (v.includes('rail')) return 'rail';
      if (v.includes('truck') || v.includes('road') || v.includes('inland')) return 'road';
      if (v.includes('courier') || v.includes('express') || v.includes('parcel')) return 'courier';
      if (v.includes('move') || v.includes('mover') || v.includes('packer')) return 'moving';
      return v;
    };

    let resolvedServiceTypeId = quote.service_type_id ? String(quote.service_type_id) : '';
    if (!resolvedServiceTypeId && primaryOption && primaryOption.legs.length > 0 && serviceTypes && serviceTypes.length > 0) {
        const mainMode = primaryOption.legs.find((l: any) => l.transport_mode === 'ocean' || l.transport_mode === 'air')?.transport_mode || primaryOption.legs[0].transport_mode;
        const mainKey = normalizeModeKey(mainMode);
        if (mainKey) {
          const foundType = serviceTypes.find((st: any) => {
            const tm = (st as any).transport_modes;
            const tmKey = normalizeModeKey(tm?.code);
            if (tmKey && tmKey === mainKey) return true;

            const nameKey = normalizeModeKey(st.name);
            const codeKey = normalizeModeKey(st.code);
            if (nameKey && nameKey === mainKey) return true;
            if (codeKey && codeKey === mainKey) return true;

            const lowerMain = (mainMode || '').toLowerCase();
            return !!(st.name?.toLowerCase().includes(lowerMain) || st.code?.toLowerCase() === lowerMain);
          });
          if (foundType) {
            resolvedServiceTypeId = String(foundType.id);
          }
        }
    }

    // Hoist root-level fields from items/cargo for UI consistency
    const firstItem = items?.[0];
    const derivedCommodity = firstItem?.description || firstItem?.product_name || '';
    const derivedHtsCode = firstItem?.attributes?.hs_code || '';
    const derivedTotalWeight = items?.reduce((sum: number, item: any) => sum + (Number(item.weight_kg) || 0), 0) || 0;
    const derivedTotalVolume = items?.reduce((sum: number, item: any) => sum + (Number(item.volume_cbm) || 0), 0) || 0;
    const derivedHazmat = firstItem?.attributes?.hazmat || undefined;

    form.reset({
      title: quote.title,
      description: quote.description || '',
      status: quote.status,
      service_type_id: resolvedServiceTypeId,
      service_id: quote.service_id ? String(quote.service_id) : '',
      incoterms: quote.incoterms || '',
      shipping_term_id: quote.incoterm_id ? String(quote.incoterm_id) : (quote.shipping_term_id ? String(quote.shipping_term_id) : ''),
      commodity: derivedCommodity,
      hts_code: derivedHtsCode,
      total_weight: String(derivedTotalWeight),
      total_volume: String(derivedTotalVolume),
      hazmat_details: derivedHazmat,
      trade_direction: ['import', 'export'].includes((quote.regulatory_data as any)?.trade_direction) 
        ? (quote.regulatory_data as any)?.trade_direction 
        : undefined,
      currency_id: quote.currency_id ? String(quote.currency_id) : '',
      carrier_id: quote.carrier_id ? String(quote.carrier_id) : '',
      origin_port_id: quote.origin_port_id ? String(quote.origin_port_id) : '',
      destination_port_id: quote.destination_port_id ? String(quote.destination_port_id) : '',
      account_id: quote.account_id ? String(quote.account_id) : '',
      contact_id: quote.contact_id ? String(quote.contact_id) : '',
      opportunity_id: quote.opportunity_id ? String(quote.opportunity_id) : '',
      valid_until: quote.valid_until ? new Date(quote.valid_until).toISOString().split('T')[0] : '',
      pickup_date: (quote.ready_date || quote.pickup_date) ? new Date(quote.ready_date || quote.pickup_date).toISOString().split('T')[0] : '',
      delivery_deadline: quote.delivery_deadline ? new Date(quote.delivery_deadline).toISOString().split('T')[0] : '',
      vehicle_type: quote.vehicle_type || '',
      special_handling: Array.isArray(quote.special_handling) ? quote.special_handling.join(', ') : (quote.special_handling || ''),
      tax_percent: quote.tax_percent ? String(quote.tax_percent) : '0',
      shipping_amount: initialShippingAmount,
      terms_conditions: quote.terms_conditions || '',
      notes: quote.notes || '',
      options: mappedOptions,
      items: items
        ? items.map((item: any) => ({
            line_number: item.line_number,
            product_name: item.product_name,
            commodity_id: item.commodity_id ? String(item.commodity_id) : '',
            aes_hts_id: item.aes_hts_id ? String(item.aes_hts_id) : '',
            description: item.description || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            package_category_id: item.package_category_id ? String(item.package_category_id) : '',
            package_size_id: item.package_size_id ? String(item.package_size_id) : '',
            attributes: {
                weight: item.weight_kg || 0,
                volume: item.volume_cbm || 0,
                length: item.attributes?.length || 0,
                width: item.attributes?.width || 0,
                height: item.attributes?.height || 0,
                hs_code: item.attributes?.hs_code || '',
                stackable: item.attributes?.stackable || false,
                hazmat: item.attributes?.hazmat || undefined,
            }
          })) : [],
      cargo_configurations: cargoConfigs
        ? cargoConfigs.map((c: any) => ({
            id: c.id,
            transport_mode: c.transport_mode,
            cargo_type: c.cargo_type,
            container_type: c.container_type || undefined,
            container_size: c.container_size || undefined,
            quantity: c.quantity,
            unit_weight_kg: c.unit_weight_kg || undefined,
            unit_volume_cbm: c.unit_volume_cbm || undefined,
            length_cm: c.length_cm || undefined,
            width_cm: c.width_cm || undefined,
            height_cm: c.height_cm || undefined,
            is_hazardous: c.is_hazardous,
            hazardous_class: c.hazardous_class || undefined,
            un_number: c.un_number || undefined,
            is_temperature_controlled: c.is_temperature_controlled,
            temperature_min: c.temperature_min || undefined,
            temperature_max: c.temperature_max || undefined,
            temperature_unit: c.temperature_unit || 'C',
            package_category_id: c.package_category_id ? String(c.package_category_id) : undefined,
            package_size_id: c.package_size_id ? String(c.package_size_id) : undefined,
            remarks: c.remarks || undefined,
          }))
        : [],
    });

    // Inject missing CRM entities into dropdowns
    const injectMissingEntities = async () => {
      if (quote.service_id) {
        const { data: svc } = await scopedDb
          .from('services')
          .select('id, service_name, service_type_id')
          .eq('id', quote.service_id)
          .maybeSingle();
        if (svc) {
          setServices((prev) => {
            if (prev.find((s) => String(s.id) === String(svc.id))) return prev;
            return [...prev, { 
              ...svc, 
              id: String(svc.id), 
              service_type_id: svc.service_type_id ? String(svc.service_type_id) : '', 
              is_default: false, 
              priority: 0 
            }];
          });
        }
      }

      const accId = quote.account_id ? String(quote.account_id) : '';
      const conId = quote.contact_id ? String(quote.contact_id) : '';
      const oppId = quote.opportunity_id ? String(quote.opportunity_id) : '';

      if (accId && !accounts.some((a) => String(a.id) === accId)) {
        const { data: acc } = await scopedDb
          .from('accounts')
          .select('id, name')
          .eq('id', accId)
          .maybeSingle();
        if (acc) {
          setAccounts((prev) => {
            if (prev.some((a) => String(a.id) === String(acc.id))) return prev;
            return [{ id: String(acc.id), name: acc.name || 'Account' }, ...prev];
          });
        }
      }

      if (conId && !contacts.some((c) => String(c.id) === conId)) {
        const { data: con } = await scopedDb
          .from('contacts')
          .select('id, first_name, last_name, account_id')
          .eq('id', conId)
          .maybeSingle();
        if (con) {
          setContacts((prev) => {
            if (prev.some((c) => String(c.id) === String(con.id))) return prev;
            return [
              {
                id: String(con.id),
                first_name: con.first_name || '',
                last_name: con.last_name || '',
                account_id: con.account_id ? String(con.account_id) : null,
              },
              ...prev,
            ];
          });
        }
      }

      if (oppId && !opportunities.some((o) => String(o.id) === oppId)) {
        const { data: opp } = await scopedDb
          .from('opportunities')
          .select('id, name, account_id, contact_id')
          .eq('id', oppId)
          .maybeSingle();
        if (opp) {
          setOpportunities((prev) => {
            if (prev.some((o) => String(o.id) === String(opp.id))) return prev;
            return [
              {
                id: String(opp.id),
                name: opp.name || 'Opportunity',
                account_id: opp.account_id ? String(opp.account_id) : null,
                contact_id: opp.contact_id ? String(opp.contact_id) : null,
              },
              ...prev,
            ];
          });
        }
      }
    };

    injectMissingEntities().catch((err) => {
      console.error('[QuoteRepository] Error injecting CRM entities:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreQuery.data, versionsQuery.data]);

  const validateSavedQuote = async (quoteId: string, opts?: { strictGuards?: boolean }) => {
    if (!quoteId) return;
    if (process.env.NODE_ENV === 'test') return;

    const { data, error } = await scopedDb
      .from('quotation_versions')
      .select(`
        id,
        quote_id,
        tenant_id,
        version_number,
        anomalies,
        quotation_version_options (
          id,
          quotation_version_option_legs (
            id,
            quotation_version_option_leg_charges:quote_charges ( id )
          )
        )
      `)
      .eq('quote_id', quoteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    const options = (data as any).quotation_version_options || [];
    const hasOptions = Array.isArray(options) && options.length > 0;
    const hasCharges = options.some((opt: any) =>
      Array.isArray(opt.quotation_version_option_legs) &&
      opt.quotation_version_option_legs.some(
        (leg: any) =>
          Array.isArray(leg.quotation_version_option_leg_charges) &&
          leg.quotation_version_option_leg_charges.length > 0
      )
    );

    if (!hasOptions || !hasCharges) {
      toast.warning('Quote saved but has no options or charges. Please review before sending.');

      try {
        const currentAnomalies = Array.isArray((data as any).anomalies)
          ? (data as any).anomalies
          : [];

        const anomaly = buildMissingOptionsOrChargesAnomaly(data, quoteId, {
          strictGuards: opts?.strictGuards,
        });

        await scopedDb
          .from('quotation_versions')
          .update({
            anomalies: [...currentAnomalies, anomaly],
          })
          .eq('id', (data as any).id);
      } catch {
      }
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (params: SaveQuoteParams): Promise<string> => {
      const { quoteId: saveQuoteId, data } = params;
      const finalTenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id || null;

      let accountId = data.account_id || '';
      let contactId = data.contact_id || '';
      const opportunityId = data.opportunity_id || '';

      if (opportunityId && (!accountId || !contactId)) {
        const { data: opp, error: oppError } = await scopedDb
          .from('opportunities')
          .select('id, account_id, contact_id')
          .eq('id', opportunityId)
          .maybeSingle();
        if (!oppError && opp) {
          if (!accountId && opp.account_id) accountId = String(opp.account_id);
          if (!contactId && opp.contact_id) contactId = String(opp.contact_id);
        }
      }

      const isUuid = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const uuidOrNull = (v: any) => (isUuid(v) ? v : null);
      const uuidOrUndefined = (v: any) => (isUuid(v) ? v : undefined);
      const sanitizeQuoteIds = {
        service_type_id: uuidOrNull(data.service_type_id),
        service_id: uuidOrNull(data.service_id),
        incoterms: data.incoterms || null,
        shipping_term_id: uuidOrNull(data.shipping_term_id),
        [dbField('quote', 'incoterms')]: uuidOrNull(data.shipping_term_id),
        currency_id: uuidOrNull(data.currency_id),
        carrier_id: uuidOrNull(data.carrier_id),
        consignee_id: uuidOrNull(data.consignee_id),
        origin_port_id: uuidOrNull(data.origin_port_id),
        destination_port_id: uuidOrNull(data.destination_port_id),
        account_id: uuidOrNull(accountId || null),
        contact_id: uuidOrNull(contactId || null),
        opportunity_id: uuidOrNull(opportunityId || null),
      };
 
      // Prepare payload for RPC
      const payload: any = {
        quote: {
            id: saveQuoteId || undefined,
            title: data.title,
            description: data.description || null,
            ...sanitizeQuoteIds,
            status: data.status || 'draft',
            valid_until: data.valid_until || null,
            ready_date: data.pickup_date || null,
            pickup_date: data.pickup_date || null,
            delivery_deadline: data.delivery_deadline || null,
            vehicle_type: data.vehicle_type || null,
            special_handling: data.special_handling || null,
            tax_percent: data.tax_percent ? Number(data.tax_percent) : 0,
            shipping_amount: data.shipping_amount ? Number(data.shipping_amount) : 0,
            terms_conditions: data.terms_conditions || null,
            notes: data.notes || null,
            billing_address: data.billing_address || {},
            shipping_address: data.shipping_address || {},
            tenant_id: finalTenantId,
            regulatory_data: {
              trade_direction: data.trade_direction || null,
            },
        },
        items: data.items?.map((item, index) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            const discountPct = Number(item.discount_percent) || 0;
            const discountAmt = (qty * price * discountPct) / 100;
            const lineTotal = (qty * price) - discountAmt;

            return {
              line_number: index + 1,
              type: item.type || 'loose',
              container_type_id: item.container_type_id || null,
              container_size_id: item.container_size_id || null,
              product_name: item.product_name,
              commodity_id: item.commodity_id || null,
              aes_hts_id: item.aes_hts_id || null,
              description: item.description || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent || 0,
              discount_amount: discountAmt,
              line_total: lineTotal,
              package_category_id: item.package_category_id || null,
              package_size_id: item.package_size_id || null,
              weight_kg: item.attributes?.weight || 0,
              volume_cbm: item.attributes?.volume || 0,
              attributes: item.attributes || {},
            };
        }) || [],
        cargo_configurations: data.cargo_configurations?.map((config) => ({
            transport_mode: config.transport_mode,
            cargo_type: config.cargo_type,
            container_type: config.container_type || null,
            container_size: config.container_size || null,
            container_type_id: uuidOrNull(config.container_type_id),
            container_size_id: uuidOrNull(config.container_size_id),
            quantity: config.quantity,
            unit_weight_kg: config.unit_weight_kg || null,
            unit_volume_cbm: config.unit_volume_cbm || null,
            length_cm: config.length_cm || null,
            width_cm: config.width_cm || null,
            height_cm: config.height_cm || null,
            is_hazardous: config.is_hazardous || false,
            hazardous_class: config.hazardous_class || null,
            un_number: config.un_number || null,
            is_temperature_controlled: config.is_temperature_controlled || false,
            temperature_min: config.temperature_min || null,
            temperature_max: config.temperature_max || null,
            temperature_unit: config.temperature_unit || 'C',
            package_category_id: config.package_category_id || null,
            package_size_id: config.package_size_id || null,
            remarks: config.remarks || null,
        })) || [],
        options: data.options?.map((option: any) => ({
            id: uuidOrUndefined(option.id),
            [dbField('option', 'isPrimary')]: option.is_primary,
            total_amount: typeof option.total_amount === 'number' ? option.total_amount : undefined,
            currency: option.currency || undefined,
            transit_time_days: typeof option.transit_time_days === 'number' ? option.transit_time_days : undefined,
            legs: option.legs?.map((leg: any) => ({
                id: uuidOrUndefined(leg.id),
                carrier_id: uuidOrNull(leg.carrier_id),
                transport_mode: leg.transport_mode,
                service_only_category: leg.service_only_category || null,
                leg_type: leg.leg_type || 'transport',
                origin_location_name: leg.origin_location_name,
                destination_location_name: leg.destination_location_name,
                [dbField('leg', 'transitTime')]: leg.transit_time_days 
                    ? leg.transit_time_days * 24 
                    : parseTransitTimeToHours(leg.transit_time),
                flight_number: leg.flight_number,
                voyage_number: leg.voyage_number,
                departure_date: leg.departure_date,
                arrival_date: leg.arrival_date,
                charges: (leg.charges || []).map((charge: any) => ({
                    id: uuidOrUndefined(charge.id),
                    [dbField('charge', 'category')]: charge.category_id || undefined,
                    [dbField('charge', 'side')]: charge.charge_side_id || undefined,
                    amount: typeof charge.amount === 'number' ? charge.amount : undefined,
                    currency: charge.currency || undefined,
                    charge_code: charge.charge_code || undefined,
                    basis: charge.basis || undefined,
                    unit_price: typeof charge.unit_price === 'number' ? charge.unit_price : undefined,
                    quantity: typeof charge.quantity === 'number' ? charge.quantity : undefined,
                    note: charge.note || undefined
                }))
            })) || []
        })) || []
      };

      const { data: savedId, error } = await scopedDb.rpc('save_quote_atomic', { p_payload: payload });

      if (error) {
          console.error('[QuoteRepository] RPC save failed:', error);
          throw error;
      }
      
      if (!savedId) throw new Error('Quote save did not return an id');

      return String(savedId);
    },
    onSuccess: async (savedId) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      if (savedId) {
        await validateSavedQuote(String(savedId), { strictGuards: phase2GuardsEnabled });
      }
    },
  });

  return {
    isHydrating,
    saveQuote: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };

}

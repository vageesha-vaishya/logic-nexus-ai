import { useState, useEffect } from 'react';
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

function parseTransitTime(val: string | number | undefined): number | null {
    if (!val) return null;
    const strVal = String(val).toLowerCase();
    let hours = 0;
    const numberPart = parseInt(strVal.match(/\d+/)?.[0] || '0');

    if ((strVal.includes('day') || strVal.includes(' d')) && !strVal.includes('hour')) {
        hours = numberPart * 24;
    } else {
        hours = numberPart;
    }

    return (!isNaN(hours) && hours > 0) ? hours : null;
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface QuoteRepositoryContextData {
  serviceTypes: ServiceTypeOption[];
  services: ServiceOption[];
  carriers: CarrierOption[];
  ports: PortOption[];
  accounts: AccountOption[];
  contacts: ContactOption[];
  opportunities: OpportunityOption[];
  isLoadingOpportunities: boolean;
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
      const data = await portsService.getAllPorts();
      console.log(`[useQuoteRepository] Ports loaded: ${data.length}`);
      return data.map((p: any) => ({
        id: p.id,
        name: p.location_name,
        code: p.location_code,
        country_code: p.country,
      }));
    },
    staleTime: 1000 * 60 * 60, // 1 hour for global ports
  });

  // 2. Carriers
  const { data: carriers = [] } = useQuery<CarrierOption[]>({
    queryKey: quoteKeys.reference.carriers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carriers')
        .select('id, carrier_name, scac, carrier_type')
        .eq('is_active', true)
        .order('carrier_name');
      if (error) throw error;
      return (data || []) as CarrierOption[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 3. Accounts
  const { data: accounts = [] } = useQuery<AccountOption[]>({
    queryKey: quoteKeys.reference.accounts(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      return (data || []) as AccountOption[];
    },
    enabled: !!tenantId,
  });

  // 4. Opportunities
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery<OpportunityOption[]>({
    queryKey: quoteKeys.reference.opportunities(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('opportunities')
        .select('id, name, account_id, contact_id, stage, amount, probability')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OpportunityOption[];
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
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const serviceData = serviceQuery.data ?? { services: [], serviceTypes: [] };

  // 6. Contacts
  const { data: contacts = [] } = useQuery<ContactOption[]>({
    queryKey: quoteKeys.reference.contacts(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, account_id')
        .eq('tenant_id', tenantId)
        .order('first_name');
      if (error) throw error;
      return (data || []) as ContactOption[];
    },
    enabled: !!tenantId,
  });

  return {
    serviceTypes: serviceData.serviceTypes,
    services: deduplicateById(injectedServices, serviceData.services),
    carriers,
    ports,
    accounts: deduplicateById(injectedAccounts, accounts),
    contacts: deduplicateById(injectedContacts, contacts),
    opportunities: deduplicateById(injectedOpportunities, opportunities),
    isLoadingOpportunities,
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
    queryFn: async () => {
      const start = performance.now();
      const [quoteResult, itemsResult, cargoResult] = await Promise.all([
        scopedDb.from('quotes').select('*').eq('id', quoteId!).maybeSingle(),
        scopedDb.from('quote_items').select('*').eq('quote_id', quoteId!).order('line_number', { ascending: true }),
        scopedDb.from('quote_cargo_configurations').select('*').eq('quote_id', quoteId!),
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const versionsQuery = useQuery({
    queryKey: quoteKeys.hydration(quoteId!)?.concat(['versions']),
    queryFn: async () => {
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
            .maybeSingle();

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
    staleTime: 1000 * 60 * 5, // 5 minutes
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
            transit_time_days: opt.total_transit_days,
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

    // Case 2: Dirty form, do not overwrite
    if (isDirty) return;

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

    // Resolve Service Type ID from Option if missing
    let resolvedServiceTypeId = quote.service_type_id ? String(quote.service_type_id) : '';
    if (!resolvedServiceTypeId && primaryOption && primaryOption.legs.length > 0) {
        const mainMode = primaryOption.legs.find((l: any) => l.transport_mode === 'ocean' || l.transport_mode === 'air')?.transport_mode || primaryOption.legs[0].transport_mode;
        if (mainMode && serviceTypes) {
             const foundType = serviceTypes.find((st: any) => st.name?.toLowerCase().includes(mainMode.toLowerCase()) || st.code?.toLowerCase() === mainMode.toLowerCase());
             if (foundType) {
                 resolvedServiceTypeId = String(foundType.id);
             }
        }
    }

    form.reset({
      title: quote.title,
      description: quote.description || '',
      status: quote.status,
      service_type_id: resolvedServiceTypeId,
      service_id: quote.service_id ? String(quote.service_id) : '',
      incoterms: quote.incoterms || '',
      trade_direction: ['import', 'export'].includes((quote.regulatory_data as any)?.trade_direction) 
        ? (quote.regulatory_data as any)?.trade_direction 
        : undefined,
      carrier_id: quote.carrier_id ? String(quote.carrier_id) : '',
      origin_port_id: quote.origin_port_id ? String(quote.origin_port_id) : '',
      destination_port_id: quote.destination_port_id ? String(quote.destination_port_id) : '',
      account_id: quote.account_id ? String(quote.account_id) : '',
      contact_id: quote.contact_id ? String(quote.contact_id) : '',
      opportunity_id: quote.opportunity_id ? String(quote.opportunity_id) : '',
      valid_until: quote.valid_until ? new Date(quote.valid_until).toISOString().split('T')[0] : '',
      pickup_date: quote.pickup_date ? new Date(quote.pickup_date).toISOString().split('T')[0] : '',
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
          }))
        : [],
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

  // --- Save mutation ---

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

      // Prepare payload for RPC
      const payload: any = {
        quote: {
            id: saveQuoteId || undefined,
            title: data.title,
            description: data.description || null,
            service_type_id: data.service_type_id || null,
            service_id: data.service_id || null,
            incoterms: data.incoterms || null,
            carrier_id: data.carrier_id || null,
            consignee_id: data.consignee_id || null,
            origin_port_id: data.origin_port_id || null,
            destination_port_id: data.destination_port_id || null,
            account_id: accountId || null,
            contact_id: contactId || null,
            opportunity_id: opportunityId || null,
            status: data.status || 'draft',
            valid_until: data.valid_until || null,
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
            container_type_id: config.container_type_id || null,
            container_size_id: config.container_size_id || null,
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
        options: data.options?.map((option) => ({
            id: option.id,
            is_selected: option.is_primary,
            legs: option.legs?.map((leg: any) => ({
                id: leg.id,
                carrier_id: leg.carrier_id,
                transport_mode: leg.transport_mode,
                origin_location_name: leg.origin_location_name,
                destination_location_name: leg.destination_location_name,
                transit_time_hours: leg.transit_time_days 
                    ? leg.transit_time_days * 24 
                    : (leg.transit_time ? parseTransitTime(leg.transit_time) : null),
                flight_number: leg.flight_number,
                voyage_number: leg.voyage_number,
                departure_date: leg.departure_date,
                arrival_date: leg.arrival_date
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });

  return {
    isHydrating,
    saveQuote: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };

}

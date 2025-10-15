import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CarrierQuotesSection } from './CarrierQuotesSection';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import OpportunitySelectDialogList from '@/components/crm/OpportunitySelectDialogList';
import AccountSelectDialogList from '@/components/crm/AccountSelectDialogList';
import ContactSelectDialogList from '@/components/crm/ContactSelectDialogList';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import {
  createRatesAndChargesForQuote,
  createQuotationVersionWithOptions,
} from '@/integrations/supabase/carrierRatesActions';

const quoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  service_type_id: z.string().optional(),
  service_id: z.string().optional(),
  incoterms: z.string().optional(),
  trade_direction: z.enum(['import', 'export']).optional(),
  carrier_id: z.string().optional(),
  consignee_id: z.string().optional(),
  origin_port_id: z.string().optional(),
  destination_port_id: z.string().optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  status: z.string(),
  valid_until: z.string().optional(),
  tax_percent: z.string().optional(),
  shipping_amount: z.string().optional(),
  terms_conditions: z.string().optional(),
  notes: z.string().optional(),
});

type QuoteItem = {
  line_number: number;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  package_category_id?: string;
  package_size_id?: string;
};

type Charge = {
  type: string;
  amount: number;
  currency: string;
  note?: string;
};

type CarrierQuote = {
  carrier_id: string;
  mode?: string;
  buying_charges: Charge[];
  selling_charges: Charge[];
};

export function QuoteForm({ quoteId, onSuccess }: { quoteId?: string; onSuccess?: (quoteId: string) => void }) {
  const { context, supabase, user } = useCRM();
  const { roles } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = !!quoteId;
  const [items, setItems] = useState<QuoteItem[]>([
    { line_number: 1, product_name: '', quantity: 1, unit_price: 0, discount_percent: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [consignees, setConsignees] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [packageCategories, setPackageCategories] = useState<any[]>([]);
  const [packageSizes, setPackageSizes] = useState<any[]>([]);
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [resolvedTenantName, setResolvedTenantName] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [carrierQuotes, setCarrierQuotes] = useState<CarrierQuote[]>([]);
  // Display-only hint; actual quote_number is generated in DB
  const [quoteNumberPreview, setQuoteNumberPreview] = useState<string>('Auto-generated on save');
  // Resolved labels for hidden contacts
  const [resolvedContactLabels, setResolvedContactLabels] = useState<Record<string, string>>({});
  // Resolved labels for services that are not directly visible due to tenant scope/RLS
  const [resolvedServiceLabels, setResolvedServiceLabels] = useState<Record<string, string>>({});
  // Resolved labels for carriers not yet in the dropdown list
  const [resolvedCarrierLabels, setResolvedCarrierLabels] = useState<Record<string, string>>({});
  // Resolved labels for package categories and sizes that may be hidden by RLS/tenant scope
  const [resolvedPackageCategoryLabels, setResolvedPackageCategoryLabels] = useState<Record<string, string>>({});
  const [resolvedPackageSizeLabels, setResolvedPackageSizeLabels] = useState<Record<string, string>>({});
  
  // Format carrier name defensively to avoid accidental repeated text in UI (e.g., "ABCABC")
  const formatCarrierName = (name: string) => {
    if (!name) return name;
    const trimmed = String(name).trim();
    const len = trimmed.length;
    if (len % 2 === 0) {
      const half = len / 2;
      const first = trimmed.slice(0, half);
      const second = trimmed.slice(half);
      if (first === second) return first;
    }
    return trimmed;
  };

  const filteredServices = useMemo(() => {
    if (!selectedServiceType) return [];
    return services.filter(service => service.service_type === selectedServiceType);
  }, [selectedServiceType, services]);

  const form = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      status: 'draft',
      opportunity_id: searchParams.get('opportunityId') || '',
      // Keep inputs controlled from mount
      title: '',
      description: '',
      service_type_id: '',
      service_id: '',
      incoterms: '',
      trade_direction: undefined,
      carrier_id: '',
      consignee_id: '',
      origin_port_id: '',
      destination_port_id: '',
      account_id: '',
      contact_id: '',
      valid_until: '',
      tax_percent: '0',
      shipping_amount: '0',
      terms_conditions: '',
      notes: '',
    },
  });

  // Watch selected account to enable contact filtering
  const accountId = form.watch('account_id');
  // Watch selected carrier to ensure its label is available immediately
  const carrierId = form.watch('carrier_id');

  const fetchServiceData = async () => {
    try {
      const tenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id;
      
      if (!tenantId) {
        console.warn('No tenant ID available for fetching service data');
        return;
      }

      // Fetch service types and services for the current tenant using mapping table, then hydrate service records
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('service_type_mappings')
        .select('service_type, service_id, is_default, priority')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('service_type')
        .order('priority', { ascending: false });

      if (mappingsError) {
        console.error('Service mappings error:', mappingsError);
        throw mappingsError;
      }

      const mappingRows = Array.isArray(mappingsData) ? mappingsData : [];
      const serviceIds = [...new Set(mappingRows.map((m: any) => m.service_id).filter(Boolean))];

      let servicesById: Record<string, any> = {};
      if (serviceIds.length > 0) {
        const { data: svcData, error: svcErr } = await supabase
          .from('services')
          .select('id, service_name, is_active')
          .in('id', serviceIds)
          .eq('is_active', true);
        if (svcErr) throw svcErr;
        for (const s of svcData || []) servicesById[String(s.id)] = s;
      }

      // Extract unique service types for dropdown
      const uniqueServiceTypes = [...new Set(mappingRows.map((m: any) => String(m.service_type)))];
      const serviceTypesForDropdown = uniqueServiceTypes.map((type: string) => ({
        id: type,
        name: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
      }));
      setServiceTypes(serviceTypesForDropdown);

      // Build services list matched to mappings and available service records
      const servicesForDropdown = mappingRows
        .map((m: any) => {
          const svc = servicesById[String(m.service_id)];
          if (!svc) return null;
          return {
            id: svc.id,
            service_name: svc.service_name,
            service_type: m.service_type,
            is_default: m.is_default,
            priority: m.priority,
          };
        })
        .filter(Boolean);

      setServices(servicesForDropdown as any[]);

    } catch (error) {
      console.error('Error loading service data:', error);
      toast.error('Failed to load service options.');
    }
  };

  useEffect(() => {
    fetchData();
    fetchServiceData();
    // Re-run when tenant context resolves so mappings/services populate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.tenantId, resolvedTenantId]);

  // Pre-populate with user's last used values for new quotes
  // Only runs after opportunities/accounts/contacts data is loaded
  useEffect(() => {
    if (quoteId || !user?.id) return; // Skip for edit mode or no user
    if (opportunities.length === 0 && accounts.length === 0) return; // Wait for data
    
    const fetchLastUsedValues = async () => {
      try {
        const tenantId = context.tenantId || roles?.[0]?.tenant_id;
        if (!tenantId) return;

        // Get user's most recent quote to pre-populate fields
        const { data: lastQuote, error } = await supabase
          .from('quotes')
          .select('opportunity_id, account_id, contact_id')
          .eq('tenant_id', tenantId)
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !lastQuote) return;

        // Pre-populate if values exist and form fields are empty
        const currentOppId = form.getValues('opportunity_id');
        const currentAccId = form.getValues('account_id');
        const currentConId = form.getValues('contact_id');

        // Only pre-populate if the items exist in the loaded data
        if (!currentOppId && lastQuote.opportunity_id && opportunities.find(o => String(o.id) === String(lastQuote.opportunity_id))) {
          form.setValue('opportunity_id', String(lastQuote.opportunity_id));
        }
        if (!currentAccId && lastQuote.account_id && accounts.find(a => String(a.id) === String(lastQuote.account_id))) {
          form.setValue('account_id', String(lastQuote.account_id));
        }
        if (!currentConId && lastQuote.contact_id && contacts.find(c => String(c.id) === String(lastQuote.contact_id))) {
          form.setValue('contact_id', String(lastQuote.contact_id));
        }
      } catch (error) {
        console.warn('Failed to fetch last used values:', error);
      }
    };

    fetchLastUsedValues();
  }, [quoteId, user?.id, context.tenantId, roles, opportunities, accounts, contacts]);

  // Load existing quote for edit mode independent of tenant context
  useEffect(() => {
    if (!quoteId) return;
    (async () => {
      setIsHydrating(true);
      try {
        const { data: quote, error: quoteErr } = await supabase
          .from('quotes')
          .select(`
            *,
            opportunities:opportunity_id(id, name, account_id, contact_id),
            contacts:contact_id(id, first_name, last_name, account_id)
          `)
          .eq('id', quoteId)
          .maybeSingle();
        if (quoteErr) throw quoteErr;
        if (!quote) return;

        // Ensure tenant is resolved early from the quote itself (important when no account is selected)
        try {
          const qTenantId = (quote as any)?.tenant_id;
          if (qTenantId) {
            setResolvedTenantId(String(qTenantId));
          }
        } catch {}

        // CRITICAL: Hydrate dropdown lists BEFORE setting form values
        // This ensures Select components recognize the values as valid options
        const selOppId = (quote as any).opportunity_id ? String((quote as any).opportunity_id) : undefined;
        const selAccId = (quote as any).account_id ? String((quote as any).account_id) : undefined;
        const selConId = (quote as any).contact_id ? String((quote as any).contact_id) : undefined;

        // Collect all items to add to dropdowns BEFORE any state updates
        let opportunityToAdd = null;
        let accountToAdd = null;
        let contactToAdd = null;
        let carrierToAdd = null;

        // Fetch carrier FIRST if it exists (critical for display)
        const selCarrierId = (quote as any).carrier_id;
        if (selCarrierId) {
          try {
            const { data: carrierData } = await supabase
              .from('carriers')
              .select('id, carrier_name')
              .eq('id', selCarrierId)
              .maybeSingle();
            if (carrierData) {
              carrierToAdd = carrierData;
              setResolvedCarrierLabels((prev) => ({
                ...prev,
                [String(carrierData.id)]: carrierData.carrier_name || 'Selected Carrier',
              }));
            }
          } catch (err) {
            console.warn('Failed to fetch carrier:', err);
          }
        }

        // Fetch opportunity data with full details
        if (selOppId) {
          try {
            const { data: fullOpp, error: oppError } = await (supabase as any).functions.invoke('get-opportunity-full', {
              body: { id: selOppId },
            });
            if (!oppError && fullOpp) {
              opportunityToAdd = {
                id: fullOpp.id,
                name: fullOpp.name || 'Selected Opportunity',
                account_id: fullOpp.account_id,
                contact_id: fullOpp.contact_id
              };
              
              // Also prepare account from opportunity if not explicitly selected
              if (fullOpp.accounts && !selAccId) {
                accountToAdd = { 
                  id: String(fullOpp.account_id), 
                  name: fullOpp.accounts.name || 'Selected Account' 
                };
              }
              
              // Also prepare contact from opportunity if not explicitly selected
              if (fullOpp.contacts && !selConId) {
                contactToAdd = {
                  id: String(fullOpp.contact_id),
                  first_name: fullOpp.contacts.first_name || '',
                  last_name: fullOpp.contacts.last_name || '',
                  account_id: fullOpp.account_id
                };
              }
            }
          } catch (oppErr) {
            console.warn('Failed to load full opportunity, using fallback:', oppErr);
            const joinedOpp = (quote as any)?.opportunities;
            if (joinedOpp?.name) {
              opportunityToAdd = { 
                id: selOppId, 
                name: joinedOpp.name, 
                account_id: joinedOpp.account_id, 
                contact_id: joinedOpp.contact_id 
              };
            }
          }
        }

        // Fetch account if not already prepared from opportunity
        if (selAccId && !accountToAdd) {
          try {
            const { data: accData } = await supabase
              .from('accounts')
              .select('id, name')
              .eq('id', selAccId)
              .maybeSingle();
            if (accData) {
              accountToAdd = { id: accData.id, name: accData.name || 'Selected Account' };
            }
          } catch {}
        }

        // Fetch contact if not already prepared from opportunity
        if (selConId && !contactToAdd) {
          const joinedCon = (quote as any)?.contacts;
          if (joinedCon) {
            contactToAdd = {
              id: selConId,
              first_name: joinedCon.first_name || '',
              last_name: joinedCon.last_name || '',
              account_id: joinedCon.account_id
            };
          }
        }

        // NOW update all states at once in the correct order
        if (opportunityToAdd) {
          setOpportunities((prev) => {
            const exists = prev.some((o: any) => String(o.id) === String(opportunityToAdd.id));
            return exists ? prev : [opportunityToAdd, ...prev];
          });
        }
        
        if (accountToAdd) {
          setAccounts((prev) => {
            const exists = prev.some((a: any) => String(a.id) === String(accountToAdd.id));
            return exists ? prev : [accountToAdd, ...prev];
          });
        }
        
        if (contactToAdd) {
          setContacts((prev) => {
            const exists = prev.some((c: any) => String(c.id) === String(contactToAdd.id));
            return exists ? prev : [contactToAdd, ...prev];
          });
        }

        // Add carrier to list BEFORE form reset
        if (carrierToAdd) {
          setCarriers((prev) => {
            const exists = prev.some((c: any) => String(c.id) === String(carrierToAdd.id));
            return exists ? prev : [carrierToAdd, ...prev];
          });
        }

        // Small delay to ensure React has processed the state updates
        await new Promise(resolve => setTimeout(resolve, 50));

        // NOW set form values after dropdown lists are hydrated
        form.reset({
          title: (quote as any).title || '',
          description: (quote as any).description || '',
          service_type_id: (quote as any).service_type_id != null ? String((quote as any).service_type_id) : '',
          service_id: (quote as any).service_id != null ? String((quote as any).service_id) : '',
          incoterms: (quote as any).incoterms || '',
          trade_direction: (quote as any).regulatory_data?.trade_direction || undefined,
          carrier_id: (quote as any).carrier_id != null ? String((quote as any).carrier_id) : '',
          consignee_id: (quote as any).consignee_id != null ? String((quote as any).consignee_id) : '',
          origin_port_id: (quote as any).origin_port_id != null ? String((quote as any).origin_port_id) : '',
          destination_port_id: (quote as any).destination_port_id != null ? String((quote as any).destination_port_id) : '',
          account_id: selAccId || '',
          contact_id: selConId || '',
          opportunity_id: selOppId || '',
          status: (quote as any).status || 'draft',
          valid_until: (quote as any).valid_until || '',
          tax_percent: (quote as any).tax_percent != null ? String((quote as any).tax_percent) : '0',
          shipping_amount: (quote as any).shipping_amount != null ? String((quote as any).shipping_amount) : '0',
          terms_conditions: (quote as any).terms_conditions || '',
          notes: (quote as any).notes || '',
        });
        setSelectedServiceType((quote as any).service_type_id || '');
        setQuoteNumberPreview((quote as any).quote_number || '');

        // Load items; tolerate RLS issues by falling back to empty
        const { data: itemsRes, error: itemsErr } = await supabase
          .from('quote_items')
          .select('line_number, product_name, description, quantity, unit_price, discount_percent, package_category_id, package_size_id')
          .eq('quote_id', quoteId)
          .order('line_number', { ascending: true });
        if (!itemsErr && Array.isArray(itemsRes)) {
          setItems(
            itemsRes.map((it: any) => ({
              line_number: it.line_number,
              product_name: it.product_name || '',
              description: it.description || '',
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              discount_percent: Number(it.discount_percent) || 0,
              package_category_id: it.package_category_id ? String(it.package_category_id) : undefined,
              package_size_id: it.package_size_id ? String(it.package_size_id) : undefined,
            }))
          );
        }

        // Restore carrier quotes if present
        try {
          const rq = (quote as any).regulatory_data?.carrier_quotes;
          if (Array.isArray(rq)) {
            setCarrierQuotes(
              rq.map((cq: any) => ({
                carrier_id: cq.carrier_id || '',
                mode: cq.mode || (quote as any).service_type || undefined,
                buying_charges: Array.isArray(cq.buying_charges) ? cq.buying_charges : [],
                selling_charges: Array.isArray(cq.selling_charges) ? cq.selling_charges : [],
              }))
            );
          }
        } catch {}

        // Ensure selected lookup values appear in dropdowns even if tenant filters exclude them
        try {
          const selServiceId = (quote as any).service_id;
          if (selServiceId && !services.some((s: any) => String(s.id) === String(selServiceId))) {
            const { data } = await supabase
              .from('services')
              .select('id, service_name, service_type')
              .eq('id', selServiceId)
              .maybeSingle();
            if (data) setServices((prev) => [data, ...prev]);
          }

          // Carrier already fetched and added before form.reset above, skip redundant check

          const selConsigneeId = (quote as any).consignee_id;
          if (selConsigneeId && !consignees.some((c: any) => String(c.id) === String(selConsigneeId))) {
            const { data } = await supabase
              .from('consignees')
              .select('id, company_name')
              .eq('id', selConsigneeId)
              .maybeSingle();
            if (data) setConsignees((prev) => [data, ...prev]);
          }

          const selOriginId = (quote as any).origin_port_id;
          if (selOriginId && !ports.some((p: any) => String(p.id) === String(selOriginId))) {
            const { data } = await supabase
              .from('ports_locations')
              .select('id, location_name, location_code')
              .eq('id', selOriginId)
              .maybeSingle();
            if (data) setPorts((prev) => [data, ...prev]);
          }

          const selDestId = (quote as any).destination_port_id;
          if (selDestId && !ports.some((p: any) => String(p.id) === String(selDestId))) {
            const { data } = await supabase
              .from('ports_locations')
              .select('id, location_name, location_code')
              .eq('id', selDestId)
              .maybeSingle();
            if (data) setPorts((prev) => [data, ...prev]);
          }

          // Note: opportunity, account, contact already fetched above
        } catch (e) {
          console.warn('Failed to hydrate selected options for edit mode:', e);
        }
      } catch (err: any) {
        console.error('Failed to load existing quote:', err?.message || err);
        toast.error('Failed to load existing quote', { description: err?.message });
      }
      finally {
        setIsHydrating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  // Ensure defaults are applied when service types are loaded
  useEffect(() => {
    try {
      if (isEditMode) return;
      const hasServiceTypes = Array.isArray(serviceTypes) && serviceTypes.length > 0;
      const currentTypeId = form.getValues('service_type_id');
      if (!currentTypeId && hasServiceTypes) {
        const defaultServiceType = serviceTypes[0];
        form.setValue('service_type_id', String(defaultServiceType.id), { shouldDirty: true });
        setSelectedServiceType(String(defaultServiceType.id));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypes, isEditMode]);

  // When service_type_id changes: filter services based on type and auto-select
  useEffect(() => {
    if (isEditMode) return; // don't disturb existing selections in edit mode
    if (!selectedServiceType) {
      // No type selected: clear service
      const currentServiceId = form.getValues('service_id');
      if (currentServiceId) form.setValue('service_id', '', { shouldDirty: true });
      return;
    }

    // Determine selected service type name for legacy text-based matching
    const selectedTypeName = (() => {
      const st = serviceTypes.find((t: any) => String(t.id) === String(selectedServiceType));
      return st?.name || '';
    })();

    // Filter services by service_type_id (FK), nested relation (if present), or legacy text column
    const matchingServices = services.filter((s: any) =>
      String(s.service_type_id || '') === String(selectedServiceType) ||
      String((s as any)?.service_types?.id || '') === String(selectedServiceType) ||
      (selectedTypeName && String((s as any)?.service_type || '') === String(selectedTypeName))
    );
    
    const currentServiceId = form.getValues('service_id');
    
    // If current service doesn't match the type, select first matching service
    if (currentServiceId) {
      const svc = services.find((s: any) => String(s.id) === String(currentServiceId));
      const svcTypeId = String(svc?.service_type_id || '');
      const svcRelTypeId = String((svc as any)?.service_types?.id || '');
      const svcTextType = String((svc as any)?.service_type || '');
      const matches = svc && (
        svcTypeId === String(selectedServiceType) ||
        svcRelTypeId === String(selectedServiceType) ||
        (selectedTypeName && svcTextType === selectedTypeName)
      );
      if (!matches) {
        if (matchingServices.length > 0) {
          form.setValue('service_id', String(matchingServices[0].id), { shouldDirty: true });
        } else {
          form.setValue('service_id', '', { shouldDirty: true });
        }
      }
      return;
    }

    // If no service selected yet, auto-select first matching service
    if (matchingServices.length > 0) {
      form.setValue('service_id', String(matchingServices[0].id), { shouldDirty: true });
    }
  }, [selectedServiceType, services, serviceTypes, isEditMode, form]);

  const fetchData = async () => {
    const tenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id;
    // If no tenant is resolved, still allow platform admins to load global services
    if (!tenantId && !context.isPlatformAdmin) return;

    try {
      // Local lists used later in this function regardless of branch
      let accountsList: any[] = [];
      let contactsList: any[] = [];
      let opportunitiesList: any[] = [];

      // Build services query without relying on nested relation (safer across schemas)
      let servicesQuery: any = supabase
        .from('services')
        .select('id, service_name, service_type_id, service_type, tenant_id, is_active')
        .eq('is_active', true);
      if (tenantId) {
        servicesQuery = servicesQuery.eq('tenant_id', tenantId);
      }

      if (tenantId) {
        const [servicesRes, consigneesRes, portsRes, accountsRes, contactsRes, opportunitiesRes, pkgCatsRes, pkgSizesRes] = await Promise.all([
          servicesQuery,
          supabase.from('consignees').select('*').eq('tenant_id', tenantId).eq('is_active', true),
          supabase.from('ports_locations').select('*').eq('tenant_id', tenantId).eq('is_active', true),
          supabase.from('accounts').select('id, name, tenant_id').eq('tenant_id', tenantId),
          supabase.from('contacts').select('id, first_name, last_name, account_id').eq('tenant_id', tenantId),
          supabase.from('opportunities').select('id, name, account_id, contact_id, tenant_id').eq('tenant_id', tenantId),
          supabase.from('package_categories').select('*').eq('tenant_id', tenantId).eq('is_active', true),
          supabase.from('package_sizes').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        ]);

        // Fallback: if tenant-scoped services are empty or error, try global active services
        let finalServices = servicesRes?.data || [];
        if (servicesRes?.error || finalServices.length === 0) {
          try {
            const { data: globalServices } = await supabase
              .from('services')
              .select('id, service_name, service_type_id, service_type, tenant_id, is_active')
              .eq('is_active', true);
            finalServices = globalServices || [];
          } catch {}
        }

        if (consigneesRes.error) throw consigneesRes.error;
        if (portsRes.error) throw portsRes.error;
        if (accountsRes.error) throw accountsRes.error;
        if (contactsRes.error) throw contactsRes.error;
        if (opportunitiesRes.error) throw opportunitiesRes.error;
        if (pkgCatsRes.error) throw pkgCatsRes.error;
        if (pkgSizesRes.error) throw pkgSizesRes.error;

        setConsignees(consigneesRes.data || []);
        setPorts(portsRes.data || []);
        setPorts(portsRes.data || []);
        setAccounts(accountsRes.data || []);
        setContacts(contactsRes.data || []);
        setOpportunities(opportunitiesRes.data || []);
        setPackageCategories(pkgCatsRes.data || []);
        setPackageSizes(pkgSizesRes.data || []);

        // Fallback: if tenant-scoped lists are empty, attempt global fetch (subject to RLS)
        try {
          if (!pkgCatsRes.data || pkgCatsRes.data.length === 0) {
            const { data: globalCats } = await supabase
              .from('package_categories')
              .select('*')
              .eq('is_active', true);
            setPackageCategories(globalCats || []);
          }
        } catch {}
        try {
          if (!pkgSizesRes.data || pkgSizesRes.data.length === 0) {
            const { data: globalSizes } = await supabase
              .from('package_sizes')
              .select('*')
              .eq('is_active', true);
            setPackageSizes(globalSizes || []);
          }
        } catch {}

        // Fetch carriers filtered by selected service type via mapping table
        const currentServiceTypeId = selectedServiceType || form.getValues('service_type_id');
        if (currentServiceTypeId) {
          // Get service type code to use for carrier filtering
          const serviceType = serviceTypes.find((st: any) => String(st.id) === String(currentServiceTypeId));
          const serviceTypeCode = serviceType?.id;
          
          if (serviceTypeCode) {
            const carriersRes = await supabase
              .from('carrier_service_types')
              .select('carrier_id, service_type, is_active, carriers:carrier_id(id, carrier_name, tenant_id, is_active)')
              .eq('tenant_id', tenantId)
              .eq('service_type', serviceTypeCode)
              .eq('is_active', true);
            if (carriersRes.error) throw carriersRes.error;
            // Map carriers from join and de-duplicate by id to avoid double labels
            const mappedRaw = (carriersRes.data || [])
              .map((row: any) => row.carriers)
              .filter((c: any) => !!c && c.is_active);
            const mappedById: Record<string, any> = {};
            for (const c of mappedRaw) {
              mappedById[String(c.id)] = c;
            }
            let mapped = Object.values(mappedById);
            // Ensure saved carrier (in edit mode) appears in the list even if not mapped
            const selectedCarrierId = form.getValues('carrier_id');
            if (selectedCarrierId && !mapped.some((c: any) => String(c.id) === String(selectedCarrierId))) {
              const { data: selCarrier } = await supabase
                .from('carriers')
                .select('id, carrier_name, is_active')
                .eq('id', selectedCarrierId)
                .maybeSingle();
              if (selCarrier) {
                mappedById[String(selCarrier.id)] = selCarrier;
                mapped = Object.values(mappedById);
              }
            }
            setCarriers(mapped);
          } else {
            // No service type code found
            setCarriers([]);
          }
        } else {
          // No service type selected yet; do not show carriers
          setCarriers([]);
        }

        // Seed resolved tenant from current context
        setResolvedTenantId(tenantId);

        // Capture local lists for use below
        accountsList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
        contactsList = Array.isArray(contactsRes.data) ? contactsRes.data : [];
        opportunitiesList = Array.isArray(opportunitiesRes.data) ? opportunitiesRes.data : [];

        // Service types are now loaded separately, services will filter based on type selection
      } else {
        // Platform admin path without tenant: fetch services globally (respecting RLS)
        const { data: globalServices, error: svcErr } = await servicesQuery;
        if (svcErr) throw svcErr;

        // Attempt to fetch categories and sizes globally if permitted
        try {
          const [{ data: cats = [] }, { data: sizes = [] }] = await Promise.all([
            supabase.from('package_categories').select('*').eq('is_active', true),
            supabase.from('package_sizes').select('*').eq('is_active', true),
          ]);
          setPackageCategories(cats || []);
          setPackageSizes(sizes || []);
        } catch (e) {
          // Non-fatal if RLS blocks global lists
          setPackageCategories([]);
          setPackageSizes([]);
        }

        // Service types are now loaded separately
      }

      // If an opportunity is preselected (e.g. via URL), auto-fill account/contact
      try {
        const preselectedOppId = form.getValues('opportunity_id');
        if (preselectedOppId) {
          const opp = opportunitiesList.find((o: any) => String(o.id) === String(preselectedOppId));
          if (opp) {
            if (opp.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
            if (opp.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
          }
        }
      } catch {}

      // Ensure currently selected CRM IDs appear in dropdowns even if tenant lists exclude them
      try {
        const curAccountId = form.getValues('account_id');
        if (curAccountId && !accountsList.some((a: any) => String(a.id) === String(curAccountId))) {
          const { data } = await supabase
            .from('accounts')
            .select('id, name, tenant_id')
            .eq('id', curAccountId)
            .maybeSingle();
          if (data) {
            setAccounts((prev) => [data, ...prev]);
          } else {
            // Resolve account label via Edge Function when direct fetch is blocked by RLS
            try {
              const { data: labelData, error: fnError } = await supabase.functions.invoke('get-account-label', {
                body: { id: curAccountId },
              });
              if (!fnError && (labelData as any)?.name) {
                const resolved = { id: (labelData as any).id ?? curAccountId, name: (labelData as any).name } as any;
                setAccounts((prev) => [resolved, ...prev]);
                try {
                  await supabase.from('audit_logs').insert([{ 
                    user_id: user?.id || null,
                    action: 'label_fallback_used',
                    resource_type: 'account',
                    resource_id: curAccountId as any,
                    details: { method: 'edge_function', reason: 'rls_blocked' },
                  }]);
                } catch {}
              }
            } catch (fnErr) {
              console.warn('Account label resolution failed:', fnErr);
            }
          }
        }

        const curContactId = form.getValues('contact_id');
        if (curContactId && !contactsList.some((c: any) => String(c.id) === String(curContactId))) {
          const { data } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, account_id')
            .eq('id', curContactId)
            .maybeSingle();
          if (data) {
            setContacts((prev) => {
              const exists = prev.some((c: any) => String(c.id) === String(data.id));
              return exists ? prev : [data, ...prev];
            });
          } else {
            // Resolve contact label via Edge Function when direct fetch is blocked by RLS
            try {
              const { data: labelData, error: fnError } = await supabase.functions.invoke('get-contact-label', {
                body: { id: curContactId },
              });
              const first = (labelData as any)?.first_name;
              const last = (labelData as any)?.last_name;
              const resolvedAccId = (labelData as any)?.account_id;
              if (!fnError && (first || last)) {
                // Inject the resolved contact into list so it appears under the selected account filter
                const resolvedContact = {
                  id: String(curContactId),
                  first_name: first || '',
                  last_name: last || '',
                  account_id: resolvedAccId || form.getValues('account_id') || null,
                } as any;
                setContacts((prev) => {
                  const exists = prev.some((c: any) => String(c.id) === String(curContactId));
                  return exists ? prev : [resolvedContact, ...prev];
                });
                // Keep label map for any fallback rendering paths
                setResolvedContactLabels((prev) => ({
                  ...prev,
                  [String(curContactId)]: [first, last].filter(Boolean).join(' ').trim() || 'Selected Contact',
                }));
                try {
                  await supabase.from('audit_logs').insert([{ 
                    user_id: user?.id || null,
                    action: 'label_fallback_used',
                    resource_type: 'contact',
                    resource_id: curContactId as any,
                    details: { method: 'edge_function', reason: 'rls_blocked' },
                  }]);
                } catch {}
              }
            } catch (fnErr) {
              console.warn('Contact label resolution failed:', fnErr);
            }
          }
        }

        const curOppId = form.getValues('opportunity_id');
        if (curOppId && !opportunitiesList.some((o: any) => String(o.id) === String(curOppId))) {
          const { data } = await supabase
            .from('opportunities')
            .select('id, name, account_id, contact_id, tenant_id')
            .eq('id', curOppId)
            .maybeSingle();
          if (data) {
            setOpportunities((prev) => {
              const exists = prev.some((o: any) => String(o.id) === String(data.id));
              return exists ? prev : [data, ...prev];
            });
          } else {
            // Fallback: resolve label via Edge Function when direct fetch is blocked by RLS
            try {
              const { data: labelData, error: fnError } = await supabase.functions.invoke('get-opportunity-label', {
                body: { id: curOppId },
              });
              if (!fnError && (labelData as any)?.name) {
                const resolved = { id: (labelData as any).id ?? curOppId, name: (labelData as any).name } as any;
                setOpportunities((prev) => [resolved, ...prev]);
                try {
                  await supabase.from('audit_logs').insert([{ 
                    user_id: user?.id || null,
                    action: 'label_fallback_used',
                    resource_type: 'opportunity',
                    resource_id: curOppId as any,
                    details: { method: 'edge_function', reason: 'rls_blocked' },
                  }]);
                } catch {}
              }
            } catch (fnErr) {
              console.warn('Opportunity label resolution failed:', fnErr);
            }
          }
        }
      } catch (e) {
        console.warn('CRM option merge after tenant fetch failed:', e);
      }

    } catch (error: any) {
      console.error('Failed to fetch data:', error);
    }
  };

  // Refetch carriers when service type changes to enforce filtering
  useEffect(() => {
    const tenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id;
    // Skip during initial hydration to preserve manually-added carriers from edit mode
    if (!tenantId || isHydrating) return;
    const currentServiceTypeId = selectedServiceType || form.getValues('service_type_id');
    if (!currentServiceTypeId) {
      setCarriers([]);
      return;
    }
    (async () => {
      // Get service type code to use for carrier filtering
       const serviceType = serviceTypes.find((st: any) => String(st.id) === String(currentServiceTypeId));
       const serviceTypeCode = serviceType?.id;
      
      if (!serviceTypeCode) {
        setCarriers([]);
        return;
      }
      
      const carriersRes: any = await supabase
        .from('carrier_service_types')
        .select('carrier_id, service_type, is_active, carriers:carrier_id(id, carrier_name, tenant_id, is_active)')
        .eq('tenant_id', tenantId)
        .eq('service_type', serviceTypeCode)
        .eq('is_active', true);
      if (carriersRes.error) {
        console.warn('Failed to fetch carriers by service type:', carriersRes.error);
        setCarriers([]);
        return;
      }
      // Map carriers from join and de-duplicate by id to avoid double labels
      const mappedRaw = (carriersRes.data || [])
        .map((row: any) => row.carriers)
        .filter((c: any) => !!c && c.is_active);
      const mappedById: Record<string, any> = {};
      for (const c of mappedRaw) {
        mappedById[String(c.id)] = c;
      }
      let mapped = Object.values(mappedById);
      // Ensure saved carrier (in edit mode) appears in the list even if not mapped
      const selectedCarrierId = form.getValues('carrier_id');
      if (selectedCarrierId && !mapped.some((c: any) => String(c.id) === String(selectedCarrierId))) {
        const { data: selCarrier } = await supabase
          .from('carriers')
          .select('id, carrier_name, is_active')
          .eq('id', selectedCarrierId)
          .maybeSingle();
        if (selCarrier) {
          mappedById[String(selCarrier.id)] = selCarrier;
          mapped = Object.values(mappedById);
        }
      }
      setCarriers(mapped);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceType, resolvedTenantId, isHydrating]);

  // Ensure selected carrier appears promptly even before service-type filtered list loads
  useEffect(() => {
    const id = carrierId;
    if (!id) return;
    if (carriers.some((c: any) => String(c.id) === String(id))) return;
    (async () => {
      try {
        const { data: selCarrier } = await supabase
          .from('carriers')
          .select('id, carrier_name, is_active')
          .eq('id', id)
          .maybeSingle();
        if (selCarrier) {
          setResolvedCarrierLabels((prev) => ({
            ...prev,
            [String(selCarrier.id)]: selCarrier.carrier_name || 'Selected Carrier',
          }));
          const byId: Record<string, any> = {};
          for (const c of carriers) byId[String(c.id)] = c;
          byId[String(selCarrier.id)] = selCarrier;
          setCarriers(Object.values(byId));
        }
      } catch (e) {
        // Silent; fallback label will still render
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId]);

  // Preview next quote number via RPC when context becomes available
  useEffect(() => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    const franchiseId = context.franchiseId || roles?.[0]?.franchise_id || null;
    if (!tenantId) return;
    // In edit mode, use existing quote number preview and skip RPC
    if (quoteId) return;
    const preview = async () => {
      try {
        const { data, error } = await (supabase as any).rpc('preview_next_quote_number', {
          p_tenant_id: tenantId,
          p_franchise_id: franchiseId,
        });
        if (error) throw error;
        setQuoteNumberPreview(typeof data === 'string' ? data : 'Auto-generated on save');
      } catch (err) {
        // Keep default hint on any error
        console.warn('Preview quote number failed:', err);
      }
    };
    preview();
  }, [context.tenantId, context.franchiseId]);

  // When account changes, clear contact if it no longer belongs to the selected account
  useEffect(() => {
    if (!accountId) return;
    if (!Array.isArray(contacts) || contacts.length === 0) return; // wait until contacts load
    const currentContactId = form.getValues('contact_id');
    // Only clear if the selected contact exists and belongs to a different account.
    // If the contact is not present (e.g., RLS-hidden and rendered via fallback), keep it.
    const selected = contacts.find((c: any) => String(c.id) === String(currentContactId));
    if (selected && String(selected.account_id) !== String(accountId)) {
      form.setValue('contact_id', undefined, { shouldDirty: true });
    }
  }, [accountId, contacts]);

  // Resolve tenant from selected account or context
  useEffect(() => {
    let nextTenantId: string | null = context.tenantId || roles?.[0]?.tenant_id || null;
    const acc = accounts.find((a: any) => String(a.id) === String(accountId));
    if (acc?.tenant_id) nextTenantId = acc.tenant_id;
    setResolvedTenantId(nextTenantId);
  }, [accountId, accounts, context.tenantId, roles]);

  // Fetch tenant name for hint when resolved tenant changes
  useEffect(() => {
    (async () => {
      try {
        if (!resolvedTenantId) { setResolvedTenantName(null); return; }
        const { data, error } = await supabase.from('tenants').select('name').eq('id', resolvedTenantId).maybeSingle();
        if (!error) setResolvedTenantName((data as any)?.name ?? null);
      } catch {}
    })();
  }, [resolvedTenantId, supabase]);


  const addItem = () => {
    setItems([
      ...items,
      { line_number: items.length + 1, product_name: '', quantity: 1, unit_price: 0, discount_percent: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    const next = items
      .filter((_, i) => i !== index)
      .map((it, idx) => ({ ...it, line_number: idx + 1 }));
    setItems(next);
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Resolve labels for package category/size IDs that are selected but not present in the current lists
  useEffect(() => {
    const resolveMissingLabels = async () => {
      try {
        const catIds = Array.from(new Set(items.map((i) => i.package_category_id).filter((v): v is string => !!v).map(String)));
        const sizeIds = Array.from(new Set(items.map((i) => i.package_size_id).filter((v): v is string => !!v).map(String)));

        const presentCatIds = new Set((packageCategories || []).map((c: any) => String(c.id)));
        const presentSizeIds = new Set((packageSizes || []).map((s: any) => String(s.id)));

        const missingCatIds = catIds.filter((id) => !presentCatIds.has(id));
        const missingSizeIds = sizeIds.filter((id) => !presentSizeIds.has(id));

        if (missingCatIds.length > 0) {
          try {
            const { data: cats } = await supabase
              .from('package_categories')
              .select('id, category_name, is_active')
              .in('id', missingCatIds);
            if (Array.isArray(cats)) {
              setResolvedPackageCategoryLabels((prev) => {
                const next = { ...prev };
                for (const c of cats) {
                  next[String(c.id)] = c.category_name || 'Selected Category';
                }
                return next;
              });
            }
          } catch (e) {
            // Non-fatal if RLS blocks direct resolution
          }
        }

        if (missingSizeIds.length > 0) {
          try {
            const { data: sizes } = await supabase
              .from('package_sizes')
              .select('id, size_name, size_code, is_active')
              .in('id', missingSizeIds);
            if (Array.isArray(sizes)) {
              setResolvedPackageSizeLabels((prev) => {
                const next = { ...prev };
                for (const s of sizes) {
                  const base = s.size_name || 'Selected Size';
                  next[String(s.id)] = s.size_code ? `${base} (${s.size_code})` : base;
                }
                return next;
              });
            }
          } catch (e) {
            // Non-fatal if RLS blocks direct resolution
          }
        }
      } catch {}
    };
    resolveMissingLabels();
  }, [items, packageCategories, packageSizes, supabase]);

  // ===== Import/Export helpers =====
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parseCSV = (text: string): QuoteItem[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return [];
    const parseLine = (line: string) => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          // Toggle quotes or escape
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          result.push(cur.trim()); cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    };
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const idx = (name: string, aliases: string[]) => {
      const names = [name, ...aliases];
      for (const n of names) {
        const pos = headers.indexOf(n);
        if (pos !== -1) return pos;
      }
      return -1;
    };
    const iLine = idx('line_number', ['line', 'no']);
    const iProd = idx('product_name', ['product', 'item', 'name']);
    const iDesc = idx('description', ['desc']);
    const iQty = idx('quantity', ['qty']);
    const iPrice = idx('unit_price', ['price', 'unitprice']);
    const iDisc = idx('discount_percent', ['discount', 'disc_percent']);
    const parsed: QuoteItem[] = [];
    for (let r = 1; r < lines.length; r++) {
      const cols = parseLine(lines[r]);
      const q = Number(cols[iQty >= 0 ? iQty : -1] || 1);
      const p = Number(cols[iPrice >= 0 ? iPrice : -1] || 0);
      const d = Number(cols[iDisc >= 0 ? iDisc : -1] || 0);
      const product = cols[iProd >= 0 ? iProd : -1] || '';
      const description = cols[iDesc >= 0 ? iDesc : -1] || '';
      if (!product && description === '' && isNaN(q) && isNaN(p)) continue;
      parsed.push({
        line_number: Number(cols[iLine >= 0 ? iLine : -1] || parsed.length + 1),
        product_name: product,
        description,
        quantity: isNaN(q) ? 1 : q,
        unit_price: isNaN(p) ? 0 : p,
        discount_percent: isNaN(d) ? 0 : d,
      });
    }
    return parsed;
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileSelected = (e: any) => {
    try {
      const file = e?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          const next = parseCSV(text);
          if (next.length) setItems(next);
          toast.success('Items imported from Excel/CSV');
        } catch {
          toast.error('Failed to parse CSV. Please check columns.');
        }
      };
      reader.readAsText(file);
    } catch {
      toast.error('Import failed');
    } finally {
      if (e?.target) e.target.value = '';
    }
  };

  const downloadItemsCSV = () => {
    const headers = ['line_number','product_name','description','quantity','unit_price','discount_percent'];
    const rows = items.map(i => [i.line_number, i.product_name, i.description || '', i.quantity, i.unit_price, i.discount_percent]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote_items_${quoteId || 'new'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadPDF = () => {
    try {
      const totals = calculateTotals();
      const rows = items.map(i => `<tr><td>${i.line_number}</td><td>${i.product_name}</td><td>${i.description || ''}</td><td>${i.quantity}</td><td>${i.unit_price.toFixed(2)}</td><td>${i.discount_percent}%</td></tr>`).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Quote</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",sans-serif;padding:24px;color:#111}
          h1{font-size:20px;margin:0 0 12px}
          table{width:100%;border-collapse:collapse}
          th,td{border:1px solid #ddd;padding:6px;text-align:left;font-size:12px}
          tfoot td{font-weight:bold}
        </style>
      </head><body>
        <h1>Quotation ${quoteNumberPreview || ''}</h1>
        <table>
          <thead><tr><th>Line</th><th>Product</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td colspan="5">Subtotal</td><td>${totals.subtotal.toFixed(2)}</td></tr>
            <tr><td colspan="5">Tax</td><td>${totals.taxAmount.toFixed(2)}</td></tr>
            <tr><td colspan="5">Total</td><td>${totals.total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) { toast.error('Popup blocked. Allow popups to download PDF.'); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {
      toast.error('Failed to prepare PDF');
    }
  };

  // Register sticky actions in Dashboard layout (inside component)
  const { setActions, clearActions } = useStickyActions();

  useEffect(() => {
    const left = [
      (<Button key="close" type="button" variant="secondary" onClick={() => navigate(-1)}>Close</Button>),
    ];

    const right = [
      (<Button key="import" type="button" variant="outline" onClick={handleUploadClick}>Import</Button>),
      (<Button key="export" type="button" variant="outline" onClick={downloadItemsCSV}>Export</Button>),
      (<Button key="export-pdf" type="button" variant="outline" onClick={downloadPDF}>Export.PDF</Button>),
      (<Button key="submit" type="button" disabled={isSubmitting} onClick={() => form.handleSubmit(onSubmit)()}>
        {isSubmitting ? (isEditMode ? 'Modifying...' : 'Saving...') : (isEditMode ? 'Modify' : 'Add')}
      </Button>),
    ];

    setActions({ left, right });
    return () => clearActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, isEditMode, items]);

  // Carrier quotations helpers
  const addCarrierQuote = () => {
    setCarrierQuotes([
      ...carrierQuotes,
      {
        carrier_id: '',
        mode: selectedServiceType || undefined,
        buying_charges: [],
        selling_charges: [],
      },
    ]);
  };

  const removeCarrierQuote = (index: number) => {
    setCarrierQuotes(carrierQuotes.filter((_, i) => i !== index));
  };

  const updateCarrierField = (index: number, field: keyof CarrierQuote, value: any) => {
    const next = [...carrierQuotes];
    next[index] = { ...next[index], [field]: value };
    setCarrierQuotes(next);
  };

  const addCharge = (index: number, side: 'buy' | 'sell') => {
    const next = [...carrierQuotes];
    const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
    targetList.push({ type: 'freight', amount: 0, currency: 'USD' });
    setCarrierQuotes(next);
  };

  // Opportunity selection dialog state
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [accDialogOpen, setAccDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const handleSelectOpportunity = async (opp: any) => {
    try {
      if (!opp?.id) return;
      
      form.setValue('opportunity_id', String(opp.id), { shouldDirty: true });
      
      // Fetch full opportunity data including account and contact
      const { data: fullOpp, error } = await supabase.functions.invoke('get-opportunity-full', {
        body: { id: opp.id }
      });

      if (!error && fullOpp) {
        // Auto-populate account if opportunity has one
        if (fullOpp.account_id) {
          form.setValue('account_id', String(fullOpp.account_id), { shouldDirty: true });
          
          // Ensure account is in the list
          if (fullOpp.accounts) {
            setAccounts((prev) => {
              const exists = prev.some((a: any) => String(a.id) === String(fullOpp.account_id));
              return exists ? prev : [{ id: fullOpp.accounts.id, name: fullOpp.accounts.name }, ...prev];
            });
          }
        }
        
        // Auto-populate contact if opportunity has one
        if (fullOpp.contact_id) {
          form.setValue('contact_id', String(fullOpp.contact_id), { shouldDirty: true });
          
          // Ensure contact is in the list
          if (fullOpp.contacts) {
            setContacts((prev) => {
              const exists = prev.some((c: any) => String(c.id) === String(fullOpp.contact_id));
              return exists ? prev : [{ 
                id: fullOpp.contacts.id, 
                first_name: fullOpp.contacts.first_name || '', 
                last_name: fullOpp.contacts.last_name || '', 
                account_id: fullOpp.account_id 
              }, ...prev];
            });
          }
        }
        
        // Ensure selected opportunity appears in the dropdown
        setOpportunities((prev) => {
          const exists = prev.some((o: any) => String(o.id) === String(fullOpp.id));
          return exists ? prev : [fullOpp, ...prev];
        });
      } else {
        // Fallback to provided data if edge function fails
        if (opp.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
        if (opp.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
        
        setOpportunities((prev) => {
          const exists = prev.some((o: any) => String(o.id) === String(opp.id));
          return exists ? prev : [opp, ...prev];
        });
      }
    } catch (err) {
      console.error('Error selecting opportunity:', err);
      // Basic fallback
      if (opp.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
      if (opp.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
    }
  };

  const handleSelectAccount = (account: any) => {
    try {
      if (account?.id) form.setValue('account_id', String(account.id), { shouldDirty: true });
      // If currently selected contact does not belong, clear it
      const currentContactId = form.getValues('contact_id');
      const belongs = contacts.some((c: any) => String(c.id) === String(currentContactId) && String(c.account_id) === String(account.id));
      if (!belongs) form.setValue('contact_id', undefined, { shouldDirty: true });
      // Normalize injected account shape to ensure label and tenant resolution work
      const normalized = {
        id: account.id,
        name: account.name || account.account_name || 'Account',
        tenant_id: account.tenant_id ?? null,
      } as any;
      setAccounts((prev) => {
        const exists = prev.some((a: any) => String(a.id) === String(normalized.id));
        return exists ? prev : [normalized, ...prev];
      });
    } catch {}
  };

  const handleSelectContact = (contact: any) => {
    try {
      if (contact?.id) form.setValue('contact_id', String(contact.id), { shouldDirty: true });
      if (contact?.account_id) form.setValue('account_id', String(contact.account_id), { shouldDirty: true });
      setContacts((prev) => {
        const exists = prev.some((c: any) => String(c.id) === String(contact.id));
        return exists ? prev : [contact, ...prev];
      });
    } catch {}
  };

  const updateCharge = (
    index: number,
    side: 'buy' | 'sell',
    chargeIndex: number,
    field: keyof Charge,
    value: any,
  ) => {
    const next = [...carrierQuotes];
    const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
    targetList[chargeIndex] = { ...targetList[chargeIndex], [field]: value } as Charge;
    setCarrierQuotes(next);
  };

  const removeCharge = (index: number, side: 'buy' | 'sell', chargeIndex: number) => {
    const next = [...carrierQuotes];
    const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
    next[index] = {
      ...next[index],
      [side === 'buy' ? 'buying_charges' : 'selling_charges']:
        targetList.filter((_, i) => i !== chargeIndex),
    } as CarrierQuote;
    setCarrierQuotes(next);
  };

  const totalCharges = (charges: Charge[]) => charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unit_price;
      const discount = lineTotal * (item.discount_percent / 100);
      return sum + (lineTotal - discount);
    }, 0);

    const taxPercent = parseFloat(form.getValues('tax_percent') || '0');
    const shippingAmount = parseFloat(form.getValues('shipping_amount') || '0');
    const taxAmount = subtotal * (taxPercent / 100);
    const total = subtotal + taxAmount + shippingAmount;

    return { subtotal, taxAmount, total };
  };

  const onSubmit = async (values: z.infer<typeof quoteSchema>) => {
    // Resolve tenant_id from context/role, and fall back to selected account/opportunity
    let tenantId = context.tenantId || roles?.[0]?.tenant_id;
    if (!tenantId && values.account_id) {
      try {
        const { data: acc } = await supabase
          .from('accounts')
          .select('tenant_id')
          .eq('id', values.account_id)
          .maybeSingle();
        tenantId = acc?.tenant_id || tenantId;
      } catch {}
    }
    // As an additional fallback, infer from opportunity if provided
    if (!tenantId && values.opportunity_id) {
      try {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('tenant_id, account_id')
          .eq('id', values.opportunity_id)
          .maybeSingle();
        tenantId = (opp as any)?.tenant_id || tenantId;
        // Backfill account_id from opportunity if missing
        if (!values.account_id && (opp as any)?.account_id) {
          form.setValue('account_id', String((opp as any).account_id), { shouldDirty: true });
        }
      } catch {}
    }
    const franchiseId = context.franchiseId || roles?.[0]?.franchise_id || null;

    if (!tenantId) {
      toast.error('No tenant selected. Please ensure your account is linked to a tenant.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      
      const regulatory: any = {};
      if (values.trade_direction) regulatory.trade_direction = values.trade_direction;
      if (selectedServiceType) regulatory.transport_mode = selectedServiceType;
      if (carrierQuotes.length > 0) {
        regulatory.carrier_quotes = carrierQuotes.map((cq) => ({
          carrier_id: cq.carrier_id,
          mode: cq.mode || selectedServiceType || null,
          buying_charges: cq.buying_charges,
          selling_charges: cq.selling_charges,
          total_buy: totalCharges(cq.buying_charges),
          total_sell: totalCharges(cq.selling_charges),
        }));
      }

      // Only generate a quote number for new quotes
      let quoteNumber: string | null = null;
      if (!quoteId) {
        const { data: genNumber, error: genError } = await (supabase as any).rpc('generate_quote_number', {
          p_tenant_id: tenantId,
          p_franchise_id: franchiseId,
        });
        quoteNumber = genError || !genNumber ? null : (typeof genNumber === 'string' ? genNumber : String(genNumber));
      }

      const quoteData: any = {
        ...(quoteNumber ? { quote_number: quoteNumber } : {}),
        title: values.title,
        description: values.description || null,
        service_type_id: values.service_type_id || null,
        service_id: values.service_id || null,
        incoterms: values.incoterms || null,
        regulatory_data: Object.keys(regulatory).length ? regulatory : null,
        carrier_id: values.carrier_id || null,
        consignee_id: values.consignee_id || null,
        origin_port_id: values.origin_port_id || null,
        destination_port_id: values.destination_port_id || null,
        account_id: values.account_id || null,
        contact_id: values.contact_id || null,
        opportunity_id: values.opportunity_id || null,
        status: values.status,
        valid_until: values.valid_until || null,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        owner_id: user?.id || null,
        created_by: user?.id || null,
        subtotal,
        tax_amount: taxAmount,
        tax_percent: parseFloat(values.tax_percent || '0'),
        shipping_amount: parseFloat(values.shipping_amount || '0'),
        total_amount: total,
        terms_conditions: values.terms_conditions || null,
        notes: values.notes || null,
        compliance_status: 'pending',
      };

      let quote: any = null;
      if (quoteId) {
        const { data: updated, error: updateErr } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quoteId)
          .select()
          .maybeSingle();
        if (updateErr) throw updateErr;
        quote = updated || { id: quoteId };
      } else {
        const { data: created, error: quoteError } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();
        if (quoteError) throw quoteError;
        quote = created;
      }

      const itemsData = items.map((item) => ({
        quote_id: quote.id,
        line_number: Number(item.line_number) || 1,
        product_name: item.product_name,
        description: item.description ?? null,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        discount_percent: Number(item.discount_percent) || 0,
        package_category_id: item.package_category_id ? String(item.package_category_id) : null,
        package_size_id: item.package_size_id ? String(item.package_size_id) : null,
        line_total:
          (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) * (1 - (Number(item.discount_percent) || 0) / 100),
      }));

      // Replace existing items on edit; insert on create
      if (quoteId) {
        const { error: delErr } = await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', quoteId);
        if (delErr) throw delErr;
      }
      const { error: itemsError } = await supabase.from('quote_items').insert(itemsData);

      if (itemsError) throw itemsError;

      // Immediately reload items to ensure all fields (including container size) are persisted
      try {
        const { data: savedItems } = await supabase
          .from('quote_items')
          .select('line_number, product_name, description, quantity, unit_price, discount_percent, package_category_id, package_size_id')
          .eq('quote_id', quote.id)
          .order('line_number', { ascending: true });
        if (Array.isArray(savedItems)) {
          setItems(
            savedItems.map((it: any) => ({
              line_number: it.line_number,
              product_name: it.product_name || '',
              description: it.description || '',
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              discount_percent: Number(it.discount_percent) || 0,
              package_category_id: it.package_category_id ? String(it.package_category_id) : undefined,
              package_size_id: it.package_size_id ? String(it.package_size_id) : undefined,
            }))
          );
        }
      } catch {}

      // Persist carrier rates and charges, then generate quotation version/options
      try {
        if (carrierQuotes.length > 0) {
          const rateIds = await createRatesAndChargesForQuote(
            quote.id,
            tenantId!,
            values.service_id || null,
            values.origin_port_id || null,
            values.destination_port_id || null,
            carrierQuotes.map((cq) => ({
              carrier_id: cq.carrier_id,
              mode: cq.mode || selectedServiceType || undefined,
              buying_charges: cq.buying_charges || [],
              selling_charges: cq.selling_charges || [],
            })),
            supabase as any,
          );
          if (rateIds.length > 0) {
            await createQuotationVersionWithOptions(
              tenantId!,
              quote.id,
              rateIds,
              {
                valid_until: values.valid_until || undefined,
                created_by: user?.id || null,
                change_reason: 'Initial options from captured carrier rates',
              },
              supabase as any,
            );
          }
        }
      } catch (err: any) {
        console.warn('Carrier rates/options handling failed', err);
        toast.error('Saved quote, but failed to generate options from carrier rates');
      }

      toast.success(quoteId ? 'Quote updated successfully' : 'Quote created successfully');
      onSuccess?.(quote.id);
    } catch (error: any) {
      toast.error(error.message || (quoteId ? 'Failed to update quote' : 'Failed to create quote'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="enterprise-form pb-24">
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {/* Hidden file input for Import (CSV) */}
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />
        <fieldset disabled={isHydrating} aria-busy={isHydrating}>
        <Card className="ef-card">
          <CardHeader className="ef-header">
            <CardTitle className="ef-title">
              Quote Information
              {isEditMode && (
                <span className="ml-2 ef-subtitle">Edit Mode</span>
              )}
            </CardTitle>
            {isEditMode && isHydrating && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading saved data…
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="ef-grid">
              {/* Compact top grid spacing */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-1 sm:col-span-2 lg:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-1 sm:col-span-2 lg:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        rows={1}
                        className="min-h-[2.25rem] overflow-hidden resize-none"
                        onInput={(e) => {
                          const el = e.currentTarget;
                          el.style.height = 'auto';
                          el.style.height = `${el.scrollHeight}px`;
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="ef-divider" />
            {/* Quotation, Opportunity, Account, Contact section */}
            <section aria-labelledby="quote-identifiers" className="border border-border rounded-md p-3">
              <h3 id="quote-identifiers" className="sr-only">Quotation, Opportunity, Account, Contact</h3>
              <div className="ef-grid">
                {/* Quotation Number */}
                <FormItem>
                  <FormLabel>Quotation Number</FormLabel>
                  <FormControl>
                    <Input readOnly value={quoteNumberPreview} />
                  </FormControl>
                </FormItem>

              {/* Opportunity Number */}
              <FormField
                control={form.control}
                name="opportunity_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opportunity Number</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const opp = opportunities.find((o) => String(o.id) === value);
                        if (opp) {
                          if (opp.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
                          if (opp.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
                        }
                      }} 
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select opportunity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {opportunities.map((opp) => (
                          <SelectItem key={opp.id} value={String(opp.id)}>
                            {opp.name}
                          </SelectItem>
                        ))}
                        {opportunities.length === 0 && (
                          <SelectItem disabled value="__no_opportunities__">No opportunities found</SelectItem>
                        )}
                        {field.value && !opportunities.some((o: any) => String(o.id) === String(field.value)) && (
                          <SelectItem key={`selected-opportunity-${field.value}`} value={String(field.value)}>
                            Selected Opportunity
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOppDialogOpen(true)}>
                        <Search className="h-4 w-4 mr-2" /> Browse opportunities
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account */}
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v)} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.name || (account as any).account_name || 'Account'}
                          </SelectItem>
                        ))}
                        {accounts.length === 0 && (
                          <SelectItem disabled value="__no_accounts__">No accounts found</SelectItem>
                        )}
                        {field.value && !accounts.some((a: any) => String(a.id) === String(field.value)) && (
                          <SelectItem key={`selected-account-${field.value}`} value={String(field.value)}>
                            Selected Account
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAccDialogOpen(true)}>
                        <Search className="h-4 w-4 mr-2" /> Browse accounts
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact */}
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v)} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(accountId ? contacts.filter((c: any) => String(c.account_id) === String(accountId)) : contacts).map((contact) => (
                          <SelectItem key={contact.id} value={String(contact.id)}>
                            {contact.first_name} {contact.last_name}
                          </SelectItem>
                        ))}
                        {contacts.length === 0 && (
                          <SelectItem disabled value="__no_contacts__">No contacts found</SelectItem>
                        )}
                        {field.value && !(
                          (accountId ? contacts.filter((c: any) => String(c.account_id) === String(accountId)) : contacts)
                            .some((c: any) => String(c.id) === String(field.value))
                        ) && (
                          <SelectItem key={`selected-contact-${field.value}`} value={String(field.value)}>
                            {resolvedContactLabels[String(field.value)] || 'Selected Contact'}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setContactDialogOpen(true)}>
                        <Search className="h-4 w-4 mr-2" /> Browse contacts
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
            </section>
            <div className="ef-divider" />

            <div className="ef-grid">
              {/* Arrange Valid Until, Service Type, Service, Import/Export in one row */}
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const selectedType = serviceTypes.find(st => st.id === value);
                        if (selectedType) {
                          form.setValue('service_type_id', selectedType.id);
                          setSelectedServiceType(selectedType.id);
                          form.setValue('service_id', ''); // Reset service selection
                        }
                      }}
                      defaultValue={form.getValues('service_type_id')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes.map((st) => (
                          <SelectItem key={st.id} value={st.id}>
                            {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedServiceType}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredServices.length > 0 ? (
                          filteredServices.map((service) => (
                            <SelectItem key={String(service.id)} value={String(service.id)}>
                              {service.service_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-gray-500">
                            {selectedServiceType
                              ? 'No services found for this service type.'
                              : 'Please select a service type first.'}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trade_direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Import/Export</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="import">Import</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="origin_port_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin Port/Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select origin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ports.map((port) => (
                          <SelectItem key={port.id} value={String(port.id)}>
                            {port.location_name} ({port.location_code || 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination_port_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Port/Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ports.map((port) => (
                          <SelectItem key={port.id} value={String(port.id)}>
                            {port.location_name} ({port.location_code || 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carrier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* Ensure currently selected carrier appears even if list is filtered out or still loading */}
                        {field.value && !carriers.some((c: any) => String(c.id) === String(field.value)) && (
                          <SelectItem key={`selected-carrier-${field.value}`} value={String(field.value)}>
                            {formatCarrierName(resolvedCarrierLabels[String(field.value)] || 'Selected Carrier')}
                          </SelectItem>
                        )}
                        {carriers.map((carrier) => (
                          <SelectItem key={carrier.id} value={String(carrier.id)}>
                            {formatCarrierName(carrier.carrier_name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fourth column: Capture Carrier Rates label and button/dialog */}
              <div className="space-y-2">
                <FormLabel>Capture Carrier Rates</FormLabel>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="w-full md:w-auto font-semibold shadow-lg ring-4 ring-primary/70 animate-pulse"
                    >
                      {/* Using an icon to emphasize action */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                        <rect width="18" height="14" x="3" y="5" rx="2" ry="2"></rect>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      Capture Carrier Rates
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Carrier Rates</DialogTitle>
                    </DialogHeader>
                    <CarrierQuotesSection
                      carriers={carriers}
                      selectedServiceType={selectedServiceType}
                      carrierQuotes={carrierQuotes}
                      setCarrierQuotes={setCarrierQuotes}
                    />
                  </DialogContent>
                </Dialog>
              </div>

            </div>

            <div className="ef-grid">

            </div>

            <div className="ef-grid">

            </div>

            <div className="grid grid-cols-1 gap-2">

            </div>
          </CardContent>
        </Card>

        {/* Carrier quotations moved into dialog opened by the Carrier Rates button above */}

        <div className="ef-divider" />
        <Card className="ef-card">
          <CardHeader className="ef-header">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="ef-title">Line Items</CardTitle>
              <Button type="button" onClick={addItem} size="sm" className="ef-hover">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-2 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-medium">Item {index + 1}</span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-8 gap-2 items-end">
                  <Input
                    placeholder="Product Name"
                    value={item.product_name}
                    onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                  />
                  <Input
                    placeholder="Description"
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                  <Input
                    className="min-w-[2ch]"
                    type="number"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                  {selectedServiceType === 'ocean' && (
                    <>
                      <div>
                        <FormLabel>Container Category</FormLabel>
                        <Select
                          value={item.package_category_id || ''}
                          onValueChange={(v) => updateItem(index, 'package_category_id', v)}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {item.package_category_id && !packageCategories.some((cat) => String(cat.id) === String(item.package_category_id)) && (
                              <SelectItem key={`fallback-cat-${index}`} value={String(item.package_category_id)}>
                                {resolvedPackageCategoryLabels[String(item.package_category_id)] || 'Selected Category'}
                              </SelectItem>
                            )}
                            {packageCategories.length === 0 && (
                              <SelectItem disabled value="__no_categories__">No categories found</SelectItem>
                            )}
                            {packageCategories.map((cat: any) => (
                              <SelectItem key={cat.id} value={String(cat.id)}>
                                {cat.category_name || 'Category'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <FormLabel>Container Size</FormLabel>
                        <Select
                          value={item.package_size_id || ''}
                          onValueChange={(v) => updateItem(index, 'package_size_id', v)}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {item.package_size_id && !packageSizes.some((sz) => String(sz.id) === String(item.package_size_id)) && (
                              <SelectItem key={`fallback-size-${index}`} value={String(item.package_size_id)}>
                                {resolvedPackageSizeLabels[String(item.package_size_id)] || 'Selected Size'}
                              </SelectItem>
                            )}
                            {packageSizes.length === 0 && (
                              <SelectItem disabled value="__no_sizes__">No sizes found</SelectItem>
                            )}
                            {packageSizes.map((sz: any) => (
                              <SelectItem key={sz.id} value={String(sz.id)}>
                                {(sz.size_name || 'Size') + (sz.size_code ? ` (${sz.size_code})` : '')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <Input
                    className="min-w-[5ch]"
                    type="number"
                    step="0.01"
                    placeholder="Unit Price"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    className="min-w-[3ch]"
                    type="number"
                    step="0.01"
                    placeholder="Discount %"
                    value={item.discount_percent}
                    onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                  />
                  <div className="min-w-[5ch] flex items-center">
                    <span className="text-sm font-medium">
                      Total: ${(item.quantity * item.unit_price * (1 - item.discount_percent / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>



        <Card className="ef-card">
          <CardHeader className="ef-header">
            <CardTitle className="ef-title">Totals & Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="ef-grid">
              <FormField
                control={form.control}
                name="tax_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipping_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-1 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span className="font-medium">${calculateTotals().taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span className="font-medium">${parseFloat(form.watch('shipping_amount') || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>${calculateTotals().total.toFixed(2)}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="terms_conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea value={field.value ?? ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea value={field.value ?? ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="ef-card">
          <CardHeader className="ef-header">
            <CardTitle className="ef-title">Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="ef-grid">
              <FormField
                control={form.control}
                name="consignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select consignee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {consignees.map((consignee) => (
                          <SelectItem key={consignee.id} value={String(consignee.id)}>
                            {consignee.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="incoterms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incoterms</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select incoterms" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FOB">FOB - Free On Board</SelectItem>
                        <SelectItem value="CIF">CIF - Cost, Insurance & Freight</SelectItem>
                        <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                        <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                        <SelectItem value="CPT">CPT - Carriage Paid To</SelectItem>
                        <SelectItem value="CIP">CIP - Carriage & Insurance Paid</SelectItem>
                        <SelectItem value="DAP">DAP - Delivered At Place</SelectItem>
                        <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit button removed from main form per request; actions moved to sticky panel */}

        {/* Opportunity selection dialog */}
        <OpportunitySelectDialogList
          open={oppDialogOpen}
          onOpenChange={setOppDialogOpen}
          onSelect={handleSelectOpportunity}
        />

        {/* Account selection dialog */}
        <AccountSelectDialogList
          open={accDialogOpen}
          onOpenChange={setAccDialogOpen}
          onSelect={handleSelectAccount}
        />

        {/* Contact selection dialog */}
        <ContactSelectDialogList
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          onSelect={handleSelectContact}
        />

        {/* Sticky actions handled globally via DashboardLayout sticky bar */}
        
        </fieldset>
      </form>
    </Form>
    </div>
  );
}
  // Helper to normalize service_type values for robust filtering
  const canonicalType = (t: any) => {
    const raw = String(t || '').trim().toLowerCase();
    const map: Record<string, string> = {
      ocean: 'ocean',
      'ocean_freight': 'ocean',
      sea: 'ocean',
      'sea_freight': 'ocean',
      air: 'air',
      'air_freight': 'air',
      trucking: 'trucking',
      road: 'trucking',
      courier: 'courier',
      parcel: 'courier',
      moving: 'moving',
      'movers_packers': 'moving',
      railway_transport: 'railway_transport',
      rail: 'railway_transport',
    };
    return map[raw] || raw;
  };
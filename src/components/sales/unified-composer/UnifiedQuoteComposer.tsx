import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quoteComposerSchema, QuoteComposerValues } from './schema';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { QuotationNumberService } from '@/services/quotation/QuotationNumberService';
import { useToast } from '@/hooks/use-toast';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useRateFetching, ContainerResolver } from '@/hooks/useRateFetching';
import { useDraftAutoSave } from '@/hooks/useDraftAutoSave';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { PricingService } from '@/services/pricing.service';
import { QuoteOptionService } from '@/services/QuoteOptionService';
import { RateOption } from '@/types/quote-breakdown';
import { invokeAnonymous, enrichPayload } from '@/lib/supabase-functions';
import { logger } from '@/lib/logger';

import { QuoteStoreProvider, useQuoteStore } from '@/components/sales/composer/store/QuoteStore';
import { useQuoteRepositoryContext } from '@/components/sales/quote-form/useQuoteRepository';
import { FormZone, FormZoneValues, ExtendedFormData } from './FormZone';
import { ResultsZone } from './ResultsZone';
import { FinalizeSection } from './FinalizeSection';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnifiedQuoteComposerProps {
  quoteId?: string;
  versionId?: string;
  initialData?: any; // Pre-population from QuickQuoteHistory / navigation state
}

// ---------------------------------------------------------------------------
// Wrapped export (provides QuoteStoreProvider)
// ---------------------------------------------------------------------------

export function UnifiedQuoteComposer(props: UnifiedQuoteComposerProps) {
  return (
    <QuoteStoreProvider>
      <UnifiedQuoteComposerContent {...props} />
    </QuoteStoreProvider>
  );
}

// ---------------------------------------------------------------------------
// Inner content component
// ---------------------------------------------------------------------------

function UnifiedQuoteComposerContent({ quoteId, versionId, initialData }: UnifiedQuoteComposerProps) {
  const { scopedDb, context, supabase } = useCRM();
  const { user } = useAuth();
  const { toast } = useToast();
  const { containerTypes, containerSizes } = useContainerRefs();
  const { state: storeState, dispatch } = useQuoteStore();
  const { invokeAiAdvisor } = useAiAdvisor();
  const repoData = useQuoteRepositoryContext();

  const form = useForm<QuoteComposerValues>({
    resolver: zodResolver(quoteComposerSchema),
    defaultValues: {
      mode: 'ocean',
      origin: '',
      destination: '',
      commodity: '',
      marginPercent: 15,
      autoMargin: true,
      accountId: '',
      contactId: '',
      opportunityId: '',
      quoteTitle: '',
    },
  });

  // Rate fetching hook
  const rateFetching = useRateFetching();

  // Local state
  const [selectedOption, setSelectedOption] = useState<RateOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [complianceCheck, setComplianceCheck] = useState<{ compliant: boolean; issues: any[] } | null>(null);
  const [smartMode, setSmartMode] = useState(true);
  const [lastFormData, setLastFormData] = useState<{ values: FormZoneValues; extended: ExtendedFormData } | null>(null);
  
  // CRM Data
   const [accounts, setAccounts] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [opportunities, setOpportunities] = useState<any[]>([]);
   const [isCrmLoading, setIsCrmLoading] = useState(false);
   const { profile } = useAuth();
   const canOverrideQuoteNumber = ['platform_admin', 'tenant_admin', 'sales_manager'].includes((profile as any)?.role || '');

  // Edit mode state
  const [isEditMode] = useState(() => !!quoteId);
  const [editLoading, setEditLoading] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState<Partial<FormZoneValues> | undefined>(undefined);
  const [initialExtended, setInitialExtended] = useState<Partial<ExtendedFormData> | undefined>(undefined);

  // Container resolver for rate fetching
  const containerResolver: ContainerResolver = useMemo(() => ({
    resolveContainerInfo: (typeId: string, sizeId: string) => {
      const typeObj = containerTypes.find(t => t.id === typeId);
      const sizeObj = containerSizes.find(s => s.id === sizeId);
      return {
        type: typeObj?.code || typeObj?.name || typeId,
        size: sizeObj?.name || sizeId,
        iso_code: sizeObj?.iso_code,
      };
    },
  }), [containerTypes, containerSizes]);

  // Draft auto-save
  const getAutoSavePayload = useCallback(() => ({
    quoteId: storeState.quoteId,
    versionId: storeState.versionId,
    optionId: storeState.optionId,
    tenantId: storeState.tenantId,
    quoteData: storeState.quoteData,
    legs: storeState.legs,
    charges: storeState.charges,
  }), [storeState]);

  const { lastSaved, isSavingDraft } = useDraftAutoSave(
    scopedDb,
    getAutoSavePayload,
    { enabled: !!storeState.versionId && !!storeState.tenantId }
  );

  // ---------------------------------------------------------------------------
  // Edit mode: load existing quote data
  // ---------------------------------------------------------------------------

  const loadExistingQuote = async () => {
    if (!quoteId) return;
    setEditLoading(true);
    try {
      const tenantId = context?.tenantId || null;
      // Load quote
      const { data: quoteRow, error: quoteError } = await scopedDb
        .from('quotes', true)
        .select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
        .eq('id', quoteId)
        .maybeSingle();

      if (quoteError || !quoteRow) {
        toast({ title: 'Error', description: 'Failed to load quote', variant: 'destructive' });
        setEditLoading(false);
        return;
      }
      const raw = quoteRow as any;
      // Initialize store
      dispatch({
        type: 'INITIALIZE',
        payload: {
          quoteId,
          versionId: versionId || null,
          tenantId: raw.tenant_id || tenantId,
          quoteData: raw,
        },
      });

      // Pre-populate form values for edit mode
      const cargoDetails = typeof raw.cargo_details === 'object' ? raw.cargo_details : null;

      setInitialFormValues({
        accountId: raw.account_id || '',
        contactId: raw.contact_id || '',
        quoteTitle: raw.title || '',
        mode: (raw.transport_mode || 'ocean') as any,
        origin: raw.origin_location?.location_name || raw.origin || '',
        destination: raw.destination_location?.location_name || raw.destination || '',
        commodity: cargoDetails?.commodity || raw.commodity || '',
        weight: String(cargoDetails?.total_weight_kg || raw.total_weight || ''),
        volume: String(cargoDetails?.total_volume_cbm || raw.total_volume || ''),
      });
      // Sync to form directly
      if (form) {
        form.reset({
            ...form.getValues(),
            accountId: raw.account_id || '',
            contactId: raw.contact_id || '',
            quoteTitle: raw.title || '',
            mode: (raw.transport_mode || 'ocean') as any,
            origin: raw.origin_location?.location_name || raw.origin || '',
            destination: raw.destination_location?.location_name || raw.destination || '',
            commodity: cargoDetails?.commodity || raw.commodity || '',
            weight: String(cargoDetails?.total_weight_kg || raw.total_weight || ''),
            volume: String(cargoDetails?.total_volume_cbm || raw.total_volume || ''),
        });
      }

      setInitialExtended({
        incoterms: raw.incoterms || '',
        pickupDate: raw.pickup_date ? new Date(raw.pickup_date).toISOString().split('T')[0] : '',
        deliveryDeadline: raw.delivery_deadline ? new Date(raw.delivery_deadline).toISOString().split('T')[0] : '',
        htsCode: cargoDetails?.hts_code || '',
        dangerousGoods: !!raw.dangerous_goods,
        vehicleType: raw.vehicle_type || 'van',
      });

      // Load existing option if present
      if (versionId) {
        const { data: optionRows } = await scopedDb
          .from('quotation_version_options', true)
          .select('id, is_selected, total_amount, currency')
          .eq('quotation_version_id', versionId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (optionRows && optionRows.length > 0) {
          dispatch({ type: 'INITIALIZE', payload: { optionId: optionRows[0].id } });
        }
      }
    } catch (err) {
      logger.error('[UnifiedComposer] Failed to load quote:', err);
      toast({ title: 'Error', description: 'Failed to load existing quote data', variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    if (!quoteId || !versionId) return;
    loadExistingQuote();
  }, [quoteId, versionId]);

  // Load CRM Data
  useEffect(() => {
     const loadCRMData = async () => {
      // Ensure we have a tenant context before fetching
      const currentTenantId = context?.tenantId;
      if (!currentTenantId && !context?.isPlatformAdmin) {
          console.warn('[UnifiedComposer] No tenant ID available, skipping CRM data load');
          return;
      }

      try {
        console.log('[UnifiedComposer] Loading CRM data...');
        setIsCrmLoading(true);
        
        // Parallel fetch for performance
        const [accRes, conRes, oppRes] = await Promise.all([
            scopedDb.from('accounts').select('id, name, type').order('name'),
            scopedDb.from('contacts').select('id, first_name, last_name, account_id').order('first_name'),
            scopedDb.from('opportunities').select('id, name, account_id, contact_id').order('created_at', { ascending: false })
        ]);

        if (accRes.error) console.error('[UnifiedComposer] Failed to load accounts:', accRes.error);
        if (conRes.error) console.error('[UnifiedComposer] Failed to load contacts:', conRes.error);
        if (oppRes.error) console.error('[UnifiedComposer] Failed to load opportunities:', oppRes.error);

        const accs = accRes.data || [];
        const cons = conRes.data || [];
        const opps = oppRes.data || [];

        console.log(`[UnifiedComposer] Loaded ${accs.length} accounts, ${cons.length} contacts, ${opps.length} opportunities`);

        setAccounts(accs);
        setContacts(cons);
        setOpportunities(opps);
      } catch (e) {
        console.error('[UnifiedComposer] Critical error loading CRM data', e);
        toast({ title: 'Data Load Error', description: 'Failed to load customer data. Please refresh.', variant: 'destructive' });
      } finally {
        setIsCrmLoading(false);
      }
    };
    
    // Only load if scopedDb is ready
    if (scopedDb) {
        loadCRMData();
    }
  }, [scopedDb, context?.tenantId]);

  // ---------------------------------------------------------------------------
  // Handle pre-population from navigation state (QuickQuoteHistory)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialData) return;
    setInitialFormValues({
      accountId: initialData.accountId || '',
      contactId: initialData.contactId || '',
      quoteTitle: initialData.quoteTitle || '',
      mode: (initialData.mode || 'ocean') as any,
      origin: initialData.origin || '',
      destination: initialData.destination || '',
      commodity: initialData.commodity || initialData.commodity_description || '',
      weight: initialData.weight ? String(initialData.weight) : undefined,
      volume: initialData.volume ? String(initialData.volume) : undefined,
      preferredCarriers: initialData.preferredCarriers,
    });
    // Sync to form directly
    if (form) {
      form.reset({
          ...form.getValues(),
          accountId: initialData.accountId || '',
          contactId: initialData.contactId || '',
          quoteTitle: initialData.quoteTitle || '',
          mode: (initialData.mode || 'ocean') as any,
          origin: initialData.origin || '',
          destination: initialData.destination || '',
          commodity: initialData.commodity || initialData.commodity_description || '',
          weight: initialData.weight ? String(initialData.weight) : undefined,
          volume: initialData.volume ? String(initialData.volume) : undefined,
          preferredCarriers: initialData.preferredCarriers,
      });
    }

    if (initialData.containerType || initialData.incoterms || initialData.htsCode) {
      setInitialExtended({
        containerType: initialData.containerType || '',
        containerSize: initialData.containerSize || '',
        containerQty: initialData.containerQty || '1',
        incoterms: initialData.incoterms || '',
        htsCode: initialData.htsCode || '',
        dangerousGoods: !!initialData.dangerousGoods,
        vehicleType: initialData.vehicleType || 'van',
        originDetails: initialData.originDetails || null,
        destinationDetails: initialData.destinationDetails || null,
      });
    }
  }, [initialData, form]);

  // ---------------------------------------------------------------------------
  // Compliance check
  // ---------------------------------------------------------------------------

  const runComplianceCheck = async (params: FormZoneValues & ExtendedFormData) => {
    try {
      const { data, error } = await invokeAiAdvisor({
        action: 'validate_compliance',
        payload: {
          origin: params.origin,
          destination: params.destination,
          commodity: params.commodity,
          mode: params.mode,
          dangerous_goods: params.dangerousGoods,
        },
      });
      if (!error && data) {
        setComplianceCheck(data);
        if (data.compliant === false) {
          toast({ title: 'Compliance Warning', description: 'Please review compliance issues.', variant: 'destructive' });
        }
      }
    } catch {
      // Non-blocking
    }
  };

  // ---------------------------------------------------------------------------
  // Handle "Get Rates"
  // ---------------------------------------------------------------------------

  const handleGetRates = async (formValues: FormZoneValues, extendedData: ExtendedFormData, smart: boolean) => {
    setSmartMode(smart);
    setSelectedOption(null);
    setComplianceCheck(null);
    setLastFormData({ values: formValues, extended: extendedData });

    // Fire compliance in parallel (non-blocking)
    runComplianceCheck({ ...formValues, ...extendedData } as any);

    await rateFetching.fetchRates(
      {
        ...formValues,
        ...extendedData,
        mode: (formValues.mode || 'ocean') as any,
        smartMode: smart,
        account_id: storeState.quoteData?.account_id,
      } as any,
      containerResolver
    );
  };

  // ---------------------------------------------------------------------------
  // Handle option selection
  // ---------------------------------------------------------------------------

  const handleSelectOption = (option: RateOption) => {
    setSelectedOption(prev => (prev?.id === option.id ? null : option));
  };

  // ---------------------------------------------------------------------------
  // Handle save quote
  // ---------------------------------------------------------------------------

  const isUUID = (v: any) =>
    typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const handleSaveQuote = async (charges: any[], marginPercent: number, notes: string) => {
    setSaving(true);

    try {
      const tenantId = storeState.tenantId || context?.tenantId;
      if (!tenantId) {
        toast({ title: 'Error', description: 'Tenant context not found', variant: 'destructive' });
        return;
      }

      // Ensure version exists
      let currentVersionId = storeState.versionId || versionId;
      let currentQuoteId = storeState.quoteId || quoteId;

      // Build RPC payload
      const formData = lastFormData;
      const isStandalone = !!formData?.values.standalone;
      
      // Determine quote number
      let finalQuoteNumber = formData?.values.quoteNumber?.trim();
      if (finalQuoteNumber) {
        // Manual override
        if (!canOverrideQuoteNumber) {
          toast({ title: 'Not allowed', description: 'You do not have permission to override quote numbers.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        // Check uniqueness
        const unique = await QuotationNumberService.isUnique(scopedDb, tenantId, finalQuoteNumber);
        // If updating existing quote and number hasn't changed, unique check might fail if we don't exclude current ID.
        // isUnique implementation checks generic count. 
        // We should skip check if we are just saving the same number on the same quote.
        // But here we might be changing it.
        // For simplicity, let's trust the backend unique constraint or improve isUnique later.
        if (!unique && !currentQuoteId) {
             toast({ title: 'Duplicate Number', description: 'This quote number is already taken.', variant: 'destructive' });
             setSaving(false);
             return;
        }
      } else if (!currentQuoteId) {
        // Auto-generate only for new quotes
        const config = await QuotationNumberService.getConfig(scopedDb, tenantId);
        finalQuoteNumber = await QuotationNumberService.generateNext(scopedDb, tenantId, config);
      }

      // Auto-create/link opportunity (CRM-linked mode only)
      let effectiveOpportunityId = formData?.values.opportunityId || null;
      if (!isStandalone && (formData?.values.accountId) && !effectiveOpportunityId) {
        try {
          const { data: createdOpp, error: oppErr } = await scopedDb
            .from('opportunities')
            .insert({
              name: formData?.values.quoteTitle || 'New Quotation',
              account_id: formData?.values.accountId,
              tenant_id: tenantId,
              status: 'open'
            })
            .select('id')
            .single();
          if (!oppErr && createdOpp?.id) {
            effectiveOpportunityId = createdOpp.id;
          }
        } catch {
          // non-blocking
        }
      }

      // Build guest billing details in standalone mode
      const billingForStandalone = isStandalone ? {
        company: formData?.values.guestCompany || null,
        name: formData?.values.guestName || null,
        email: formData?.values.guestEmail || null,
        phone: formData?.values.guestPhone || null,
        customer_po: formData?.values.customerPo || null,
        vendor_ref: formData?.values.vendorRef || null,
        project_code: formData?.values.projectCode || null,
      } : null;

      const quotePayload: any = {
        id: isUUID(currentQuoteId) ? currentQuoteId : undefined,
        quote_number: finalQuoteNumber,
        title: (formData?.values.quoteTitle || storeState.quoteData?.title) || `Quote - ${formData?.values.origin || ''} to ${formData?.values.destination || ''}`,
        transport_mode: formData?.values.mode || 'ocean',
        origin: formData?.values.origin || '',
        destination: formData?.values.destination || '',
        status: 'draft',
        tenant_id: tenantId,
        notes: [notes, formData?.values.notesText].filter(Boolean).join('\n') || null,
        terms_conditions: formData?.values.termsConditions || null,
        billing_address: billingForStandalone,
        pickup_date: formData?.extended.pickupDate || null,
        delivery_deadline: formData?.extended.deliveryDeadline || null,
        incoterms: formData?.extended.incoterms || null,
        vehicle_type: formData?.extended.vehicleType || null,
       account_id: isStandalone ? null : (formData?.values.accountId || storeState.quoteData?.account_id || null),
       contact_id: isStandalone ? null : (formData?.values.contactId || storeState.quoteData?.contact_id || null),
       opportunity_id: isStandalone ? null : (effectiveOpportunityId || null),
      };

      // Build option with per-leg charges from useChargesManager
      // Group managed charges by legId
      const chargesByLegId: Record<string, any[]> = {};
      const combinedCharges: any[] = [];
      for (const c of charges) {
        const legKey = c.legId || 'combined';
        if (legKey === 'combined' || !c.legId) {
          combinedCharges.push(c);
        } else {
          if (!chargesByLegId[legKey]) chargesByLegId[legKey] = [];
          chargesByLegId[legKey].push(c);
        }
      }

      const optionLegs = (selectedOption?.legs || []).map((leg: any) => ({
        transport_mode: leg.mode || formData?.values.mode || 'ocean',
        leg_type: leg.leg_type || leg.bifurcation_role || 'transport',
        origin_location_name: leg.origin || '',
        destination_location_name: leg.destination || '',
        charges: (chargesByLegId[leg.id] || []).map((c: any) => ({
          category_id: c.category_id || null,
          basis_id: c.basis_id || null,
          currency_id: c.currency_id || null,
          side: 'buy',
          unit_price: c.buy?.rate || 0,
          quantity: c.buy?.quantity || 1,
          amount: c.buy?.amount || 0,
          sell_unit_price: c.sell?.rate || 0,
          sell_quantity: c.sell?.quantity || 1,
          sell_amount: c.sell?.amount || 0,
          note: c.note || null,
        })),
      }));

      const combinedChargesPayload = combinedCharges.map((c: any) => ({
        category_id: c.category_id || null,
        basis_id: c.basis_id || null,
        currency_id: c.currency_id || null,
        side: 'buy',
        unit_price: c.buy?.rate || 0,
        quantity: c.buy?.quantity || 1,
        amount: c.buy?.amount || 0,
        sell_unit_price: c.sell?.rate || 0,
        sell_quantity: c.sell?.quantity || 1,
        sell_amount: c.sell?.amount || 0,
        note: c.note || c.categoryName || null,
      }));

      const optionPayload = {
        id: isUUID(storeState.optionId) ? storeState.optionId : undefined,
        is_selected: true,
        source: 'unified_composer',
        source_attribution: selectedOption?.source_attribution || 'manual',
        ai_generated: selectedOption?.ai_generated || false,
        margin_percent: marginPercent,
        legs: optionLegs,
        combined_charges: combinedChargesPayload,
      };

      const rpcPayload = {
        quote: quotePayload,
        items: [],
        cargo_configurations: [],
        options: [optionPayload],
      };

      const { data: savedId, error: rpcError } = await scopedDb.rpc('save_quote_atomic', {
        p_payload: rpcPayload,
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to save quotation');
      }

      // Update store
      if (savedId) {
        dispatch({ type: 'INITIALIZE', payload: { quoteId: savedId } });

        // Apply manual quote number override with audit if provided
        const manualNo = formData?.values.quoteNumber?.trim();
        if (manualNo) {
          if (!canOverrideQuoteNumber) {
            toast({ title: 'Not allowed', description: 'You do not have permission to override quote numbers.', variant: 'destructive' });
            return;
          }
          try {
            // Fetch existing to compare
            const { data: existing } = await scopedDb.from('quotes').select('quote_number, notes').eq('id', savedId).single();
            const prevNo = existing?.quote_number || null;
            // Uniqueness enforcement (best-effort)
            const tenantIdStr = storeState.tenantId || context?.tenantId;
            if (tenantIdStr) {
              const unique = await QuotationNumberService.isUnique(scopedDb, tenantIdStr, manualNo);
              if (!unique) {
                toast({ title: 'Duplicate number', description: 'This quote number already exists. Please choose another.', variant: 'destructive' });
                return;
              }
            }
            if (prevNo !== manualNo) {
              const auditLine = `[${new Date().toISOString()}] Quote number changed ${prevNo ? `from ${prevNo} ` : ''}to ${manualNo}`;
              const newNotes = existing?.notes ? `${existing.notes}\n${auditLine}` : auditLine;
              await scopedDb.from('quotes').update({ quote_number: manualNo, notes: newNotes }).eq('id', savedId);
            }
          } catch (e) {
            console.error('Quote number override failed', e);
          }
        }
      }

      toast({ title: 'Success', description: 'Quote saved successfully' });
    } catch (err: any) {
      logger.error('[UnifiedComposer] Save failed:', err);
      toast({ title: 'Save Failed', description: err.message || 'An error occurred', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rerun rates
  // ---------------------------------------------------------------------------

  const handleRerunRates = () => {
    if (lastFormData) {
      handleGetRates(lastFormData.values, lastFormData.extended, smartMode);
    }
  };

  // ---------------------------------------------------------------------------
  // Draft save (manual)
  // ---------------------------------------------------------------------------

  const handleSaveDraft = async () => {
    if (!lastFormData) {
      toast({ title: 'Nothing to save', description: 'Please fill out the form first.' });
      return;
    }

    const tenantId = storeState.tenantId || context?.tenantId;
    if (!tenantId) {
      toast({ title: 'Error', description: 'Tenant context not found', variant: 'destructive' });
      return;
    }

    try {
      const formData = lastFormData;
      const quotePayload: any = {
        id: isUUID(storeState.quoteId) ? storeState.quoteId : (isUUID(quoteId) ? quoteId : undefined),
       title: (formData.values.quoteTitle || storeState.quoteData?.title) || `Draft - ${formData.values.origin || ''} to ${formData.values.destination || ''}`,
        transport_mode: formData.values.mode || 'ocean',
        origin: formData.values.origin || '',
        destination: formData.values.destination || '',
        status: 'draft',
        tenant_id: tenantId,
        pickup_date: formData.extended.pickupDate || null,
        delivery_deadline: formData.extended.deliveryDeadline || null,
        incoterms: formData.extended.incoterms || null,
       account_id: formData.values.accountId || storeState.quoteData?.account_id || null,
       contact_id: formData.values.contactId || storeState.quoteData?.contact_id || null,
       opportunity_id: formData.values.opportunityId || null,
      };

      const { data: savedId, error: rpcError } = await scopedDb.rpc('save_quote_atomic', {
        p_payload: { quote: quotePayload, items: [], cargo_configurations: [], options: [] },
      });

      if (rpcError) throw new Error(rpcError.message || 'Failed to save draft');

      if (savedId) {
        dispatch({ type: 'INITIALIZE', payload: { quoteId: savedId } });
      }

      toast({ title: 'Draft saved', description: 'Your quote draft has been saved.' });
    } catch (err: any) {
      logger.error('[UnifiedComposer] Draft save failed:', err);
      toast({ title: 'Save Failed', description: err.message || 'Could not save draft', variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // PDF Generation
  // ---------------------------------------------------------------------------

  const handleGeneratePdf = async () => {
    const currentQuoteId = storeState.quoteId || quoteId;
    const currentVersionId = storeState.versionId || versionId;
    if (!currentQuoteId) {
      toast({ title: 'Save First', description: 'Please save the quote before generating a PDF.', variant: 'destructive' });
      return;
    }
    try {
      const payload = { quoteId: currentQuoteId, versionId: currentVersionId, engine_v2: true, source: 'unified_composer', action: 'generate-pdf' };
      const response = await invokeAnonymous('generate-quote-pdf', enrichPayload(payload));
      if (!response?.content) {
        const issues = Array.isArray(response?.issues) ? response.issues.join('; ') : null;
        throw new Error(issues || 'Received empty content from PDF service');
      }
      const binaryString = window.atob(response.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quote-${currentQuoteId.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF Generated', description: 'PDF has been downloaded.' });
    } catch (err: any) {
      logger.error('[UnifiedComposer] PDF generation failed:', err);
      toast({ title: 'PDF Failed', description: err.message || 'Could not generate PDF', variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (editLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading quote...</span>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Auto-save indicator */}
        <div className="flex items-center justify-end text-xs text-muted-foreground gap-2">
          {isSavingDraft ? (
            <><Cloud className="w-3 h-3 animate-pulse" /> Saving draft...</>
          ) : lastSaved ? (
            <><Cloud className="w-3 h-3 text-green-500" /> Saved {lastSaved.toLocaleTimeString()}</>
          ) : storeState.versionId ? (
            <><CloudOff className="w-3 h-3" /> Not yet saved</>
          ) : null}
        </div>

        {/* Form Zone — always visible */}
        <FormZone
          onGetRates={handleGetRates}
          onSaveDraft={storeState.versionId ? handleSaveDraft : undefined}
          loading={rateFetching.loading}
          crmLoading={isCrmLoading}
          initialValues={initialFormValues}
          initialExtended={initialExtended}
          accounts={accounts}
          contacts={contacts}
          opportunities={opportunities}
          onChange={(values) => {
            setLastFormData(prev => ({
              values: values as FormZoneValues,
              extended: prev?.extended || initialExtended || {}
            }));
          }}
        />

        <Separator />

        {/* Results Zone */}
        <ResultsZone
          results={rateFetching.results}
          loading={rateFetching.loading}
          smartMode={smartMode}
          marketAnalysis={rateFetching.marketAnalysis}
          confidenceScore={rateFetching.confidenceScore}
          anomalies={rateFetching.anomalies}
          complianceCheck={complianceCheck}
          onSelect={handleSelectOption}
          selectedOptionId={selectedOption?.id}
          onRerunRates={lastFormData ? handleRerunRates : undefined}
        />

        {/* Finalize Section — shown when option selected */}
        {selectedOption && (
          <>
            <Separator />
            <FinalizeSection
              selectedOption={selectedOption}
              onSaveQuote={handleSaveQuote}
              onGeneratePdf={handleGeneratePdf}
              saving={saving}
              referenceData={{
                chargeCategories: repoData.chargeCategories || [],
                chargeBases: repoData.chargeBases || [],
                currencies: repoData.currencies || [],
                chargeSides: repoData.chargeSides || [],
              }}
            />
          </>
        )}
      </div>
    </FormProvider>
  );
}

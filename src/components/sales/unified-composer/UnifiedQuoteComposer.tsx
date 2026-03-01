import { useState, useEffect, useMemo, useReducer, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quoteComposerSchema, QuoteComposerValues } from './schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plane, Ship, Truck, Train, Timer, Sparkles, ChevronDown, Save, Settings2, Building2, User, FileText, Loader2, AlertCircle, History, ExternalLink } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { QuotationNumberService } from '@/services/quotation/QuotationNumberService';
import { useToast } from '@/hooks/use-toast';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useRateFetching, ContainerResolver } from '@/hooks/useRateFetching';
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

import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';
import { QuotationOptionCrudService } from '@/services/quotation/QuotationOptionCrudService';
import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';
import { showQuotationSuccessToast } from '@/components/notifications/QuotationSuccessToast';

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
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Local state
  const [selectedOption, setSelectedOption] = useState<RateOption | null>(null);
  const [visibleRateIds, setVisibleRateIds] = useState<string[]>([]);
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [complianceCheck, setComplianceCheck] = useState<{ compliant: boolean; issues: any[] } | null>(null);
  const [lastFormData, setLastFormData] = useState<{ values: FormZoneValues; extended: ExtendedFormData } | null>(null);
  const [manualOptions, setManualOptions] = useState<RateOption[]>([]);
  const [deletedOptionIds, setDeletedOptionIds] = useState<string[]>([]);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, any>>({});

  // Rate fetching hook
  const rateFetching = useRateFetching();
  
  // Clear deleted options when new search starts
  useEffect(() => {
    if (rateFetching.loading) {
      setDeletedOptionIds([]);
      setVisibleRateIds([]);
    }
  }, [rateFetching.loading]);

  // Initialize visible rates with a single default option when results arrive
  useEffect(() => {
    if (rateFetching.results && rateFetching.results.length > 0) {
      // Only set default visible option if NOT in Smart Mode
      // In Smart Mode, we start with no selected options (only AI Analysis + Available Rates)
      if (!isSmartMode) {
        // Select the first one (highest rank/priority from fetch) as default
        setVisibleRateIds([rateFetching.results[0].id]);
      } else {
        // In Smart Mode, ensure no options are pre-selected
        setVisibleRateIds([]);
      }
    }
  }, [rateFetching.results, isSmartMode]);
  
  // CRM Data
   const [accounts, setAccounts] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [opportunities, setOpportunities] = useState<any[]>([]);
   const [isCrmLoading, setIsCrmLoading] = useState(false);
   const { profile } = useAuth();
   // Temporary override: Allow all users to override quote numbers during development
   const canOverrideQuoteNumber = true; 
   // Original permission check:
   // const canOverrideQuoteNumber = ['platform_admin', 'tenant_admin', 'sales_manager'].includes((profile as any)?.role || '');

  // Edit mode state
  const [isEditMode] = useState(() => !!quoteId);
  const [editLoading, setEditLoading] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState<Partial<FormZoneValues> | undefined>(undefined);
  const [initialExtended, setInitialExtended] = useState<Partial<ExtendedFormData> | undefined>(undefined);
  const [config, setConfig] = useState<any>(null);

  // Load configuration
  useEffect(() => {
    if (context.tenantId) {
      new QuotationConfigurationService(scopedDb).getConfiguration(context.tenantId).then(setConfig);
    }
  }, [context.tenantId]);

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

  // ---------------------------------------------------------------------------
  // Audit Helper
  // ---------------------------------------------------------------------------

  const logAudit = useCallback(async (action: string, details: any, status: 'success' | 'failure' = 'success') => {
    try {
      // Use fire-and-forget for audit logs to not block UI
      scopedDb.from('audit_logs').insert({
        user_id: user?.id,
        action,
        resource_type: 'quotation',
        resource_id: quoteId,
        details: {
          ...details,
          status,
          component: 'UnifiedQuoteComposer',
          timestamp: new Date().toISOString()
        },
        // Rely on DB triggers/RLS for tenant_id/franchise_id if possible, or context
        tenant_id: context?.tenantId,
        franchise_id: context?.franchiseId
      }).then(({ error }) => {
        if (error) logger.warn('[UnifiedComposer] Audit log failed:', error);
      });
    } catch (e) {
      logger.warn('[UnifiedComposer] Audit log exception:', e);
    }
  }, [user?.id, quoteId, context?.tenantId, context?.franchiseId, scopedDb]);

  // ---------------------------------------------------------------------------
  // Handle Manual Option Creation
  // ---------------------------------------------------------------------------

  const handleAddManualOption = () => {
    const newOption: RateOption = {
      id: `manual-${Date.now()}`,
      carrier: '',
      name: '',
      price: 0,
      currency: 'USD',
      transitTime: 'TBD',
      tier: 'custom',
      is_manual: true,
      source_attribution: 'Manual Quote',
      legs: [],
      charges: [],
    };
    setManualOptions(prev => [...prev, newOption]);
    
    // Initialize draft
    setOptionDrafts(prev => ({
        ...prev,
        [newOption.id]: {
            legs: [],
            charges: [],
            marginPercent: 15
        }
    }));
    
    setSelectedOption(newOption);
  };

  // Combine results
  const combinedResults = useMemo(() => {
    const fetched = rateFetching.results || [];
    // Only include fetched rates that are explicitly visible
    const visibleFetched = fetched.filter(opt => visibleRateIds.includes(opt.id));
    const all = [...visibleFetched, ...manualOptions];
    return all.filter(opt => !deletedOptionIds.includes(opt.id));
  }, [rateFetching.results, manualOptions, deletedOptionIds, visibleRateIds]);

  // Available options (fetched but not yet added/visible)
  const availableOptions = useMemo(() => {
    const fetched = rateFetching.results || [];
    return fetched.filter(opt => !visibleRateIds.includes(opt.id) && !deletedOptionIds.includes(opt.id));
  }, [rateFetching.results, visibleRateIds, deletedOptionIds]);

  const handleAddRateOption = (optionId: string) => {
    setVisibleRateIds(prev => [...prev, optionId]);
  };

  const getTransitDays = (val?: string | null) => {
    if (!val) return null;
    const m = String(val).match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const displayResults = useMemo(() => {
    if (!combinedResults || combinedResults.length === 0) return [];
    const criteria = config?.auto_ranking_criteria || { cost: 0.4, transit_time: 0.3, reliability: 0.3 };

    const ranked = QuotationRankingService.rankOptions(
      combinedResults.map((o) => ({
        id: o.id,
        total_amount: o.price ?? o.total_amount ?? 0,
        transit_time_days: getTransitDays(o.transitTime),
        reliability_score: (o.reliability?.score ?? 5) / 10,
      })),
      criteria
    );

    const metaById = new Map(ranked.map((r) => [r.id, r]));
    const merged = combinedResults.map((o) => ({
      ...o,
      ...(metaById.get(o.id) || {}),
    })) as RateOption[];

    return merged.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
  }, [combinedResults, config?.auto_ranking_criteria]);

  const handleRemoveOption = async (optionId: string) => {
    if (displayResults.length <= 1) {
      toast({ title: 'Cannot delete', description: 'At least one option is required.', variant: 'destructive' });
      return;
    }

    // Check if it's a visible market rate
    const isMarketRate = rateFetching.results?.some(r => r.id === optionId);
    if (isMarketRate) {
      setVisibleRateIds(prev => prev.filter(id => id !== optionId));
      if (selectedOption?.id === optionId) {
        const next = displayResults.find((o) => o.id !== optionId) || null;
        setSelectedOption(next);
      }
      return;
    }

    const isUUID = (v: any) =>
      typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    const isManual = manualOptions.some((o) => o.id === optionId);

    // If it's not a UUID (temp/manual), handle locally
          if (!isUUID(optionId)) {
            setDeletedOptionIds((prev) => [...prev, optionId]);
            setManualOptions((prev) => prev.filter((o) => o.id !== optionId));
            setOptionDrafts((prev) => {
              const next = { ...prev };
              delete next[optionId];
              return next;
            });

            if (selectedOption?.id === optionId) {
              const next = displayResults.find((o) => o.id !== optionId) || null;
              setSelectedOption(next);
            }
            return;
          }

    try {
      const svc = new QuotationOptionCrudService(scopedDb);
      const { reselectedOptionId } = await svc.deleteOption(optionId, 'User removed option from composer');
      
      setManualOptions((prev) => prev.filter((o) => o.id !== optionId));
      setDeletedOptionIds((prev) => [...prev, optionId]); // Ensure it's hidden even if somehow still present in fetched results
      setOptionDrafts((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });

      if (selectedOption?.id === optionId) {
        const next = (reselectedOptionId && displayResults.find((o) => o.id === reselectedOptionId)) || displayResults.find((o) => o.id !== optionId) || null;
        setSelectedOption(next);
      }
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete option', variant: 'destructive' });
    }
  };

  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadedAttachments, setLoadedAttachments] = useState<any[]>([]); // Track original attachments for diffing
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);

  // ---------------------------------------------------------------------------
  // Edit mode: load existing quote data
  // ---------------------------------------------------------------------------

  const loadExistingQuote = useCallback(async () => {
    if (!quoteId) return;
    setEditLoading(true);
    setLoadErrors([]);

    // Audit reload attempt
    logAudit('reload_attempt', { quoteId });

    // DEBUG: Log context to debug scoping issues
    logger.info('[UnifiedComposer] loadExistingQuote context:', {
      quoteId,
      tenantId: context?.tenantId,
      franchiseId: context?.franchiseId,
      isPlatformAdmin: context?.isPlatformAdmin,
      isTenantAdmin: context?.isTenantAdmin
    });

    try {
      const tenantId = context?.tenantId || null;
      
      // Helper for retry logic
      const fetchQuoteWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          const { data, error } = await scopedDb
            .from('quotes')
            .select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
            .eq('id', quoteId)
            .maybeSingle();
            
          if (!error && data) return data;
          if (error) logger.warn(`[UnifiedComposer] Quote load attempt ${i + 1} failed:`, error);
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
        return null;
      };

      const quoteRow = await fetchQuoteWithRetry();

      if (!quoteRow) {
        logger.error('[UnifiedComposer] Failed to load quote after retries', { quoteId });
        logAudit('reload_failure', { error: 'Failed to load quote after retries', quoteId }, 'failure');
        toast({ title: 'Error', description: 'Failed to load quote data. Please try again.', variant: 'destructive' });
        setEditLoading(false);
        return;
      }
      
      logger.info('[UnifiedComposer] Quote loaded successfully:', { 
        id: quoteRow.id, 
        quoteTenant: (quoteRow as any).tenant_id,
        currentVersion: (quoteRow as any).current_version_id
      });

      const raw = quoteRow as any;

      // Parallel fetch for detailed configurations (Cargo, Items, Documents, Versions)
      // We use allSettled to allow partial failures
      const [cargoConfigResult, quoteItemsResult, docsResult, versionsResult] = await Promise.allSettled([
        scopedDb.from('quote_cargo_configurations').select('*').eq('quote_id', quoteId),
        scopedDb.from('quote_items').select('*').eq('quote_id', quoteId),
        scopedDb.from('quote_documents').select('*').eq('quote_id', quoteId),
        scopedDb.from('quotation_versions').select('*').eq('quote_id', quoteId).order('version_number', { ascending: false })
      ]);
      
      // Handle Cargo Configs
      let containerCombos: any[] = [];
      if (cargoConfigResult.status === 'fulfilled' && !cargoConfigResult.value.error) {
        containerCombos = (cargoConfigResult.value.data || []).map((c: any) => ({
          type: c.container_type || '',
          size: c.container_size || '',
          qty: c.quantity || 1
        }));
      } else {
        logger.warn('[UnifiedComposer] Failed to load cargo configs', cargoConfigResult);
        // Don't block, just log
      }

      // Handle Quote Items
      let items: any[] = [];
      if (quoteItemsResult.status === 'fulfilled' && !quoteItemsResult.value.error) {
        items = quoteItemsResult.value.data || [];
      } else {
        logger.warn('[UnifiedComposer] Failed to load quote items', quoteItemsResult);
        setLoadErrors(prev => [...prev, 'Failed to load line items']);
      }

      // Handle Documents
      let docs: any[] = [];
      if (docsResult.status === 'fulfilled' && !docsResult.value.error) {
        docs = docsResult.value.data || [];
        setAttachments(docs);
        setLoadedAttachments(docs);
      } else {
        logger.warn('[UnifiedComposer] Failed to load documents', docsResult);
        // Non-critical
      }

      // Handle Versions
      if (versionsResult.status === 'fulfilled' && !versionsResult.value.error) {
        setVersionHistory(versionsResult.value.data || []);
      } else {
        logger.warn('[UnifiedComposer] Failed to load version history', versionsResult);
        // Non-critical
      }

      // Initialize store
      dispatch({
        type: 'INITIALIZE',
        payload: {
          quoteId,
          versionId: versionId || raw.current_version_id || null, // Use current_version_id if available
          tenantId: raw.tenant_id || tenantId,
          quoteData: raw,
        },
      });

      // Pre-populate form values for edit mode
      const cargoDetails = typeof raw.cargo_details === 'object' ? raw.cargo_details : null;
      
      // Calculate totals from quote_items if available, otherwise fallback to quote header
      const totalWeight = items.length > 0 
        ? items.reduce((sum: number, item: any) => sum + (Number(item.weight_kg) || 0), 0)
        : (cargoDetails?.total_weight_kg || raw.total_weight || '');
        
      const totalVolume = items.length > 0
        ? items.reduce((sum: number, item: any) => sum + (Number(item.volume_cbm) || 0), 0)
        : (cargoDetails?.total_volume_cbm || raw.total_volume || '');
        
      const primaryCommodity = items.length > 0
        ? (items[0].product_name || items[0].description || 'Mixed General Cargo')
        : (cargoDetails?.commodity || raw.commodity || '');

      setInitialFormValues({
        accountId: raw.account_id || '',
        opportunityId: raw.opportunity_id || '',
        contactId: raw.contact_id || '',
        quoteTitle: raw.title || '',
        mode: (raw.transport_mode || 'ocean') as any,
        origin: raw.origin_location?.location_name || raw.origin || '',
        destination: raw.destination_location?.location_name || raw.destination || '',
        commodity: primaryCommodity,
        weight: String(totalWeight),
        volume: String(totalVolume),
      });
      console.log('[UnifiedComposer] Set initialFormValues:', { commodity: primaryCommodity });
      
      // Sync to form directly
      if (form) {
        form.reset({
            ...form.getValues(),
            accountId: raw.account_id || '',
            opportunityId: raw.opportunity_id || '',
            contactId: raw.contact_id || '',
            quoteTitle: raw.title || '',
            mode: (raw.transport_mode || 'ocean') as any,
            origin: raw.origin_location?.location_name || raw.origin || '',
            destination: raw.destination_location?.location_name || raw.destination || '',
            commodity: primaryCommodity,
            weight: String(totalWeight),
            volume: String(totalVolume),
        });
      }

      setInitialExtended({
        incoterms: raw.incoterms || '',
        pickupDate: raw.pickup_date ? new Date(raw.pickup_date).toISOString().split('T')[0] : '',
        deliveryDeadline: raw.delivery_deadline ? new Date(raw.delivery_deadline).toISOString().split('T')[0] : '',
        htsCode: cargoDetails?.hts_code || '',
        dangerousGoods: !!raw.dangerous_goods,
        vehicleType: raw.vehicle_type || 'van',
        containerCombos: containerCombos,
        attachments: docs,
      });

      // Load existing option if present
      // Determine which version to load: explicit prop OR current_version_id
      const targetVersionId = versionId || raw.current_version_id;
      const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      console.log('[UnifiedComposer] Target Version:', targetVersionId, 'Valid:', isValidUUID(targetVersionId));

      if (targetVersionId && isValidUUID(targetVersionId)) {
        logger.info('[UnifiedComposer] Loading version', { targetVersionId });
        // Fetch options
        const { data: optionRows, error: optError } = await scopedDb
          .from('quotation_version_options')
          .select('*')
          .eq('quotation_version_id', targetVersionId)
          .order('created_at', { ascending: false });

        if (optError) {
          logger.error('[UnifiedComposer] Failed to load options', optError);
          setLoadErrors(prev => [...prev, 'Failed to load options']);
          // We don't throw here to allow the rest of the form to show up
        } else if (optionRows && optionRows.length > 0) {

          logger.info(`[UnifiedComposer] Found ${optionRows.length} options`);
          const optionIds = optionRows.map((o: any) => o.id);

          // Fetch legs for these options
          const { data: legRows, error: legError } = await scopedDb
            .from('quotation_version_option_legs')
            .select('*')
            .in('quotation_version_option_id', optionIds)
            .order('sort_order');

          if (legError) {
            logger.error('[UnifiedComposer] Failed to load legs', legError);
            throw legError;
          }
          logger.info(`[UnifiedComposer] Found ${legRows?.length || 0} legs`);

          // Fetch charges for these options
          const { data: chargeRows, error: chargeError } = await scopedDb
            .from('quote_charges')
            .select(`
              *,
              category:category_id(name, code),
              basis:basis_id(name, code),
              currency:currency_id(code),
              side:charge_side_id(name, code)
            `)
            .in('quote_option_id', optionIds);
            
          if (chargeError) {
            logger.error('[UnifiedComposer] Failed to load charges', chargeError);
            throw chargeError;
          }
          logger.info(`[UnifiedComposer] Found ${chargeRows?.length || 0} charges`);

          // Helper to group charges into buy/sell pairs
          const groupCharges = (charges: any[]) => {
             const pairs: any[] = [];
             const pendingBuys: any[] = [];
             const pendingSells: any[] = [];
             
             charges.forEach(c => {
                 const sideCode = c.side?.code?.toLowerCase() || 'buy';
                 if (sideCode === 'buy') pendingBuys.push(c);
                 else pendingSells.push(c);
             });
             
             // Match sells to buys
             pendingSells.forEach(sell => {
                 const matchIndex = pendingBuys.findIndex(buy => 
                     buy.leg_id === sell.leg_id &&
                     buy.category_id === sell.category_id &&
                     buy.basis_id === sell.basis_id
                 );
                 
                 if (matchIndex >= 0) {
                     const buy = pendingBuys[matchIndex];
                     pendingBuys.splice(matchIndex, 1);
                     pairs.push({
                         id: buy.id, 
                         leg_id: buy.leg_id,
                         category_id: buy.category_id,
                         basis_id: buy.basis_id,
                         currency_id: buy.currency_id,
                         unit: buy.unit,
                         // Display fields
                         category: buy.category?.name || buy.category?.code || 'Charge',
                         name: buy.category?.name || buy.category?.code || 'Charge',
                         basis: buy.basis?.name || buy.basis?.code || 'Flat',
                         currency: buy.currency?.code || 'USD',
                         // Pair data
                         buy: {
                             quantity: buy.quantity,
                             rate: buy.rate,
                             amount: buy.amount,
                             dbChargeId: buy.id
                         },
                         sell: {
                             quantity: sell.quantity,
                             rate: sell.rate,
                             amount: sell.amount,
                             dbChargeId: sell.id
                         },
                         note: buy.note || sell.note
                     });
                 } else {
                     pairs.push({
                         id: sell.id,
                         leg_id: sell.leg_id,
                         category_id: sell.category_id,
                         basis_id: sell.basis_id,
                         currency_id: sell.currency_id,
                         unit: sell.unit,
                         category: sell.category?.name || sell.category?.code || 'Charge',
                         name: sell.category?.name || sell.category?.code || 'Charge',
                         basis: sell.basis?.name || sell.basis?.code || 'Flat',
                         currency: sell.currency?.code || 'USD',
                         sell: {
                             quantity: sell.quantity,
                             rate: sell.rate,
                             amount: sell.amount,
                             dbChargeId: sell.id
                         },
                         note: sell.note
                     });
                 }
             });
             
             pendingBuys.forEach(buy => {
                 pairs.push({
                     id: buy.id,
                     leg_id: buy.leg_id,
                     category_id: buy.category_id,
                     basis_id: buy.basis_id,
                     currency_id: buy.currency_id,
                     unit: buy.unit,
                     category: buy.category?.name || buy.category?.code || 'Charge',
                     name: buy.category?.name || buy.category?.code || 'Charge',
                     basis: buy.basis?.name || buy.basis?.code || 'Flat',
                     currency: buy.currency?.code || 'USD',
                     buy: {
                         quantity: buy.quantity,
                         rate: buy.rate,
                         amount: buy.amount,
                         dbChargeId: buy.id
                     },
                     note: buy.note
                 });
             });
             
             return pairs;
          };

          // Reconstruct RateOption objects
          const reconstructedOptions: RateOption[] = optionRows.map((opt: any) => {
            // Filter legs for this option
            const myLegs = (legRows || [])
              .filter((l: any) => l.quotation_version_option_id === opt.id)
              .map((l: any) => {
                // Get charges for this leg
                const legChargesRaw = (chargeRows || []).filter((c: any) => c.leg_id === l.id);
                const legCharges = groupCharges(legChargesRaw);

                return {
                    id: l.id,
                    mode: l.transport_mode || 'ocean',
                    leg_type: 'transport',
                    carrier: undefined,
                    carrier_id: l.carrier_id,
                    origin: l.origin_location || '',
                    destination: l.destination_location || '',
                    transit_time: l.transit_time_hours ? `${Math.ceil(l.transit_time_hours / 24)} days` : 'TBD',
                    departure_date: l.departure_date,
                    arrival_date: l.arrival_date,
                    sequence: l.sort_order,
                    origin_location_id: l.origin_location_id,
                    destination_location_id: l.destination_location_id,
                    charges: legCharges
                };
              });

            // Filter global charges (no leg_id)
            const globalChargesRaw = (chargeRows || []).filter((c: any) => c.quote_option_id === opt.id && !c.leg_id);
            const globalCharges = groupCharges(globalChargesRaw);

            return {
               id: opt.id,
               carrier: opt.option_name || 'Saved Option',
               name: opt.option_name || 'Saved Option',
               price: opt.total_amount,
               currency: opt.currency,
               transitTime: opt.transit_time_days ? `${opt.transit_time_days} days` : 'TBD',
               tier: 'custom',
               is_manual: true, // Treat loaded options as manual so they are editable
               source_attribution: 'Saved Quote',
               legs: myLegs,
               charges: globalCharges,
               // Other fields
               is_selected: opt.is_selected,
               total_amount: opt.total_amount,
               marginPercent: opt.margin_percentage,
             } as RateOption;
           });
 
           setManualOptions(reconstructedOptions);
           
           // Find selected option
           const selected = reconstructedOptions.find(o => (o as any).is_selected) || reconstructedOptions[0];
           if (selected) {
             setSelectedOption(selected);
             dispatch({ type: 'INITIALIZE', payload: { optionId: selected.id } });
             
             // Also update optionDrafts so the edit form works
             const draft: any = {
                 legs: selected.legs,
                 charges: [...(selected.charges || []), ...((selected.legs || []).flatMap((l: any) => l.charges || []))],
                 marginPercent: (selected as any).marginPercent || form.getValues('marginPercent') || 15
             };
             setOptionDrafts(prev => ({ ...prev, [selected.id]: draft }));
           }
           
           // Log success
           logAudit('reload_success', { quoteId, versionId: targetVersionId || 'current' });
        }
      }
    } catch (err: any) {
      logger.error('[UnifiedComposer] Failed to load quote:', err);
      logAudit('reload_failure', { error: err?.message || 'Unknown error', quoteId }, 'failure');
      toast({ title: 'Error', description: 'Failed to load existing quote data', variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  }, [quoteId, versionId, context, scopedDb, toast, dispatch, form]);

  useEffect(() => {
    if (!quoteId) return;
    loadExistingQuote();
  }, [loadExistingQuote, quoteId]);

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
        setIsCrmLoading(true);
        
        // Parallel fetch for performance
        const [accRes, conRes, oppRes] = await Promise.all([
            scopedDb.from('accounts').select('id, name').order('name'),
            scopedDb.from('contacts').select('id, first_name, last_name, account_id').order('first_name'),
            scopedDb.from('opportunities').select('id, name, account_id, contact_id').order('created_at', { ascending: false })
        ]);

        if (accRes.error || conRes.error || oppRes.error) {
            console.error('[UnifiedComposer] Failed to load CRM data', { accError: accRes.error, conError: conRes.error, oppError: oppRes.error });
        }

        setAccounts(accRes.data || []);
        setContacts(conRes.data || []);
        setOpportunities(oppRes.data || []);
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
      opportunityId: initialData.opportunityId || '',
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
          opportunityId: initialData.opportunityId || '',
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
  // Handle Composer Mode (Manual Only)
  // ---------------------------------------------------------------------------

  const handleComposerMode = useCallback(() => {
    const newOption: RateOption = {
        id: `manual-${Date.now()}`,
        carrier: '',
        name: '',
        price: 0,
        currency: 'USD',
        transitTime: 'TBD',
        tier: 'custom',
        is_manual: true,
        source_attribution: 'Manual Quote',
        legs: [],
        charges: [],
    };
    
    setManualOptions([newOption]);
    setVisibleRateIds([newOption.id]);
    setSelectedOption(newOption);
    setIsSmartMode(false);
    setDeletedOptionIds([]);
    
    // Initialize draft
    setOptionDrafts({
        [newOption.id]: {
            legs: [],
            charges: [],
            marginPercent: 15
        }
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Handle "Get Rates"
  // ---------------------------------------------------------------------------

  const handleGetRates = async (formValues: FormZoneValues, extendedData: ExtendedFormData, smart: boolean) => {
    setComplianceCheck(null);
    setLastFormData({ values: formValues, extended: extendedData });
    setIsSmartMode(smart);

    // Note: smart param is passed from FormZone but we might ignore it or use it if needed.
    // In rollback, we trust the FormZone to decide or we default to a standard behavior.
    // For now, we will pass it through to fetchRates.

    setSelectedOption(null);

    // Fire compliance in parallel (non-blocking)
    runComplianceCheck({ ...formValues, ...extendedData } as any);

    // DISABLE AUTO MARKET RATE FETCHING
    // Instead of fetching rates, we switch to Manual Composer Mode immediately.
    // This ensures only the "Manual Quotation" option is shown.
    handleComposerMode();

    /*
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
    */
  };

  // ---------------------------------------------------------------------------
  // Handle option selection
  // ---------------------------------------------------------------------------

  const handleSelectOption = (option: RateOption) => {
    setSelectedOption(option);
  };

  const handleRenameOption = (optionId: string, newName: string) => {
    setManualOptions(prev => prev.map(opt => {
        if (opt.id === optionId) {
            return { ...opt, carrier: newName, name: newName };
        }
        return opt;
    }));
    
    if (selectedOption?.id === optionId) {
        setSelectedOption(prev => prev ? { ...prev, carrier: newName, name: newName } : null);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle Attachment Sync
  // ---------------------------------------------------------------------------
  
  const handleSaveAttachments = async (quoteId: string, currentAttachments: any[]) => {
    try {
        // 1. Identify deleted attachments
        // IDs in loadedAttachments that are NOT in currentAttachments
        const currentIds = new Set(currentAttachments.filter(a => a.id).map(a => a.id));
        const toDelete = loadedAttachments.filter(a => !currentIds.has(a.id));
        
        if (toDelete.length > 0) {
            const deleteIds = toDelete.map(a => a.id);
            const { error: delError } = await scopedDb.from('quote_documents').delete().in('id', deleteIds);
            if (delError) {
                logger.error('Failed to delete attachments', delError);
                toast({ title: 'Warning', description: 'Failed to delete some removed attachments.', variant: 'destructive' });
            } else {
                // Also try to delete from storage if path exists
                // This is optional but good for cleanup
                // We'll skip complex storage cleanup for now to avoid accidental data loss
            }
        }

        // 2. Identify new attachments (File objects)
        const newFiles = currentAttachments.filter(a => a instanceof File);
        
        if (newFiles.length > 0) {
            for (const file of newFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${quoteId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                // Upload to storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('commodity-docs')
                    .upload(fileName, file);

                if (uploadError) {
                    logger.error('Failed to upload file', { fileName, error: uploadError });
                    toast({ title: 'Upload Failed', description: `Failed to upload ${file.name}`, variant: 'destructive' });
                    continue;
                }

                // Insert into quote_documents
                const { error: insertError } = await scopedDb.from('quote_documents').insert({
                    quote_id: quoteId,
                    file_name: file.name,
                    file_path: uploadData.path,
                    file_type: file.type,
                    file_size: file.size,
                    uploaded_by: user?.id
                });

                if (insertError) {
                     logger.error('Failed to link file to quote', insertError);
                     toast({ title: 'Link Failed', description: `Failed to link ${file.name} to quote`, variant: 'destructive' });
                }
            }
        }
        
        // 3. Update loadedAttachments for next save
        // We re-fetch to be sure, or just update local state if we trust it
        // Re-fetching is safer
        const { data: refreshedDocs } = await scopedDb.from('quote_documents').select('*').eq('quote_id', quoteId);
        if (refreshedDocs) {
            setLoadedAttachments(refreshedDocs);
            // Also update form if needed, but form state might have File objects replaced by DB records?
            // Actually, we should probably replace File objects in form with the new records so subsequent saves don't re-upload
            // But modifying form state here might be tricky.
            // For now, let's just update loadedAttachments.
            // Ideally we should reload the attachments into the form.
        }

    } catch (error) {
        logger.error('Error syncing attachments', error);
        toast({ title: 'Attachment Error', description: 'Failed to sync attachments.', variant: 'destructive' });
    }
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
      const currentVersionId = storeState.versionId || versionId;
      const currentQuoteId = storeState.quoteId || quoteId;

      // Build RPC payload
      const formData = lastFormData || (initialFormValues && initialExtended ? {
          values: initialFormValues as FormZoneValues,
          extended: initialExtended as ExtendedFormData
      } : null);

      if (!formData) {
          toast({ title: 'Error', description: 'Form data not ready. Please try again.', variant: 'destructive' });
          setSaving(false);
          return;
      }
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
        job_title: formData?.values.guestJobTitle || null,
        department: formData?.values.guestDepartment || null,
        billing_address: formData?.values.billingAddress || null,
        shipping_address: formData?.values.shippingAddress || null,
        tax_id: formData?.values.taxId || null,
        customer_po: formData?.values.customerPo || null,
        vendor_ref: formData?.values.vendorRef || null,
        project_code: formData?.values.projectCode || null,
      } : null;

      // Duplicate detection
      if (isStandalone && formData?.values.guestCompany) {
        try {
          const { data: dups } = await scopedDb
            .from('quotes')
            .select('id, quote_number, billing_address')
            .eq('tenant_id', tenantId)
            .neq('id', currentQuoteId || '00000000-0000-0000-0000-000000000000')
            .ilike('billing_address->>company', `%${formData.values.guestCompany}%`)
            .limit(1);

          if (dups && dups.length > 0) {
             const companyName = (dups[0] as any).billing_address?.company || 'Unknown';
             if (!window.confirm(`Potential duplicate found: Quote ${dups[0].quote_number} for company "${companyName}". Continue saving?`)) {
               setSaving(false);
               return;
             }
          }
        } catch (err) {
          logger.warn('Duplicate check failed', err);
        }
      }

      const quotePayload: any = {
        id: isUUID(currentQuoteId) ? currentQuoteId : undefined,
        quote_number: finalQuoteNumber,
        title: (formData?.values.quoteTitle || storeState.quoteData?.title) || `Quote - ${formData?.values.origin || ''} to ${formData?.values.destination || ''}`,
        transport_mode: formData?.values.mode || 'ocean',
        origin: formData?.values.origin || '',
        destination: formData?.values.destination || '',
        status: 'draft',
        tenant_id: tenantId,
        // franchise_id: storeState.franchiseId || context?.franchiseId, // Removed for rollback
        notes: [notes, formData?.values.internalNotes, formData?.values.specialInstructions, formData?.values.notesText].filter(Boolean).join('\n\n') || null,
        terms_conditions: formData?.values.termsConditions || null,
        billing_address: billingForStandalone,
        pickup_date: formData?.extended.pickupDate || null,
        delivery_deadline: formData?.extended.deliveryDeadline || null,
        incoterms: formData?.extended.incoterms || null,
        vehicle_type: formData?.extended.vehicleType || null,
        account_id: isStandalone ? null : (formData?.values.accountId || storeState.quoteData?.account_id || null),
        contact_id: isStandalone ? null : (formData?.values.contactId || storeState.quoteData?.contact_id || null),
        opportunity_id: isStandalone ? null : (effectiveOpportunityId || null),
        cargo_details: {
            commodity: formData?.values.commodity,
            total_weight_kg: Number(formData?.values.weight) || 0,
            total_volume_cbm: Number(formData?.values.volume) || 0,
            dangerous_goods: formData?.values.dangerousGoods || formData?.extended.dangerousGoods || false,
            hts_code: formData?.values.htsCode || formData?.extended.htsCode || null,
        }
      };

      const options: any[] = [];

      if (!selectedOption) {
        toast({ title: 'Select an option', description: 'Pick a quote option before saving.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Map container combos
      const combos = formData?.values.containerCombos || formData?.extended.containerCombos || [];
      const cargoConfigs = combos.map((c: any) => ({
          container_type: c.type,
          container_size: c.size,
          quantity: c.qty,
          temperature_control: null // Add if needed
      }));

      console.log('[UnifiedComposer] quotePayload cargo_details:', JSON.stringify(quotePayload.cargo_details, null, 2));

      const findBasisCodeById = (id: string) =>
        repoData.chargeBases?.find((b: any) => b.id === id)?.code || '';
      const findCurrencyCodeById = (id: string) =>
        repoData.currencies?.find((c: any) => c.id === id)?.code || 'USD';

      const buildChargePayload = (c: any, side: 'buy' | 'sell') => {
        const quantity = side === 'buy' ? c.buy?.quantity : c.sell?.quantity;
        const unitPrice = side === 'buy' ? c.buy?.rate : c.sell?.rate;
        const amount = side === 'buy' ? c.buy?.amount : c.sell?.amount;
        return {
          charge_code: c.category_id || null,
          basis_id: c.basis_id || null,
          currency_id: c.currency_id || null,
          basis: findBasisCodeById(c.basis_id) || '',
          currency: findCurrencyCodeById(c.currency_id) || 'USD',
          unit: c.unit || '',
          quantity: quantity ?? 1,
          unit_price: unitPrice ?? 0,
          amount: amount ?? 0,
          side,
          note: c.note || null,
        };
      };

      const selectedId = selectedOption.id;

      for (const opt of displayResults) {
        const isSelected = opt.id === selectedId;
        const draft = optionDrafts[opt.id];
        const draftLegs = (draft?.legs || opt.legs || []) as any[];
        const draftCharges = (draft?.charges || (isSelected ? charges : [])) as any[];
        const mp = draft?.marginPercent ?? marginPercent;

        const chargesByLegId: Record<string, any[]> = {};
        const combinedCharges: any[] = [];
        for (const c of draftCharges) {
          const legKey = c.legId || 'combined';
          if (legKey === 'combined' || !c.legId) {
            combinedCharges.push(c);
          } else {
            if (!chargesByLegId[legKey]) chargesByLegId[legKey] = [];
            chargesByLegId[legKey].push(c);
          }
        }

        const legsPayload = draftLegs.map((leg: any) => ({
          id: isUUID(leg.id) ? leg.id : undefined,
          transport_mode: leg.mode || formData?.values.mode || 'ocean',
          leg_type: leg.leg_type || 'transport',
          origin_location_name: leg.origin || '',
          destination_location_name: leg.destination || '',
          origin_location_id: isUUID(leg.origin_location_id) ? leg.origin_location_id : (isUUID(leg.originId) ? leg.originId : null),
          destination_location_id: isUUID(leg.destination_location_id) ? leg.destination_location_id : (isUUID(leg.destinationId) ? leg.destinationId : null),
          carrier_id: leg.carrier_id || null,
          carrier_name: leg.carrier || leg.carrier_name || null,
          charges: (chargesByLegId[leg.id] || []).flatMap((c: any) => [
            buildChargePayload(c, 'buy'),
            buildChargePayload(c, 'sell'),
          ]),
        }));

        const combinedPayload = combinedCharges.flatMap((c: any) => [
          buildChargePayload(c, 'buy'),
          buildChargePayload(c, 'sell'),
        ]);

        options.push({
          id: isUUID(opt.id) ? opt.id : undefined,
          option_name: opt.carrier || opt.name || 'Option',
          is_selected: isSelected,
          source: 'unified_composer',
          source_attribution: opt.source_attribution || 'manual',
          ai_generated: opt.ai_generated || false,
          margin_percent: mp,
          currency: opt.currency || 'USD',
          transit_time_days: getTransitDays(opt.transitTime),
          legs: legsPayload,
          combined_charges: combinedPayload,
          rank_score: opt.rank_score,
          rank_details: opt.rank_details,
          is_recommended: opt.is_recommended,
          recommendation_reason: opt.recommendation_reason,
        });
      }

      const { data: savedId, error: rpcError } = await scopedDb.rpc('save_quote_atomic', {
        p_payload: {
          quote: quotePayload,
          items: [], // Use cargo_details for now, items can be added later if granular items are needed
          cargo_configurations: cargoConfigs,
          options: options
        }
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

      // Sync attachments
      if (savedId && formData?.extended?.attachments) {
        await handleSaveAttachments(savedId, formData.extended.attachments);
      }

      // Fetch the final quote number for the toast
      let displayQuoteNumber = finalQuoteNumber;
      if (savedId) {
        try {
          // If we didn't have a manual number or just want to be sure
          const { data: q } = await scopedDb.from('quotes').select('quote_number').eq('id', savedId).single();
          if (q?.quote_number) {
            displayQuoteNumber = q.quote_number;
          }
        } catch (e) {
          console.warn('Failed to fetch quote number for toast', e);
        }
      }

      // Log success
      try {
        logger.info('Quotation saved successfully', {
            component: 'UnifiedQuoteComposer',
            action: 'save_quote',
            quoteId: savedId,
            quoteNumber: displayQuoteNumber,
            userId: user?.id,
            timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Failed to log success', e);
      }

      if (displayQuoteNumber) {
        showQuotationSuccessToast(displayQuoteNumber);
      } else {
        toast({ title: 'Success', description: 'Quote saved successfully' });
      }
    } catch (err: any) {
      logger.error('[UnifiedComposer] Save failed:', err);
      
      let errorMessage = err.message || 'An error occurred while saving the quotation.';
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      } else if (err.code === 'PGRST116') {
        errorMessage = 'Database error: The quotation could not be verified after saving.';
      }

      toast({ 
        title: 'Save Failed', 
        description: errorMessage, 
        variant: 'destructive',
        duration: 5000 
      });
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rerun rates
  // ---------------------------------------------------------------------------

  const handleRerunRates = () => {
    if (lastFormData) {
      // Pass false for smart mode as rollback default
      handleGetRates(lastFormData.values, lastFormData.extended, false);
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
      setSaving(true);
      const formData = lastFormData;
      const quotePayload: any = {
        id: isUUID(storeState.quoteId) ? storeState.quoteId : (isUUID(quoteId) ? quoteId : undefined),
        title: (formData.values.quoteTitle || storeState.quoteData?.title) || `Draft - ${formData.values.origin || ''} to ${formData.values.destination || ''}`,
        transport_mode: formData.values.mode || 'ocean',
        origin: formData.values.origin || '',
        destination: formData.values.destination || '',
        status: 'draft',
        tenant_id: tenantId,
        // franchise_id: storeState.franchiseId || context?.franchiseId, // Removed
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
           // Simplified success handling (removed versionId fetching for auto-save)
           dispatch({ type: 'INITIALIZE', payload: { quoteId: savedId } });
           
           // Update URL without reloading if it's a new quote
           if (!quoteId) {
             setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev);
                newParams.set('id', savedId);
                return newParams;
             });
           }
      }

      toast({ title: 'Draft saved', description: 'Your quote draft has been saved.' });
    } catch (err: any) {
      logger.error('[UnifiedComposer] Draft save failed:', err);
      toast({ title: 'Save Failed', description: err.message || 'Could not save draft', variant: 'destructive' });
    } finally {
      setSaving(false);
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

  const handleFormChange = useCallback((values: any) => {
    setLastFormData((prev) => ({
      values: values as FormZoneValues,
      extended: (prev?.extended || (initialExtended as ExtendedFormData) || ({} as ExtendedFormData)),
    }));
  }, [initialExtended]);

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
        
        {loadErrors.length > 0 && (
          <div className="rounded-md bg-destructive/15 p-4 text-destructive">
            <div className="flex items-center gap-2 font-medium">
               <AlertCircle className="h-4 w-4" />
               <span>Some data failed to load:</span>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {loadErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
           {versionHistory.length > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="h-4 w-4" />
                  Version History
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[1.25rem]">{versionHistory.length}</Badge>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Version History</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {versionHistory.map((ver) => (
                    <div key={ver.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Version {ver.version_number}</span>
                        <span className="text-xs text-muted-foreground">{new Date(ver.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {ver.change_summary || 'No summary available'}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {ver.created_by_email || 'System'}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                            setSearchParams(prev => {
                                const newParams = new URLSearchParams(prev);
                                newParams.set('versionId', ver.id);
                                return newParams;
                            });
                        }}>
                          Load <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
           )}
        </div>

        {/* Form Zone */}
        <FormZone
            onGetRates={handleGetRates}
            onSaveDraft={handleSaveDraft}
            loading={rateFetching.loading}
            crmLoading={isCrmLoading}
            initialValues={initialFormValues}
            initialExtended={initialExtended}
            accounts={accounts}
            contacts={contacts}
            opportunities={opportunities}
            onChange={handleFormChange}
        />

        <Separator />

        {/* Results Zone */}
        <ResultsZone
            results={(!lastFormData && displayResults.length === 0 && !rateFetching.loading && !isSmartMode) ? null : displayResults}
            loading={rateFetching.loading}
            smartMode={isSmartMode}
            marketAnalysis={rateFetching.marketAnalysis}
            confidenceScore={rateFetching.confidenceScore}
            anomalies={rateFetching.anomalies}
            complianceCheck={complianceCheck}
            onSelect={handleSelectOption}
            selectedOptionId={selectedOption?.id}
            onRerunRates={lastFormData ? handleRerunRates : undefined}
            onAddManualOption={handleAddManualOption}
            onRemoveOption={handleRemoveOption}
            availableOptions={availableOptions}
            onAddRateOption={handleAddRateOption}
            onRenameOption={handleRenameOption}
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
              draft={optionDrafts[selectedOption.id]}
              onDraftChange={(draft) =>
                setOptionDrafts((prev) => ({ ...prev, [selectedOption.id]: draft }))
              }
              onRenameOption={handleRenameOption}
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

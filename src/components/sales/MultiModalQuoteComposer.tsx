import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, Save, Loader2, Plus, Trash2, Edit2, Copy, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { calculateChargeableWeight, TransportMode } from '@/utils/freightCalculations';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuotationWorkflowStepper } from './composer/QuotationWorkflowStepper';
import { QuoteDetailsStep } from './composer/QuoteDetailsStep';
import { LegsConfigurationStep } from './composer/LegsConfigurationStep';
import { ChargesManagementStep } from './composer/ChargesManagementStep';
import { ReviewAndSaveStep } from './composer/ReviewAndSaveStep';
import { BasisConfigModal } from './composer/BasisConfigModal';
import { DeleteConfirmDialog } from './composer/DeleteConfirmDialog';
import { SaveProgress } from './composer/SaveProgress';
import { ErrorBoundary } from './composer/ErrorBoundary';
import { ValidationFeedback } from './composer/ValidationFeedback';
import { QuoteOptionsOverview } from './composer/QuoteOptionsOverview';
import { QuoteOptionService } from '@/services/QuoteOptionService';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';
import { LogisticsPlugin } from '@/plugins/logistics/LogisticsPlugin';
import { PricingService } from '@/services/pricing.service';
import { logger } from '@/lib/logger';
import { useDebug } from '@/hooks/useDebug';
import { formatContainerSize } from '@/lib/container-utils';

import { QuoteStoreProvider, useQuoteStore } from './composer/store/QuoteStore';
import { Leg } from './composer/store/types';

interface MultiModalQuoteComposerProps {
  quoteId: string;
  versionId: string;
  optionId?: string;
  lastSyncTimestamp?: number;
  tenantId?: string;
  initialState?: any;
  templateId?: string;
}

const STEPS = [
  { id: 1, title: 'Quote Details', description: 'Basic information' },
  { id: 2, title: 'Transport Legs', description: 'Configure routes' },
  { id: 3, title: 'Charges', description: 'Add costs' },
  { id: 4, title: 'Review & Save', description: 'Finalize quote' }
];

// Helper to safely render strings from potential DB objects
const getSafeString = (val: any, fallback: string = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
     // Try common properties
     return val.name || val.code || val.details || val.description || fallback;
  }
  return String(val);
};

export function MultiModalQuoteComposer(props: MultiModalQuoteComposerProps) {
  return (
    <QuoteStoreProvider initialState={props.initialState}>
      <MultiModalQuoteComposerContent {...props} />
    </QuoteStoreProvider>
  );
}

function MultiModalQuoteComposerContent({ quoteId, versionId, optionId: initialOptionId, lastSyncTimestamp, tenantId: propTenantId, templateId }: MultiModalQuoteComposerProps) {
  const { scopedDb, context } = useCRM();
  const debug = useDebug('Sales', 'QuoteComposer');
  const { toast } = useToast();
  const { invokeAiAdvisor } = useAiAdvisor();
  
  // Initialize Store
  const { state: storeState, dispatch } = useQuoteStore();
  
  // Initialize Services
  const pricingService = useMemo(() => new PricingService(scopedDb.client), [scopedDb.client]);
  const quoteOptionService = useMemo(() => new QuoteOptionService(scopedDb.client), [scopedDb.client]);
  
  const debounceTimers = useRef(new Map<string, NodeJS.Timeout>());

  // State Migration: currentStep is now managed by the store
  const currentStep = storeState.currentStep;
  const setCurrentStep = (step: number) => dispatch({ type: 'SET_STEP', payload: step });

  // Map store state to local variables for compatibility
  const { 
    tenantId, 
    optionId, 
    isSaving: saving, 
    isLoading: loading,
    quoteData,
    legs,
    charges: combinedCharges,
    validationErrors,
    validationWarnings,
    autoMargin,
    marginPercent,
    marketAnalysis,
    confidenceScore,
    anomalies,
    options,
    viewMode,
    deletedLegIds,
    deletedChargeIds,
    isGeneratingSmart
  } = storeState;

  const [connectionStatus, setConnectionStatus] = useState<'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'>('SUBSCRIBED');
  const [pricingRequestsCount, setPricingRequestsCount] = useState(0);
  const isPricingCalculating = pricingRequestsCount > 0;
  
  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'leg' | 'charge' | 'combinedCharge';
    target?: any;
  }>({ open: false, type: 'leg' });

  // Save progress tracking
  const [saveProgress, setSaveProgress] = useState<{
    show: boolean;
    steps: { label: string; completed: boolean }[];
  }>({
    show: false,
    steps: []
  });
  
  const uniqueByCarrierName = (arr: any[], preferredTenantId?: string | null) => {
    try {
      const map: Record<string, any> = {};
      for (const item of arr || []) {
        const key = String((item as any)?.carrier_name || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map[key];
        if (!existing) {
          map[key] = item;
        } else {
          const existingTenant = (existing as any)?.tenant_id ?? null;
          const currentTenant = (item as any)?.tenant_id ?? null;
          if (preferredTenantId && existingTenant !== preferredTenantId && currentTenant === preferredTenantId) {
            map[key] = item;
          }
        }
      }
      return Object.values(map);
    } catch {
      return arr || [];
    }
  };

  // Access reference data from store
  const {
    serviceTypes,
    transportModes,
    chargeCategories,
    chargeBases,
    currencies,
    tradeDirections,
    containerTypes,
    containerSizes,
    carriers,
    chargeSides
  } = storeState.referenceData;

  // Option management state
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<any>(null);
  const [newOptionData, setNewOptionData] = useState({
    option_name: '',
    carrier_name: '',
    carrier_id: '',
    service_type: '',
    transit_time: '',
    valid_until: ''
  });

  useEffect(() => {
    loadInitialData();
  }, [quoteId, versionId, propTenantId]);

  // Real-time Pricing Updates Subscription
  useEffect(() => {
    const subscription = pricingService.subscribeToUpdates(() => {
      toast({
        title: "Pricing Updated",
        description: "Market rates or pricing configurations have been updated.",
      });
      // Cache is automatically cleared by the service.
      // Future improvement: Automatically re-calculate open quotes if auto-margin is enabled.
    }, (status) => {
        setConnectionStatus(status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
             toast({
                title: "Pricing Service Disconnected",
                description: "Attempting to reconnect...",
                variant: "destructive"
             });
        }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pricingService, toast]);

  useEffect(() => {
    if (lastSyncTimestamp && lastSyncTimestamp > 0) {
      debug.debug('[Composer] External sync triggered', lastSyncTimestamp);
      if (optionId && tenantId) {
        loadOptionData();
      } else {
        loadInitialData();
      }
      
      // Also refresh options list to show new AI generated options
      if (versionId && tenantId) {
        ensureOptionExists(tenantId);
      }
    }
  }, [lastSyncTimestamp]);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyboard = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentStep === 4 && !saving) {
          saveQuotation();
        }
      }
      // Cmd/Ctrl + → to go next
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        if (canProceed()) handleNext();
      }
      // Cmd/Ctrl + ← to go back
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentStep, saving]);

  useEffect(() => {
    if (optionId && tenantId) {
      loadOptionData();
    }
  }, [optionId, tenantId, carriers.length, transportModes.length, serviceTypes.length]);

  const loadInitialData = async () => {
    debug.debug('[Composer] Loading initial data...', { quoteId, versionId, optionId: initialOptionId });
    dispatch({ type: 'SET_LOADING', payload: true });
    
    const errors: string[] = [];
    
    try {
      // Step 1: Resolve tenant ID & Context
      debug.debug('[Composer] Step 1: Resolving tenant ID and Context');
      
      let resolvedTenantId: string | null = propTenantId || context?.tenantId || null;
      
      // Attempt 1: User Metadata
      if (!resolvedTenantId) {
        const { data: { user } } = await scopedDb.client.auth.getUser();
        resolvedTenantId = user?.user_metadata?.tenant_id ?? null;
      }

      // Attempt 2: Fetch from Quote (lightweight query)
      if (!resolvedTenantId && quoteId) {
          try {
             // Use bypass mode (true) to rely on RLS, but don't inject missing scope
             const { data, error } = await scopedDb
                .from('quotes', true)
                .select('tenant_id')
                .eq('id', quoteId)
                .maybeSingle();
             
             if (!error && data) {
                resolvedTenantId = data.tenant_id;
                debug.log('[Composer] Resolved tenant from quote lookup:', resolvedTenantId);
             }
          } catch (e) {
             debug.warn('[Composer] Failed to resolve tenant from quote lookup', e);
          }
      }

      // Attempt 3: Fetch from Version (lightweight query)
      if (!resolvedTenantId && versionId) {
          try {
             const { data, error } = await scopedDb
                .from('quotation_versions', true)
                .select('tenant_id')
                .eq('id', versionId)
                .maybeSingle();
             
             if (!error && data) {
                resolvedTenantId = data.tenant_id;
                debug.log('[Composer] Resolved tenant from version lookup:', resolvedTenantId);
             }
          } catch (e) {
             debug.warn('[Composer] Failed to resolve tenant from version lookup', e);
          }
      }

      if (!resolvedTenantId) {
        debug.error('[Composer] Failed to resolve tenant ID after all attempts');
        errors.push('Could not determine tenant context');
      } else {
        dispatch({ type: 'INITIALIZE', payload: { tenantId: resolvedTenantId } });
      }

      // Always fetch quote details if quoteId is present to populate context
      if (quoteId) {
        try {
          // Construct query - if we have a resolved tenant, enforce it to satisfy RLS policies
          let quoteQuery = scopedDb
            .from('quotes', true)
            .select('tenant_id, franchise_id, origin_location, destination_location, cargo_details, transport_mode, origin_code, destination_code')
            .eq('id', quoteId);
            
          if (resolvedTenantId) {
             quoteQuery = quoteQuery.eq('tenant_id', resolvedTenantId);
          }

          const { data: quoteRow, error: quoteError } = await quoteQuery.maybeSingle();
          
          if (quoteError) {
            debug.error('[Composer] Error fetching quote', { error: quoteError, component: 'MultiModalQuoteComposer' });
            errors.push(`Failed to load quote details: ${quoteError.message}`);
            toast({
              title: "Error Loading Quote",
              description: typeof quoteError.message === 'string' ? quoteError.message : JSON.stringify(quoteError.message || 'Unknown error'),
              variant: "destructive"
            });
          } else if (quoteRow) {
            // Fetch quote items to calculate total weight and volume
            let calculatedTotalWeight = 0;
            let calculatedTotalVolume = 0;
            let derivedCommodity = '';

            try {
              let itemsQuery = scopedDb
                .from('quote_items')
                .select('weight_kg, volume_cbm, quantity, product_name, description')
                .eq('quote_id', quoteId);

              // Removed tenant_id filter as quote_items table relies on quote_id relationship
              // and does not store tenant_id directly in the view/table in some cases.
              // if (resolvedTenantId) {
              //   itemsQuery = itemsQuery.eq('tenant_id', resolvedTenantId);
              // }

              const { data: items, error: itemsError } = await itemsQuery;

              if (itemsError) {
                 debug.error('[Composer] Error fetching quote items:', itemsError);
                 console.error('[Composer] Full quote items error:', itemsError);
                 toast({
                   title: "Warning",
                   description: `Could not load cargo items: ${itemsError.message || JSON.stringify(itemsError)}`,
                   variant: "destructive"
                 });
              }

              if (!itemsError && items) {
                items.forEach((item: any) => {
                  const qty = Number(item.quantity) || 1;
                  const weight = Number(item.weight_kg) || 0;
                  const volume = Number(item.volume_cbm) || 0;
                  
                  // Assuming weight_kg and volume_cbm are per-line-item totals or per-unit? 
                  // In logistics, usually specificed as total for the line. 
                  // If ambiguous, we sum the raw values.
                  calculatedTotalWeight += weight;
                  calculatedTotalVolume += volume;
                  
                  if (!derivedCommodity && (item.product_name || item.description)) {
                    derivedCommodity = item.product_name || item.description;
                  }
                });
                debug.log('[Composer] Calculated totals from items:', { weight: calculatedTotalWeight, volume: calculatedTotalVolume });
              }
            } catch (e) {
              debug.warn('[Composer] Failed to fetch items for totals', e);
            }

            // Use quote's tenant_id if we don't have one yet, or verify it matches
            if (!resolvedTenantId) {
              resolvedTenantId = (quoteRow as any)?.tenant_id ?? null;
              if (resolvedTenantId) {
                 debug.log('[Composer] Resolved tenant from full quote load:', resolvedTenantId);
                 dispatch({ type: 'INITIALIZE', payload: { tenantId: resolvedTenantId } });
              }
            }
            
            // Normalize quote data for consumption
            const raw = quoteRow as any;
            const cargoDetails = raw.cargo_details;
            
            // Check for [object Object] corruption or valid JSON
            let validCargoDetails = cargoDetails;
            if (typeof cargoDetails === 'string' && cargoDetails === '[object Object]') {
                validCargoDetails = null;
            }

            // Fallback to cargo_details if calculation yields zero (e.g. no items found)
            if (calculatedTotalWeight === 0 && validCargoDetails?.total_weight_kg) {
                calculatedTotalWeight = Number(validCargoDetails.total_weight_kg) || 0;
                debug.log('[Composer] Used fallback weight from cargo_details:', calculatedTotalWeight);
            }
            if (calculatedTotalVolume === 0 && validCargoDetails?.total_volume_cbm) {
                calculatedTotalVolume = Number(validCargoDetails.total_volume_cbm) || 0;
                debug.log('[Composer] Used fallback volume from cargo_details:', calculatedTotalVolume);
            }

            const normalizedQuote = {
                ...raw,
                origin: raw.origin_location?.name || raw.origin_code || '',
                destination: raw.destination_location?.name || raw.destination_code || '',
                commodity: getSafeString(validCargoDetails?.commodity) || derivedCommodity || '',
                mode: raw.transport_mode || 'ocean',
                total_weight: calculatedTotalWeight,
                total_volume: calculatedTotalVolume,
                franchiseId: (quoteRow as any)?.franchise_id // Include franchiseId in quoteData
            };

            dispatch({ type: 'UPDATE_QUOTE_DATA', payload: normalizedQuote });
          }
        } catch (error: any) {
          debug.error('[Composer] Exception fetching quote', { 
            error: error.message, 
            stack: error.stack, 
            component: 'MultiModalQuoteComposer' 
          });
          errors.push(`Exception loading quote: ${error.message}`);
        }
      }

      // Fallback 1: fetch from quotation version
      if (versionId) {
        try {
          const { data: versionRow, error: versionError } = await scopedDb
            .from('quotation_versions', true)
            .select('tenant_id, market_analysis, confidence_score, anomalies, aes_hts_id, aes_hts_codes(hts_code, description)')
            .eq('id', versionId)
            .maybeSingle();
          
          if (versionError) {
            logger.error('[Composer] Error fetching version', { error: versionError, component: 'MultiModalQuoteComposer' });
          } else if (versionRow) {
            if (!resolvedTenantId && (versionRow as any)?.tenant_id) {
                resolvedTenantId = (versionRow as any).tenant_id;
                dispatch({ type: 'INITIALIZE', payload: { tenantId: resolvedTenantId } });
            }
            
            dispatch({ 
              type: 'INITIALIZE', 
              payload: {
                marketAnalysis: (versionRow as any)?.market_analysis ?? null,
                confidenceScore: (versionRow as any)?.confidence_score ?? null,
                anomalies: (versionRow as any)?.anomalies ?? []
              } 
            });

            // Load HTS/AES data if present
            if ((versionRow as any).aes_hts_id) {
              dispatch({ 
                type: 'UPDATE_QUOTE_DATA', 
                payload: {
                  aes_hts_id: (versionRow as any).aes_hts_id,
                  hts_code: (versionRow as any).aes_hts_codes?.hts_code
                } 
              });
            }
          }
        } catch (error: any) {
          logger.error('[Composer] Exception fetching version', { 
            error: error.message, 
            stack: error.stack, 
            component: 'MultiModalQuoteComposer' 
          });
        }
      }

      // Fallback 3: fetch from existing option if provided
      if (!resolvedTenantId && initialOptionId) {
        try {
          const { data: optionRow, error: optionError } = await scopedDb
            .from('quotation_version_options', true)
            .select('tenant_id')
            .eq('id', initialOptionId)
            .maybeSingle();
          
          if (optionError) {
            logger.error('[Composer] Error fetching option', { error: optionError, component: 'MultiModalQuoteComposer' });
          } else if (optionRow) {
            resolvedTenantId = (optionRow as any)?.tenant_id ?? null;
            if (resolvedTenantId) dispatch({ type: 'INITIALIZE', payload: { tenantId: resolvedTenantId } });
            debug.debug('[Composer] Resolved tenant from option:', resolvedTenantId);
          }
        } catch (error: any) {
          logger.error('[Composer] Exception fetching option', { 
            error: error.message, 
            stack: error.stack, 
            component: 'MultiModalQuoteComposer' 
          });
        }
      }

      // Step 2: Load reference data with individual error handling
      debug.debug('[Composer] Step 2: Loading reference data');
      
      const loadReferenceData = async () => {
        const results = {
          serviceTypes: [] as any[],
          transportModes: [] as any[],
          chargeCategories: [] as any[],
          chargeBases: [] as any[],
          currencies: [] as any[],
          tradeDirections: [] as any[],
          containerTypes: [] as any[],
          containerSizes: [] as any[],
          carriers: [] as any[],
          chargeSides: [] as any[],
          serviceLegCategories: [] as any[]
        };

        const fetchRef = async (table: string, resultKey: keyof typeof results, errorMsg: string, selectQuery: string = '*') => {
          try {
            const { data, error } = await (scopedDb
              .from(table as any, true)
              .select(selectQuery)
              .eq('is_active', true) as any);
            
            if (error) {
              debug.error(`[Composer] Error loading ${table}:`, error);
              errors.push(errorMsg);
            } else {
              (results as any)[resultKey] = data || [];
              debug.debug(`[Composer] Loaded ${table}:`, (results as any)[resultKey].length);
            }
          } catch (error) {
            debug.error(`[Composer] Exception loading ${table}:`, error);
            errors.push(errorMsg);
          }
        };

        await Promise.all([
          fetchRef('service_types', 'serviceTypes', 'Failed to load service types', '*, transport_modes(*)'),
          fetchRef('transport_modes', 'transportModes', 'Failed to load transport modes'),
          fetchRef('charge_categories', 'chargeCategories', 'Failed to load charge categories'),
          fetchRef('charge_bases', 'chargeBases', 'Failed to load charge bases'),
          fetchRef('currencies', 'currencies', 'Failed to load currencies'),
          fetchRef('trade_directions', 'tradeDirections', 'Failed to load trade directions'),
          fetchRef('container_types', 'containerTypes', 'Failed to load container types'),
          fetchRef('container_sizes', 'containerSizes', 'Failed to load container sizes'),
          fetchRef('carriers', 'carriers', 'Failed to load carriers'),
          fetchRef('service_leg_categories', 'serviceLegCategories', 'Failed to load service leg categories', '*, id, name, code, description, sort_order')
        ]);

        return results;
      };

      const refData = await loadReferenceData();
      const uniqueCarriers = uniqueByCarrierName(refData.carriers, resolvedTenantId);

      dispatch({
        type: 'SET_REFERENCE_DATA',
        payload: {
          serviceTypes: refData.serviceTypes,
          transportModes: refData.transportModes,
          chargeCategories: refData.chargeCategories,
          chargeBases: refData.chargeBases,
          currencies: refData.currencies,
          tradeDirections: refData.tradeDirections,
          containerTypes: refData.containerTypes,
          containerSizes: refData.containerSizes,
          carriers: uniqueCarriers,
          chargeSides: refData.chargeSides,
          serviceLegCategories: refData.serviceLegCategories
        }
      });

      // Set default currency
      if (refData.currencies.length > 0) {
        dispatch({ type: 'UPDATE_QUOTE_DATA', payload: { currencyId: refData.currencies[0].id } });
        debug.debug('[Composer] Set default currency:', refData.currencies[0].id);
      }

      // Step 3: Ensure option exists if we have a versionId
      if (versionId && resolvedTenantId) {
        await ensureOptionExists(resolvedTenantId);
      }

      debug.debug('[Composer] Initial data load complete. Errors:', errors.length);
      
      if (errors.length > 0) {
        toast({ 
          title: 'Partial Load', 
          description: `Some data failed to load: ${errors.join(', ')}`, 
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      debug.error('[Composer] Critical error in loadInitialData:', error);
      toast({ title: 'Error', description: 'Failed to initialize composer: ' + error.message, variant: 'destructive' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Ensure an option exists for this version
  const ensureOptionExists = async (resolvedTenantId: string) => {
    debug.debug('[Composer] Ensuring option exists for version:', versionId);
    
    try {
      // Query for existing options with full details for overview
      const { data: existingOptions, error: queryError } = await scopedDb
        .from('quotation_version_options', true)
        .select(`
          *,
          legs:quotation_version_option_legs(
            *,
            charges:quote_charges(*)
          )
        `)
        .eq('quotation_version_id', versionId)
        .order('created_at', { ascending: false });

      if (queryError) {
        debug.error('[Composer] Error querying options:', queryError);
        return;
      }

      if (existingOptions && existingOptions.length > 0) {
        dispatch({ type: 'SET_OPTIONS', payload: existingOptions });
        
        // If initialOptionId is provided, use it.
        // Otherwise, if current optionId exists in list, keep it.
        // Otherwise default to first.
        let targetId = existingOptions[0].id;
        
        if (initialOptionId && existingOptions.some((o: any) => o.id === initialOptionId)) {
          targetId = initialOptionId;
          dispatch({ type: 'SET_VIEW_MODE', payload: 'composer' });
        } else if (optionId && existingOptions.some((o: any) => o.id === optionId)) {
          targetId = optionId;
          // If we have data, default to overview unless explicitly editing?
          // Let's default to overview for now to show off the new UI
          dispatch({ type: 'SET_VIEW_MODE', payload: 'overview' });
        } else {
          dispatch({ type: 'SET_VIEW_MODE', payload: 'overview' });
        }
        
        debug.debug('[Composer] Found existing options:', { count: existingOptions.length, selected: targetId });
        dispatch({ type: 'INITIALIZE', payload: { optionId: targetId } });
        
        // Update URL to include optionId to prevent duplicates on reload
        const url = new URL(window.location.href);
        if (!url.searchParams.has('optionId') || url.searchParams.get('optionId') !== targetId) {
          url.searchParams.set('optionId', targetId);
          window.history.replaceState({}, '', url.toString());
        }
        return;
      }

      // Create new option only if none exists
      debug.debug('[Composer] Creating new option for version');
      const { data: newOption, error: insertError } = await scopedDb
        .from('quotation_version_options')
        .insert({
          quotation_version_id: versionId,
          tenant_id: resolvedTenantId,
          source: 'composer',
          source_attribution: 'manual',
          ai_generated: false
        })
        .select()
        .maybeSingle();

      if (insertError) {
        debug.error('[Composer] Error creating option:', insertError);
        
        // Check if option was created by another process
        const { data: retry } = await scopedDb
          .from('quotation_version_options', true)
          .select('id')
          .eq('quotation_version_id', versionId)
          .limit(1)
          .maybeSingle();

        if (retry?.id) {
          debug.debug('[Composer] Option found on retry:', retry.id);
          dispatch({ type: 'INITIALIZE', payload: { optionId: retry.id } });
          dispatch({ type: 'SET_OPTIONS', payload: [retry] });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'composer' });
          
          // Update URL
          const url = new URL(window.location.href);
          url.searchParams.set('optionId', retry.id);
          window.history.replaceState({}, '', url.toString());
        }
        return;
      }

      if (newOption?.id) {
        debug.debug('[Composer] Created new option:', newOption.id);
        dispatch({ type: 'INITIALIZE', payload: { optionId: newOption.id } });
        dispatch({ type: 'SET_OPTIONS', payload: [newOption] });
        dispatch({ type: 'SET_VIEW_MODE', payload: 'composer' });
        
        // Update URL with new optionId
        const url = new URL(window.location.href);
        url.searchParams.set('optionId', newOption.id);
        window.history.replaceState({}, '', url.toString());
        debug.debug('[Composer] Updated URL with new optionId');
      }
    } catch (error) {
      debug.error('[Composer] Unexpected error in ensureOptionExists:', error);
    }
  };

  // Helper to ensure tenantId exists at save time
  const ensureTenantForSave = async (): Promise<string | null> => {
    if (tenantId) return tenantId;
    try {
      const { data: { user } } = await scopedDb.client.auth.getUser();
      let resolved: string | null = user?.user_metadata?.tenant_id ?? null;
      if (!resolved && quoteId) {
        const { data: q } = await scopedDb
          .from('quotes')
          .select('tenant_id')
          .eq('id', quoteId)
          .maybeSingle();
        resolved = (q as any)?.tenant_id ?? null;
      }
      if (!resolved && versionId) {
        const { data: v } = await scopedDb
          .from('quotation_versions')
          .select('tenant_id')
          .eq('id', versionId)
          .maybeSingle();
        resolved = (v as any)?.tenant_id ?? null;
      }
      if (!resolved && optionId) {
        const { data: o } = await scopedDb
          .from('quotation_version_options')
          .select('tenant_id')
          .eq('id', optionId)
          .maybeSingle();
        resolved = (o as any)?.tenant_id ?? null;
      }
      if (resolved) dispatch({ type: 'INITIALIZE', payload: { tenantId: resolved } });
      return resolved;
    } catch {
      return null;
    }
  };

  const loadOptionData = async () => {
    if (!optionId || !tenantId) return;

    debug.debug('[Composer] Loading option data for:', { optionId, tenantId });
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Parallel fetch of legs, global charges, and option details
      const [legResult, chargeResult, optionResult] = await Promise.all([
        scopedDb
          .from('quotation_version_option_legs', true)
          .select(`
            *,
            quote_charges(
              *,
              charge_sides(code),
              charge_categories(name, code),
              charge_bases(name, code),
              currencies(code, symbol)
            )
          `)
          .eq('quotation_version_option_id', optionId)
          .order('sort_order', { ascending: true }),
        
        scopedDb
          .from('quote_charges', true)
          .select(`
            *,
            charge_sides(code),
            charge_categories(name, code),
            charge_bases(name, code),
            currencies(code, symbol)
          `)
          .eq('quote_option_id', optionId)
          .is('leg_id', null),

        scopedDb
          .from('quotation_version_options', true)
          .select('*')
          .eq('id', optionId)
          .single()
      ]);

      const { data: legData, error: legError } = legResult;
      const { data: chargeData, error: chargeError } = chargeResult;
      const { data: optionData, error: optionError } = optionResult;

      if (legError) throw legError;
      if (chargeError) throw chargeError;
      // optionError might occur if option deleted, but less likely here. Ignore if just missing (handled by if check)

      debug.debug(`[Composer] Loaded legs: ${legData?.length}, Global charges: ${chargeData?.length}`);

      // Always update quoteData with option specifics to ensure UI reflects current option
      if (optionData) {
        dispatch({ type: 'UPDATE_QUOTE_DATA', payload: {
          carrier_name: getSafeString(optionData.carrier_name),
          service_type: getSafeString(optionData.service_type),
          transit_time: getSafeString(optionData.transit_time),
          validUntil: optionData.valid_until ? new Date(optionData.valid_until).toISOString().split('T')[0] : quoteData.validUntil,
          currencyId: optionData.quote_currency_id || quoteData.currencyId,
          option_name: getSafeString(optionData.option_name),
          ai_generated: optionData.ai_generated || false
        }});
      }

      // Process global charges
      if (chargeData) {
        const globalChargesMap = new Map();
        
        chargeData.forEach((charge: any) => {
          const key = `${charge.category_id}-${charge.basis_id}-${charge.note || ''}`;
          if (!globalChargesMap.has(key)) {
            globalChargesMap.set(key, {
              id: charge.id,
              category_id: charge.category_id,
              basis_id: charge.basis_id,
              unit: charge.unit,
              currency_id: charge.currency_id,
              note: charge.note,
              buy: { quantity: 0, rate: 0 },
              sell: { quantity: 0, rate: 0 }
            });
          }
          
          const chargeObj = globalChargesMap.get(key);
          const side = charge.charge_sides?.code;
          
          if (side === 'buy' || side === 'cost') {
            chargeObj.buy = {
              dbChargeId: charge.id,
              quantity: charge.quantity,
              rate: charge.rate,
              amount: charge.amount
            };
          } else if (side === 'sell' || side === 'revenue') {
            chargeObj.sell = {
              dbChargeId: charge.id,
              quantity: charge.quantity,
              rate: charge.rate,
              amount: charge.amount
            };
          }
        });
        
        dispatch({ type: 'SET_CHARGES', payload: Array.from(globalChargesMap.values()) });
      } else {
        dispatch({ type: 'SET_CHARGES', payload: [] });
      }

      if (legData && legData.length > 0) {
        const legsWithCharges = legData.map((leg: any) => {
          const chargesMap = new Map();

          // Group charges by their base properties (category, basis, etc.)
          leg.quote_charges?.forEach((charge: any) => {
            const key = `${charge.category_id}-${charge.basis_id}-${charge.note || ''}`;
            if (!chargesMap.has(key)) {
              chargesMap.set(key, {
                id: charge.id,
                category_id: charge.category_id,
                basis_id: charge.basis_id,
                unit: charge.unit,
                currency_id: charge.currency_id,
                note: charge.note,
                buy: { quantity: 0, rate: 0 },
                sell: { quantity: 0, rate: 0 }
              });
            }

            const chargeObj = chargesMap.get(key);
            const side = charge.charge_sides?.code;
            if (side === 'buy') {
              chargeObj.buy = { 
                dbChargeId: charge.id, 
                quantity: charge.quantity || 0, 
                rate: charge.rate || 0, 
                amount: charge.amount || 0 
              };
            } else if (side === 'sell') {
              chargeObj.sell = { 
                dbChargeId: charge.id, 
                quantity: charge.quantity || 0, 
                rate: charge.rate || 0, 
                amount: charge.amount || 0 
              };
            }
          });

          // Resolve references
          const carrierId = leg.carrier_id || leg.provider_id;
          const carrierName = carrierId 
             ? carriers.find(c => c.id === carrierId)?.carrier_name 
             : (leg.carrier_name || (leg.leg_type === 'transport' ? optionData?.carrier_name : undefined));
             
          const modeName = leg.mode_id 
             ? (transportModes.find(m => m.id === leg.mode_id)?.name || serviceTypes.find(s => s.transport_modes?.id === leg.mode_id)?.transport_modes?.code || 'ocean')
             : (leg.mode || 'ocean');

          return {
            id: leg.id,
            mode: getSafeString(modeName),
            serviceTypeId: leg.service_type_id || '',
            carrierId: carrierId || undefined,
            carrierName: getSafeString(carrierName),
            origin: getSafeString(leg.origin_location),
            destination: getSafeString(leg.destination_location),
            // Normalize legType to ensure it's either 'transport' or 'service'
            legType: leg.leg_type === 'service' ? 'service' : 'transport',
            serviceOnlyCategory: getSafeString(leg.service_only_category),
            charges: Array.from(chargesMap.values())
          };
        });

        dispatch({ type: 'SET_LEGS', payload: legsWithCharges });
      } else {
        dispatch({ type: 'SET_LEGS', payload: [] });
      }
    } catch (error: any) {
      debug.error('[Composer] Error loading option data:', error);
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const addLeg = (modeId: string) => {
    // Resolve the selected transport mode so we can use its code for lookups and labels
    const selectedMode = transportModes.find((tm) => tm.id === modeId);
    const modeCode = selectedMode?.code || modeId;
    const lowerModeCode = modeCode.toLowerCase();
    
    // Find matching service types by looking at their transport_modes relationship
    const matchingServiceTypes = serviceTypes.filter((st) => {
      if (!st.is_active) return false;
      const transportMode = (st as any).transport_modes;
      return transportMode && transportMode.code?.toLowerCase() === lowerModeCode;
    });
    
    const defaultServiceType = matchingServiceTypes[0];

    const newLeg: Leg = {
      id: `leg-${Date.now()}`,
      mode: modeCode,
      serviceTypeId: defaultServiceType?.id || '',
      origin: '',
      destination: '',
      charges: [],
      legType: 'transport',
    };
    dispatch({ type: 'ADD_LEG', payload: newLeg });
    
    // Show toast if service type was auto-selected
    if (defaultServiceType) {
      toast({
        title: 'Service Type Auto-Selected',
        description: `${defaultServiceType.name} has been automatically selected for ${selectedMode?.name || modeCode} transport.`,
      });
    }
  };

  const updateLeg = (legId: string, updates: Partial<Leg>) => {
    // If mode changed, recalculate chargeable weight for weight-based charges
    let finalUpdates = { ...updates };
    
    if (updates.mode) {
      const leg = legs.find(l => l.id === legId);
      if (leg && updates.mode !== leg.mode) {
        const weight = Number(quoteData.total_weight) || 0;
        const volume = Number(quoteData.total_volume) || 0;
        const newChargeableWeight = calculateChargeableWeight(weight, volume, updates.mode as TransportMode);
        const quantity = newChargeableWeight > 0 ? newChargeableWeight : 1;
        
        const updatedCharges = leg.charges.map(charge => {
          // Check if charge is weight-based
          const basis = chargeBases.find(b => b.id === charge.basis_id);
          const code = basis?.code?.toLowerCase() || '';
          const isWeightBased = !charge.basis_id || ['kg', 'lb', 'cbm', 'wm', 'chg_wt', 'ton', 'w/m'].some(c => code.includes(c));
          
          if (isWeightBased) {
            return {
              ...charge,
              buy: { ...charge.buy, quantity },
              sell: { ...charge.sell, quantity }
            };
          }
          return charge;
        });
        
        finalUpdates.charges = updatedCharges;
      }
    }
    
    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: finalUpdates } });
  };

  const confirmRemoveLeg = (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    const hasCharges = leg && leg.charges.length > 0;
    
    if (hasCharges) {
      setDeleteDialog({
        open: true,
        type: 'leg',
        target: legId
      });
    } else {
      removeLeg(legId);
    }
  };

  const removeLeg = (legId: string) => {
    const startTime = performance.now();
    debug.info('Removing leg', { legId });
    
    dispatch({ type: 'REMOVE_LEG', payload: legId });
    setDeleteDialog({ open: false, type: 'leg' });
    
    const duration = performance.now() - startTime;
    debug.log(`Leg removed: ${legId}`, { duration: `${duration.toFixed(2)}ms` });
  };

  const addCharge = (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (leg) {
        // Calculate chargeable weight based on leg mode and quote details
        const weight = Number(quoteData.total_weight) || 0;
        const volume = Number(quoteData.total_volume) || 0;
        const chargeableWeight = calculateChargeableWeight(weight, volume, leg.mode as TransportMode);
        
        // Default quantity to chargeable weight if available, otherwise 1
        const defaultQuantity = chargeableWeight > 0 ? chargeableWeight : 1;

        const newCharge = {
          id: `charge-${Date.now()}`,
          category_id: '',
          basis_id: '',
          unit: '',
          currency_id: currencies[0]?.id || '',
          buy: { quantity: defaultQuantity, rate: 0, dbChargeId: null },
          sell: { quantity: defaultQuantity, rate: 0, dbChargeId: null },
          note: ''
        };

        const updatedCharges = [...leg.charges, newCharge];
        dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: updatedCharges } } });
    }
  };

  const updateCharge = (legId: string, chargeIdx: number, field: string, value: any) => {
    // 1. Sync Update
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    const charges = [...leg.charges];
    const charge = { ...charges[chargeIdx] };

    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      charge[parent] = { ...(charge[parent] || {}), [child]: value };
    } else {
      charge[field] = value;
    }
    charges[chargeIdx] = charge;
    
    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges } } });

    // 2. Async Pricing Calculation (Debounced)
    if (autoMargin && marginPercent > 0 && field.startsWith('buy.')) {
        // Retrieve current rate from state (optimistic) or use value if it's the field being updated
        const currentLeg = legs.find(l => l.id === legId);
        const currentCharge = currentLeg?.charges[chargeIdx];
        const buyRate = field === 'buy.rate' ? Number(value) : (currentCharge?.buy?.rate || 0);
        
        const timerKey = `leg-${legId}-charge-${chargeIdx}`;

        if (debounceTimers.current.has(timerKey)) {
            clearTimeout(debounceTimers.current.get(timerKey));
        }

        const timer = setTimeout(() => {
            setPricingRequestsCount(prev => prev + 1);
            pricingService.calculateFinancials(buyRate, marginPercent, true)
            .then(result => {
                const latestLeg = legs.find(l => l.id === legId);
                if (latestLeg) {
                    const newCharges = [...latestLeg.charges];
                    if (newCharges[chargeIdx]) {
                    newCharges[chargeIdx] = {
                        ...newCharges[chargeIdx],
                        sell: {
                        ...newCharges[chargeIdx].sell,
                        quantity: newCharges[chargeIdx].buy?.quantity || 1,
                        rate: result.sellPrice
                        }
                    };
                    }
                    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: newCharges } } });
                }
            })
            .catch(err => logger.error('Pricing calculation failed', { error: err }))
            .finally(() => {
                setPricingRequestsCount(prev => Math.max(0, prev - 1));
                debounceTimers.current.delete(timerKey);
            });
        }, 300);

        debounceTimers.current.set(timerKey, timer);
    }
  };

  const confirmRemoveCharge = (legId: string, chargeIdx: number) => {
    setDeleteDialog({
      open: true,
      type: 'charge',
      target: { legId, chargeIdx }
    });
  };

  const removeCharge = (legId: string, chargeIdx: number) => {
    const startTime = performance.now();
    debug.info('Removing charge', { legId, chargeIdx });
    
    dispatch({ type: 'REMOVE_LEG_CHARGE', payload: { legId, chargeIdx } });
    
    setDeleteDialog({ open: false, type: 'charge' });
    
    const duration = performance.now() - startTime;
    debug.log(`Charge removed from leg ${legId}`, { duration: `${duration.toFixed(2)}ms` });
  };

  // Combined charges handlers
  const addCombinedCharge = () => {
    const newCharge = {
      id: `combined-${Date.now()}`,
      category_id: '',
      basis_id: '',
      unit: '',
      currency_id: currencies[0]?.id || '',
      buy: { quantity: 1, rate: 0, dbChargeId: null },
      sell: { quantity: 1, rate: 0, dbChargeId: null },
      note: ''
    };
    dispatch({ type: 'ADD_COMBINED_CHARGE', payload: newCharge });
  };

  const updateCombinedCharge = (chargeIdx: number, field: string, value: any) => {
    // 1. Sync Update
    const charge = { ...combinedCharges[chargeIdx] };
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      charge[parent] = { ...(charge[parent] || {}), [child]: value };
    } else {
      charge[field] = value;
    }
    dispatch({ type: 'UPDATE_COMBINED_CHARGE', payload: { index: chargeIdx, charge } });

    // 2. Async Pricing Calculation (Debounced)
    if (autoMargin && marginPercent > 0 && field.startsWith('buy.')) {
        const buyRate = field === 'buy.rate' ? Number(value) : (combinedCharges[chargeIdx]?.buy?.rate || 0);
        const timerKey = `combined-${chargeIdx}`;

        if (debounceTimers.current.has(timerKey)) {
            clearTimeout(debounceTimers.current.get(timerKey));
        }
        
        const timer = setTimeout(() => {
            setPricingRequestsCount(prev => prev + 1);
            pricingService.calculateFinancials(buyRate, marginPercent, true)
            .then(result => {
                if (combinedCharges[chargeIdx]) {
                    const updatedCharge = { ...combinedCharges[chargeIdx] };
                    updatedCharge.sell = {
                        ...updatedCharge.sell,
                        quantity: updatedCharge.buy?.quantity || 1,
                        rate: result.sellPrice
                    };
                    dispatch({ type: 'UPDATE_COMBINED_CHARGE', payload: { index: chargeIdx, charge: updatedCharge } });
                }
            })
            .catch(err => debug.error('Combined charge pricing failed', { error: err }))
            .finally(() => {
                setPricingRequestsCount(prev => Math.max(0, prev - 1));
                debounceTimers.current.delete(timerKey);
            });
        }, 300);

        debounceTimers.current.set(timerKey, timer);
    }
  };

  const confirmRemoveCombinedCharge = (chargeIdx: number) => {
    setDeleteDialog({
      open: true,
      type: 'combinedCharge',
      target: chargeIdx
    });
  };

  const removeCombinedCharge = (chargeIdx: number) => {
    const startTime = performance.now();
    debug.info('Removing combined charge', { chargeIdx });
    
    dispatch({ type: 'REMOVE_COMBINED_CHARGE', payload: chargeIdx });
    setDeleteDialog({ open: false, type: 'combinedCharge' });
    
    const duration = performance.now() - startTime;
    debug.log(`Combined charge removed: ${chargeIdx}`, { duration: `${duration.toFixed(2)}ms` });
  };

  const refreshOptionsList = async () => {
    if (!versionId) return;
    const { data: existingOptions, error: queryError } = await scopedDb
      .from('quotation_version_options', true)
      .select(`
        *,
        legs:quotation_version_option_legs(
          *,
          charges:quote_charges(*)
        )
      `)
      .eq('quotation_version_id', versionId)
      .order('created_at', { ascending: false });

    if (!queryError && existingOptions) {
      dispatch({ type: 'SET_OPTIONS', payload: existingOptions });
    }
  };

  const handleGenerateSmartOptions = async () => {
    if (!quoteData || !tenantId) {
      toast({ title: "Error", description: "Missing quote details or tenant context.", variant: "destructive" });
      return;
    }

    dispatch({ type: 'SET_GENERATING_SMART', payload: true });
    try {
      const payload = {
        origin: quoteData.origin,
        destination: quoteData.destination,
        commodity: quoteData.commodity,
        mode: quoteData.mode || quoteData.transport_mode || 'ocean'
      };

      toast({ title: "Generating Options", description: "AI is analyzing market rates..." });
      
      const aiResponse = await invokeAiAdvisor({
        action: 'generate_smart_quotes',
        payload
      });
      
      if (aiResponse.error) {
        throw new Error(aiResponse.error.message || 'AI Advisor failed');
      }

      if (!aiResponse.data?.options) {
        throw new Error('No options returned from AI');
      }

      const results = aiResponse.data.options;
      const analysis = aiResponse.data.market_analysis;
      const confidence = aiResponse.data.confidence_score;
      const anomalies = aiResponse.data.anomalies;

      // Update market analysis state and persist to version
      if (analysis || confidence || anomalies) {
        dispatch({ 
            type: 'SET_ANALYSIS_DATA', 
            payload: { 
              marketAnalysis: analysis, 
              confidenceScore: confidence,
              anomalies: anomalies || []
            } 
        });
        
        // Persist analysis to the version header
        await scopedDb
          .from('quotation_versions')
          .update({ 
            market_analysis: analysis || marketAnalysis,
            confidence_score: confidence || confidenceScore,
            anomalies: anomalies || []
          })
          .eq('id', versionId);
      }

      // Get Rate Mapper
      const logisticsPlugin = PluginRegistry.getPlugin('plugin-logistics-core') as LogisticsPlugin;
      if (!logisticsPlugin) {
        throw new Error('Logistics plugin not initialized');
      }

      // Fetch Charge Sides for mapper
      const { data: chargeSides } = await scopedDb.from('charge_sides').select('*');

      const masterData = {
          currencies: currencies || [],
          categories: chargeCategories || [],
          bases: chargeBases || [],
          serviceTypes: serviceTypes || [],
          serviceModes: transportModes || [],
          carriers: carriers || [],
          sides: chargeSides || []
      };

      const rateMapper = logisticsPlugin.createRateMapper(masterData);

      // Process options using QuoteOptionService
      let processedCount = 0;
      for (const result of results) {
        try {
          await quoteOptionService.addOptionToVersion({
            tenantId,
            versionId,
            rate: result,
            rateMapper,
            source: 'ai_generated',
            context: {
              origin: payload.origin,
              destination: payload.destination,
            }
          });
          processedCount++;
        } catch (optErr) {
          debug.error('Failed to process smart option:', optErr);
          // Continue with other options
        }
      }

      if (processedCount === 0) {
        throw new Error('Failed to process any of the generated options');
      }

      // SYNC: Log to AI Request History
      try {
          await scopedDb.from('ai_quote_requests').insert({
              tenant_id: tenantId,
              request_payload: payload,
              response_payload: {
                  options: results,
                  market_analysis: analysis
              },
              status: 'converted'
          });
          debug.debug('[Composer] Logged smart quote generation to history');
      } catch (logErr) {
          debug.warn('[Composer] Failed to log smart quote history:', logErr);
      }

      toast({ title: "Success", description: `Generated ${results.length} smart options.` });
      await refreshOptionsList();
      
    } catch (error: any) {
      debug.error('Smart Quote Error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      dispatch({ type: 'SET_GENERATING_SMART', payload: false });
    }
  };

  const validateQuotation = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate legs
    if (legs.length === 0) {
      errors.push('At least one transport leg is required');
    }

    legs.forEach((leg, idx) => {
      if (!leg.mode) errors.push(`Leg ${idx + 1}: Mode is required`);
      if (!leg.origin) errors.push(`Leg ${idx + 1}: Origin is required`);
      if (!leg.destination) errors.push(`Leg ${idx + 1}: Destination is required`);
      
      // Validate Service Type / Category based on leg type
      if (leg.legType === 'service') {
        if (!leg.serviceOnlyCategory) {
          errors.push(`Leg ${idx + 1}: Service Category is required`);
        }
      } else {
        // Transport leg
        if (!leg.serviceTypeId) {
          errors.push(`Leg ${idx + 1}: Service Type is required`);
        }
      }
      
      // Air Mode specific validation
      if (leg.mode.toLowerCase() === 'air') {
        const weight = Number(quoteData.total_weight);
        if (!weight || isNaN(weight) || weight <= 0) {
            errors.push(`Leg ${idx + 1} (Air): Total Weight is required for Air freight`);
        }
      }

      if (leg.charges.length === 0) {
        warnings.push(`Leg ${idx + 1}: No charges added. Consider adding at least one charge.`);
      }
      
      leg.charges.forEach((charge, chargeIdx) => {
        if (!charge.category_id) {
          errors.push(`Leg ${idx + 1}, Charge ${chargeIdx + 1}: Category is required`);
        }
        if (!charge.currency_id) {
          errors.push(`Leg ${idx + 1}, Charge ${chargeIdx + 1}: Currency is required`);
        }
        
        // Warn about zero rates
        if (charge.sell?.rate === 0) {
          warnings.push(`Leg ${idx + 1}, Charge ${chargeIdx + 1}: Sell rate is zero`);
        }
      });
    });

    // Validate combined charges
    combinedCharges.forEach((charge, idx) => {
      if (!charge.category_id) {
        errors.push(`Combined Charge ${idx + 1}: Category is required`);
      }
      if (!charge.currency_id) {
        errors.push(`Combined Charge ${idx + 1}: Currency is required`);
      }
    });
    
    // Check if all legs have zero charges and no combined charges
    if (legs.every(leg => leg.charges.length === 0) && combinedCharges.length === 0) {
      errors.push('At least one leg must have charges, or add combined charges');
    }

    return { errors, warnings };
  };

  const saveQuotation = async () => {
    // Validate first
    const validation = validateQuotation();
    dispatch({ type: 'SET_VALIDATION', payload: validation });
    
    if (validation.errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please fix ${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''} before saving`,
        variant: 'destructive'
      });
      return;
    }

    dispatch({ type: 'SET_SAVING', payload: true });
    const startTime = performance.now();
    debug.info('Starting quotation save...', { 
      versionId, 
      optionId, 
      legsCount: legs.length,
      combinedChargesCount: combinedCharges.length 
    });
    
    // Initialize progress tracking
    const progressSteps = [
      { label: 'Validating data...', completed: false },
      { label: 'Creating quotation option...', completed: false },
      { label: 'Cleaning up deleted items...', completed: false },
      { label: 'Saving transport legs...', completed: false },
      { label: 'Saving charges...', completed: false },
      { label: 'Finalizing...', completed: false }
    ];
    
    setSaveProgress({ show: true, steps: progressSteps });
    
    const updateProgress = (stepIndex: number) => {
      progressSteps[stepIndex].completed = true;
      setSaveProgress({ show: true, steps: [...progressSteps] });
    };

    try {
      // Ensure tenant is resolved before proceeding
      const finalTenantId = await ensureTenantForSave();
      if (!finalTenantId) {
        toast({
          title: 'Save Failed',
          description: 'Tenant ID not found. Please ensure the quote belongs to a tenant or your user has a tenant assigned.',
          variant: 'destructive'
        });
        dispatch({ type: 'SET_SAVING', payload: false });
        setSaveProgress({ show: false, steps: [] });
        return;
      }

      updateProgress(0); // Validation complete

      // Ensure we have an option to save to
      debug.debug('[Composer] Ensuring option exists before save. Current optionId:', optionId);
      let currentOptionId = optionId;
      
      if (!currentOptionId) {
        // This should rarely happen now that we call ensureOptionExists in loadInitialData
        debug.debug('[Composer] No optionId - checking for existing options');
        const { data: existingOptions } = await scopedDb
          .from('quotation_version_options')
          .select('id')
          .eq('quotation_version_id', versionId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingOptions && existingOptions.length > 0) {
          currentOptionId = existingOptions[0].id;
          dispatch({ type: 'INITIALIZE', payload: { optionId: currentOptionId } });
          debug.debug('[Composer] Using existing option:', currentOptionId);
        } else {
          debug.debug('[Composer] Creating new option during save');
          const { data: newOption, error: optError } = await scopedDb
            .from('quotation_version_options')
            .insert({
              quotation_version_id: versionId,
              tenant_id: finalTenantId,
              source: 'composer',
              source_attribution: 'manual',
              ai_generated: false
            })
            .select()
            .maybeSingle();
          
          if (optError) {
            debug.error('[Composer] Error creating option:', optError);
            throw new Error(`Failed to create quotation option: ${optError.message}`);
          }
          
          if (newOption?.id) {
            currentOptionId = newOption.id;
            dispatch({ type: 'INITIALIZE', payload: { optionId: currentOptionId } });
            debug.debug('[Composer] Created option:', currentOptionId);
          }
        }
      } else {
        debug.debug('[Composer] Using existing optionId:', currentOptionId);
      }
      
      updateProgress(1); // Option created

      // Delete tracked charges first
      if (deletedChargeIds.length > 0) {
        const { error: deleteError } = await scopedDb
          .from('quote_charges')
          .delete()
          .in('id', deletedChargeIds);
        
        if (deleteError) {
          debug.error('Error deleting charges:', deleteError);
          throw new Error(`Failed to delete charges: ${deleteError.message}`);
        }
      }

      // Get charge side IDs
      const [buySideRes, sellSideRes] = await Promise.all([
        scopedDb.from('charge_sides', true).select('id').eq('code', 'buy').single(),
        scopedDb.from('charge_sides', true).select('id').eq('code', 'sell').single()
      ]);

      if (buySideRes.error || sellSideRes.error || !buySideRes.data || !sellSideRes.data) {
        throw new Error('Failed to fetch charge sides');
      }

      const buySideId = buySideRes.data.id;
      const sellSideId = sellSideRes.data.id;

      // Clean up orphaned legs and their charges
      const { data: existingLegs } = await scopedDb
        .from('quotation_version_option_legs')
        .select('id')
        .eq('quotation_version_option_id', currentOptionId);
      
      const stateLegIds = new Set(
        (legs || [])
          .filter(l => !String(l.id).startsWith('leg-'))
          .map(l => String(l.id))
      );
      
      const toDeleteLegIds = (existingLegs || [])
        .map((l: any) => String(l.id))
        .filter((id: string) => !stateLegIds.has(id));
      
      if (toDeleteLegIds.length > 0) {
        // Delete charges associated with removed legs
        const { error: chargeDeleteError } = await scopedDb
          .from('quote_charges')
          .delete()
          .in('leg_id', toDeleteLegIds)
          .eq('quote_option_id', currentOptionId);
        
        if (chargeDeleteError) {
          debug.error('Error deleting leg charges:', chargeDeleteError);
          throw new Error(`Failed to delete leg charges: ${chargeDeleteError.message}`);
        }
        
        // Delete the legs themselves
        const { error: legDeleteError } = await scopedDb
          .from('quotation_version_option_legs')
          .delete()
          .in('id', toDeleteLegIds);
        
        if (legDeleteError) {
          debug.error('Error deleting legs:', legDeleteError);
          throw new Error(`Failed to delete legs: ${legDeleteError.message}`);
        }
      }
      
      updateProgress(2); // Cleanup complete

      // Save legs and charges
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        let legId = leg.id;
        
        if (leg.id.startsWith('leg-')) {
          // New leg
          const { data: newLeg, error: legError } = await scopedDb
            .from('quotation_version_option_legs')
            .insert({
              quotation_version_option_id: currentOptionId,
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              leg_type: (leg.legType === 'service' ? 'service' : 'transport'),
              service_only_category: leg.serviceOnlyCategory || null,
              tenant_id: finalTenantId,
              franchise_id: context.franchiseId,
              sort_order: i,
              carrier_id: leg.carrierId || null,
              carrier_name: leg.carrierName || null
            })
            .select()
            .single();
          
          if (legError) throw legError;
          if (!newLeg) throw new Error('Failed to create leg');
          legId = (newLeg as any).id;
        } else {
          // Update existing leg
          const { error: updateError } = await scopedDb
            .from('quotation_version_option_legs')
            .update({
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              // Strict enforcement of leg_type constraint
              leg_type: (leg.legType === 'service' ? 'service' : 'transport'),
              service_only_category: leg.serviceOnlyCategory || null,
              sort_order: i,
              carrier_id: leg.carrierId || null,
              carrier_name: leg.carrierName || null
            })
            .eq('id', legId);
          
          if (updateError) throw updateError;
        }

        // Save charges with UPDATE/INSERT logic
        for (const charge of leg.charges) {
          const chargeData = {
            quote_option_id: currentOptionId,
            leg_id: legId,
            category_id: charge.category_id || null,
            basis_id: charge.basis_id || null,
            currency_id: charge.currency_id || null,
            unit: charge.unit || null,
            note: charge.note || null,
            tenant_id: finalTenantId,
            franchise_id: context.franchiseId
          };

          // Handle buy side
          if (charge.buy?.dbChargeId) {
            // Update existing
            const { error: updateError } = await scopedDb
              .from('quote_charges')
              .update({
                ...chargeData,
                quantity: charge.buy.quantity || 1,
                rate: charge.buy.rate || 0,
                amount: (charge.buy.quantity || 1) * (charge.buy.rate || 0)
              })
              .eq('id', charge.buy.dbChargeId);
            if (updateError) throw updateError;
          } else {
            // Insert new
            const { error: insertError } = await scopedDb
              .from('quote_charges')
              .insert({
                ...chargeData,
                charge_side_id: buySideId,
                quantity: charge.buy?.quantity || 1,
                rate: charge.buy?.rate || 0,
                amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0)
              });
            if (insertError) throw insertError;
          }

          // Handle sell side
          if (charge.sell?.dbChargeId) {
            // Update existing
            const { error: updateError } = await scopedDb
              .from('quote_charges')
              .update({
                ...chargeData,
                quantity: charge.sell.quantity || 1,
                rate: charge.sell.rate || 0,
                amount: (charge.sell.quantity || 1) * (charge.sell.rate || 0)
              })
              .eq('id', charge.sell.dbChargeId);
            if (updateError) throw updateError;
          } else {
            // Insert new
            const { error: insertError } = await scopedDb
              .from('quote_charges')
              .insert({
                ...chargeData,
                charge_side_id: sellSideId,
                quantity: charge.sell?.quantity || 1,
                rate: charge.sell?.rate || 0,
                amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0)
              });
            if (insertError) throw insertError;
          }
        }
      }
      
      updateProgress(3); // Legs saved

      // Update Quotation Version (Header)
      const { error: versionError } = await scopedDb
        .from('quotation_versions')
        .update({
          valid_until: quoteData.validUntil || null,
          total_weight: quoteData.total_weight ? Number(quoteData.total_weight) : null,
          total_volume: quoteData.total_volume ? Number(quoteData.total_volume) : null,
          incoterms: quoteData.incoterms || null,
          commodity: quoteData.commodity || null,
          notes: quoteData.notes || null,
          aes_hts_id: quoteData.aes_hts_id || null,
        })
        .eq('id', versionId);

      if (versionError) {
        debug.error('Error updating version:', versionError);
      }

      // SYNC: Update Parent Quote Header with Totals and Status
      // This ensures the "Form" view reflects the latest calculations from Composer
      if (quoteId) {
          const parentUpdatePayload: any = {
              total_weight: quoteData.total_weight ? Number(quoteData.total_weight) : null,
              total_volume: quoteData.total_volume ? Number(quoteData.total_volume) : null,
              incoterms: quoteData.incoterms || null,
              // If we have a valid until date, sync it
              valid_until: quoteData.validUntil || null,
          };

          // If we have a calculated total (Sell Price), update shipping_amount
          // We calculate this from the current state's legs and charges
          const currentTotalSell = legs.reduce((acc, leg) => {
              return acc + leg.charges.reduce((sum, c) => sum + ((c.sell?.quantity || 0) * (c.sell?.rate || 0)), 0);
          }, 0) + combinedCharges.reduce((acc, c) => acc + ((c.sell?.quantity || 0) * (c.sell?.rate || 0)), 0);

          if (currentTotalSell > 0) {
              parentUpdatePayload.shipping_amount = currentTotalSell;
          }

          const { error: parentError } = await scopedDb
              .from('quotes')
              .update(parentUpdatePayload)
              .eq('id', quoteId);

          if (parentError) {
              debug.warn('[Composer] Failed to sync parent quote header:', parentError);
          } else {
              debug.log('[Composer] Synced parent quote header with new totals');
          }
      }

      // Update Current Option Details
      if (currentOptionId) {
        // Recalculate Option Financials from Charges to ensure sync
        let newTotalBuy = 0;
        let newTotalSell = 0;

        // Sum from Legs
        legs.forEach(leg => {
            leg.charges.forEach((c: any) => {
                newTotalBuy += (c.buy?.quantity || 1) * (c.buy?.rate || 0);
                newTotalSell += (c.sell?.quantity || 1) * (c.sell?.rate || 0);
            });
        });

        // Sum from Combined Charges
        combinedCharges.forEach((c: any) => {
            newTotalBuy += (c.buy?.quantity || 1) * (c.buy?.rate || 0);
            newTotalSell += (c.sell?.quantity || 1) * (c.sell?.rate || 0);
        });

        const newMarginAmount = newTotalSell - newTotalBuy;
        const newMarginPercent = newTotalSell > 0 ? (newMarginAmount / newTotalSell) * 100 : 0;

        const { error: optionError } = await scopedDb
          .from('quotation_version_options')
          .update({
            carrier_id: quoteData.carrier_id || null,
            carrier_name: quoteData.carrier_name || null,
            service_type: quoteData.service_type || null,
            transit_time: quoteData.transit_time || null,
            valid_until: quoteData.validUntil || null,
            currency: quoteData.currencyId ? currencies.find(c => c.id === quoteData.currencyId)?.code : null,
            option_name: quoteData.option_name || null,
            total_buy: newTotalBuy,
            total_sell: newTotalSell,
            total_amount: newTotalSell,
            margin_amount: newMarginAmount,
            margin_percentage: newMarginPercent
          })
          .eq('id', currentOptionId);

        if (optionError) {
          debug.error('Error updating option:', optionError);
        }
      }

      // Save combined charges with UPDATE/INSERT logic
      for (const charge of combinedCharges || []) {
        const chargeData = {
          quote_option_id: currentOptionId,
          leg_id: null,
          category_id: charge.category_id || null,
          basis_id: charge.basis_id || null,
          currency_id: charge.currency_id || null,
          unit: charge.unit || null,
          note: charge.note || null,
          tenant_id: finalTenantId
        };

        // Handle buy side
        if (charge.buy?.dbChargeId) {
          const { error: updateError } = await scopedDb
            .from('quote_charges')
            .update({
              ...chargeData,
              quantity: charge.buy.quantity || 1,
              rate: charge.buy.rate || 0,
              amount: (charge.buy.quantity || 1) * (charge.buy.rate || 0)
            })
            .eq('id', charge.buy.dbChargeId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await scopedDb
            .from('quote_charges')
            .insert({
              ...chargeData,
              charge_side_id: buySideId,
              quantity: charge.buy?.quantity || 1,
              rate: charge.buy?.rate || 0,
              amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0)
            });
          if (insertError) throw insertError;
        }

        // Handle sell side
        if (charge.sell?.dbChargeId) {
          const { error: updateError } = await scopedDb
            .from('quote_charges')
            .update({
              ...chargeData,
              quantity: charge.sell.quantity || 1,
              rate: charge.sell.rate || 0,
              amount: (charge.sell.quantity || 1) * (charge.sell.rate || 0)
            })
            .eq('id', charge.sell.dbChargeId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await scopedDb
            .from('quote_charges')
            .insert({
              ...chargeData,
              charge_side_id: sellSideId,
              quantity: charge.sell?.quantity || 1,
              rate: charge.sell?.rate || 0,
              amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0)
            });
          if (insertError) throw insertError;
        }
      }
      
      updateProgress(4); // Charges saved

      // Calculate and save totals to option
      try {
        const calculateLegTotal = (leg: any, side: 'buy' | 'sell') => {
          return leg.charges.reduce((acc: number, charge: any) => {
            const qty = charge[side]?.quantity || 0;
            const rate = charge[side]?.rate || 0;
            return acc + (qty * rate);
          }, 0);
        };

        const calculateCombinedTotal = (side: 'buy' | 'sell') => {
          return combinedCharges.reduce((acc: number, charge: any) => {
            const qty = charge[side]?.quantity || 0;
            const rate = charge[side]?.rate || 0;
            return acc + (qty * rate);
          }, 0);
        };

        const totalBuy = legs.reduce((acc: number, leg: any) => acc + calculateLegTotal(leg, 'buy'), 0) + calculateCombinedTotal('buy');
        const totalSell = legs.reduce((acc: number, leg: any) => acc + calculateLegTotal(leg, 'sell'), 0) + calculateCombinedTotal('sell');
        const marginAmount = totalSell - totalBuy;

        debug.info('Updating option totals', { totalBuy, totalSell, marginAmount });

        const { error: optionUpdateError } = await scopedDb
            .from('quotation_version_options')
            .update({
                buy_subtotal: totalBuy,
                sell_subtotal: totalSell,
                margin_amount: marginAmount,
                total_amount: totalSell,
                quote_currency_id: quoteData.currencyId || null
            })
            .eq('id', currentOptionId);
            
        if (optionUpdateError) {
           debug.error('Failed to update option totals', optionUpdateError);
           // Don't fail the whole save, but log it
        }
      } catch (calcError) {
        debug.error('Error calculating totals', calcError);
      }

      const duration = performance.now() - startTime;
      debug.log('Quotation saved successfully', { 
        versionId, 
        optionId: currentOptionId,
        duration: `${duration.toFixed(2)}ms`
      });

      toast({ 
        title: 'Success', 
        description: 'Quotation saved successfully',
        duration: 3000
      });
      
      // Reload data to sync with database
      if (currentOptionId) {
        await loadOptionData();
      }
      
      // Clear deletion queue after successful save
      dispatch({ type: 'CLEAR_DELETIONS' });
      
      // Clear validation feedback
      dispatch({ type: 'SET_VALIDATION', payload: { errors: [], warnings: [] } });
      
      updateProgress(5); // Complete
      
      // Keep success display for a moment
      setTimeout(() => {
        setSaveProgress({ show: false, steps: [] });
      }, 1000);
      
    } catch (error: any) {
      const duration = performance.now() - startTime;
      debug.error('Save quotation error:', { error, duration: `${duration.toFixed(2)}ms` });
      const errorMessage = error.message || 'Failed to save quotation';
      
      // Hide progress on error
      setSaveProgress({ show: false, steps: [] });
      
      toast({ 
        title: 'Save Failed', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  };

  const handleAddOption = () => {
    setEditingOption(null);
    setNewOptionData({
      option_name: `Option ${options.length + 1}`,
      carrier_name: '',
      carrier_id: '',
      service_type: '',
      transit_time: '',
      valid_until: ''
    });
    setOptionDialogOpen(true);
  };

  const handleEditOption = (opt: any) => {
    if (!opt.id) {
      debug.warn('Cannot edit option without ID:', opt);
      toast({ title: 'Error', description: 'Cannot edit option: Missing ID', variant: 'destructive' });
      return;
    }
    setEditingOption(opt);
    setNewOptionData({
      option_name: opt.option_name || '',
      carrier_name: opt.carrier_name || '',
      carrier_id: opt.carrier_rate_id || '',
      service_type: opt.service_type || '',
      transit_time: opt.transit_time || '',
      valid_until: opt.valid_until ? new Date(opt.valid_until).toISOString().split('T')[0] : ''
    });
    setOptionDialogOpen(true);
  };

  const handleDeleteOption = async (id: string) => {
    if (options.length <= 1) {
      toast({ title: 'Cannot delete', description: 'At least one option must exist.', variant: 'destructive' });
      return;
    }
    
    if (!confirm('Are you sure you want to delete this option? This action cannot be undone.')) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    const startTime = performance.now();
    debug.info('Deleting quote option', { optionId: id });

    try {
      const { error } = await scopedDb
        .from('quotation_version_options')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const newOptions = options.filter(o => o.id !== id);
      dispatch({ type: 'SET_OPTIONS', payload: newOptions });
      if (optionId === id) {
        dispatch({ type: 'INITIALIZE', payload: { optionId: newOptions[0].id } });
      }
      
      const duration = performance.now() - startTime;
      debug.log('Option deleted successfully', { 
        optionId: id,
        remainingOptions: newOptions.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      toast({ title: 'Success', description: 'Option deleted successfully.' });
    } catch (error: any) {
      const duration = performance.now() - startTime;
      debug.error('Error deleting option:', { error, duration: `${duration.toFixed(2)}ms` });
      toast({ title: 'Error', description: 'Failed to delete option: ' + error.message, variant: 'destructive' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSaveOptionDetails = async () => {
    if (!newOptionData.option_name) {
      toast({ title: 'Error', description: 'Option Name is required', variant: 'destructive' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    const startTime = performance.now();
    debug.info('Saving option details', { 
      isNew: !editingOption, 
      optionId: editingOption?.id,
      name: newOptionData.option_name 
    });

    try {
      const tenant = await ensureTenantForSave();
      if (!tenant) throw new Error('Tenant context missing');

      const payload = {
        option_name: newOptionData.option_name,
        carrier_name: newOptionData.carrier_name,
        carrier_id: newOptionData.carrier_id || null,
        service_type: newOptionData.service_type,
        transit_time: newOptionData.transit_time,
        valid_until: newOptionData.valid_until || null,
        tenant_id: tenant,
        quotation_version_id: versionId
      };

      if (editingOption) {
        // Update existing
        const { data, error } = await scopedDb
          .from('quotation_version_options')
          .update(payload)
          .eq('id', editingOption.id)
          .select()
          .single();

        if (error) throw error;
        
        dispatch({ type: 'SET_OPTIONS', payload: options.map(o => o.id === editingOption.id ? data : o) });
        if (optionId === editingOption.id) {
          // Refresh quote data if we edited the current option
          dispatch({ 
            type: 'UPDATE_QUOTE_DATA', 
            payload: {
             carrier_name: data.carrier_name,
             service_type: data.service_type,
             transit_time: data.transit_time,
             validUntil: data.valid_until ? new Date(data.valid_until).toISOString().split('T')[0] : quoteData.validUntil,
             option_name: data.option_name
            }
          });
        }
      } else {
        // Create new
        const { data, error } = await scopedDb
          .from('quotation_version_options')
          .insert({
            ...payload,
            source: 'composer',
            source_attribution: 'manual',
            ai_generated: false
          })
          .select()
          .single();

        if (error) throw error;

        dispatch({ type: 'SET_OPTIONS', payload: [...options, data] });
        dispatch({ type: 'INITIALIZE', payload: { optionId: data.id } });
      }

      const duration = performance.now() - startTime;
      debug.log('Option details saved successfully', { 
        optionId: editingOption?.id || 'new',
        operation: editingOption ? 'update' : 'create',
        duration: `${duration.toFixed(2)}ms`
      });

      setOptionDialogOpen(false);
      toast({ title: 'Success', description: `Option ${editingOption ? 'updated' : 'created'} successfully.` });
    } catch (error: any) {
      const duration = performance.now() - startTime;
      debug.error('Error saving option:', { error, duration: `${duration.toFixed(2)}ms` });
      toast({ title: 'Error', description: 'Failed to save option: ' + error.message, variant: 'destructive' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleNext = () => {
    // Clear validation on navigation
    dispatch({ type: 'SET_VALIDATION', payload: { errors: [], warnings: [] } });
    
    if (currentStep < 4) {
      dispatch({ type: 'SET_STEP', payload: currentStep + 1 });
    }
  };

  const handleBack = () => {
    // Clear validation on navigation
    dispatch({ type: 'SET_VALIDATION', payload: { errors: [], warnings: [] } });
    
    if (currentStep > 1) {
      dispatch({ type: 'SET_STEP', payload: currentStep - 1 });
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Quote details - require at least currency
        return quoteData.currencyId;
      case 2:
        // Legs - require at least one valid leg
        // And if Air mode, require weight
        return legs.length > 0 && legs.every(leg => {
          const basic = leg.mode && leg.origin && leg.destination;
          if (!basic) return false;
          if (leg.mode.toLowerCase() === 'air') {
             const weight = Number(quoteData.total_weight);
             return weight > 0;
          }
          return true;
        });
      case 3:
        // Charges - at least one leg should have charges OR there should be combined charges
        return legs.some(leg => leg.charges.length > 0) || combinedCharges.length > 0;
      default:
        return true;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
             <Skeleton className="h-10 w-48" />
             <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="grid grid-cols-4 gap-4">
             <Skeleton className="h-32 w-full" />
             <Skeleton className="h-32 w-full" />
             <Skeleton className="h-32 w-full" />
             <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (viewMode === 'overview') {
          return (
            <QuoteOptionsOverview 
              onGenerateSmartOptions={handleGenerateSmartOptions}
            />
          );
        }

  return (
    <div className="space-y-6">
      {/* Validation Feedback */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <ValidationFeedback errors={validationErrors} warnings={validationWarnings} />
      )}
      
      {/* Option Selector */}
      <Card className="border-muted bg-muted/10">
        <CardContent className="p-3 flex items-center gap-3 overflow-x-auto justify-between">
          <div className="flex items-center gap-3 overflow-x-auto">
            <Button 
                variant="outline" 
                size="sm" 
                className="h-9 px-2 gap-2"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'overview' })}
            >
                <ArrowLeft className="h-3 w-3" />
                Back to Overview
            </Button>
            <div className="h-6 w-px bg-border mx-1" />
            
             {connectionStatus === 'SUBSCRIBED' ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1 h-6 px-2" title="Real-time Pricing Active">
                    <Wifi className="h-3 w-3" />
                </Badge>
             ) : (
                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 gap-1 h-6 px-2" title="Pricing Service Disconnected">
                    <WifiOff className="h-3 w-3" />
                </Badge>
             )}

            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Quote Options:</span>
            <div className="flex gap-2">
              {options.map(opt => (
                <div key={opt.id} className="relative group">
                  <Button
                    variant={optionId === opt.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => dispatch({ type: 'INITIALIZE', payload: { optionId: opt.id } })}
                    className={`h-9 text-xs pr-8 ${optionId === opt.id ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20' : 'text-muted-foreground border border-transparent'}`}
                    title={`Service: ${opt.service_type || 'N/A'}\nTransit: ${opt.transit_time || 'N/A'}\nValid Until: ${opt.valid_until ? new Date(opt.valid_until).toLocaleDateString() : 'N/A'}`}
                  >
                    <div className="flex flex-col items-start text-left leading-tight">
                      <span className="font-semibold">{opt.option_name || 'Option'}</span>
                      <span className="text-[10px] opacity-80">{opt.carrier_name || 'No Carrier'}</span>
                    </div>
                  </Button>
                  <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 ${optionId === opt.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 hover:text-blue-500"
                      onClick={(e) => { e.stopPropagation(); handleEditOption(opt); }}
                    >
                      <Edit2 className="h-2 w-2" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteOption(opt.id); }}
                      data-testid={`delete-option-btn-${opt.id}`}
                    >
                      <Trash2 className="h-2 w-2" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-2" onClick={handleAddOption}>
            <Plus className="h-3 w-3" />
            Add Option
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <QuotationWorkflowStepper
            currentStep={currentStep}
            onStepClick={setCurrentStep}
            steps={STEPS}
          />
        </CardContent>
      </Card>

      {currentStep === 1 && (
        <QuoteDetailsStep />
      )}

      {currentStep === 2 && (
        <LegsConfigurationStep />
      )}

      {currentStep === 3 && (
        <ChargesManagementStep />
      )}

      {currentStep === 4 && (
        <ReviewAndSaveStep templateId={templateId} />
      )}

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep < 4 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={saveQuotation} disabled={saving} size="lg">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Quotation
                <span className="ml-2 text-xs opacity-70">(Ctrl+S)</span>
              </Button>
            )}
          </div>
          
          {/* Keyboard shortcuts hint */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            💡 Tip: Use <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-muted rounded text-xs">←</kbd> / <kbd className="px-2 py-1 bg-muted rounded text-xs">→</kbd> to navigate, <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-muted rounded text-xs">S</kbd> to save
          </p>
        </CardContent>
      </Card>

  // Basis Configuration Modal
      <BasisConfigModal />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        onConfirm={() => {
          if (deleteDialog.type === 'leg' && deleteDialog.target) {
            removeLeg(deleteDialog.target);
          } else if (deleteDialog.type === 'charge' && deleteDialog.target) {
            removeCharge(deleteDialog.target.legId, deleteDialog.target.chargeIdx);
          } else if (deleteDialog.type === 'combinedCharge' && typeof deleteDialog.target === 'number') {
            removeCombinedCharge(deleteDialog.target);
          }
        }}
        title={
          deleteDialog.type === 'leg' 
            ? 'Delete Transport Leg' 
            : deleteDialog.type === 'charge'
            ? 'Delete Charge'
            : 'Delete Combined Charge'
        }
        description={
          deleteDialog.type === 'leg'
            ? 'This will remove the leg and all its associated charges. This action cannot be undone.'
          : 'This will remove this charge. This action cannot be undone.'
        }
      />
      
      {/* Save Progress Overlay */}
      <SaveProgress show={saveProgress.show} steps={saveProgress.steps} />
      {/* Option Edit Dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingOption ? 'Edit Option' : 'New Option'}</DialogTitle>
            <DialogDescription>
              Configure the basic details for this quotation option.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="option_name" className="text-right">
                Name
              </Label>
              <Input
                id="option_name"
                value={newOptionData.option_name}
                onChange={(e) => setNewOptionData({ ...newOptionData, option_name: e.target.value })}
                className="col-span-3"
                placeholder="e.g. Option 1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="carrier" className="text-right">
                Carrier
              </Label>
              <div className="col-span-3">
                <Select
                  value={newOptionData.carrier_id || carriers.find(c => c.carrier_name === newOptionData.carrier_name)?.id || ''}
                  onValueChange={(val) => {
                    const selected = carriers.find(c => c.id === val);
                    if (selected) {
                      setNewOptionData({ 
                        ...newOptionData, 
                        carrier_name: selected.carrier_name,
                        carrier_id: selected.id 
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={newOptionData.carrier_name || "Select carrier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.filter(c => {
                       const st = (newOptionData.service_type || '').toLowerCase();
                       if (!st) return true;
                       if (st.includes('ocean') || st.includes('sea')) return c.carrier_type === 'ocean';
                       if (st.includes('air')) return c.carrier_type === 'air_cargo';
                       if (st.includes('road') || st.includes('truck')) return c.carrier_type === 'trucking';
                       if (st.includes('rail')) return c.carrier_type === 'rail';
                       return true;
                    }).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.carrier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="service" className="text-right">
                Service
              </Label>
              <Input
                id="service"
                value={newOptionData.service_type}
                onChange={(e) => setNewOptionData({ ...newOptionData, service_type: e.target.value })}
                className="col-span-3"
                placeholder="e.g. Direct / Transshipment"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="transit" className="text-right">
                Transit
              </Label>
              <Input
                id="transit"
                value={newOptionData.transit_time}
                onChange={(e) => setNewOptionData({ ...newOptionData, transit_time: e.target.value })}
                className="col-span-3"
                placeholder="e.g. 25 days"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="valid" className="text-right">
                Valid Until
              </Label>
              <Input
                id="valid"
                type="date"
                value={newOptionData.valid_until}
                onChange={(e) => setNewOptionData({ ...newOptionData, valid_until: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOptionDetails} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

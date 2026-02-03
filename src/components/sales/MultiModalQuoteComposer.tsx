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
import { PricingService } from '@/services/pricing.service';
import { logger } from '@/lib/logger';
import { useDebug } from '@/hooks/useDebug';

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service';
  serviceOnlyCategory?: string;
  carrierName?: string;
}

interface MultiModalQuoteComposerProps {
  quoteId: string;
  versionId: string;
  optionId?: string;
  lastSyncTimestamp?: number;
  tenantId?: string;
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

export function MultiModalQuoteComposer({ quoteId, versionId, optionId: initialOptionId, lastSyncTimestamp, tenantId: propTenantId }: MultiModalQuoteComposerProps) {
  const { scopedDb, context } = useCRM();
  const debug = useDebug('Sales', 'QuoteComposer');
  const { toast } = useToast();
  const { invokeAiAdvisor } = useAiAdvisor();
  
  // Initialize Pricing Service
  const pricingService = useMemo(() => new PricingService(scopedDb.client), [scopedDb.client]);
  const debounceTimers = useRef(new Map<string, NodeJS.Timeout>());

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'>('SUBSCRIBED');
  const [pricingRequestsCount, setPricingRequestsCount] = useState(0);
  const isPricingCalculating = pricingRequestsCount > 0;
  const [saving, setSaving] = useState(false);
  const [optionId, setOptionId] = useState<string | null>(initialOptionId || null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [combinedCharges, setCombinedCharges] = useState<any[]>([]);
  const [quoteData, setQuoteData] = useState<any>({});
  const [autoMargin, setAutoMargin] = useState(false);
  const [marginPercent, setMarginPercent] = useState(15);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [options, setOptions] = useState<any[]>([]); // Store all available options
  const [viewMode, setViewMode] = useState<'overview' | 'composer'>('composer');
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isGeneratingSmart, setIsGeneratingSmart] = useState(false);
  
  // Track charges to delete
  const [chargesToDelete, setChargesToDelete] = useState<string[]>([]);
  
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
  
  // Validation feedback
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Reference data
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [chargeCategories, setChargeCategories] = useState<any[]>([]);
  const [chargeBases, setChargeBases] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [tradeDirections, setTradeDirections] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<any[]>([]);
  const [containerSizes, setContainerSizes] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);

  // Basis configuration modal
  const [basisModalOpen, setBasisModalOpen] = useState(false);
  const [currentBasisConfig, setCurrentBasisConfig] = useState<any>({
    tradeDirection: '',
    containerType: '',
    containerSize: '',
    quantity: 1
  });
  const [basisTarget, setBasisTarget] = useState<{ type: 'leg' | 'combined'; legId?: string; chargeIdx: number } | null>(null);

  // Transport modes for mode-to-service-type mapping
  const [transportModes, setTransportModes] = useState<any[]>([]);

  // Option management state
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<any>(null);
  const [newOptionData, setNewOptionData] = useState({
    option_name: '',
    carrier_name: '',
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
    setLoading(true);
    
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
        setTenantId(resolvedTenantId);
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
              const { data: items, error: itemsError } = await scopedDb
                .from('quote_items')
                .select('weight_kg, volume_cbm, quantity, product_name, description')
                .eq('quote_id', quoteId);

              if (itemsError) {
                 debug.error('[Composer] Error fetching quote items:', itemsError);
                 toast({
                   title: "Warning",
                   description: "Could not load cargo items. Totals may be zero.",
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
                 setTenantId(resolvedTenantId);
              }
            }
            
            if ((quoteRow as any)?.franchise_id) {
              setFranchiseId((quoteRow as any).franchise_id);
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
                total_volume: calculatedTotalVolume
            };

            setQuoteData(normalizedQuote);
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
                setTenantId(resolvedTenantId);
            }
            setMarketAnalysis((versionRow as any)?.market_analysis ?? null);
            setConfidenceScore((versionRow as any)?.confidence_score ?? null);
            setAnomalies((versionRow as any)?.anomalies ?? []);

            // Load HTS/AES data if present
            if ((versionRow as any).aes_hts_id) {
              setQuoteData((prev: any) => ({
                ...prev,
                aes_hts_id: (versionRow as any).aes_hts_id,
                hts_code: (versionRow as any).aes_hts_codes?.hts_code
              }));
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
            if (resolvedTenantId) setTenantId(resolvedTenantId);
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
          carriers: [] as any[]
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
          fetchRef('carriers', 'carriers', 'Failed to load carriers')
        ]);

        return results;
      };

      const refData = await loadReferenceData();
      
      setServiceTypes(refData.serviceTypes);
      setTransportModes(refData.transportModes);
      setChargeCategories(refData.chargeCategories);
      setChargeBases(refData.chargeBases);
      setCurrencies(refData.currencies);
      setTradeDirections(refData.tradeDirections);
      setContainerTypes(refData.containerTypes);
      setContainerSizes(refData.containerSizes);
      setCarriers(refData.carriers);

      // Set default currency
      if (refData.currencies.length > 0) {
        setQuoteData((prev: any) => ({ ...prev, currencyId: refData.currencies[0].id }));
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
      setLoading(false);
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
        setOptions(existingOptions);
        
        // If initialOptionId is provided, use it.
        // Otherwise, if current optionId exists in list, keep it.
        // Otherwise default to first.
        let targetId = existingOptions[0].id;
        
        if (initialOptionId && existingOptions.some((o: any) => o.id === initialOptionId)) {
          targetId = initialOptionId;
          setViewMode('composer');
        } else if (optionId && existingOptions.some((o: any) => o.id === optionId)) {
          targetId = optionId;
          // If we have data, default to overview unless explicitly editing?
          // Let's default to overview for now to show off the new UI
          setViewMode('overview');
        } else {
          setViewMode('overview');
        }
        
        debug.debug('[Composer] Found existing options:', existingOptions.length, 'Selected:', targetId);
        setOptionId(targetId);
        
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
          tenant_id: resolvedTenantId
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
          setOptionId(retry.id);
          setOptions([retry]);
          setViewMode('composer');
          
          // Update URL
          const url = new URL(window.location.href);
          url.searchParams.set('optionId', retry.id);
          window.history.replaceState({}, '', url.toString());
        }
        return;
      }

      if (newOption?.id) {
        debug.debug('[Composer] Created new option:', newOption.id);
        setOptionId(newOption.id);
        setOptions([newOption]);
        setViewMode('composer');
        
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
      if (resolved) setTenantId(resolved);
      return resolved;
    } catch {
      return null;
    }
  };

  const loadOptionData = async () => {
    if (!optionId || !tenantId) return;

    debug.debug('[Composer] Loading option data for:', { optionId, tenantId });
    setLoading(true);
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

      debug.debug('[Composer] Loaded legs:', legData?.length, 'Global charges:', chargeData?.length);

      // Always update quoteData with option specifics to ensure UI reflects current option
      if (optionData) {
        setQuoteData(prev => ({
          ...prev,
          carrier_name: getSafeString(optionData.carrier_name),
          service_type: getSafeString(optionData.service_type),
          transit_time: getSafeString(optionData.transit_time),
          validUntil: optionData.valid_until ? new Date(optionData.valid_until).toISOString().split('T')[0] : prev.validUntil,
          currencyId: optionData.quote_currency_id || prev.currencyId,
          option_name: getSafeString(optionData.option_name),
          ai_generated: optionData.ai_generated || false
        }));
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
        
        setCombinedCharges(Array.from(globalChargesMap.values()));
      } else {
        setCombinedCharges([]);
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
          const carrierName = leg.provider_id 
             ? carriers.find(c => c.id === leg.provider_id)?.carrier_name 
             : (leg.carrier_name || (leg.leg_type === 'transport' ? optionData?.carrier_name : undefined));
             
          const modeName = leg.mode_id 
             ? (transportModes.find(m => m.id === leg.mode_id)?.name || serviceTypes.find(s => s.transport_modes?.id === leg.mode_id)?.transport_modes?.code || 'ocean')
             : (leg.mode || 'ocean');

          return {
            id: leg.id,
            mode: getSafeString(modeName),
            serviceTypeId: leg.service_type_id || '',
            carrierName: getSafeString(carrierName),
            origin: getSafeString(leg.origin_location),
            destination: getSafeString(leg.destination_location),
            // Normalize legType to ensure it's either 'transport' or 'service'
            legType: leg.leg_type === 'service' ? 'service' : 'transport',
            serviceOnlyCategory: getSafeString(leg.service_only_category),
            charges: Array.from(chargesMap.values())
          };
        });

        setLegs(legsWithCharges);
      } else {
        setLegs([]);
      }
    } catch (error: any) {
      debug.error('[Composer] Error loading option data:', error);
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
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
    setLegs([...legs, newLeg]);
    
    // Show toast if service type was auto-selected
    if (defaultServiceType) {
      toast({
        title: 'Service Type Auto-Selected',
        description: `${defaultServiceType.name} has been automatically selected for ${selectedMode?.name || modeCode} transport.`,
      });
    }
  };

  const updateLeg = (legId: string, updates: Partial<Leg>) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const updatedLeg = { ...leg, ...updates };
        
        // If mode changed, recalculate chargeable weight for weight-based charges
        if (updates.mode && updates.mode !== leg.mode) {
          const weight = Number(quoteData.total_weight) || 0;
          const volume = Number(quoteData.total_volume) || 0;
          const newChargeableWeight = calculateChargeableWeight(weight, volume, updates.mode as TransportMode);
          const quantity = newChargeableWeight > 0 ? newChargeableWeight : 1;
          
          updatedLeg.charges = leg.charges.map(charge => {
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
        }
        
        return updatedLeg;
      }
      return leg;
    }));
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
    // Track charges that need to be deleted from DB
    const legToRemove = legs.find(leg => leg.id === legId);
    if (legToRemove) {
      const chargeIdsToDelete: string[] = [];
      legToRemove.charges.forEach(charge => {
        if (charge.buy?.dbChargeId) chargeIdsToDelete.push(charge.buy.dbChargeId);
        if (charge.sell?.dbChargeId) chargeIdsToDelete.push(charge.sell.dbChargeId);
      });
      if (chargeIdsToDelete.length > 0) {
        setChargesToDelete(prev => [...prev, ...chargeIdsToDelete]);
      }
    }
    
    setLegs(legs.filter(leg => leg.id !== legId));
    setDeleteDialog({ open: false, type: 'leg' });
    
    const duration = performance.now() - startTime;
    debug.log(`Leg removed: ${legId}`, { duration: `${duration.toFixed(2)}ms` });
  };

  const addCharge = (legId: string) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        // Calculate chargeable weight based on leg mode and quote details
        const weight = Number(quoteData.total_weight) || 0;
        const volume = Number(quoteData.total_volume) || 0;
        const chargeableWeight = calculateChargeableWeight(weight, volume, leg.mode as TransportMode);
        
        // Default quantity to chargeable weight if available, otherwise 1
        const defaultQuantity = chargeableWeight > 0 ? chargeableWeight : 1;

        return {
          ...leg,
          charges: [
            ...leg.charges,
            {
              id: `charge-${Date.now()}`,
              category_id: '',
              basis_id: '',
              unit: '',
              currency_id: currencies[0]?.id || '',
              buy: { quantity: defaultQuantity, rate: 0, dbChargeId: null },
              sell: { quantity: defaultQuantity, rate: 0, dbChargeId: null },
              note: ''
            }
          ]
        };
      }
      return leg;
    }));
  };

  const updateCharge = (legId: string, chargeIdx: number, field: string, value: any) => {
    // 1. Sync Update
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const charges = [...leg.charges];
        const charge = { ...charges[chargeIdx] };

        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          charge[parent] = { ...(charge[parent] || {}), [child]: value };
        } else {
          charge[field] = value;
        }
        charges[chargeIdx] = charge;
        return { ...leg, charges };
      }
      return leg;
    }));

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
                setLegs(currentLegs => currentLegs.map(l => {
                if (l.id === legId) {
                    const newCharges = [...l.charges];
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
                    return { ...l, charges: newCharges };
                }
                return l;
                }));
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
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const chargeToRemove = leg.charges[chargeIdx];
        
        // Track DB charge IDs for deletion
        if (chargeToRemove) {
          const idsToDelete: string[] = [];
          if (chargeToRemove.buy?.dbChargeId) idsToDelete.push(chargeToRemove.buy.dbChargeId);
          if (chargeToRemove.sell?.dbChargeId) idsToDelete.push(chargeToRemove.sell.dbChargeId);
          if (idsToDelete.length > 0) {
            setChargesToDelete(prev => [...prev, ...idsToDelete]);
          }
        }
        
        return {
          ...leg,
          charges: leg.charges.filter((_, idx) => idx !== chargeIdx)
        };
      }
      return leg;
    }));
    
    setDeleteDialog({ open: false, type: 'charge' });
    
    const duration = performance.now() - startTime;
    debug.log(`Charge removed from leg ${legId}`, { duration: `${duration.toFixed(2)}ms` });
  };

  // Combined charges handlers
  const addCombinedCharge = () => {
    setCombinedCharges(prev => ([
      ...prev,
      {
        id: `combined-${Date.now()}`,
        category_id: '',
        basis_id: '',
        unit: '',
        currency_id: currencies[0]?.id || '',
        buy: { quantity: 1, rate: 0, dbChargeId: null },
        sell: { quantity: 1, rate: 0, dbChargeId: null },
        note: ''
      }
    ]));
  };

  const updateCombinedCharge = (chargeIdx: number, field: string, value: any) => {
    // 1. Sync Update
    setCombinedCharges(prev => {
      const next = [...prev];
      const charge = { ...next[chargeIdx] };
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        charge[parent] = { ...(charge[parent] || {}), [child]: value };
      } else {
        charge[field] = value;
      }
      next[chargeIdx] = charge;
      return next;
    });

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
                setCombinedCharges(curr => {
                const next = [...curr];
                if (next[chargeIdx]) {
                    next[chargeIdx] = {
                    ...next[chargeIdx],
                    sell: {
                        ...next[chargeIdx].sell,
                        quantity: next[chargeIdx].buy?.quantity || 1,
                        rate: result.sellPrice
                        }
                    };
                }
                return next;
                });
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
    setCombinedCharges(prev => {
      const chargeToRemove = prev[chargeIdx];
      
      // Track DB charge IDs for deletion
      if (chargeToRemove) {
        const idsToDelete: string[] = [];
        if (chargeToRemove.buy?.dbChargeId) idsToDelete.push(chargeToRemove.buy.dbChargeId);
        if (chargeToRemove.sell?.dbChargeId) idsToDelete.push(chargeToRemove.sell.dbChargeId);
        if (idsToDelete.length > 0) {
          setChargesToDelete(prevIds => [...prevIds, ...idsToDelete]);
        }
      }
      
      return prev.filter((_, idx) => idx !== chargeIdx);
    });
    
    setDeleteDialog({ open: false, type: 'combinedCharge' });
    
    const duration = performance.now() - startTime;
    debug.log(`Combined charge removed: ${chargeIdx}`, { duration: `${duration.toFixed(2)}ms` });
  };

  const openBasisModal = (legId: string, chargeIdx: number) => {
    setBasisTarget({ type: 'leg', legId, chargeIdx });
    const tdId = String(tradeDirections?.[0]?.id ?? '');
    const ctId = String(containerTypes?.[0]?.id ?? '');
    const csId = String(containerSizes?.[0]?.id ?? '');
    setCurrentBasisConfig({ tradeDirection: tdId, containerType: ctId, containerSize: csId, quantity: 1 });
    setBasisModalOpen(true);
  };

  const openCombinedBasisModal = (chargeIdx: number) => {
    setBasisTarget({ type: 'combined', chargeIdx });
    const tdId = String(tradeDirections?.[0]?.id ?? '');
    const ctId = String(containerTypes?.[0]?.id ?? '');
    const csId = String(containerSizes?.[0]?.id ?? '');
    setCurrentBasisConfig({ tradeDirection: tdId, containerType: ctId, containerSize: csId, quantity: 1 });
    setBasisModalOpen(true);
  };

  const saveBasisConfig = (config: any) => {
    if (!basisTarget) return;
    const size = containerSizes.find(s => s.id === config.containerSize);

    if (basisTarget.type === 'leg' && basisTarget.legId) {
      const { legId, chargeIdx } = basisTarget;
      setLegs(legs.map(leg => {
        if (leg.id === legId) {
          const charges = [...leg.charges];
          charges[chargeIdx] = {
            ...charges[chargeIdx],
            unit: `${config.quantity}x${size?.name || ''}`,
            buy: { ...charges[chargeIdx].buy, quantity: config.quantity },
            sell: { ...charges[chargeIdx].sell, quantity: config.quantity },
            basisDetails: config
          };
          return { ...leg, charges };
        }
        return leg;
      }));
    } else if (basisTarget.type === 'combined') {
      const { chargeIdx } = basisTarget;
      setCombinedCharges(prev => {
        const next = [...prev];
        next[chargeIdx] = {
          ...next[chargeIdx],
          unit: `${config.quantity}x${size?.name || ''}`,
          buy: { ...(next[chargeIdx].buy || {}), quantity: config.quantity },
          sell: { ...(next[chargeIdx].sell || {}), quantity: config.quantity },
          basisDetails: config
        };
        return next;
      });
    }

    setBasisModalOpen(false);
    setCurrentBasisConfig({ tradeDirection: '', containerType: '', containerSize: '', quantity: 1 });
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
      setOptions(existingOptions);
    }
  };

  const handleGenerateSmartOptions = async () => {
    if (!quoteData || !tenantId) {
      toast({ title: "Error", description: "Missing quote details or tenant context.", variant: "destructive" });
      return;
    }

    setIsGeneratingSmart(true);
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

      // Update market analysis state and persist to version
      if (analysis) {
        setMarketAnalysis(analysis);
        // Persist analysis to the version header
        await scopedDb
          .from('quotation_versions')
          .update({ market_analysis: analysis })
          .eq('id', versionId);
      }

      // Fetch Master Data for resolution
      const { data: currencies } = await scopedDb.from('currencies').select('id, code');
      const { data: categories } = await scopedDb.from('charge_categories').select('id, name');

      for (const result of results) {
        const mapped = mapOptionToQuote(result);
        // Use mapped financials if available (preserving source data/logic), otherwise default calculate
        let financials;
        if (mapped.buyPrice !== undefined && mapped.marginAmount !== undefined && mapped.buyPrice > 0) {
            financials = { 
                buyPrice: mapped.buyPrice, 
                marginAmount: mapped.marginAmount, 
                markupPercent: mapped.markupPercent,
                sellPrice: mapped.total_amount || mapped.sellPrice || 0
            };
        } else {
            // Async Pricing Service Call
            // Defaults: 15% Margin, Sell-Based (isCostBased=false)
            const calc = await pricingService.calculateFinancials(mapped.sellPrice, 15, false);
            
            // Calculate Markup for backward compatibility (Profit / Cost * 100)
            let markup = 0;
            if (calc.buyPrice > 0) {
                markup = (calc.marginAmount / calc.buyPrice) * 100;
            }

            financials = {
                buyPrice: calc.buyPrice,
                marginAmount: calc.marginAmount,
                markupPercent: Number(markup.toFixed(2)),
                sellPrice: calc.sellPrice
            };
        }

        // Resolve Currency (default to USD if not found)
        const currencyCode = mapped.currency || 'USD';
        const currencyId = currencies?.find(c => c.code === currencyCode)?.id || currencies?.[0]?.id;

        const { data: optData, error: optError } = await scopedDb
          .from('quotation_version_options')
          .insert({
            quotation_version_id: versionId,
            tenant_id: tenantId,
            franchise_id: franchiseId,
            carrier_name: mapped.carrier,
            service_type: mapped.serviceType,
            transit_time: mapped.transitTime,
            valid_until: mapped.validUntil,
            option_name: mapped.optionName,
            reliability_score: mapped.reliability,
            ai_generated: true,
            ai_explanation: mapped.aiExplanation,
            source: 'ai_smart_quote',
            total_co2_kg: mapped.co2,
            total_buy: financials.buyPrice,
            margin_amount: financials.marginAmount,
            margin_percentage: financials.markupPercent,
            total_sell: financials.sellPrice,
            total_amount: financials.sellPrice,
            quote_currency_id: currencyId
          })
          .select()
          .single();

        if (optError) throw optError;

        // Insert Legs and Charges (Correctly respecting bifurcation)
        if (mapped.legs && mapped.legs.length > 0) {
            for (let i = 0; i < mapped.legs.length; i++) {
                const leg = mapped.legs[i];
                const legId = crypto.randomUUID();
                
                // Determine Service Type ID for leg (if transport)
                // This is a simplification; ideally we'd look up service types
                // But for now we rely on the option's service type or generic
                
                const { data: legData, error: legError } = await scopedDb
                  .from('quotation_version_option_legs')
                  .insert({
                     id: legId,
                     quotation_version_option_id: optData.id,
                     tenant_id: tenantId,
                     mode: leg.mode || payload.mode,
                     origin_location: leg.origin || payload.origin,
                     destination_location: leg.destination || payload.destination,
                     leg_type: leg.leg_type || 'transport', // mapOptionToQuote now assigns this
                     carrier_name: leg.carrier || mapped.carrier,
                     sort_order: i,
                     transit_time: leg.transit_time
                  })
                  .select()
                  .single();

                if (legError) {
                    debug.error("Failed to insert leg:", legError);
                    continue;
                }

                // Insert Charges for this Leg
                if (leg.charges && leg.charges.length > 0) {
                    // Calculate Chargeable Weight for this leg
                    const weight = Number(quoteData.total_weight) || 0;
                    const volume = Number(quoteData.total_volume) || 0;
                    const legMode = (leg.mode || payload.mode || 'ocean').toLowerCase();
                    
                    let transportMode: TransportMode = 'ocean';
                    if (legMode.includes('air')) transportMode = 'air';
                    else if (legMode.includes('road') || legMode.includes('truck')) transportMode = 'road';
                    else if (legMode.includes('rail')) transportMode = 'rail';
                    
                    const chargeableWeight = calculateChargeableWeight(weight, volume, transportMode);

                    const chargesToInsert = leg.charges.map((c: any) => {
                        // Resolve Category ID
                        const cName = (c.name || c.charge_categories?.name || '').toLowerCase();
                        let category = categories?.find(cat => cat.name.toLowerCase() === cName || cName.includes(cat.name.toLowerCase()));
                        
                        // Fallback to 'Freight' or first available category if not found
                        if (!category && categories && categories.length > 0) {
                            category = categories.find(cat => cat.name.toLowerCase().includes('freight')) || categories[0];
                        }
                        
                        // Resolve Currency ID
                        const cCurrency = c.currency || currencyCode;
                        const cCurrencyId = currencies?.find(cur => cur.code === cCurrency)?.id || currencyId;

                        // Map unit string to basis_id and determine quantity
                        let basisId = 'fc9fd073-e16b-4064-b915-c0d965351d68'; // Default: Per Shipment
                        let quantity = 1;
                        const unitLower = (c.unit || '').toLowerCase();
                        
                        if (unitLower.includes('kg') || unitLower.includes('kilogram')) {
                            basisId = '297dc9e1-b128-4909-a5fc-48ca11f85f3d';
                            quantity = chargeableWeight;
                        } else if (unitLower.includes('container') || unitLower.includes('box') || unitLower.includes('teu') || unitLower.includes('feu')) {
                            basisId = '495e6fc6-e8b3-4d2d-8761-e0135b82b511';
                            // Default to 1 if container count not available, or parse from quoteData if present
                            quantity = 1; 
                        } else if (unitLower.includes('cbm') || unitLower.includes('cubic')) {
                            basisId = 'ede3ff41-d0d1-40fb-b719-c3ba8fa89d78';
                            quantity = volume || 1;
                        } else if (unitLower.includes('mile')) {
                            basisId = 'fb0e952e-e0be-478b-9616-986528bef6f8';
                            quantity = 1;
                        }

                        const rate = c.amount || 0;
                        const totalAmount = rate * quantity;

                        return {
                            leg_id: legId,
                            tenant_id: tenantId,
                            quote_option_id: optData.id,
                            category_id: category?.id,
                            charge_side_id: '0e065e06-1e00-4aa2-8f83-9223abe18a05', // Default to Sell side
                            basis_id: basisId,
                            currency_id: cCurrencyId,
                            unit: c.unit || 'per_shipment',
                            rate: rate,
                            quantity: quantity,
                            amount: totalAmount,
                            note: c.note || c.name,
                            sort_order: 0
                        };
                    });

                    const { error: chargeError } = await scopedDb
                        .from('quote_charges')
                        .insert(chargesToInsert);
                        
                    if (chargeError) {
                         debug.error("Failed to insert leg charges:", chargeError);
                    }
                }
            }
        } else {
             // Fallback: Create default leg if mapOptionToQuote failed to produce legs (Unlikely with new logic)
             const legId = crypto.randomUUID();
             await scopedDb
              .from('quotation_version_option_legs')
              .insert({
                 id: legId,
                 quotation_version_option_id: optData.id,
                 tenant_id: tenantId,
                 mode: payload.mode,
                 origin_location: payload.origin,
                 destination_location: payload.destination,
                 leg_type: 'transport',
                 carrier_name: mapped.carrier,
                 sort_order: 0
              });
        }
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
      setIsGeneratingSmart(false);
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
    setValidationErrors(validation.errors);
    setValidationWarnings(validation.warnings);
    
    if (validation.errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please fix ${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''} before saving`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
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
        setSaving(false);
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
          setOptionId(currentOptionId);
          debug.debug('[Composer] Using existing option:', currentOptionId);
        } else {
          debug.debug('[Composer] Creating new option during save');
          const { data: newOption, error: optError } = await scopedDb
            .from('quotation_version_options')
            .insert({
              quotation_version_id: versionId,
              tenant_id: finalTenantId
            })
            .select()
            .maybeSingle();
          
          if (optError) {
            debug.error('[Composer] Error creating option:', optError);
            throw new Error(`Failed to create quotation option: ${optError.message}`);
          }
          
          if (newOption?.id) {
            currentOptionId = newOption.id;
            setOptionId(currentOptionId);
            debug.debug('[Composer] Created option:', currentOptionId);
          }
        }
      } else {
        debug.debug('[Composer] Using existing optionId:', currentOptionId);
      }
      
      updateProgress(1); // Option created

      // Delete tracked charges first
      if (chargesToDelete.length > 0) {
        const { error: deleteError } = await scopedDb
          .from('quote_charges')
          .delete()
          .in('id', chargesToDelete);
        
        if (deleteError) {
          debug.error('Error deleting charges:', deleteError);
          throw new Error(`Failed to delete charges: ${deleteError.message}`);
        }
        
        // Clear the deletion queue
        setChargesToDelete([]);
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
              franchise_id: franchiseId,
              sort_order: i
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
              sort_order: i
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
            franchise_id: franchiseId
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
        // Non-critical, but good to know
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
      setChargesToDelete([]);
      
      // Clear validation feedback
      setValidationErrors([]);
      setValidationWarnings([]);
      
      updateProgress(5); // Complete
      
      // Keep success display for a moment
      setTimeout(() => {
        setSaveProgress({ show: false, steps: [] });
      }, 1000);
      
    } catch (error: any) {
      const duration = performance.now() - startTime;
      debug.error('Save quotation error:', error, { duration: `${duration.toFixed(2)}ms` });
      const errorMessage = error.message || 'Failed to save quotation';
      
      // Hide progress on error
      setSaveProgress({ show: false, steps: [] });
      
      toast({ 
        title: 'Save Failed', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddOption = () => {
    setEditingOption(null);
    setNewOptionData({
      option_name: `Option ${options.length + 1}`,
      carrier_name: '',
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

    setLoading(true);
    const startTime = performance.now();
    debug.info('Deleting quote option', { optionId: id });

    try {
      const { error } = await scopedDb
        .from('quotation_version_options')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const newOptions = options.filter(o => o.id !== id);
      setOptions(newOptions);
      if (optionId === id) {
        setOptionId(newOptions[0].id);
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
      debug.error('Error deleting option:', error, { duration: `${duration.toFixed(2)}ms` });
      toast({ title: 'Error', description: 'Failed to delete option: ' + error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOptionDetails = async () => {
    if (!newOptionData.option_name) {
      toast({ title: 'Error', description: 'Option Name is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
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

        setOptions(prev => prev.map(o => o.id === editingOption.id ? data : o));
        if (optionId === editingOption.id) {
          // Refresh quote data if we edited the current option
          setQuoteData(prev => ({
             ...prev,
             carrier_name: data.carrier_name,
             service_type: data.service_type,
             transit_time: data.transit_time,
             validUntil: data.valid_until ? new Date(data.valid_until).toISOString().split('T')[0] : prev.validUntil,
             option_name: data.option_name
          }));
        }
      } else {
        // Create new
        const { data, error } = await scopedDb
          .from('quotation_version_options')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setOptions(prev => [...prev, data]);
        setOptionId(data.id);
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
      debug.error('Error saving option:', error, { duration: `${duration.toFixed(2)}ms` });
      toast({ title: 'Error', description: 'Failed to save option: ' + error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchRates = async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    setLoading(true);
    toast({
      title: "Fetching AI Rates",
      description: "Consulting AI Smart Advisor for real-time market rates...",
    });

    try {
      // 1. Prepare Payload for AI
      // We treat this leg as a mini-shipment to get specific rates
      const payload = {
        origin: leg.origin,
        destination: leg.destination,
        commodity: quoteData.commodity || 'General Cargo',
        mode: leg.mode.toLowerCase(),
        // Add context if available
        container_type: quoteData.container_type,
        weight: quoteData.total_weight,
        volume: quoteData.total_volume
      };

      // 2. Invoke AI Advisor
      const aiResponse = await invokeAiAdvisor({
        action: 'generate_smart_quotes',
        payload
      });

      if (aiResponse.error) {
        throw new Error(aiResponse.error.message || 'AI Advisor failed');
      }

      if (!aiResponse.data?.options || aiResponse.data.options.length === 0) {
        throw new Error('No rates found for this route');
      }

      // 3. Process Result
      // We take the first (best) option returned by AI
      const bestOption = aiResponse.data.options[0];
      const mapped = mapOptionToQuote(bestOption);

      if (!mapped) throw new Error('Failed to process AI rates');

      // 4. Extract Charges
      // Collect charges from all returned legs (in case AI broke it down) and global charges
      let extractedCharges: any[] = [];
      
      if (mapped.legs) {
        mapped.legs.forEach((l: any) => {
          if (l.charges) extractedCharges = [...extractedCharges, ...l.charges];
        });
      }
      if (mapped.charges) {
        extractedCharges = [...extractedCharges, ...mapped.charges];
      }

      if (extractedCharges.length === 0) {
        // Fallback: If AI returned a total but no details, create a lump sum
        if (mapped.total_amount > 0) {
            extractedCharges.push({
                name: 'Freight Charges',
                amount: mapped.total_amount,
                currency: mapped.currency || 'USD',
                unit: 'per_shipment'
            });
        }
      }

      const weight = Number(quoteData.total_weight) || 0;
      const volume = Number(quoteData.total_volume) || 0;
      const chargeableWeight = calculateChargeableWeight(weight, volume, leg.mode as TransportMode);

      // 5. Map to Composer Charge Format
      const newCharges = await Promise.all(extractedCharges.map(async (chg) => {
        // Find matching IDs from master data
        const catName = chg.category || chg.name || 'Freight';
        const cat = chargeCategories.find(c => 
          (c.name && c.name.toLowerCase() === catName.toLowerCase()) || 
          (c.code && c.code.toLowerCase() === catName.toLowerCase())
        ) || chargeCategories.find(c => c.code === 'FRT') || chargeCategories[0];

        // Basis mapping
        const basisName = chg.unit || 'per_shipment';
        // Try to match basis code or name
        let basis = chargeBases.find(b => 
          (b.code && b.code.toLowerCase() === basisName.toLowerCase()) ||
          (b.name && b.name.toLowerCase() === basisName.toLowerCase())
        );
        
        // Fallback for common units
        if (!basis) {
            if (basisName.includes('kg')) basis = chargeBases.find(b => b.code === 'kg');
            else if (basisName.includes('cbm')) basis = chargeBases.find(b => b.code === 'cbm');
            else if (basisName.includes('cont') || basisName.includes('box')) basis = chargeBases.find(b => b.code === 'container');
            else basis = chargeBases.find(b => b.code === 'shipment'); // Default
        }

        const curr = currencies.find(c => c.code === (chg.currency || 'USD')) || currencies[0];
        
        // Calculate Buy/Sell
        // If AI provides specific buy/sell, use them. Otherwise use standard margin logic.
        const sellRate = Number(chg.amount || chg.rate || 0);
        let buyRate = Number(chg.buyRate || chg.cost || 0);
        
        if (buyRate === 0 && sellRate > 0) {
            // Reverse calculate buy rate assuming 15% margin if not provided
            // Use PricingService for consistent financial logic
            const financials = await pricingService.calculateFinancials(sellRate, 15, false);
            buyRate = financials.buyPrice;
        }

        // Determine quantity
        let quantity = Number(chg.quantity || 1);
        // Adjust quantity based on basis if needed (similar to original logic)
        if (basis?.code?.toLowerCase().includes('kg') || basis?.code?.toLowerCase().includes('cbm')) {
             quantity = chargeableWeight > 0 ? chargeableWeight : 1;
        }

        return {
          id: `charge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category_id: cat?.id || '',
          basis_id: basis?.id || '',
          unit: basis?.code || 'shipment',
          currency_id: curr?.id || '',
          buy: {
            quantity,
            rate: buyRate,
            dbChargeId: null
          },
          sell: {
            quantity,
            rate: sellRate,
            dbChargeId: null
          },
          note: chg.note || `AI Rate: ${chg.name || catName}`
        };
      }));

      // 6. Update State (using smart merge)
      setLegs(currentLegs => currentLegs.map(l => {
        if (l.id === legId) {
          // Merge new charges with existing ones to prevent duplicates
          const updatedCharges = [...l.charges];
          
          newCharges.forEach(newCharge => {
            const existingIndex = updatedCharges.findIndex(c => 
              c.category_id === newCharge.category_id && 
              // Strict matching to prevent duplication
              ((!c.basis_id && !newCharge.basis_id) || c.basis_id === newCharge.basis_id) &&
              ((!c.unit && !newCharge.unit) || c.unit === newCharge.unit)
            );

            if (existingIndex >= 0) {
              // Update existing charge
              const existing = updatedCharges[existingIndex];
              
              updatedCharges[existingIndex] = {
                ...existing,
                unit: newCharge.unit || existing.unit,
                currency_id: newCharge.currency_id,
                buy: { 
                    ...existing.buy, 
                    rate: newCharge.buy.rate,
                    quantity: (existing.buy.quantity === 0 || existing.buy.quantity === 1) ? newCharge.buy.quantity : existing.buy.quantity,
                    amount: ((existing.buy.quantity === 0 || existing.buy.quantity === 1) ? newCharge.buy.quantity : existing.buy.quantity) * newCharge.buy.rate
                },
                sell: { 
                    ...existing.sell, 
                    rate: newCharge.sell.rate, 
                    quantity: (existing.sell.quantity === 0 || existing.sell.quantity === 1) ? newCharge.sell.quantity : existing.sell.quantity,
                    amount: ((existing.sell.quantity === 0 || existing.sell.quantity === 1) ? newCharge.sell.quantity : existing.sell.quantity) * newCharge.sell.rate
                },
                note: newCharge.note || existing.note
              };
            } else {
              // Add new charge
              updatedCharges.push(newCharge);
            }
          });

          return { ...l, charges: updatedCharges };
        }
        return l;
      }));

      toast({
        title: "Rates Fetched",
        description: `Successfully retrieved ${newCharges.length} AI rates.`,
      });

    } catch (error: any) {
      debug.error('Error fetching rates:', error);
      toast({
        title: "Rate Fetch Failed",
        description: error.message || "Could not retrieve AI rates.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    // Clear validation on navigation
    setValidationErrors([]);
    setValidationWarnings([]);
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    // Clear validation on navigation
    setValidationErrors([]);
    setValidationWarnings([]);
    
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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
              options={options.map(opt => ({
                ...opt,
                mode: opt.service_type ? (opt.service_type.toLowerCase().includes('air') ? 'air' : opt.service_type.toLowerCase().includes('road') ? 'road' : 'sea') : 'sea'
              }))}
              selectedId={optionId || undefined}
              onSelect={(id) => {
                setOptionId(id);
                setViewMode('composer');
              }}
              onGenerateSmartOptions={handleGenerateSmartOptions}
              marketAnalysis={marketAnalysis}
              confidenceScore={confidenceScore}
              anomalies={anomalies}
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
                onClick={() => setViewMode('overview')}
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
                    onClick={() => setOptionId(opt.id)}
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
        <QuoteDetailsStep
          quoteData={quoteData}
          currencies={currencies}
          origin={legs.length > 0 ? legs[0].origin : undefined}
          destination={legs.length > 0 ? legs[legs.length - 1].destination : undefined}
          validationErrors={validationErrors}
          onChange={(field, value) => {
            setQuoteData((prev: any) => ({ ...prev, [field]: value }));
            
            // Recalculate charges if weight/volume changes
            if (field === 'total_weight' || field === 'total_volume') {
              const weight = field === 'total_weight' ? Number(value) : Number(quoteData.total_weight) || 0;
              const volume = field === 'total_volume' ? Number(value) : Number(quoteData.total_volume) || 0;
              
              setLegs(currentLegs => currentLegs.map(leg => {
                const chargeableWeight = calculateChargeableWeight(weight, volume, leg.mode as TransportMode);
                const quantity = chargeableWeight > 0 ? chargeableWeight : 1;
                
                const updatedCharges = leg.charges.map(charge => {
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
                return { ...leg, charges: updatedCharges };
              }));
            }
          }}
        />
      )}

      {currentStep === 2 && (
        <LegsConfigurationStep
          legs={legs}
          serviceTypes={serviceTypes}
          onAddLeg={addLeg}
          onUpdateLeg={updateLeg}
          onRemoveLeg={confirmRemoveLeg}
          validationErrors={validationErrors}
        />
      )}

      {currentStep === 3 && (
        <ChargesManagementStep
          legs={legs}
          combinedCharges={combinedCharges}
          chargeCategories={chargeCategories}
          chargeBases={chargeBases}
          currencies={currencies}
          tradeDirections={tradeDirections}
          containerTypes={containerTypes}
          containerSizes={containerSizes}
          serviceTypes={serviceTypes}
          autoMargin={autoMargin}
          marginPercent={marginPercent}
          onAutoMarginChange={setAutoMargin}
          onMarginPercentChange={setMarginPercent}
          onAddCharge={addCharge}
          onUpdateCharge={updateCharge}
          onRemoveCharge={confirmRemoveCharge}
          onConfigureBasis={openBasisModal}
          onAddCombinedCharge={addCombinedCharge}
          onUpdateCombinedCharge={updateCombinedCharge}
          onRemoveCombinedCharge={confirmRemoveCombinedCharge}
          onConfigureCombinedBasis={openCombinedBasisModal}
          onFetchRates={handleFetchRates}
          validationErrors={validationErrors}
          isPricingCalculating={isPricingCalculating}
        />
      )}

      {currentStep === 4 && (
        <ReviewAndSaveStep
          legs={legs}
          quoteData={quoteData}
          currencies={currencies}
          combinedCharges={combinedCharges}
        />
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

      {/* Basis Configuration Modal */}
      <BasisConfigModal
        open={basisModalOpen}
        onClose={() => setBasisModalOpen(false)}
        onSave={saveBasisConfig}
        config={currentBasisConfig}
        onChange={(updates) => setCurrentBasisConfig({ ...currentBasisConfig, ...updates })}
        tradeDirections={tradeDirections}
        containerTypes={containerTypes}
        containerSizes={containerSizes}
      />

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
              <Input
                id="carrier"
                value={newOptionData.carrier_name}
                onChange={(e) => setNewOptionData({ ...newOptionData, carrier_name: e.target.value })}
                className="col-span-3"
                placeholder="e.g. Maersk"
              />
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
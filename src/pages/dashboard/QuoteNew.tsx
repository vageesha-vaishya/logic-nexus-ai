import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteFormRefactored as QuoteForm } from '@/components/sales/quote-form/QuoteFormRefactored';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { QuoteTemplateList } from '@/components/sales/templates/QuoteTemplateList';
import { QuoteTemplate } from '@/components/sales/templates/types';
import { FileText, Loader2 } from 'lucide-react';
import { QuoteFormValues } from '@/components/sales/quote-form/types';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { QuickQuoteHistory } from '@/components/sales/quick-quote/QuickQuoteHistory';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';
import { LogisticsPlugin } from '@/plugins/logistics/LogisticsPlugin';
import { QuoteOptionService } from '@/services/QuoteOptionService';
import { QuoteTransformService } from '@/lib/services/quote-transform.service';

export default function QuoteNew() {
  const { supabase, context, scopedDb } = useCRM();
  // Cast supabase to any to avoid strict type mismatch, assuming it's a valid client when used
  const quoteOptionService = new QuoteOptionService(supabase as any);
  const location = useLocation();
  const navigate = useNavigate();
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateData, setTemplateData] = useState<Partial<QuoteFormValues> | undefined>(undefined);
  const [generatedOptionIds, setGeneratedOptionIds] = useState<string[]>([]);

  const [optionsInserted, setOptionsInserted] = useState(false);
  const [isInsertingOptions, setIsInsertingOptions] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'composer'>('form');

  // Auto-switch to composer when options are inserted
  useEffect(() => {
    if (optionsInserted && location.state) {
        logger.info('[QuoteNew] Options inserted, switching to composer view');
        setViewMode('composer');
    }
  }, [optionsInserted, location.state]);
  const [insertionError, setInsertionError] = useState<string | null>(null);
  const [insertionProgress, setInsertionProgress] = useState({ current: 0, total: 0 });
  const [insertionStartTime, setInsertionStartTime] = useState<number | null>(null);
  
  // Real-time sync listener
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleSyncUpdate = (source: string, payload: any) => {
    console.log(`[QuoteNew] Sync: ${source} changed`, payload);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      setLastSyncTimestamp(Date.now());
      debounceTimer.current = null;
    }, 500); // 500ms debounce to prevent excessive reloads
  };

  useEffect(() => {
    if (!createdQuoteId || !supabase) return;

    const channel = supabase.channel(`quote-sync-${createdQuoteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotation_versions',
          filter: `quote_id=eq.${createdQuoteId}`
        },
        (payload) => handleSyncUpdate('Version', payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotation_version_options',
          filter: versionId ? `quotation_version_id=eq.${versionId}` : undefined
        },
        (payload) => handleSyncUpdate('Option', payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_quote_requests',
          filter: `quote_id=eq.${createdQuoteId}`
        },
        (payload) => handleSyncUpdate('AI Quote Request', payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [createdQuoteId, versionId, supabase]);

  // Timeout monitor
  useEffect(() => {
    if (isInsertingOptions && insertionStartTime) {
      const timeoutId = setTimeout(() => {
        if (isInsertingOptions) {
          console.error('[QuoteNew] Insertion timed out after 30s');
          setInsertionError('Operation timed out. Please try again.');
          setIsInsertingOptions(false);
          // Allow user to proceed even if incomplete
          setOptionsInserted(true); 
          toast.error('Quote generation timed out. Some options may be missing.');
        }
      }, 30000);
      return () => clearTimeout(timeoutId);
    }
  }, [isInsertingOptions, insertionStartTime]);
  
  const [masterData, setMasterData] = useState<{
    serviceTypes: any[];
    carriers: any[];
    containerTypes?: any[];
    containerSizes?: any[];
  }>({ serviceTypes: [], carriers: [] });

  // Fetch master data on mount
  useEffect(() => {
    const fetchMasterData = async () => {
        try {
            const { data: st, error: stError } = await scopedDb.from('service_types').select('id, name, code');
            if (stError) console.error('[QuoteNew] Error fetching service types:', stError);

            const { data: c, error: cError } = await scopedDb.from('carriers').select('id, carrier_name, scac');
            if (cError) console.error('[QuoteNew] Error fetching carriers:', cError);

            const { data: ct, error: ctError } = await scopedDb.from('container_types').select('id, name, code');
            if (ctError) console.error('[QuoteNew] Error fetching container types:', ctError);

            const { data: cs, error: csError } = await scopedDb.from('container_sizes').select('id, name, code');
            if (csError) console.error('[QuoteNew] Error fetching container sizes:', csError);

            setMasterData({
                serviceTypes: st || [],
                carriers: c || [],
                containerTypes: ct || [],
                containerSizes: cs || []
            });
        } catch (error) {
            console.error('[QuoteNew] Unexpected error fetching master data:', error);
        }
    };
    fetchMasterData();
  }, [scopedDb]);

  useEffect(() => {
    if (location.state) {
      try {
        const transformedData = QuoteTransformService.transformToQuoteForm(
            location.state as any, 
            masterData
        );
        
        setTemplateData(prev => ({
            ...prev,
            ...transformedData
        }));
        
        logger.info('[QuoteNew] Transformed Quick Quote state to form values', { 
            itemsCount: transformedData.items?.length,
            serviceTypeId: transformedData.service_type_id
        });

        // Audit Log: Transformation Success
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                QuoteTransformService.logTransferEvent(supabase, {
                    action: 'quote_transform_success',
                    status: 'success',
                    userId: data.user.id,
                    details: {
                        source: 'quick_quote',
                        itemCount: transformedData.items?.length,
                        serviceType: transformedData.service_type_id
                    }
                });
            }
        });

      } catch (error) {
        logger.error('[QuoteNew] Failed to transform Quick Quote state', { error });
        toast.error('Failed to load quote details. Please verify the data.');

        // Audit Log: Transformation Failure
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                QuoteTransformService.logTransferEvent(supabase, {
                    action: 'quote_transform_failure',
                    status: 'failure',
                    userId: data.user.id,
                    details: {
                        source: 'quick_quote',
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
            }
        });
      }
    }
  }, [location.state, masterData]);

  // ... (handleTemplateSelect and handleSuccess remain the same) ...

  // Insert selected options once version is created
  useEffect(() => {
    const insertOptions = async () => {
      // Requirements: Version created, Tenant ID known, Options available, Not yet inserted
      if (!versionId || optionsInserted || isInsertingOptions || !location.state) return;

      let resolvedTenantId = tenantId;
      if (!resolvedTenantId) {
          resolvedTenantId = context?.tenantId ?? null;
          if (!resolvedTenantId) {
              const { data: u } = await supabase.auth.getUser();
              resolvedTenantId = (u.user?.user_metadata as any)?.tenant_id;
          }
      }

      if (!resolvedTenantId) return;

      const state = location.state as any;
      const selectedRates = state.selectedRates; 

      if (!selectedRates || !Array.isArray(selectedRates) || selectedRates.length === 0) return;

      // Check if options already exist for this version to prevent duplication
      const { count: existingOptionsCount } = await scopedDb
          .from('quotation_version_options')
          .select('*', { count: 'exact', head: true })
          .eq('quotation_version_id', versionId);

      if (existingOptionsCount && existingOptionsCount > 0) {
          logger.info('[QuoteNew] Options already exist for version, skipping insertion', { versionId });
          setOptionsInserted(true);
          return;
      }

      logger.info('[QuoteNew] Starting option insertion', { count: selectedRates.length, versionId });
      setIsInsertingOptions(true);
      setInsertionStartTime(performance.now());
      setInsertionProgress({ current: 0, total: selectedRates.length });
      setInsertionError(null);

      try {
        const startTime = performance.now();

        // 0. Update Version with AI Analysis (if available)
        if (state.marketAnalysis || state.confidenceScore) {
             const { error: versionUpdateError } = await scopedDb.from('quotation_versions').update({
                 market_analysis: state.marketAnalysis,
                 confidence_score: state.confidenceScore,
                 anomalies: state.anomalies ? (Array.isArray(state.anomalies) ? state.anomalies : []) : []
             }).eq('id', versionId);
             
             if (versionUpdateError) {
                 console.warn('[QuoteNew] Failed to save AI analysis to version:', versionUpdateError);
             }
        }

        // 1. Fetch Master Data in Parallel
        const [
            { data: categories },
            { data: sides },
            { data: bases },
            { data: currencies },
            { data: serviceTypes },
            { data: serviceModes },
            { data: carriers }
        ] = await Promise.all([
            scopedDb.from('charge_categories', true).select('id, code, name'),
            scopedDb.from('charge_sides', true).select('id, code, name'),
            scopedDb.from('charge_bases', true).select('id, code, name'),
            scopedDb.from('currencies', true).select('id, code'),
            scopedDb.from('service_types', true).select('id, code, name, transport_modes(code)'),
            scopedDb.from('service_modes', true).select('id, code, name'),
            scopedDb.from('carriers', true).select('id, carrier_name, scac')
        ]);

        // Initialize Logistics Plugin Mapper
        const logisticsPlugin = PluginRegistry.getPlugin('plugin-logistics-core') as LogisticsPlugin;
        if (!logisticsPlugin) {
            throw new Error('Logistics Core Plugin not found');
        }

        const rateMapper = logisticsPlugin.createRateMapper({
            categories: categories || [],
            sides: sides || [],
            bases: bases || [],
            currencies: currencies || [],
            serviceTypes: serviceTypes || [],
            serviceModes: serviceModes || [],
            carriers: carriers || []
        });

        const buySideId = rateMapper.getSideId('buy') || rateMapper.getSideId('cost');
        const sellSideId = rateMapper.getSideId('sell') || rateMapper.getSideId('revenue');

        if (!buySideId || !sellSideId) {
             console.error('[QuoteNew] Master Data Missing: Sides', { sides });
             throw new Error(`Missing charge sides configuration. Found ${sides?.length} sides.`);
        }

        // Process each rate concurrently
        const newOptionIds: string[] = [];

        const processRate = async (rawRate: any) => {
            try {
                const optionId = await QuoteTransformService.retryOperation(async () => {
                    return await quoteOptionService.addOptionToVersion({
                        tenantId: resolvedTenantId,
                        versionId: versionId,
                        rate: rawRate,
                        rateMapper: rateMapper,
                        source: rawRate.source_attribution || state.source || 'quick_quote',
                        context: {
                            origin: state.origin,
                            destination: state.destination,
                            originDetails: state.originDetails,
                            destinationDetails: state.destinationDetails
                        }
                    });
                }, { maxAttempts: 3, backoffFactor: 1.5 });

                newOptionIds.push(optionId);
                setInsertionProgress(prev => ({ ...prev, current: prev.current + 1 }));

            } catch (err: any) {
                const carrierName = rawRate.carrier || rawRate.carrier_name || rawRate.provider || 'Unknown Carrier';
                console.error(`[QuoteNew] Error processing rate ${carrierName}:`, err);
                toast.error(`Failed to process rate for ${carrierName}: ${err.message || 'Unknown error'}`);
            }
        };

        // Run concurrently
        await Promise.all(selectedRates.map(processRate));

        const duration = performance.now() - startTime;
        logger.info(`[QuoteNew] Option insertion completed`, { duration: `${duration.toFixed(2)}ms`, count: selectedRates.length });
        
        if (newOptionIds.length > 0) {
            setGeneratedOptionIds(newOptionIds);
            setOptionsInserted(true);
            toast.success(`Successfully imported ${newOptionIds.length} options from Quick Quote`);
            
            // Explicit feedback for corrected quotes
            if (newOptionIds.length > 0) {
                // SYNC: Update AI Request History status
                if (state.historyId) {
                    try {
                        logger.info('[QuoteNew] Syncing back to AI Request History', { historyId: state.historyId });
                        // Try to link quote_id if possible, otherwise just status
                        const { error: historyError } = await scopedDb
                            .from('ai_quote_requests')
                            .update({ 
                                status: 'converted',
                                // We optimistically attempt to link the quote. If column missing, this might fail,
                                // but we catch it. However, to avoid hard failure, we might just update status.
                                // Let's stick to status to ensure robustness unless we know schema.
                            })
                            .eq('id', state.historyId);

                        if (historyError) {
                            console.warn('[QuoteNew] Failed to update history status:', historyError);
                        } else {
                            logger.info('[QuoteNew] History status updated to converted');
                        }
                    } catch (hErr) {
                        console.error('[QuoteNew] History sync crash:', hErr);
                    }
                }
            }
            const hasCorrections = selectedRates.some((r: any) => {
                 const mapped = mapOptionToQuote(r);
                 // Simple heuristic: If mapped total differs from input total significantly
                 return Math.abs((mapped?.total_amount || 0) - (r.total_amount || 0)) > 100;
            });
            if (hasCorrections) {
                toast.info("Historical quote data was automatically corrected for accuracy.");
            }
        } else {
             // If all failed, we should probably set insertion error to prompt user
             setInsertionError("Failed to import any options. Please check the error messages.");
             toast.error("Failed to import any options.");
        }

      } catch (err: any) {
          logger.error('[QuoteNew] Critical error inserting options', { error: err });
          
          let errorMessage = err.message || 'Failed to save options';
          if (err.message?.includes('column') && err.message?.includes('does not exist')) {
             errorMessage = 'Database schema mismatch: Missing columns. Please run the latest migration.';
          }
          if (err.details) {
             errorMessage += ` (${err.details})`;
          }
          if (err.hint) {
             errorMessage += ` Hint: ${err.hint}`;
          }
          
          setInsertionError(errorMessage);
          toast.error(`Failed to save options: ${errorMessage}`);
      } finally {
          setIsInsertingOptions(false);
          setInsertionStartTime(null);
      }
    };

    insertOptions();
  }, [versionId, tenantId, location.state, optionsInserted, isInsertingOptions, scopedDb]);

  const handleTemplateSelect = (template: QuoteTemplate) => {
    try {
      // Parse content if string, or use as is if object
      const content = typeof template.content === 'string' 
        ? JSON.parse(template.content) 
        : template.content;
      
      // Map template content to form values
      // We explicitly exclude system fields
      const { id, created_at, updated_at, tenant_id, quote_number, ...rest } = content as any;
      
      setTemplateData(rest);
      setTemplateDialogOpen(false);
      toast.success(`Template "${template.name}" applied`);
    } catch (e) {
      console.error('Error applying template', e);
      toast.error('Failed to apply template');
    }
  };

  const handleHistorySelect = (payload: any) => {
    // If we have specific rates, we proceed. 
    // If rates are empty, it means we just want to use the params (draft mode).
    // So we remove the strict length check here.
    
    // CRITICAL: Ensure we deep copy the payload to avoid reference issues
    // and force reprocessing of the raw data through the mapper.
    // The mapper has been updated to fix historical data errors ($12k vs $4k).
    const safePayload = JSON.parse(JSON.stringify(payload));

    // Navigate to self with new state to trigger re-initialization
    navigate('/dashboard/quotes/new', { 
        state: safePayload
    });
    
    // Reset local state to ensure fresh processing
    setCreatedQuoteId(null);
    setVersionId(null);
    setOptionsInserted(false);
    setGeneratedOptionIds([]);
    setInsertionError(null);
    setTemplateData(undefined);
  };

  const handleSuccess = (quoteId: string) => {
    // Update state with created quote ID
    setCreatedQuoteId(quoteId);
    
    // Switch to composer view
    setViewMode('composer');

    // Update AI Quote History if applicable
    if ((location.state as any)?.historyId) {
        scopedDb.from('ai_quote_requests')
            .update({ status: 'converted', quote_id: quoteId })
            .eq('id', (location.state as any).historyId)
            .then(({ error }) => {
                if (error) console.error('[QuoteNew] Failed to update history status:', error);
                else logger.info('[QuoteNew] Updated history status to converted', { historyId: (location.state as any).historyId });
            });
    }

    // Audit Log: Quote Created
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
            QuoteTransformService.logTransferEvent(supabase, {
                action: 'quote_created',
                status: 'success',
                userId: data.user.id,
                resourceId: quoteId,
                details: {
                    source: location.state ? 'quick_quote' : 'manual',
                    historyId: (location.state as any)?.historyId
                }
            });
        }
    });

    // Fetch tenant_id for the created quote to ensure version insert works
    (async () => {
      const { data } = await scopedDb
        .from('quotes')
        .select('tenant_id')
        .eq('id', quoteId)
        .single();
      setTenantId((data as any)?.tenant_id ?? null);
    })();
  };

  const handleRetryInsertion = () => {
    setIsInsertingOptions(false);
    setInsertionError(null);
    setInsertionProgress({ current: 0, total: 0 });
    // This will trigger the useEffect again because dependencies (isInsertingOptions) change
    // But we need to make sure we don't get stuck in a loop.
    // Actually, the useEffect runs when optionsInserted is false and versionId/tenantId are present.
    // If we just clear error, it might not re-trigger if nothing else changed.
    // We might need a trigger. But wait, useEffect depends on [versionId, tenantId, location.state, optionsInserted, isInsertingOptions].
    // If we set isInsertingOptions to false, the effect *might* run again if we don't block it.
    // The effect checks: if (!versionId || !tenantId || optionsInserted || isInsertingOptions || !location.state) return;
    // So if isInsertingOptions is false, and optionsInserted is false, it WILL run again.
    // So simply resetting state is enough.
  };

  const handleContinueAnyway = () => {
    setOptionsInserted(true);
    setInsertionError(null);
  };

  useEffect(() => {
    const ensureVersion = async () => {
      if (!createdQuoteId) return;
      
      console.log('[QuoteNew] Ensuring version exists for quote:', createdQuoteId);
      setVersionError(null);
      
      try {
        // Check if version already exists
        const { data: existing, error: queryError } = await (scopedDb
          .from('quotation_versions')
          .select('id, version_number') as any)
          .eq('quote_id', createdQuoteId)
          .order('version_number', { ascending: false })
          .limit(1);
        
        if (queryError) {
          console.error('[QuoteNew] Error querying versions:', queryError);
          setVersionError('Failed to check existing versions: ' + queryError.message);
          return;
        }
        
        if (Array.isArray(existing) && existing.length && (existing[0] as any)?.id) {
          console.log('[QuoteNew] Found existing version:', (existing[0] as any).id);
          setVersionId(String((existing[0] as any).id));
          return;
        }
        
        // Create initial version only if none exists
        console.log('[QuoteNew] No version found, creating version 1');
        
        // Resolve Tenant ID with multiple fallbacks
        let finalTenantId = tenantId;
        
        // 1. Check Context
        if (!finalTenantId) {
            finalTenantId = context?.tenantId ?? null;
        }

        // 2. Check User Metadata
        if (!finalTenantId) {
            const { data: userData } = await supabase.auth.getUser();
            finalTenantId = (userData?.user?.user_metadata as any)?.tenant_id;
        }

        // 3. Check Quote Record (last resort)
        if (!finalTenantId) {
             const { data: quoteData } = await scopedDb.from('quotes').select('tenant_id').eq('id', createdQuoteId).single();
             if (quoteData) finalTenantId = quoteData.tenant_id;
        }
        
        if (!finalTenantId) {
          console.error('[QuoteNew] Cannot create version: no tenant_id available');
          setVersionError('Missing Tenant ID - cannot create quotation version');
          return;
        }

        // Update state if we found it externally
        if (!tenantId) setTenantId(finalTenantId);
        
        const { data: v, error: insertError } = await scopedDb
          .from('quotation_versions')
          .insert({ quote_id: createdQuoteId, tenant_id: finalTenantId, version_number: 1 })
          .select('id')
          .maybeSingle();
        
        if (insertError) {
          console.error('[QuoteNew] Error creating version:', insertError);
          // Check if version was created by another process
          const { data: retry } = await (scopedDb
            .from('quotation_versions')
            .select('id') as any)
            .eq('quote_id', createdQuoteId)
            .limit(1)
            .maybeSingle();
          
          if ((retry as any)?.id) {
            console.log('[QuoteNew] Version found on retry:', (retry as any).id);
            setVersionId(String((retry as any).id));
            return;
          }
          setVersionError('Failed to create quotation version: ' + insertError.message);
          return;
        }
        
        if ((v as any)?.id) {
          console.log('[QuoteNew] Created version:', (v as any).id);
          setVersionId(String((v as any).id));
        }
      } catch (error: any) {
        console.error('[QuoteNew] Unexpected error in ensureVersion:', error);
        setVersionError('Unexpected error: ' + error.message);
      }
    };
    
    ensureVersion();
  }, [createdQuoteId, tenantId, context.tenantId, scopedDb, supabase]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes">Quotes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes/new">New</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">New Quote</h1>
            <div className="flex gap-2">
                <QuickQuoteHistory onSelect={handleHistorySelect} />
                <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Use Template
                </Button>
            </div>
          </div>
        </div>
        
        {/* Version Initialization Error */}
        {versionError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start justify-between">
            <div>
              <h4 className="font-bold flex items-center gap-2">
                 Initialization Error
              </h4>
              <p className="mt-1 text-sm">{versionError}</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="bg-white hover:bg-red-50 text-red-700 border-red-200">
                  Reload Page
                </Button>
            </div>
          </div>
        )}

        {/* Main Quote Form or Header Summary */}
        {viewMode === 'form' ? (
            <QuoteForm 
                onSuccess={handleSuccess} 
                initialData={templateData} 
                autoSave={!!location.state?.selectedRates}
                versionId={versionId || undefined}
                quoteId={createdQuoteId || undefined}
                initialViewMode="form"
            />
        ) : (
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">Quote Header Saved</h3>
                            <p className="text-xs text-muted-foreground">You are now in the Route Composer to finalize carrier details.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setViewMode('form')}>
                        Edit Header
                    </Button>
                </CardContent>
            </Card>
        )}
        
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select a Quote Template</DialogTitle>
            </DialogHeader>
            <QuoteTemplateList onSelect={handleTemplateSelect} />
          </DialogContent>
        </Dialog>
        
        {createdQuoteId && versionId && viewMode === 'composer' && (!location.state?.selectedRates || optionsInserted) && (
          <div className="mt-6">
            <MultiModalQuoteComposer 
              quoteId={createdQuoteId} 
              versionId={versionId} 
              optionId={generatedOptionIds.length > 0 ? generatedOptionIds[0] : undefined}
              lastSyncTimestamp={lastSyncTimestamp}
              tenantId={tenantId || undefined}
            />
          </div>
        )}
        
        {createdQuoteId && location.state?.selectedRates && !optionsInserted && !versionError && (
             <div className="mt-6 p-8 border rounded-lg bg-muted/20 flex flex-col items-center justify-center text-center">
                {insertionError ? (
                    <div className="space-y-4 max-w-md">
                        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                             <FileText className="h-6 w-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-red-700">Generation Failed</h3>
                        <p className="text-sm text-muted-foreground">{insertionError}</p>
                        <div className="flex gap-3 justify-center pt-2">
                            <Button onClick={handleRetryInsertion} variant="outline">Retry</Button>
                            <Button onClick={handleContinueAnyway} variant="default">Continue Anyway</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-pulse">
                        <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
                        <h3 className="text-lg font-semibold">Generating Quote Options...</h3>
                        <p className="text-sm text-muted-foreground">
                            Processing rate {insertionProgress.current} of {insertionProgress.total}
                        </p>
                        {insertionProgress.total > 0 && (
                             <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                                 <div 
                                    className="h-full bg-primary transition-all duration-300" 
                                    style={{ width: `${(insertionProgress.current / insertionProgress.total) * 100}%` }}
                                 />
                             </div>
                        )}
                        <p className="text-xs text-muted-foreground pt-2">Please wait while we configure your selected carrier rates.</p>
                    </div>
                )}
             </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Helper function for robust carrier matching
function findCarrierId(searchName: string, carriers: any[]): string | undefined {
    if (!searchName || !carriers || carriers.length === 0) return undefined;
    
    const normalizedSearch = searchName.toLowerCase().trim();
    if (!normalizedSearch) return undefined;

    // 1. Exact Name Match (case-insensitive)
    let match = carriers.find(c => c.carrier_name.toLowerCase() === normalizedSearch);

    // 2. SCAC Match
    if (!match) {
        match = carriers.find(c => c.scac?.toLowerCase() === normalizedSearch);
    }

    // 3. Includes Check (Bidirectional)
    if (!match) {
        // Try to find where DB name contains search name (e.g. "Evergreen Marine" contains "Evergreen")
        match = carriers.find(c => c.carrier_name.toLowerCase().includes(normalizedSearch));
    }
    if (!match) {
        // Try reverse: Search name contains DB name (e.g. "Evergreen Line" contains "Evergreen")
        // Be careful with short names like "ONE" matching "None" etc.
        match = carriers.find(c => normalizedSearch.includes(c.carrier_name.toLowerCase()) && c.carrier_name.length > 2);
    }

    // 4. Hardcoded Aliases for common mismatches
    if (!match) {
        const aliases: Record<string, string[]> = {
            'evergreen': ['evergreen line', 'evergreen marine', 'emc'],
            'maersk': ['maersk line', 'maersk sealand'],
            'msc': ['mediterranean shipping company'],
            'cma cgm': ['cma', 'cgm'],
            'cosco': ['cosco shipping'],
            'one': ['ocean network express'],
            'zim': ['zim integrated shipping services'],
            'hmm': ['hyundai merchant marine'],
            'yang ming': ['yang ming marine transport'],
            'apl': ['american president lines']
        };

        for (const [key, variants] of Object.entries(aliases)) {
            if (normalizedSearch.includes(key) || variants.some(v => normalizedSearch.includes(v))) {
                // Find the canonical carrier in masterData
                match = carriers.find(c => 
                    c.carrier_name.toLowerCase().includes(key) || 
                    (c.scac && c.scac.toLowerCase() === key)
                );
                if (match) break;
            }
        }
    }
    
    return match ? match.id : undefined;
}

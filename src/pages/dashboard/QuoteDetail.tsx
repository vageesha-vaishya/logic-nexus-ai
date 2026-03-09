import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VersionHistoryPanel } from '@/components/sales/quotation-versions/VersionHistoryPanel';
import { SaveVersionDialog } from '@/components/sales/quotation-versions/SaveVersionDialog';
import { QuotationComparisonDashboard } from '@/components/sales/quotation-versions/QuotationComparisonDashboard';
import { QuotationVersionHistory } from '@/components/sales/QuotationVersionHistory';
import { UnifiedQuoteComposer } from '@/components/sales/unified-composer/UnifiedQuoteComposer';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { ShareQuoteDialog } from '@/components/sales/portal/ShareQuoteDialog';
import { SendQuoteDialog } from '@/components/sales/SendQuoteDialog';
import { QuotePreviewModal } from '@/components/sales/QuotePreviewModal';
import { useDebug } from '@/hooks/useDebug';
import { Button } from "@/components/ui/button";
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';
import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';
import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';
import { logger } from '@/lib/logger';

const RETRY_DELAYS_MS = [0, 500, 1200];
const DEFAULT_RANKING_CRITERIA = { cost: 0.4, transit_time: 0.3, reliability: 0.3 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('temporar') ||
    message.includes('connection') ||
    message.includes('socket') ||
    message.includes('failed to load')
  );
};

const normalizeCurrencyCode = (value?: string) => {
  if (!value) return 'USD';
  const normalized = String(value).toUpperCase().trim();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'USD';
};

const normalizeTransitDays = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const matched = value.match(/(\d+)/);
    if (matched) {
      const parsed = Number(matched[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
};

const normalizeReliability = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
};

const normalizeAmount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const normalizeRate = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const isSystemBalancingCharge = (note: unknown) => {
  if (typeof note !== 'string') return false;
  const normalized = note.trim().toLowerCase();
  return normalized === 'unitemized surcharges' || normalized === 'bundle discount adjustment';
};

const getOptionDisplayName = (optionRow: any, fallbackIndex: number) => {
  const optionName = typeof optionRow?.option_name === 'string' ? optionRow.option_name.trim() : '';
  if (optionName) return optionName;
  const serviceType = typeof optionRow?.service_type === 'string' ? optionRow.service_type.trim() : '';
  if (serviceType) return `${serviceType} Option`;
  return `Option ${fallbackIndex + 1}`;
};

const getMissingComparisonFields = (option: any) => {
  const missingFields: string[] = [];
  if (!option.option_name) missingFields.push('option_name');
  if (!Number.isFinite(Number(option.total_amount)) || Number(option.total_amount) < 0) missingFields.push('option_amount');
  if (!Array.isArray(option.charges) || option.charges.length === 0) {
    missingFields.push('charges');
  } else {
    const hasAmount = option.charges.some((charge: any) => Number.isFinite(Number(charge.amount)));
    const hasRate = option.charges.some((charge: any) => Number.isFinite(Number(charge.rate)));
    if (!hasAmount) missingFields.push('charge_amount');
    if (!hasRate) missingFields.push('interest_rates');
  }
  return missingFields;
};

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVersionId = searchParams.get('versionId');
  const urlOptionId = searchParams.get('optionId');
  const { supabase, context, scopedDb } = useCRM();
  const debug = useDebug('Sales', 'QuoteDetail');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(urlVersionId || null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [showSaveVersion, setShowSaveVersion] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [comparisonOptions, setComparisonOptions] = useState<any[]>([]);
  const [selectedComparisonOptionId, setSelectedComparisonOptionId] = useState<string | null>(urlOptionId || null);
  const [selectionSaving, setSelectionSaving] = useState(false);
  const versionAbortRef = useRef<AbortController | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setSelectedComparisonOptionId(urlOptionId || null);
  }, [urlOptionId]);

  // Load configuration
  useEffect(() => {
    if (context.tenantId) {
      new QuotationConfigurationService(supabase).getConfiguration(context.tenantId).then(setConfig);
    }
  }, [context.tenantId]);

  // Load comparison options if multi-option enabled
  useEffect(() => {
    if (versionId) {
        // Clear previous options to avoid stale data during version switch
        setComparisonOptions([]);
        
        const fetchOptions = async () => {
          const startedAt = Date.now();
          const { data: optionRows, error } = await scopedDb
            .from('quotation_version_options')
            .select('*')
            .eq('quotation_version_id', versionId);

          if (error) {
            logger.error('Error fetching comparison options', { versionId, error: error.message });
            return;
          }

          if (!optionRows || optionRows.length === 0) {
            setComparisonOptions([]);
            return;
          }

          const carrierIds = new Set<string>();
          const carrierRateIds = new Set<string>();
          const currencyIds = new Set<string>();
          const optionIds = new Set<string>();
          const chargeCategoryIds = new Set<string>();

          optionRows.forEach((opt: any) => {
            if (opt?.id) optionIds.add(opt.id);
            if (opt?.carrier_id) carrierIds.add(opt.carrier_id);
            if (opt?.carrier_rate_id) carrierRateIds.add(opt.carrier_rate_id);
            if (opt?.currency_id) currencyIds.add(opt.currency_id);
          });

          const carrierRatesMap: Record<string, any> = {};
          if (carrierRateIds.size > 0) {
            const { data: rates } = await scopedDb
              .from('carrier_rates')
              .select('id, currency, carrier_id')
              .in('id', Array.from(carrierRateIds));

            rates?.forEach((rate: any) => {
              carrierRatesMap[rate.id] = rate;
              if (rate?.carrier_id) carrierIds.add(rate.carrier_id);
            });
          }

          const carriersMap: Record<string, any> = {};
          if (carrierIds.size > 0) {
            const { data: carriers } = await scopedDb
              .from('carriers')
              .select('id, carrier_name')
              .in('id', Array.from(carrierIds));

            carriers?.forEach((carrier: any) => {
              carriersMap[carrier.id] = carrier;
            });
          }

          const chargesByOptionId: Record<string, any[]> = {};
          const optionLegsByOptionId: Record<string, any[]> = {};
          if (optionIds.size > 0) {
            const { data: chargeRows, error: chargeError } = await scopedDb
              .from('quote_charges')
              .select('id, quote_option_id, category_id, amount, rate, currency_id, note, sort_order')
              .in('quote_option_id', Array.from(optionIds));

            if (chargeError) {
              logger.error('Error fetching option charges', { versionId, error: chargeError.message });
            }

            chargeRows?.forEach((charge: any) => {
              if (charge?.currency_id) currencyIds.add(charge.currency_id);
              if (charge?.category_id) chargeCategoryIds.add(charge.category_id);
              const optionId = String(charge?.quote_option_id || '');
              if (!optionId) return;
              if (!chargesByOptionId[optionId]) chargesByOptionId[optionId] = [];
              chargesByOptionId[optionId].push(charge);
            });

            const { data: legRows, error: legError } = await scopedDb
              .from('quotation_version_option_legs')
              .select('id, quotation_version_option_id, provider_id, carrier_name, transit_time_hours, sort_order')
              .in('quotation_version_option_id', Array.from(optionIds));

            if (legError) {
              logger.error('Error fetching option legs', { versionId, error: legError.message });
            }

            legRows?.forEach((leg: any) => {
              if (leg?.provider_id) carrierIds.add(leg.provider_id);
              const optionId = String(leg?.quotation_version_option_id || '');
              if (!optionId) return;
              if (!optionLegsByOptionId[optionId]) optionLegsByOptionId[optionId] = [];
              optionLegsByOptionId[optionId].push(leg);
            });

            const missingCarrierIds = Array.from(carrierIds).filter((carrierId) => !carriersMap[carrierId]);
            if (missingCarrierIds.length > 0) {
              const { data: moreCarriers } = await scopedDb
                .from('carriers')
                .select('id, carrier_name')
                .in('id', missingCarrierIds);
              moreCarriers?.forEach((carrier: any) => {
                carriersMap[carrier.id] = carrier;
              });
            }
          }

          const currenciesMap: Record<string, any> = {};
          if (currencyIds.size > 0) {
            const { data: currencies } = await scopedDb
              .from('currencies')
              .select('id, code')
              .in('id', Array.from(currencyIds));

            currencies?.forEach((currencyRow: any) => {
              currenciesMap[currencyRow.id] = currencyRow;
            });
          }

          const chargeCategoriesMap: Record<string, string> = {};
          if (chargeCategoryIds.size > 0) {
            const { data: categories } = await scopedDb
              .from('charge_categories')
              .select('id, name')
              .in('id', Array.from(chargeCategoryIds));

            categories?.forEach((category: any) => {
              chargeCategoriesMap[category.id] = category.name;
            });
          }

          const rankableOptions = optionRows
            .filter((opt: any) => typeof opt?.id === 'string' && opt.id.length > 0)
            .map((opt: any, index: number) => {
              const optionLegs = (optionLegsByOptionId[opt.id] || [])
                .sort((a: any, b: any) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
              const carrierRate = opt.carrier_rate_id ? carrierRatesMap[opt.carrier_rate_id] : null;
              const optionCarrierName = typeof opt?.carrier_name === 'string' ? opt.carrier_name.trim() : '';
              let carrierName = optionCarrierName || carriersMap[opt.provider_id]?.carrier_name;
              if (!carrierName && carrierRate?.carrier_id) {
                carrierName = carriersMap[carrierRate.carrier_id]?.carrier_name;
              }
              if (!carrierName) {
                const legCarrierName = optionLegs
                  .map((leg: any) => {
                    const explicitName = typeof leg?.carrier_name === 'string' ? leg.carrier_name.trim() : '';
                    if (explicitName) return explicitName;
                    if (leg?.provider_id) return carriersMap[leg.provider_id]?.carrier_name || '';
                    return '';
                  })
                  .find((value: string) => value.length > 0);
                if (legCarrierName) carrierName = legCarrierName;
              }
              if (!carrierName) carrierName = 'Unknown Carrier';
              const transitTimeFromLegs = optionLegs
                .map((leg: any) => {
                  const transitHours = Number(leg?.transit_time_hours);
                  if (!Number.isFinite(transitHours) || transitHours <= 0) return null;
                  return Math.max(1, Math.round(transitHours / 24));
                })
                .filter((value: number | null): value is number => typeof value === 'number')
                .reduce((sum: number, value: number) => sum + value, 0);
              const transitTime = normalizeTransitDays(opt.total_transit_days)
                ?? normalizeTransitDays(opt.transit_days)
                ?? normalizeTransitDays(opt.transit_time)
                ?? (transitTimeFromLegs > 0 ? transitTimeFromLegs : null);
              const currencyCode = currenciesMap[opt.currency_id]?.code;
              const currency = normalizeCurrencyCode(currencyCode || opt.currency || carrierRate?.currency);
              const storedTotalAmount = normalizeAmount(opt.total_amount ?? opt.sell_subtotal);
              const rawCharges = chargesByOptionId[opt.id] || [];
              const charges = rawCharges
                .map((charge: any) => {
                  const chargeCurrencyCode = charge?.currency_id ? currenciesMap[charge.currency_id]?.code : null;
                  return {
                    id: String(charge.id),
                    name: chargeCategoriesMap[charge.category_id] || 'Charge',
                    amount: normalizeAmount(charge.amount),
                    rate: normalizeRate(charge.rate),
                    currency: normalizeCurrencyCode(chargeCurrencyCode || currency),
                    note: typeof charge?.note === 'string' ? charge.note : null,
                    sort_order: Number.isFinite(Number(charge?.sort_order)) ? Number(charge.sort_order) : 0,
                  };
                })
                .sort((a, b) => a.sort_order - b.sort_order);
              const composerCharges = charges.filter((charge: any) => !isSystemBalancingCharge(charge.note));
              const optionName = getOptionDisplayName(opt, index);
              const rateValues = composerCharges.map((charge: any) => charge.rate).filter((rate: any) => typeof rate === 'number');
              const averageRate = rateValues.length > 0
                ? Number((rateValues.reduce((sum: number, rate: number) => sum + rate, 0) / rateValues.length).toFixed(2))
                : null;
              const chargesTotal = Number(
                composerCharges.reduce((sum: number, charge: any) => sum + normalizeAmount(charge.amount), 0).toFixed(2)
              );
              const totalAmount = chargesTotal > 0
                ? chargesTotal
                : (storedTotalAmount > 0 ? storedTotalAmount : 0);
              const reliabilitySource = typeof opt?.reliability_score === 'number'
                ? opt.reliability_score
                : opt?.rank_details?.reliability_score;
              const reliabilityScore = normalizeReliability(reliabilitySource);
              const optionData = {
                ...opt,
                option_name: optionName,
                carrier_name: carrierName,
                total_amount: totalAmount,
                currency,
                transit_time_days: transitTime,
                reliability_score: reliabilityScore,
                charges: composerCharges,
                charges_total: chargesTotal,
                average_rate: averageRate,
              };
              const missing_fields = getMissingComparisonFields(optionData);
              if (storedTotalAmount <= 0 && chargesTotal > 0) {
                logger.warn('Comparison option total amount recovered from charge sum', {
                  versionId,
                  optionId: opt.id,
                  storedTotalAmount,
                  chargesTotal,
                });
              }
              if (charges.length !== composerCharges.length) {
                logger.warn('Excluded system balancing charges from comparison totals', {
                  versionId,
                  optionId: opt.id,
                  excludedCharges: charges.length - composerCharges.length,
                });
              }
              if (carrierName === 'Unknown Carrier') {
                logger.warn('Comparison option missing carrier mapping', {
                  versionId,
                  optionId: opt.id,
                  carrier_rate_id: opt?.carrier_rate_id || null,
                  optionCarrierName: optionCarrierName || null,
                });
              }
              if (missing_fields.length > 0) {
                logger.warn('Comparison option data incomplete', {
                  versionId,
                  optionId: opt.id,
                  missingFields: missing_fields,
                });
              }

              return {
                ...optionData,
                missing_fields,
                data_completeness: {
                  is_complete: missing_fields.length === 0,
                  missing_fields,
                },
              };
            });

          const criteria = config?.auto_ranking_criteria || DEFAULT_RANKING_CRITERIA;
          const ranked = QuotationRankingService.rankOptions(rankableOptions, criteria);
          
          setComparisonOptions(ranked);
          const selected = ranked.find((opt: any) => opt.id === urlOptionId)
            || ranked.find((opt: any) => opt.is_selected)
            || ranked[0];
          const selectedId = selected?.id ?? null;
          setSelectedComparisonOptionId(selectedId);
          if (selectedId && urlOptionId !== selectedId) {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('optionId', selectedId);
              return next;
            }, { replace: true });
          }
          logger.info('Loaded comparison options', {
            versionId,
            optionsCount: ranked.length,
            incompleteOptionsCount: ranked.filter((opt: any) => !opt?.data_completeness?.is_complete).length,
            durationMs: Date.now() - startedAt,
          });
        };

        fetchOptions();
    }
  }, [versionId, config, scopedDb, setSearchParams, urlOptionId]);

  useEffect(() => {
    // Reset state when ID changes to prevent data mismatch during transition
    setResolvedId(null);
    setVersionId(null);
    setTenantId(null);
    setQuoteNumber(null);
    setComparisonOptions([]);
    setLoading(true);

    const checkQuote = async () => {
      setError(null);
      if (!id) {
        setError('Missing quote identifier');
        setLoading(false);
        return;
      }
      debug.info('Resolving quote', { id });

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let lastError: unknown = null;

      for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) {
        const attempt = i + 1;
        try {
          let query = scopedDb
            .from('quotes')
            .select('id, tenant_id, quote_number');

          if (isUuid) {
            query = query.or(`id.eq.${id},quote_number.eq.${id}`);
          } else {
            query = query.eq('quote_number', id);
          }

          const { data, error } = await query
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error('Quote not found');

          logger.info('Quote resolved', { id, resolvedId: (data as any)?.id, attempt });
          setResolvedId((data as any)?.id ?? null);
          setTenantId((data as any)?.tenant_id ?? null);
          setQuoteNumber((data as any)?.quote_number ?? null);
          return;
        } catch (err: any) {
          lastError = err;
          logger.error('Quote resolution attempt failed', {
            id,
            attempt,
            maxAttempts: RETRY_DELAYS_MS.length,
            error: err?.message || String(err),
          });
          const shouldRetry = i < RETRY_DELAYS_MS.length - 1 && isRetryableError(err);
          if (shouldRetry) {
            await wait(RETRY_DELAYS_MS[i + 1]);
            continue;
          }
        }
      }

      const message = lastError instanceof Error ? lastError.message : 'Failed to load quote';
      debug.error('Failed to load quote', { error: message });
      setError(message);
      setLoading(false);
    };
    checkQuote();
  }, [id, reloadToken, scopedDb, debug]);

  useEffect(() => {
    const loadLatestVersion = async () => {
      if (!resolvedId) return;
      
      debug.info('Loading version', { quoteId: resolvedId, urlVersionId });
      
      try {
        if (versionAbortRef.current) versionAbortRef.current.abort();
        versionAbortRef.current = new AbortController();
        const signal = versionAbortRef.current.signal;

        // If URL has versionId, try to load that specific version first
        if (urlVersionId) {
          const { data: v, error: vError } = await scopedDb
            .from('quotation_versions')
            .select('id, version_number, tenant_id')
            .eq('id', urlVersionId)
            .maybeSingle()
            .abortSignal(signal);

          if (!vError && v) {
            debug.log('Found requested version', { versionId: v.id });
            setVersionId(String(v.id));
            if (!tenantId && v.tenant_id) {
               setTenantId(v.tenant_id);
            }
            setLoading(false);
            return;
          } else {
             debug.warn('Requested version not found or error, falling back to latest', { urlVersionId, error: vError });
          }
        }

        const { data, error } = await (scopedDb
          .from('quotation_versions')
          .select('id, version_number, tenant_id') as any)
          .eq('quote_id', resolvedId)
          .order('version_number', { ascending: false })
          .limit(1)
          .abortSignal(signal);
        
        if (error) {
          debug.error('Error querying versions', error);
          throw error;
        }
        
        if (Array.isArray(data) && data.length && (data[0] as any)?.id) {
          const v = data[0] as any;
          debug.log('Found existing version', { versionId: v.id });
          setVersionId(String(v.id));
          if (!tenantId && v.tenant_id) {
             debug.log('Resolved tenant from version', v.tenant_id);
             setTenantId(v.tenant_id);
          }
          setLoading(false);
          return;
        }
        
        // Create initial version only if none exists
        debug.log('No version found, creating version 1');
        
        let finalTenantId = tenantId;
        if (!finalTenantId) {
          // Fallback: fetch tenant from quote if not already set
          const { data: qRow, error: qError } = await scopedDb
            .from('quotes')
            .select('tenant_id')
            .eq('id', resolvedId)
            .maybeSingle()
            .abortSignal(signal);
          
          if (qError) {
            console.error('[QuoteDetail] Error fetching quote tenant:', qError);
          }
          
          finalTenantId = (qRow as any)?.tenant_id ?? null;
          if (finalTenantId) {
            setTenantId(finalTenantId);
          }
        }
        
        if (!finalTenantId) {
          finalTenantId = context.tenantId;
        }

        if (!finalTenantId) {
          const { data: { user } } = await supabase.auth.getUser();
          finalTenantId = user?.user_metadata?.tenant_id;
        }
        
        if (!finalTenantId) {
          throw new Error('Cannot create version: no tenant_id available');
        }
        
        // Use upsert with ignoreDuplicates to handle race conditions safely
        // This prevents "duplicate key value violates unique constraint" errors
        const { data: v, error: upsertError } = await scopedDb
          .from('quotation_versions')
          .upsert({ 
            quote_id: resolvedId, 
            tenant_id: finalTenantId, 
            version_number: 1,
            major: 1, 
            minor: 0,
            status: 'draft',
            kind: 'major' 
          }, { 
            onConflict: 'quote_id, version_number', 
            ignoreDuplicates: true 
          })
          .select('id')
          .maybeSingle()
          .abortSignal(signal);
        
        if (upsertError) {
          debug.error('Error creating version:', upsertError);
          throw upsertError;
        }
        
        if ((v as any)?.id) {
          debug.log('Created version:', (v as any).id);
          setVersionId(String((v as any).id));
        } else {
          // If v is null, it means the row already exists (ignoreDuplicates triggered)
          // So we fetch the existing version
          debug.log('Version already exists, fetching...');
          const { data: existing } = await supabase
            .from('quotation_versions')
            .select('id')
            .eq('quote_id', resolvedId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle()
            .abortSignal(signal);
            
          if ((existing as any)?.id) {
             setVersionId(String((existing as any).id));
          } else {
             throw new Error('Failed to retrieve existing version after conflict');
          }
        }
        setLoading(false);
      } catch (error: any) {
        const msg = error?.message ? String(error.message).toLowerCase() : '';
        if (error?.name === 'AbortError' || msg.includes('aborted')) return;
        logger.error('Quote version load failed', {
          resolvedId,
          urlVersionId,
          error: error?.message || String(error),
        });
        setError(error.message || 'Failed to load quotation version');
        setLoading(false);
      }
    };
    
    loadLatestVersion();
    return () => {
      if (versionAbortRef.current) versionAbortRef.current.abort();
    };
  }, [resolvedId, urlVersionId, tenantId, context.tenantId, scopedDb, supabase, debug]);

  const handleSaveVersion = async (type: 'minor' | 'major', reason: string) => {
    if (!resolvedId) return;
    
    // Client-side integrity check: Ensure session exists
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        toast.error('No active session. Please sign in again.');
        return;
    }

    try {
      const { error } = await supabase.functions.invoke('save-quotation-version', {
        body: {
          quoteId: resolvedId,
          type,
          reason
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error) throw error;
      toast.success('Version saved successfully');
      setVersionId(prev => prev + '_new'); // Force refresh
    } catch (err: any) {
      console.error('Failed to save version:', err);
      toast.error('Failed to save version');
    }
  };

  const handleRestoreVersion = async (vId: string) => {
    if (!confirm('Are you sure you want to restore this version? This will overwrite the current quote data.')) {
        return;
    }

    try {
        const { error } = await supabase.functions.invoke('restore-quotation-version', {
            body: { versionId: vId }
        });

        if (error) throw error;
        toast.success('Version restored successfully');
        
        // Reload page or force refresh context to show restored data
        // For now, simple reload to ensure clean state
        window.location.reload();
    } catch (err: any) {
        console.error('Failed to restore version:', err);
        toast.error('Failed to restore version');
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setReloadToken((v) => v + 1);
  };

  const persistSelectedOption = async (nextOptionId: string) => {
    if (!versionId) return;
    const clearResult = await scopedDb
      .from('quotation_version_options')
      .update({ is_selected: false })
      .eq('quotation_version_id', versionId)
      .neq('id', nextOptionId);
    if (clearResult.error) {
      throw new Error(clearResult.error.message);
    }

    const selectResult = await scopedDb
      .from('quotation_version_options')
      .update({ is_selected: true })
      .eq('id', nextOptionId)
      .eq('quotation_version_id', versionId);
    if (selectResult.error) {
      throw new Error(selectResult.error.message);
    }
  };

  const handleSelectComparisonOption = async (nextOptionId: string) => {
    if (selectionSaving) return;
    const nextOption = comparisonOptions.find((option) => option.id === nextOptionId);
    if (!nextOption) {
      toast.error('Selected option is unavailable');
      return;
    }
    if (!nextOption?.data_completeness?.is_complete) {
      toast.error('Selected option has incomplete comparison data');
    }
    if (selectedComparisonOptionId === nextOptionId) {
      return;
    }

    const previousSelected = selectedComparisonOptionId;
    const previousOptions = comparisonOptions;
    setSelectionSaving(true);
    setSelectedComparisonOptionId(nextOptionId);
    setComparisonOptions((prev) => prev.map((opt) => ({ ...opt, is_selected: opt.id === nextOptionId })));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('optionId', nextOptionId);
      return next;
    }, { replace: true });

    try {
      await persistSelectedOption(nextOptionId);
      toast.success('Option selected');
    } catch (selectionError: any) {
      logger.error('Failed persisting selected option', {
        versionId,
        optionId: nextOptionId,
        error: selectionError?.message || String(selectionError),
      });
      setSelectedComparisonOptionId(previousSelected || null);
      setComparisonOptions(previousOptions);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (previousSelected) {
          next.set('optionId', previousSelected);
        } else {
          next.delete('optionId');
        }
        return next;
      }, { replace: true });
      toast.error('Failed to update selected option');
    } finally {
      setSelectionSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-muted-foreground">Loading quotation details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-2xl mx-auto">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-destructive/20 p-2 rounded-full">
                        <CloudOff className="w-6 h-6 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-destructive">Failed to Load Quotation</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    {error}
                </p>
                <div className="flex space-x-4">
                    <Button onClick={handleRetry}>
                        Retry
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/dashboard/quotes')}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DetailScreenTemplate
        title={`Edit Quote: ${quoteNumber ?? id}`}
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Quotes', to: '/dashboard/quotes' },
          { label: quoteNumber ?? (id || 'Detail') },
        ]}
        actions={
          resolvedId && (
            <>
              <Button 
                  variant="outline" 
                  onClick={() => setShowSaveVersion(true)}
              >
                  Save Version
              </Button>
              <Button 
                  variant="outline" 
                  onClick={() => navigate(`/dashboard/bookings/new?quoteId=${resolvedId}`)}
                  data-testid="convert-booking-btn"
              >
                  Convert to Booking
              </Button>
              <QuotePreviewModal 
                quoteId={resolvedId} 
                quoteNumber={quoteNumber ?? (resolvedId ?? '')} 
                versionId={versionId || undefined}
              />
              <ShareQuoteDialog quoteId={resolvedId} quoteNumber={quoteNumber ?? (resolvedId ?? '')} />
              <SendQuoteDialog 
                  quoteId={resolvedId} 
                  quoteNumber={quoteNumber ?? (resolvedId ?? '')} 
                  versionId={versionId || ''}
              />
            </>
          )
        }
      >
        <div className="space-y-6">
          {config?.multi_option_enabled && comparisonOptions.length > 0 && (
            <QuotationComparisonDashboard 
              options={comparisonOptions}
              selectedOptionId={selectedComparisonOptionId}
              onSelect={handleSelectComparisonOption}
            />
          )}
          
          {resolvedId ? (
            <>
              <UnifiedQuoteComposer
                  key={resolvedId} // Force re-mount when quote changes
                  quoteId={resolvedId}
                  versionId={versionId || undefined}
              />
              <QuotationVersionHistory 
                  quoteId={resolvedId} 
                  key={versionId} // Force reload when version is resolved/created
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading quote details...</p>
            </div>
          )}
          <VersionHistoryPanel
            quoteId={resolvedId ?? (id as string)}
            onRestore={handleRestoreVersion}
          />
        </div>
        
        <SaveVersionDialog
          open={showSaveVersion}
          onOpenChange={setShowSaveVersion}
          onSave={handleSaveVersion}
        />
      </DetailScreenTemplate>
    </DashboardLayout>
  );
}

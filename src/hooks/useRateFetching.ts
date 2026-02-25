import { useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { PricingService } from '@/services/pricing.service';
import { generateSimulatedRates } from '@/lib/simulation-engine';
import { formatContainerSize } from '@/lib/container-utils';
import { RateOption } from '@/types/quote-breakdown';
import { logger } from '@/lib/logger';

// --- Sorting / Selection helpers ---

const getTransitDaysFromString = (value?: string) => {
  if (!value) return 999;
  const match = value.match(/(\d+)/);
  if (!match) return 999;
  const days = parseInt(match[1], 10);
  return isNaN(days) ? 999 : days;
};

const getCo2FromOption = (option: RateOption) => {
  if (typeof option.co2_kg === 'number' && !isNaN(option.co2_kg)) return option.co2_kg;
  const raw = option.environmental?.co2_emissions;
  if (!raw) return Number.POSITIVE_INFINITY;
  const match = String(raw).match(/(\d+(\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const val = parseFloat(match[1]);
  return isNaN(val) ? Number.POSITIVE_INFINITY : val;
};

const selectMarketTrendOptions = (options: RateOption[]): RateOption[] => {
  if (!options || options.length === 0) return [];
  const byId = new Map<string, RateOption>();
  options.forEach(opt => {
    if (opt?.id && !byId.has(opt.id)) byId.set(opt.id, opt);
  });
  const unique = Array.from(byId.values());
  if (unique.length === 0) return [];

  const cheapest = [...unique].sort((a, b) => (a.price || 0) - (b.price || 0))[0];
  const fastest = [...unique].sort((a, b) => getTransitDaysFromString(a.transitTime) - getTransitDaysFromString(b.transitTime))[0];
  const greenest = [...unique].sort((a, b) => getCo2FromOption(a) - getCo2FromOption(b))[0];

  const picked: RateOption[] = [];
  const pushUnique = (opt?: RateOption) => {
    if (opt && !picked.some(p => p.id === opt.id)) picked.push(opt);
  };
  pushUnique(cheapest);
  pushUnique(fastest);
  pushUnique(greenest);

  if (picked.length < 3) {
    const sorted = [...unique].sort((a, b) => (a.price || 0) - (b.price || 0));
    for (const opt of sorted) {
      if (picked.length >= 3) break;
      if (!picked.some(p => p.id === opt.id)) picked.push(opt);
    }
  }
  return picked.slice(0, 3);
};

const rankAiOptions = (options: RateOption[], preferredCarriers: string[]): RateOption[] => {
  if (!options || options.length === 0) return [];
  const preferredSet = new Set((preferredCarriers || []).map(name => String(name || '').toLowerCase()));
  return [...options].sort((a, b) => {
    const aPreferred = preferredSet.has(String(a.carrier || '').toLowerCase());
    const bPreferred = preferredSet.has(String(b.carrier || '').toLowerCase());
    if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
    const aBest = String(a.tier || '') === 'best_value';
    const bBest = String(b.tier || '') === 'best_value';
    if (aBest !== bBest) return aBest ? -1 : 1;
    const priceDiff = (a.price || 0) - (b.price || 0);
    if (priceDiff !== 0) return priceDiff;
    const transitDiff = getTransitDaysFromString(a.transitTime) - getTransitDaysFromString(b.transitTime);
    if (transitDiff !== 0) return transitDiff;
    return (b.reliability?.score || 0) - (a.reliability?.score || 0);
  });
};

// --- Types ---

export interface ContainerCombo {
  type: string;
  size: string;
  qty: number;
}

export interface RateFetchParams {
  mode: string;
  origin: string;
  destination: string;
  commodity: string;
  weight?: string;
  volume?: string;
  containerType?: string;
  containerSize?: string;
  containerQty?: string;
  containerCombos?: ContainerCombo[];
  preferredCarriers?: string[];
  smartMode?: boolean;
  vehicleType?: string;
  account_id?: string;
  // pass-through fields for the rate engine
  [key: string]: any;
}

export interface ContainerResolver {
  resolveContainerInfo: (typeId: string, sizeId: string) => { type: string; size: string; iso_code?: string };
}

export interface RateFetchingResult {
  results: RateOption[] | null;
  loading: boolean;
  error: string | null;
  marketAnalysis: string | null;
  confidenceScore: number | null;
  anomalies: string[];
  fetchRates: (params: RateFetchParams, containerResolver: ContainerResolver) => Promise<RateOption[]>;
  clearResults: () => void;
}

export function useRateFetching(): RateFetchingResult {
  const [results, setResults] = useState<RateOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [anomalies, setAnomalies] = useState<string[]>([]);

  const { supabase, context } = useCRM();
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setMarketAnalysis(null);
    setConfidenceScore(null);
    setAnomalies([]);
  }, []);

  const fetchRates = useCallback(async (params: RateFetchParams, containerResolver: ContainerResolver): Promise<RateOption[]> => {
    setLoading(true);
    setResults(null);
    setError(null);
    setMarketAnalysis(null);
    setConfidenceScore(null);
    setAnomalies([]);

    const { preferredCarriers = [], smartMode = true, ...payload } = params;

    try {
      // Build container combos
      const combos: ContainerCombo[] =
        (payload.mode === 'ocean' || payload.mode === 'rail') && payload.containerCombos && payload.containerCombos.length > 0
          ? payload.containerCombos
          : [{ type: payload.containerType || '', size: payload.containerSize || '', qty: Number(payload.containerQty) || 1 }];

      // 1. Fire legacy rate-engine per combo + AI advisor in parallel
      const legacyPromises = combos.map(c => {
        const { type: typeName, size: sizeName } = containerResolver.resolveContainerInfo(c.type, c.size);
        return supabase.functions.invoke('rate-engine', {
          body: {
            ...payload,
            containerType: typeName,
            containerSize: sizeName,
            containerQty: String(c.qty),
            containerTypeId: c.type,
            containerSizeId: c.size,
          },
        });
      });

      const aiPromise = smartMode
        ? invokeAiAdvisor({ action: 'generate_smart_quotes', payload })
        : Promise.resolve({ data: null, error: null });

      const [legacyResList, aiRes] = await Promise.all([Promise.all(legacyPromises), aiPromise]);

      const pricingService = new PricingService(supabase);

      let combinedOptions: RateOption[] = [];
      let legacyOptionsAll: RateOption[] = [];
      let legacyErrorMsg = '';

      // 2. Process legacy results per combo
      for (let i = 0; i < legacyResList.length; i++) {
        const legacyRes = legacyResList[i] as any;
        const combo = combos[i];
        let rawOptions = legacyRes.data?.options || [];

        if (legacyRes.error || !rawOptions.length) {
          if (legacyRes.error) {
            logger.warn(`[useRateFetching] Legacy rate engine failed for combo ${i}:`, legacyRes.error);
            legacyErrorMsg += `${legacyRes.error.message || 'Fetch Failed'}; `;
          }
          // Simulation fallback
          const { type: typeName, size: sizeName } = containerResolver.resolveContainerInfo(combo.type, combo.size);
          rawOptions = generateSimulatedRates({
            mode: payload.mode as any,
            origin: payload.origin,
            destination: payload.destination,
            weightKg: Number(payload.weight) || undefined,
            containerQty: combo.qty,
            containerSize: sizeName,
            vehicleType: payload.vehicleType,
          });
        }

        if (rawOptions.length > 0) {
          const { size: sizeName } = containerResolver.resolveContainerInfo(combo.type, combo.size);
          let legacyOptions = await Promise.all(
            rawOptions.map(async (opt: any) => {
              const mapped = mapOptionToQuote(opt);
              const qty = combo.qty || 1;
              const sell = (mapped.total_amount || 0) * qty;
              const calc = await pricingService.calculateFinancials(sell, 15, false);
              let markupPercent = 0;
              if (calc.buyPrice > 0) {
                markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
              }
              return {
                ...mapped,
                price: sell,
                currency: mapped.currency || 'USD',
                carrier: mapped.carrier || 'Unknown Carrier',
                markupPercent,
                verified: true,
                verificationTimestamp: new Date().toISOString(),
              };
            })
          );
          legacyOptions = legacyOptions.sort((a: any, b: any) => {
            if (a.price !== b.price) return a.price - b.price;
            return getTransitDaysFromString(a.transitTime) - getTransitDaysFromString(b.transitTime);
          });
          legacyOptionsAll = [...legacyOptionsAll, ...legacyOptions];
        }
      }

      if (legacyOptionsAll.length > 0) {
        combinedOptions = [...combinedOptions, ...selectMarketTrendOptions(legacyOptionsAll)];
      }

      // 3. Process AI results
      if (smartMode) {
        if (aiRes.error) {
          let errorMsg = 'AI helper is not available in this environment. Showing standard rates only.';
          const rawMessage = String(aiRes.error.message || '');
          const lower = rawMessage.toLowerCase();
          const status = (aiRes.error as any).status;
          const isAuthError = status === 401 || status === 403 || lower.includes('unauthorized');
          if (!isAuthError && rawMessage) errorMsg = `AI Error: ${rawMessage}`;
          toast({ title: 'AI Generation Failed', description: errorMsg, variant: 'destructive' });
        } else if (aiRes.data) {
          const aiData = aiRes.data;
          if (aiData.options) {
            const aiOptionsRaw = await Promise.all(
              aiData.options.map(async (opt: any) => {
                const mapped = mapOptionToQuote(opt);
                const calc = await pricingService.calculateFinancials(mapped.total_amount, 15, false);
                let markupPercent = 0;
                if (calc.buyPrice > 0) {
                  markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
                }
                return {
                  ...mapped,
                  id: mapped.id || `ai-${Math.random().toString(36).substr(2, 9)}`,
                  source_attribution: 'AI Smart Engine',
                  carrier: mapped.carrier_name,
                  price: mapped.total_amount,
                  currency: mapped.currency || 'USD',
                  name: mapped.option_name,
                  transitTime: mapped.transit_time?.details,
                  co2_kg: mapped.total_co2_kg,
                  legs: mapped.legs,
                  charges: mapped.charges,
                  buyPrice: calc.buyPrice,
                  marginAmount: calc.marginAmount,
                  marginPercent: calc.marginPercent,
                  markupPercent,
                };
              })
            );
            const rankedAi = rankAiOptions(aiOptionsRaw as RateOption[], preferredCarriers);
            combinedOptions = [...combinedOptions, ...rankedAi.slice(0, 5)];
            setMarketAnalysis(aiData.market_analysis);
            setConfidenceScore(aiData.confidence_score);
            setAnomalies(aiData.anomalies || []);
          }
        }
      }

      // 4. Unconditional simulation fallback if no results at all
      if (combinedOptions.length === 0) {
        const { type: typeName, size: sizeName } = containerResolver.resolveContainerInfo(
          payload.containerType || '',
          payload.containerSize || ''
        );
        const simulated = generateSimulatedRates({
          mode: payload.mode as any,
          origin: payload.origin,
          destination: payload.destination,
          weightKg: Number(payload.weight) || undefined,
          containerQty: Number(payload.containerQty) || 1,
          containerSize: sizeName,
          vehicleType: payload.vehicleType,
        });

        if (simulated.length > 0) {
          let simOptions = await Promise.all(
            simulated.map(async (opt: any) => {
              const mapped = mapOptionToQuote(opt);
              const sell = mapped.total_amount || 0;
              const calc = await pricingService.calculateFinancials(sell, 15, false);
              let markupPercent = 0;
              if (calc.buyPrice > 0) {
                markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
              }
              return {
                ...mapped,
                price: sell,
                currency: mapped.currency || 'USD',
                carrier: mapped.carrier || 'Unknown Carrier',
                markupPercent,
                verified: true,
                verificationTimestamp: new Date().toISOString(),
              };
            })
          );
          simOptions = simOptions.sort((a: any, b: any) => a.price - b.price).slice(0, 3);
          combinedOptions = [...combinedOptions, ...simOptions];
          toast({
            title: 'Showing Simulated Rates',
            description: 'Legacy and AI engines were unavailable. Displaying simulated market rates.',
          });
        } else {
          const aiError = aiRes.error ? (aiRes.error.message || 'Unknown AI Error') : 'No Data';
          throw new Error(`No quotes available. Legacy: ${legacyErrorMsg || 'No Data'}. AI: ${aiError}`);
        }
      }

      setResults(combinedOptions);

      // 5. Save to history
      try {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (authUser && context?.tenantId) {
          const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
          const userId = String(authUser.id);
          const tenantId = String(context.tenantId);
          if (isUUID(userId) && isUUID(tenantId)) {
            await supabase.from('ai_quote_requests').insert({
              user_id: userId,
              tenant_id: tenantId,
              request_payload: payload,
              response_payload: {
                options: combinedOptions,
                market_analysis: smartMode && aiRes?.data?.market_analysis ? aiRes.data.market_analysis : null,
                confidence_score: smartMode && aiRes?.data?.confidence_score ? aiRes.data.confidence_score : null,
                anomalies: smartMode && aiRes?.data?.anomalies ? aiRes.data.anomalies : [],
              },
              status: 'generated',
            });
          }
        }
      } catch (err) {
        logger.error('[useRateFetching] Failed to save history:', err);
      }

      return combinedOptions;
    } catch (err: any) {
      const message = err.message || 'Failed to calculate rates.';
      setError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return [];
    } finally {
      setLoading(false);
    }
  }, [supabase, context, invokeAiAdvisor, toast]);

  return {
    results,
    loading,
    error,
    marketAnalysis,
    confidenceScore,
    anomalies,
    fetchRates,
    clearResults,
  };
}

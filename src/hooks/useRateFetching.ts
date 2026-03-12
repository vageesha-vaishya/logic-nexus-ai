import { useState, useCallback, useMemo, useRef } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { PricingService } from '@/services/pricing.service';
import { generateSimulatedRates } from '@/lib/simulation-engine';
import { formatContainerSize } from '@/lib/container-utils';
import { RateOption } from '@/types/quote-breakdown';
import { logger } from '@/lib/logger';
import { buildHybridRouteConfiguration, type RealtimeCarrierValidationRequest, type RealtimeCarrierValidationResult } from '@/services/quotation/hybrid-route-configuration';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { HybridRouteMetricsService, type QuoteGenerationStage } from '@/services/quotation/HybridRouteMetricsService';

import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';

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

const normalizeLocationValue = (value: unknown): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'origin') return '';
  if (normalized.toLowerCase() === 'destination') return '';
  return normalized;
};

const ORIGIN_LOCATION_KEYS = [
  'origin',
  'from',
  'origin_name',
  'origin_location_name',
  'origin_port',
  'origin_airport',
  'origin_station',
  'origin_city',
  'origin_terminal',
  'pickup',
  'pickup_location',
  'pickup_address',
  'pickup_city',
  'from_location',
  'from_city',
  'from_port',
  'from_airport',
  'from_station',
  'pol',
  'port_of_loading',
  'portOfLoading',
  'departure_airport',
  'departureAirport',
  'departure_station',
  'departureStation',
];

const DESTINATION_LOCATION_KEYS = [
  'destination',
  'to',
  'destination_name',
  'destination_location_name',
  'destination_port',
  'destination_airport',
  'destination_station',
  'destination_city',
  'destination_terminal',
  'delivery',
  'delivery_location',
  'delivery_address',
  'delivery_city',
  'dropoff',
  'dropoff_location',
  'dropoff_address',
  'to_location',
  'to_city',
  'to_port',
  'to_airport',
  'to_station',
  'pod',
  'port_of_discharge',
  'portOfDischarge',
  'arrival_airport',
  'arrivalAirport',
  'arrival_station',
  'arrivalStation',
];

const resolveLocationFromSources = (sources: any[], keys: string[]): string => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      const value = normalizeLocationValue(source[key]);
      if (value) return value;
    }
  }
  return '';
};

const resolveOptionLocation = (option: any, keys: string[]): string => {
  return resolveLocationFromSources(
    [
      option,
      option?.route,
      option?.locations,
      option?.location,
      option?.shipment,
      option?.request,
      option?.input,
      option?.metadata,
    ],
    keys
  );
};

const resolveLegLocation = (leg: any, keys: string[]): string => {
  return resolveLocationFromSources(
    [
      leg,
      leg?.route,
      leg?.location,
      leg?.locations,
      leg?.segment,
      leg?.shipment,
      leg?.metadata,
    ],
    keys
  );
};

const normalizeLegDate = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveCarrierName = (leg: any, option: any): string => {
  const candidates = [
    leg?.carrier_name,
    typeof leg?.carrier === 'object' ? leg?.carrier?.name : '',
    leg?.carrier,
    leg?.provider_name,
    leg?.provider?.name,
    leg?.operator_name,
    leg?.line_name,
    option?.carrier_name,
    typeof option?.carrier === 'object' ? option?.carrier?.name : '',
    option?.carrier,
    option?.name,
  ];
  for (const candidate of candidates) {
    const value =
      typeof candidate === 'object'
        ? String(candidate?.name || candidate?.label || '').trim()
        : String(candidate || '').trim();
    if (value && value.toLowerCase() !== 'unknown carrier') return value;
  }
  return 'Unknown Carrier';
};

const resolveDepartureDate = (leg: any, option: any): string => {
  const candidates = [
    leg?.departure_date,
    leg?.departureDate,
    leg?.departure,
    leg?.etd,
    leg?.estimated_departure,
    leg?.estimated_departure_date,
    leg?.departure_datetime,
    leg?.schedule?.departure,
    option?.departure_date,
    option?.departureDate,
    option?.departure,
    option?.etd,
    option?.estimated_departure,
    option?.estimated_departure_date,
    option?.schedule?.departure,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeLegDate(candidate);
    if (normalized) return normalized;
  }
  return '';
};

const fillLegContinuity = (
  legs: Array<{ origin: string; destination: string; [key: string]: any }>,
  route: { origin: string; destination: string }
) => {
  if (legs.length === 0) return legs;

  const normalizedLegs = legs.map((leg) => ({
    ...leg,
    origin: normalizeLocationValue(leg.origin),
    destination: normalizeLocationValue(leg.destination),
  }));

  if (!normalizedLegs[0].origin) normalizedLegs[0].origin = route.origin;
  if (!normalizedLegs[normalizedLegs.length - 1].destination) {
    normalizedLegs[normalizedLegs.length - 1].destination = route.destination;
  }

  for (let i = 1; i < normalizedLegs.length; i += 1) {
    if (!normalizedLegs[i].origin && normalizedLegs[i - 1].destination) {
      normalizedLegs[i].origin = normalizedLegs[i - 1].destination;
    }
  }

  for (let i = normalizedLegs.length - 2; i >= 0; i -= 1) {
    if (!normalizedLegs[i].destination && normalizedLegs[i + 1].origin) {
      normalizedLegs[i].destination = normalizedLegs[i + 1].origin;
    }
  }

  for (let i = 0; i < normalizedLegs.length; i += 1) {
    const previousDestination = i > 0 ? normalizedLegs[i - 1].destination : route.origin;
    const nextOrigin = i < normalizedLegs.length - 1 ? normalizedLegs[i + 1].origin : route.destination;
    if (!normalizedLegs[i].origin) normalizedLegs[i].origin = previousDestination || route.origin;
    if (!normalizedLegs[i].destination) normalizedLegs[i].destination = nextOrigin || route.destination;
  }

  for (let i = 0; i < normalizedLegs.length - 1; i += 1) {
    const currentDestination = normalizeLocationValue(normalizedLegs[i].destination);
    const nextOrigin = normalizeLocationValue(normalizedLegs[i + 1].origin);
    if (!currentDestination && nextOrigin) {
      normalizedLegs[i].destination = nextOrigin;
    } else if (!nextOrigin && currentDestination) {
      normalizedLegs[i + 1].origin = currentDestination;
    }
  }

  return normalizedLegs;
};

const enrichOptionRouteData = (option: any, fallbackRoute: { origin: string; destination: string }) => {
  const optionOrigin = resolveOptionLocation(option, ORIGIN_LOCATION_KEYS) || fallbackRoute.origin;
  const optionDestination = resolveOptionLocation(option, DESTINATION_LOCATION_KEYS) || fallbackRoute.destination;

  const sourceLegs = Array.isArray(option?.legs) ? option.legs : [];
  const normalizedLegs = sourceLegs.map((leg: any) => {
    const origin = resolveLegLocation(leg, ORIGIN_LOCATION_KEYS);
    const destination = resolveLegLocation(leg, DESTINATION_LOCATION_KEYS);
    return {
      ...leg,
      carrier: resolveCarrierName(leg, option),
      departure_date: resolveDepartureDate(leg, option),
      origin: origin || '',
      destination: destination || '',
      from: origin || '',
      to: destination || '',
    };
  });
  const continuityLegs = fillLegContinuity(normalizedLegs, {
    origin: optionOrigin || fallbackRoute.origin,
    destination: optionDestination || fallbackRoute.destination,
  }).map((leg) => ({
    ...leg,
    carrier: leg.carrier || resolveCarrierName(leg, option),
    departure_date: leg.departure_date || resolveDepartureDate(leg, option),
    from: leg.origin || optionOrigin || 'Origin',
    to: leg.destination || optionDestination || 'Destination',
  }));

  const legs =
    continuityLegs.length > 0
      ? continuityLegs
      : [
          {
            id: option?.id ? `${option.id}-route-leg` : `route-leg-${Date.now()}`,
            mode: option?.mode || option?.transport_mode || 'ocean',
            sequence: 1,
            leg_type: 'transport',
            carrier: option?.carrier || option?.carrier_name || 'Unknown Carrier',
            origin: optionOrigin || 'Origin',
            destination: optionDestination || 'Destination',
            from: optionOrigin || 'Origin',
            to: optionDestination || 'Destination',
            charges: Array.isArray(option?.charges) ? option.charges : [],
          },
        ];

  return {
    ...option,
    origin: optionOrigin || legs[0]?.origin || '',
    destination: optionDestination || legs[legs.length - 1]?.destination || '',
    legs,
  };
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
  const { enabled: hybridRouteEnabled } = useAppFeatureFlag(FEATURE_FLAGS.HYBRID_ROUTE_CONFIGURATION_V1, true);
  const { enabled: hybridMetricsEnabled } = useAppFeatureFlag(FEATURE_FLAGS.HYBRID_ROUTE_METRICS_DASHBOARD_V1, false);
  const metricsService = useMemo(() => new HybridRouteMetricsService(supabase), [supabase]);
  const latestRequestSeqRef = useRef(0);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setMarketAnalysis(null);
    setConfidenceScore(null);
    setAnomalies([]);
  }, []);

  const fetchRates = useCallback(async (params: RateFetchParams, containerResolver: ContainerResolver): Promise<RateOption[]> => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    setLoading(true);
    setResults(null);
    setError(null);
    setMarketAnalysis(null);
    setConfidenceScore(null);
    setAnomalies([]);

    const { preferredCarriers = [], smartMode = true, ...payload } = params;

    const requestId = `rates-${Date.now()}`;
    const requestTimestamp = new Date().toISOString();
    const requestStartAt = Date.now();
    const timeline: QuoteGenerationStage[] = [];
    const markStage = (stage: string, details?: Record<string, unknown>, optionCount?: number, unknownCarrierCount?: number, routeGapCount?: number) => {
      timeline.push({
        stage,
        elapsed_ms: Date.now() - requestStartAt,
        option_count: optionCount,
        unknown_carrier_count: unknownCarrierCount,
        route_gap_count: routeGapCount,
        details,
      });
    };
    const isStaleRequest = () => latestRequestSeqRef.current !== requestSeq;
    const routeContext = {
      origin: normalizeLocationValue(params.origin),
      destination: normalizeLocationValue(params.destination),
    };

    try {
      markStage('request_started', {
        smartMode,
        mode: params.mode,
        origin: routeContext.origin,
        destination: routeContext.destination,
      });
      logger.info('[useRateFetching] Fetch started', {
        requestId,
        requestTimestamp,
        smartMode,
        routeContext,
        mode: params.mode,
      });
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
      markStage('rate_sources_resolved', {
        legacySourceCount: legacyResList.length,
        aiAvailable: !!aiRes?.data,
        aiError: aiRes?.error ? String(aiRes.error.message || aiRes.error) : null,
      });

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
              const mapped = enrichOptionRouteData(mapOptionToQuote(opt), routeContext);
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
                is_manual: false,
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
      markStage('legacy_options_processed', {
        legacyOptionsAll: legacyOptionsAll.length,
      }, combinedOptions.length);

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
                const mapped = enrichOptionRouteData(mapOptionToQuote(opt), routeContext);
                const calc = await pricingService.calculateFinancials(mapped.total_amount, 15, false);
                let markupPercent = 0;
                if (calc.buyPrice > 0) {
                  markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
                }
                return {
                  ...mapped,
                  id: mapped.id || `ai-${Math.random().toString(36).substr(2, 9)}`,
                  source_attribution: 'AI Smart Engine',
                  is_manual: false,
                  carrier: mapped.carrier_name || mapped.carrier || opt?.carrier?.name || opt?.carrier || 'AI Carrier',
                  price: mapped.total_amount,
                  currency: mapped.currency || 'USD',
                  name: mapped.option_name || opt?.name || 'AI Option',
                  mode: mapped.mode || mapped.legs?.[0]?.mode || payload.mode || 'ocean',
                  transport_mode: mapped.transport_mode || mapped.mode || mapped.legs?.[0]?.mode || payload.mode || 'ocean',
                  transitTime: mapped.transit_time?.details || mapped.transitTime || opt?.transit_time?.details || 'TBD',
                  co2_kg: mapped.total_co2_kg,
                  legs: Array.isArray(mapped.legs) ? mapped.legs : [],
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
            markStage('ai_options_processed', {
              aiOptions: aiOptionsRaw.length,
              confidence: aiData.confidence_score,
            }, combinedOptions.length);
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
                const mapped = enrichOptionRouteData(mapOptionToQuote(opt), routeContext);
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
                is_manual: false,
                carrier: mapped.carrier || 'Unknown Carrier',
                markupPercent,
                verified: true,
                verificationTimestamp: new Date().toISOString(),
              };
            })
          );
          simOptions = simOptions.sort((a: any, b: any) => a.price - b.price).slice(0, 3);
          combinedOptions = [...combinedOptions, ...simOptions];
          markStage('simulation_fallback_applied', {
            simulationOptions: simOptions.length,
          }, combinedOptions.length);
          toast({
            title: 'Showing Simulated Rates',
            description: 'Legacy and AI engines were unavailable. Displaying simulated market rates.',
          });
        } else {
          const aiError = aiRes.error ? (aiRes.error.message || 'Unknown AI Error') : 'No Data';
          throw new Error(`No quotes available. Legacy: ${legacyErrorMsg || 'No Data'}. AI: ${aiError}`);
        }
      }

      // 5. Final Ranking and Recommendations
      const realtimeCarrierValidator = smartMode
        ? async (request: RealtimeCarrierValidationRequest): Promise<RealtimeCarrierValidationResult[]> => {
            try {
              const response = await invokeAiAdvisor({
                action: 'validate_carrier_service_availability',
                payload: request,
              });
              if (response?.error) return [];
              const data = response?.data;
              if (Array.isArray(data)) return data as RealtimeCarrierValidationResult[];
              if (Array.isArray(data?.results)) return data.results as RealtimeCarrierValidationResult[];
              return [];
            } catch {
              return [];
            }
          }
        : undefined;

      const hybridConfig = hybridRouteEnabled
        ? await buildHybridRouteConfiguration({
            options: combinedOptions.map((option) => ({
              ...option,
              is_manual: false,
              source_attribution: option.source_attribution || (smartMode ? 'Smart Quote Mode' : 'Market Rate'),
            })),
            routeInput: {
              origin: routeContext.origin,
              destination: routeContext.destination,
              mode: payload.mode || params.mode,
              requested_departure_date: payload.departure_date || payload.pickupDate,
              preferred_carriers: preferredCarriers,
              max_options: smartMode ? 5 : 3,
            },
            realtimeValidator: realtimeCarrierValidator,
          })
        : {
            options: combinedOptions,
            validationIssues: [],
            auditTrail: [],
          };

      const normalizedCombinedOptions = hybridConfig.options.map((opt) => enrichOptionRouteData(opt, routeContext));
      const hybridAnomalies = hybridConfig.validationIssues.map((issue) => `${issue.option_id}: ${issue.message}`);
      const optionsWithRouteFallback = normalizedCombinedOptions.filter((opt) => {
        const firstLeg = Array.isArray(opt.legs) ? opt.legs[0] : null;
        const lastLeg = Array.isArray(opt.legs) ? opt.legs[opt.legs.length - 1] : null;
        return (
          normalizeLocationValue(firstLeg?.origin) === routeContext.origin &&
          normalizeLocationValue(lastLeg?.destination) === routeContext.destination
        );
      }).length;
      const unknownCarrierCount = normalizedCombinedOptions.filter(
        (opt) => String(opt.carrier || '').trim().toLowerCase() === 'unknown carrier'
      ).length;
      const routeGapCount = normalizedCombinedOptions.length - optionsWithRouteFallback;

      markStage('hybrid_route_configured', {
        hybridRouteEnabled,
        validationIssues: hybridConfig.validationIssues.length,
        auditEvents: hybridConfig.auditTrail.length,
      }, normalizedCombinedOptions.length, unknownCarrierCount, routeGapCount);

      logger.info('[useRateFetching] Route population summary', {
        requestId,
        requestTimestamp,
        totalOptions: normalizedCombinedOptions.length,
        optionsWithRouteFallback,
        validationIssueCount: hybridConfig.validationIssues.length,
        auditEvents: hybridConfig.auditTrail.length,
      });

      const rankableOptions = normalizedCombinedOptions.map(opt => ({
        ...opt,
        // Map RateOption fields to RankableOption interface
        total_amount: opt.price || 0,
        transit_time_days: getTransitDaysFromString(opt.transitTime),
        reliability_score: opt.reliability?.score || 0.5,
      }));

      // Apply ranking service
      const rankedResults = QuotationRankingService.rankOptions(rankableOptions);
      markStage('ranking_completed', {
        rankedCount: rankedResults.length,
      }, rankedResults.length, unknownCarrierCount, routeGapCount);

      if (isStaleRequest()) {
        logger.warn('[useRateFetching] Stale request ignored after ranking', { requestId, requestSeq });
        return [];
      }

      setResults(rankedResults);
      if (hybridAnomalies.length > 0) {
        setAnomalies((current) => Array.from(new Set([...current, ...hybridAnomalies])));
      }

      // 6. Save to history
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
                options: normalizedCombinedOptions,
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

      logger.info('[useRateFetching] Fetch completed', {
        requestId,
        requestTimestamp,
        rankedCount: rankedResults.length,
      });

      if (hybridMetricsEnabled && context?.tenantId && !isStaleRequest()) {
        try {
          await metricsService.record({
            tenant_id: String(context.tenantId),
            user_id: context.userId ? String(context.userId) : undefined,
            request_id: requestId,
            mode: String(params.mode || payload.mode || ''),
            smart_mode: smartMode,
            duration_ms: Date.now() - requestStartAt,
            total_options: rankedResults.length,
            issues_count: hybridConfig.validationIssues.length,
            unknown_carrier_count: unknownCarrierCount,
            route_gap_count: routeGapCount,
            status: 'success',
            timeline,
          });
        } catch (metricsError) {
          logger.warn('[useRateFetching] Failed to persist quote generation metrics', { requestId, metricsError });
        }
      }

      return normalizedCombinedOptions;
    } catch (err: any) {
      const message = err.message || 'Failed to calculate rates.';
      markStage('request_failed', { message });
      if (!isStaleRequest()) {
        setError(message);
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
      if (hybridMetricsEnabled && context?.tenantId && !isStaleRequest()) {
        try {
          await metricsService.record({
            tenant_id: String(context.tenantId),
            user_id: context.userId ? String(context.userId) : undefined,
            request_id: requestId,
            mode: String(params.mode || payload.mode || ''),
            smart_mode: smartMode,
            duration_ms: Date.now() - requestStartAt,
            total_options: 0,
            issues_count: 1,
            unknown_carrier_count: 0,
            route_gap_count: 0,
            status: 'failure',
            error_message: message,
            timeline,
          });
        } catch (metricsError) {
          logger.warn('[useRateFetching] Failed to persist failed metrics', { requestId, metricsError });
        }
      }
      return [];
    } finally {
      if (!isStaleRequest()) {
        setLoading(false);
      }
    }
  }, [supabase, context, invokeAiAdvisor, toast, hybridRouteEnabled, hybridMetricsEnabled, metricsService]);

  return useMemo(() => ({
    results,
    loading,
    error,
    marketAnalysis,
    confidenceScore,
    anomalies,
    fetchRates,
    clearResults,
  }), [results, loading, error, marketAnalysis, confidenceScore, anomalies, fetchRates, clearResults]);
}

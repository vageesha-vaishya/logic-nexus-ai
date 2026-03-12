import { DEFAULT_MODE_CARRIER_TYPE_MAP, getCarrierTypesForMode, normalizeModeCode, type ModeCarrierTypeMap } from '@/lib/mode-utils';
import { RateOption, TransportLeg } from '@/types/quote-breakdown';

export interface SmartRouteCarrierProfile {
  id?: string;
  carrier_name: string;
  carrier_type?: string | null;
  service_types?: string[];
  pricing_index?: number;
  reliability_score?: number;
  supported_routes?: Array<{ origin: string; destination: string; mode?: string }>;
}

export interface SmartRouteInput {
  origin: string;
  destination: string;
  mode: string;
  requested_departure_date?: string;
  preferred_carriers?: string[];
  max_options?: number;
}

export interface SmartRouteValidationIssue {
  option_id: string;
  severity: 'error' | 'warning';
  field: 'carrier' | 'origin' | 'destination' | 'departure_date' | 'price' | 'service';
  message: string;
}

export interface SmartRouteAuditRecord {
  action: string;
  option_id: string;
  details: Record<string, unknown>;
}

export interface RealtimeCarrierValidationRequest {
  route: {
    origin: string;
    destination: string;
    mode: string;
    requested_departure_date: string;
  };
  options: Array<{
    option_id: string;
    carrier: string;
    mode: string;
    origin: string;
    destination: string;
    departure_date: string;
    total_amount: number;
    currency: string;
  }>;
}

export interface RealtimeCarrierValidationResult {
  option_id: string;
  available: boolean;
  price_valid: boolean;
  message?: string;
}

export interface HybridRouteConfigurationResult {
  options: RateOption[];
  validationIssues: SmartRouteValidationIssue[];
  auditTrail: SmartRouteAuditRecord[];
}

type RealtimeCarrierValidator = (
  request: RealtimeCarrierValidationRequest
) => Promise<RealtimeCarrierValidationResult[]>;

const normalizeText = (value: unknown): string => String(value || '').trim();

const normalizeLocation = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const lower = normalized.toLowerCase();
  if (lower === 'origin' || lower === 'destination' || lower === 'city/port') return '';
  return normalized;
};

const normalizeDate = (value: unknown): string => {
  const raw = normalizeText(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const dedupeBy = <T>(items: T[], keyFn: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

const buildCarrierProfiles = (
  options: RateOption[],
  profiles: SmartRouteCarrierProfile[]
): SmartRouteCarrierProfile[] => {
  const fromOptions: SmartRouteCarrierProfile[] = options
    .map((option) => normalizeText(option.carrier))
    .filter(Boolean)
    .map((carrierName) => ({
      carrier_name: carrierName,
      pricing_index: 1,
      reliability_score: 0.8,
    }));

  const merged = [...profiles, ...fromOptions].map((profile) => ({
    ...profile,
    carrier_name: normalizeText(profile.carrier_name),
    pricing_index: typeof profile.pricing_index === 'number' && profile.pricing_index > 0 ? profile.pricing_index : 1,
    reliability_score:
      typeof profile.reliability_score === 'number' && profile.reliability_score > 0
        ? profile.reliability_score
        : 0.8,
  }));

  return dedupeBy(merged.filter((profile) => profile.carrier_name), (profile) => profile.carrier_name.toLowerCase());
};

const carrierSupportsMode = (
  carrier: SmartRouteCarrierProfile,
  mode: string,
  modeCarrierMap: ModeCarrierTypeMap
): boolean => {
  const normalizedMode = normalizeModeCode(mode);
  const allowedCarrierTypes = getCarrierTypesForMode(normalizedMode, modeCarrierMap);
  if (!allowedCarrierTypes.length) return true;
  const carrierType = normalizeText(carrier.carrier_type).toLowerCase();
  if (!carrierType) return true;
  return allowedCarrierTypes.includes(carrierType);
};

const carrierSupportsRoute = (
  carrier: SmartRouteCarrierProfile,
  origin: string,
  destination: string,
  mode: string
): boolean => {
  if (!carrier.supported_routes || carrier.supported_routes.length === 0) return true;
  const normalizedMode = normalizeModeCode(mode);
  return carrier.supported_routes.some((route) => {
    const routeOrigin = normalizeLocation(route.origin).toLowerCase();
    const routeDestination = normalizeLocation(route.destination).toLowerCase();
    const routeMode = normalizeModeCode(route.mode || normalizedMode);
    return (
      routeOrigin === normalizeLocation(origin).toLowerCase() &&
      routeDestination === normalizeLocation(destination).toLowerCase() &&
      routeMode === normalizedMode
    );
  });
};

const scoreCarrier = (
  carrier: SmartRouteCarrierProfile,
  leg: TransportLeg,
  preferredCarrierSet: Set<string>,
  modeCarrierMap: ModeCarrierTypeMap
): number => {
  const preferredBoost = preferredCarrierSet.has(carrier.carrier_name.toLowerCase()) ? 15 : 0;
  const modeBoost = carrierSupportsMode(carrier, leg.mode, modeCarrierMap) ? 20 : -30;
  const routeBoost = carrierSupportsRoute(carrier, leg.origin, leg.destination, leg.mode) ? 12 : -20;
  const pricingScore = Math.max(0, 10 - ((carrier.pricing_index || 1) - 1) * 4);
  const reliabilityScore = Math.max(0, (carrier.reliability_score || 0.8) * 10);
  return preferredBoost + modeBoost + routeBoost + pricingScore + reliabilityScore;
};

const normalizeLegs = (option: RateOption, routeInput: SmartRouteInput, fallbackCarrier: string): TransportLeg[] => {
  const sourceLegs = Array.isArray(option.legs) ? option.legs : [];
  const rawLegs: TransportLeg[] =
    sourceLegs.length > 0
      ? sourceLegs.map((leg, index) => ({
          ...leg,
          id: normalizeText(leg.id) || `${option.id}-leg-${index + 1}`,
          mode: normalizeModeCode(leg.mode || option.transport_mode || routeInput.mode || 'ocean'),
          origin: normalizeLocation(leg.origin || (leg as any).from),
          destination: normalizeLocation(leg.destination || (leg as any).to),
          carrier: normalizeText(leg.carrier || fallbackCarrier),
          departure_date: normalizeDate(leg.departure_date || routeInput.requested_departure_date),
        }))
      : [
          {
            id: `${option.id}-leg-1`,
            mode: normalizeModeCode(option.transport_mode || routeInput.mode || 'ocean'),
            origin: normalizeLocation((option as any).origin || routeInput.origin),
            destination: normalizeLocation((option as any).destination || routeInput.destination),
            carrier: normalizeText(option.carrier || fallbackCarrier),
            departure_date: normalizeDate((option as any).departure_date || routeInput.requested_departure_date),
          },
        ];

  if (!rawLegs[0].origin) rawLegs[0].origin = normalizeLocation((option as any).origin || routeInput.origin);
  if (!rawLegs[rawLegs.length - 1].destination) {
    rawLegs[rawLegs.length - 1].destination = normalizeLocation((option as any).destination || routeInput.destination);
  }

  for (let index = 1; index < rawLegs.length; index += 1) {
    if (!rawLegs[index].origin) rawLegs[index].origin = rawLegs[index - 1].destination;
  }
  for (let index = rawLegs.length - 2; index >= 0; index -= 1) {
    if (!rawLegs[index].destination) rawLegs[index].destination = rawLegs[index + 1].origin;
  }
  for (let index = 0; index < rawLegs.length; index += 1) {
    if (!rawLegs[index].carrier) rawLegs[index].carrier = fallbackCarrier;
    if (!rawLegs[index].departure_date) rawLegs[index].departure_date = normalizeDate(routeInput.requested_departure_date);
    (rawLegs[index] as any).from = rawLegs[index].origin;
    (rawLegs[index] as any).to = rawLegs[index].destination;
  }

  return rawLegs;
};

const selectLegCarrier = (
  leg: TransportLeg,
  preferredCarrierSet: Set<string>,
  carriers: SmartRouteCarrierProfile[],
  modeCarrierMap: ModeCarrierTypeMap
): SmartRouteCarrierProfile | null => {
  if (!carriers.length) return null;
  const ranked = [...carriers].sort((left, right) => {
    const rightScore = scoreCarrier(right, leg, preferredCarrierSet, modeCarrierMap);
    const leftScore = scoreCarrier(left, leg, preferredCarrierSet, modeCarrierMap);
    if (rightScore !== leftScore) return rightScore - leftScore;
    const leftPrice = left.pricing_index || 1;
    const rightPrice = right.pricing_index || 1;
    return leftPrice - rightPrice;
  });
  return ranked[0] || null;
};

const recalculateOption = (
  option: RateOption,
  routeInput: SmartRouteInput,
  carriers: SmartRouteCarrierProfile[],
  modeCarrierMap: ModeCarrierTypeMap
): { option: RateOption; audits: SmartRouteAuditRecord[] } => {
  const preferredCarrierSet = new Set((routeInput.preferred_carriers || []).map((carrier) => carrier.toLowerCase()));
  const fallbackCarrier = normalizeText(option.carrier) || normalizeText(routeInput.preferred_carriers?.[0]) || 'Unknown Carrier';
  const normalizedLegs = normalizeLegs(option, routeInput, fallbackCarrier);
  const audits: SmartRouteAuditRecord[] = [];

  const legs = normalizedLegs.map((leg) => {
    const selectedCarrier = selectLegCarrier(leg, preferredCarrierSet, carriers, modeCarrierMap);
    const existingCarrierName = normalizeText(leg.carrier);
    const existingCarrierProfile = carriers.find((carrier) => carrier.carrier_name.toLowerCase() === existingCarrierName.toLowerCase());
    const existingCarrierCompatible = existingCarrierProfile
      ? carrierSupportsMode(existingCarrierProfile, leg.mode, modeCarrierMap) &&
        carrierSupportsRoute(existingCarrierProfile, leg.origin, leg.destination, leg.mode)
      : true;
    const shouldUseSelectedCarrier =
      !existingCarrierName ||
      existingCarrierName.toLowerCase() === 'unknown carrier' ||
      !existingCarrierCompatible;
    const carrierName = shouldUseSelectedCarrier
      ? selectedCarrier?.carrier_name || existingCarrierName || fallbackCarrier
      : existingCarrierName;
    audits.push({
      action: 'recalculate_leg',
      option_id: option.id,
      details: {
        leg_id: leg.id,
        mode: leg.mode,
        origin: leg.origin,
        destination: leg.destination,
        carrier: carrierName,
        departure_date: leg.departure_date || normalizeDate(routeInput.requested_departure_date),
      },
    });
    return {
      ...leg,
      mode: normalizeModeCode(leg.mode || routeInput.mode),
      carrier: carrierName,
      departure_date: normalizeDate(leg.departure_date || routeInput.requested_departure_date),
      from: leg.origin,
      to: leg.destination,
    };
  });

  const primaryCarrier = normalizeText(legs[0]?.carrier) || fallbackCarrier;
  return {
    option: {
      ...option,
      is_manual: false,
      carrier: primaryCarrier,
      name: normalizeText(option.name) || primaryCarrier,
      origin: legs[0]?.origin || routeInput.origin,
      destination: legs[legs.length - 1]?.destination || routeInput.destination,
      departure_date: normalizeDate((option as any).departure_date || legs[0]?.departure_date || routeInput.requested_departure_date),
      transport_mode: normalizeModeCode(option.transport_mode || option.legs?.[0]?.mode || routeInput.mode),
      legs,
      source_attribution: normalizeText(option.source_attribution) || 'Smart Quote Mode',
    } as RateOption,
    audits,
  };
};

const makeAlternativeOption = (
  baseOption: RateOption,
  carrier: SmartRouteCarrierProfile,
  routeInput: SmartRouteInput,
  index: number
): RateOption => {
  const factor = carrier.pricing_index || 1;
  const baseAmount = Number(baseOption.total_amount || baseOption.price || 0);
  const adjustedAmount = Number((baseAmount * factor).toFixed(2));
  const legs = (baseOption.legs || []).map((leg) => ({
    ...leg,
    carrier: carrier.carrier_name,
    departure_date: normalizeDate(leg.departure_date || routeInput.requested_departure_date),
  }));
  const baseId = normalizeText(baseOption.id) || 'hybrid-option';
  const id = `${baseId}-${slugify(carrier.carrier_name)}-${index + 1}`;
  return {
    ...baseOption,
    id,
    is_manual: false,
    carrier: carrier.carrier_name,
    name: `${carrier.carrier_name} Smart Option`,
    total_amount: adjustedAmount,
    price: adjustedAmount,
    source_attribution: 'Smart Quote Mode',
    transport_mode: normalizeModeCode(baseOption.transport_mode || routeInput.mode),
    legs,
  };
};

const generateAlternatives = (
  recalculatedOptions: RateOption[],
  carriers: SmartRouteCarrierProfile[],
  routeInput: SmartRouteInput
): RateOption[] => {
  if (!recalculatedOptions.length || !carriers.length) return recalculatedOptions;
  const maxOptions = Math.max(3, Number(routeInput.max_options || 5));
  const sortedCarriers = [...carriers].sort((left, right) => {
    const leftPrice = left.pricing_index || 1;
    const rightPrice = right.pricing_index || 1;
    if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    const rightReliability = right.reliability_score || 0.8;
    const leftReliability = left.reliability_score || 0.8;
    return rightReliability - leftReliability;
  });

  const alternatives: RateOption[] = [...recalculatedOptions];
  for (const option of recalculatedOptions) {
    for (let index = 0; index < sortedCarriers.length; index += 1) {
      if (alternatives.length >= maxOptions) break;
      const carrier = sortedCarriers[index];
      if (!carrier.carrier_name || carrier.carrier_name.toLowerCase() === normalizeText(option.carrier).toLowerCase()) continue;
      alternatives.push(makeAlternativeOption(option, carrier, routeInput, index));
    }
    if (alternatives.length >= maxOptions) break;
  }

  return dedupeBy(alternatives, (option) => `${normalizeText(option.carrier).toLowerCase()}|${normalizeText((option as any).origin).toLowerCase()}|${normalizeText((option as any).destination).toLowerCase()}|${Number(option.total_amount || option.price || 0).toFixed(2)}`).slice(0, maxOptions);
};

const validateOption = (
  option: RateOption,
  routeInput: SmartRouteInput,
  carriers: SmartRouteCarrierProfile[],
  modeCarrierMap: ModeCarrierTypeMap
): SmartRouteValidationIssue[] => {
  const issues: SmartRouteValidationIssue[] = [];
  const legs = Array.isArray(option.legs) ? option.legs : [];
  const mode = normalizeModeCode(option.transport_mode || routeInput.mode);

  if (!normalizeText(option.carrier) || normalizeText(option.carrier).toLowerCase() === 'unknown carrier') {
    issues.push({
      option_id: option.id,
      severity: 'error',
      field: 'carrier',
      message: 'Carrier is missing or unresolved',
    });
  }

  if (!normalizeLocation((option as any).origin || legs[0]?.origin)) {
    issues.push({
      option_id: option.id,
      severity: 'error',
      field: 'origin',
      message: 'Origin is missing',
    });
  }

  if (!normalizeLocation((option as any).destination || legs[legs.length - 1]?.destination)) {
    issues.push({
      option_id: option.id,
      severity: 'error',
      field: 'destination',
      message: 'Destination is missing',
    });
  }

  const departure = normalizeDate((option as any).departure_date || legs[0]?.departure_date || routeInput.requested_departure_date);
  if (!departure) {
    issues.push({
      option_id: option.id,
      severity: 'warning',
      field: 'departure_date',
      message: 'Departure date is not available',
    });
  }

  const amount = Number(option.total_amount || option.price || 0);
  if (!(amount > 0)) {
    issues.push({
      option_id: option.id,
      severity: 'error',
      field: 'price',
      message: 'Price is not valid',
    });
  }

  const matchedCarrier = carriers.find((carrier) => carrier.carrier_name.toLowerCase() === normalizeText(option.carrier).toLowerCase());
  if (matchedCarrier && !carrierSupportsMode(matchedCarrier, mode, modeCarrierMap)) {
    issues.push({
      option_id: option.id,
      severity: 'error',
      field: 'service',
      message: `Carrier "${matchedCarrier.carrier_name}" does not match mode "${mode}"`,
    });
  }

  return issues;
};

const applyRealtimeValidation = (
  options: RateOption[],
  realtimeResults: RealtimeCarrierValidationResult[]
): SmartRouteValidationIssue[] => {
  const issues: SmartRouteValidationIssue[] = [];
  const byOptionId = new Map<string, RealtimeCarrierValidationResult>();
  realtimeResults.forEach((result) => {
    byOptionId.set(result.option_id, result);
  });
  options.forEach((option) => {
    const status = byOptionId.get(option.id);
    if (!status) return;
    if (!status.available) {
      issues.push({
        option_id: option.id,
        severity: 'error',
        field: 'service',
        message: status.message || 'Carrier service unavailable for selected route',
      });
    }
    if (!status.price_valid) {
      issues.push({
        option_id: option.id,
        severity: 'warning',
        field: 'price',
        message: status.message || 'Carrier API returned stale or invalid pricing',
      });
    }
  });
  return issues;
};

const createRealtimeRequest = (
  options: RateOption[],
  routeInput: SmartRouteInput
): RealtimeCarrierValidationRequest => ({
  route: {
    origin: normalizeLocation(routeInput.origin),
    destination: normalizeLocation(routeInput.destination),
    mode: normalizeModeCode(routeInput.mode),
    requested_departure_date: normalizeDate(routeInput.requested_departure_date),
  },
  options: options.map((option) => {
    const legs = Array.isArray(option.legs) ? option.legs : [];
    return {
      option_id: option.id,
      carrier: normalizeText(option.carrier),
      mode: normalizeModeCode(option.transport_mode || legs[0]?.mode || routeInput.mode),
      origin: normalizeLocation((option as any).origin || legs[0]?.origin),
      destination: normalizeLocation((option as any).destination || legs[legs.length - 1]?.destination),
      departure_date: normalizeDate((option as any).departure_date || legs[0]?.departure_date || routeInput.requested_departure_date),
      total_amount: Number(option.total_amount || option.price || 0),
      currency: normalizeText(option.currency) || 'USD',
    };
  }),
});

export const validateSmartRouteInput = (input: SmartRouteInput): string[] => {
  const errors: string[] = [];
  if (!normalizeLocation(input.origin)) errors.push('Origin is required');
  if (!normalizeLocation(input.destination)) errors.push('Destination is required');
  if (!normalizeModeCode(input.mode)) errors.push('Mode is required');
  return errors;
};

export const buildHybridRouteConfiguration = async ({
  options,
  routeInput,
  carrierProfiles = [],
  modeCarrierMap = DEFAULT_MODE_CARRIER_TYPE_MAP,
  realtimeValidator,
}: {
  options: RateOption[];
  routeInput: SmartRouteInput;
  carrierProfiles?: SmartRouteCarrierProfile[];
  modeCarrierMap?: ModeCarrierTypeMap;
  realtimeValidator?: RealtimeCarrierValidator;
}): Promise<HybridRouteConfigurationResult> => {
  const inputErrors = validateSmartRouteInput(routeInput);
  if (inputErrors.length > 0) {
    return {
      options,
      validationIssues: inputErrors.map((message, index) => ({
        option_id: options[index]?.id || `option-${index + 1}`,
        severity: 'error' as const,
        field: index === 0 ? 'origin' : index === 1 ? 'destination' : 'service',
        message,
      })),
      auditTrail: [],
    };
  }

  const mergedProfiles = buildCarrierProfiles(options, carrierProfiles);
  const recalculated = options.map((option) => recalculateOption(option, routeInput, mergedProfiles, modeCarrierMap));
  const recalculatedOptions = recalculated.map((entry) => entry.option);
  const auditTrail = recalculated.flatMap((entry) => entry.audits);
  const alternatives = generateAlternatives(recalculatedOptions, mergedProfiles, routeInput);
  const localValidationIssues = alternatives.flatMap((option) => validateOption(option, routeInput, mergedProfiles, modeCarrierMap));

  let realtimeIssues: SmartRouteValidationIssue[] = [];
  if (realtimeValidator) {
    const request = createRealtimeRequest(alternatives, routeInput);
    const realtimeValidation = await realtimeValidator(request);
    realtimeIssues = applyRealtimeValidation(alternatives, realtimeValidation);
  }

  const issues = [...localValidationIssues, ...realtimeIssues];
  const blockedOptionIds = new Set(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.option_id));
  const filteredOptions = alternatives.filter((option) => !blockedOptionIds.has(option.id));
  const shouldFallbackToAlternatives = blockedOptionIds.size === 0;

  return {
    options: filteredOptions.length > 0 || !shouldFallbackToAlternatives ? filteredOptions : alternatives,
    validationIssues: issues,
    auditTrail,
  };
};

import type {
  MglChargeRow,
  MglCalculatedOption,
  MglScenarioConfig,
  MglRateOption,
  MglRateType,
  MglValidationIssue,
  MglValidationResult,
  TransportMode,
} from './types';

export const MGL_DEFAULT_EQUIPMENT_COLUMNS = [
  { key: 'standard_20', label: "Standard - 20'" },
  { key: 'open_top_40', label: "Open Top - 40'" },
  { key: 'flat_rack_40', label: "Flat Rack - 40'" },
  { key: 'flat_rack_collapsible_20', label: "Flat Rack collapsible - 20'" },
  { key: 'platform_20', label: "Platform - 20'" },
  { key: 'high_cube_45', label: 'High Cube - 45' },
] as const;

const ALLOWED_MULTI_LEG_TRANSITIONS: Record<TransportMode, TransportMode[]> = {
  air: ['road', 'air'],
  ocean: ['road', 'rail', 'ocean', 'air'],
  road: ['air', 'ocean', 'rail', 'road'],
  rail: ['road', 'ocean', 'rail', 'air'],
};

const NYC_CODES = new Set([
  'USNYC',
  'NYC',
  'NEW YORK',
  'NEW YORK CITY',
  'JFK',
  'USJFK',
  'EWR',
  'USEWR',
  'LGA',
  'USLGA',
  'PANYNJ',
  'USNYNJ',
  'PORT OF NEW YORK AND NEW JERSEY',
  'NYC TRUCK TERMINAL',
  'NEWARK TRUCK TERMINAL',
]);
const DEHRA_DUN_CODES = new Set(['INDED', 'DED', 'DEHRA DUN', 'DEHRADUN', 'DEHRA DUN AIRPORT']);

const COMMODITY_CONTAINER_RULES: Record<
  NonNullable<MglRateOption['commodityType']>,
  NonNullable<MglRateOption['containerType']>[]
> = {
  general: ['standard', 'open_top', 'flat_rack', 'platform'],
  hazardous: ['standard', 'open_top', 'flat_rack'],
  perishable: ['reefer'],
  pharmaceutical: ['reefer'],
  fragile: ['standard', 'reefer'],
  oversized: ['open_top', 'flat_rack', 'platform'],
};

const COMMODITY_MULTIPLIERS: Record<NonNullable<MglRateOption['commodityType']>, number> = {
  general: 1,
  hazardous: 1.18,
  perishable: 1.12,
  pharmaceutical: 1.2,
  fragile: 1.08,
  oversized: 1.16,
};

const CONTAINER_MULTIPLIERS: Record<string, number> = {
  "standard:20'": 1,
  "standard:40'": 1.25,
  "standard:40'HC": 1.33,
  "standard:45'": 1.42,
  "open_top:20'": 1.1,
  "open_top:40'": 1.36,
  "open_top:40'HC": 1.44,
  "open_top:45'": 1.54,
  "flat_rack:20'": 1.2,
  "flat_rack:40'": 1.48,
  "flat_rack:40'HC": 1.56,
  "flat_rack:45'": 1.65,
  "reefer:20'": 1.22,
  "reefer:40'": 1.56,
  "reefer:40'HC": 1.64,
  "reefer:45'": 1.74,
  "platform:20'": 1.18,
  "platform:40'": 1.42,
  "platform:40'HC": 1.5,
  "platform:45'": 1.58,
};

const STANDALONE_RATE_TYPE_ORDER: Array<{ optionOrdinal: 1 | 2 | 3 | 4; rateType: MglRateType }> = [
  { optionOrdinal: 1, rateType: 'spot' },
  { optionOrdinal: 2, rateType: 'contract' },
  { optionOrdinal: 3, rateType: 'market' },
  { optionOrdinal: 4, rateType: 'negotiated' },
];

const DEFAULT_RATE_TYPE_MULTIPLIERS: Record<MglRateType, number> = {
  spot: 1.04,
  contract: 0.95,
  market: 1.09,
  negotiated: 0.99,
};

function normalizeCode(value: string | undefined) {
  return String(value || '').trim().toUpperCase();
}

function isNycCode(value: string | undefined) {
  return NYC_CODES.has(normalizeCode(value));
}

function isDehraDunCode(value: string | undefined) {
  return DEHRA_DUN_CODES.has(normalizeCode(value));
}

function getRateTypeMultiplier(config: MglScenarioConfig, rateType: MglRateType) {
  const override = config.rateTypeMultipliers?.[rateType];
  if (typeof override === 'number' && override > 0) return override;
  return DEFAULT_RATE_TYPE_MULTIPLIERS[rateType] || 1;
}

function calculateTransitTimeDays(config: MglScenarioConfig) {
  const legTransitDays = (config.legs || []).reduce((sum, leg) => sum + Number(leg.transitDays || 0), 0);
  const dwellDays = (config.legConnections || []).reduce((sum, connection) => {
    const dwellHours = Number(connection.dwellHours || 0);
    return sum + Math.max(0, dwellHours / 24);
  }, 0);
  const total = legTransitDays + dwellDays;
  return Number(total.toFixed(2));
}

function buildScenarioOption(
  config: MglScenarioConfig,
  optionOrdinal: 1 | 2 | 3 | 4,
  rateType: MglRateType,
): MglRateOption {
  const equipmentColumns = config.equipmentColumns?.length
    ? config.equipmentColumns
    : [...MGL_DEFAULT_EQUIPMENT_COLUMNS];
  const commodityMultiplier = COMMODITY_MULTIPLIERS[config.commodityType] || 1;
  const containerKey = `${config.containerType}:${config.containerSize}`;
  const containerMultiplier = CONTAINER_MULTIPLIERS[containerKey] || 1;
  const rateTypeMultiplier = getRateTypeMultiplier(config, rateType);
  const totalMultiplier = Number(
    (rateTypeMultiplier * commodityMultiplier * containerMultiplier).toFixed(4),
  );
  const transitTimeDays = calculateTransitTimeDays(config);

  const chargeRows: MglChargeRow[] = (config.baseChargeRows || []).map((row, index) => {
    const valuesByEquipment = Object.fromEntries(
      Object.entries(row.valuesByEquipment || {}).map(([equipmentKey, amount]) => [
        equipmentKey,
        Number((Number(amount || 0) * totalMultiplier).toFixed(2)),
      ]),
    );
    return {
      ...row,
      id: `${optionOrdinal}:${row.id || index}`,
      valuesByEquipment,
    };
  });

  return {
    id: `${config.carrierName.toLowerCase().replace(/\s+/g, '-')}-opt-${optionOrdinal}`,
    quoteId: config.quoteId,
    quoteVersionId: config.quoteVersionId,
    optionName: `Option ${optionOrdinal}`,
    carrierName: config.carrierName,
    rateType,
    rateValidUntil: config.rateValidUntil,
    transitTimeDays,
    mode: config.legs.length > 1 ? 'multimodal' : 'single',
    equipmentColumns,
    legs: config.legs.map((leg, index) => ({
      ...leg,
      sequenceNo: index + 1,
    })),
    transitPoints: config.transitPoints || [],
    legConnections: config.legConnections || [],
    chargeRows,
    containerType: config.containerType,
    containerSize: config.containerSize,
    commodityType: config.commodityType,
    hsCode: config.hsCode,
    imdgClass: config.imdgClass,
    temperatureControlMinC: config.temperatureControlMinC,
    temperatureControlMaxC: config.temperatureControlMaxC,
    oversizedLengthCm: config.oversizedLengthCm,
    oversizedWidthCm: config.oversizedWidthCm,
    oversizedHeightCm: config.oversizedHeightCm,
    originCode: config.originCode,
    destinationCode: config.destinationCode,
    standaloneMode: true,
    optionOrdinal,
  };
}

export function generateStandaloneMglRateOptions(config: MglScenarioConfig): MglRateOption[] {
  return STANDALONE_RATE_TYPE_ORDER.map((item) =>
    buildScenarioOption(config, item.optionOrdinal, item.rateType),
  );
}

export function validateStandaloneOptionSet(options: MglRateOption[]): MglValidationResult {
  const errors: MglValidationIssue[] = [];
  const warnings: MglValidationIssue[] = [];
  if (options.length !== 4) {
    errors.push({
      code: 'INVALID_OPTION_SET',
      message: `Standalone mode requires 4 options, received ${options.length}.`,
    });
  }
  const missingOrdinals = [1, 2, 3, 4].filter(
    (ordinal) => !options.some((option) => option.optionOrdinal === ordinal),
  );
  if (missingOrdinals.length > 0) {
    errors.push({
      code: 'INVALID_OPTION_SET',
      message: `Missing standalone option ordinals: ${missingOrdinals.join(', ')}.`,
    });
  }
  const duplicateRateTypes = options
    .map((option) => option.rateType)
    .filter((rateType, index, arr) => Boolean(rateType) && arr.indexOf(rateType) !== index);
  if (duplicateRateTypes.length > 0) {
    errors.push({
      code: 'INVALID_OPTION_SET',
      message: `Standalone options must use unique rate types. Duplicates: ${[
        ...new Set(duplicateRateTypes),
      ].join(', ')}.`,
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateMglRateOption(option: MglRateOption): MglValidationResult {
  const errors: MglValidationIssue[] = [];
  const warnings: MglValidationIssue[] = [];

  if (!Array.isArray(option.legs) || option.legs.length === 0) {
    errors.push({
      code: 'EMPTY_LEGS',
      message: 'At least one transport leg is required.',
    });
  }

  const sortedLegs = [...(option.legs || [])].sort((a, b) => a.sequenceNo - b.sequenceNo);

  sortedLegs.forEach((leg, index) => {
    if (leg.sequenceNo !== index + 1) {
      errors.push({
        code: 'LEG_SEQUENCE_INVALID',
        message: `Leg ${leg.id} has sequence ${leg.sequenceNo}, expected ${index + 1}.`,
        legId: leg.id,
      });
    }

    if (index > 0) {
      const prev = sortedLegs[index - 1];
      if (
        String(prev.destinationCode || '').trim().toUpperCase() !==
        String(leg.originCode || '').trim().toUpperCase()
      ) {
        errors.push({
          code: 'LEG_ROUTE_BREAK',
          message: `Route break between legs ${prev.id} and ${leg.id}.`,
          legId: leg.id,
        });
      }

      const allowed = ALLOWED_MULTI_LEG_TRANSITIONS[prev.mode] || [];
      if (!allowed.includes(leg.mode)) {
        errors.push({
          code: 'UNSUPPORTED_MODE_COMBINATION',
          message: `Unsupported transport transition from ${prev.mode} to ${leg.mode}.`,
          legId: leg.id,
        });
      }
    }
  });

  for (const row of option.chargeRows || []) {
    for (const [equipmentKey, value] of Object.entries(row.valuesByEquipment || {})) {
      if (Number(value) < 0) {
        errors.push({
          code: 'NEGATIVE_CHARGE',
          message: `Charge row ${row.rowName} contains negative amount for ${equipmentKey}.`,
          rowId: row.id,
        });
      }
    }
  }

  if ((option.chargeRows || []).length === 0) {
    warnings.push({
      code: 'NEGATIVE_CHARGE',
      message: 'No charge rows configured for this option.',
    });
  }

  if (!option.containerType || !option.containerSize || !option.commodityType) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Container type, container size, and commodity type are required.',
    });
  }

  if (!option.rateType) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Rate type is required.',
    });
  }

  if (option.rateValidUntil) {
    const expiryTime = Date.parse(option.rateValidUntil);
    if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
      errors.push({
        code: 'RATE_EXPIRED',
        message: 'Rate has expired and cannot be used for quotation.',
      });
    }
  }

  if (option.containerType && option.commodityType) {
    const allowedContainers = COMMODITY_CONTAINER_RULES[option.commodityType];
    if (!allowedContainers?.includes(option.containerType)) {
      errors.push({
        code: 'CONTAINER_COMMODITY_INCOMPATIBLE',
        message: `${option.commodityType} is not allowed with ${option.containerType}.`,
      });
    }
  }

  if (option.containerType && option.containerSize) {
    const key = `${option.containerType}:${option.containerSize}`;
    if (!CONTAINER_MULTIPLIERS[key]) {
      errors.push({
        code: 'CONTAINER_UNSUPPORTED',
        message: `Unsupported container profile ${option.containerType} ${option.containerSize}.`,
      });
    }
  }

  if (option.commodityType === 'hazardous' && !String(option.imdgClass || '').trim()) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'IMDG class is required for hazardous cargo.',
    });
  }

  if (
    (option.commodityType === 'perishable' || option.commodityType === 'pharmaceutical') &&
    option.containerType === 'reefer'
  ) {
    const min = option.temperatureControlMinC;
    const max = option.temperatureControlMaxC;
    const hasTemperatureRange = Number.isFinite(min) && Number.isFinite(max);
    if (!hasTemperatureRange) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Temperature range is required for reefer perishable or pharmaceutical cargo.',
      });
    } else if (Number(min) >= Number(max)) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Temperature control minimum must be lower than maximum.',
      });
    }
  }

  if (option.commodityType === 'oversized') {
    const length = Number(option.oversizedLengthCm || 0);
    const width = Number(option.oversizedWidthCm || 0);
    const height = Number(option.oversizedHeightCm || 0);
    if (length <= 0 || width <= 0 || height <= 0) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Oversized cargo dimensions are required.',
      });
    }
  }

  const transitPointIds = new Set((option.transitPoints || []).map((point) => point.id).filter(Boolean));
  for (const point of option.transitPoints || []) {
    if (!String(point.code || '').trim()) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Transit points must include code.',
      });
    }
    if (!point.mode) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Transit points must include mode.',
      });
    }
    if (Number(point.minConnectionHours || 0) < 0) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Transit points cannot have negative min connection hours.',
      });
    }
  }

  if ((option.legConnections || []).length > 0) {
    const legsById = new Map((option.legs || []).map((leg) => [leg.id, leg]));
    for (const connection of option.legConnections || []) {
      if (!legsById.has(connection.fromLegId) || !legsById.has(connection.toLegId)) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Leg connection ${connection.id} references unknown leg IDs.`,
        });
      }
      if (connection.transitPointId && !transitPointIds.has(connection.transitPointId)) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Leg connection ${connection.id} references unknown transit point.`,
        });
      }
      const dwellHours = Number(connection.dwellHours || 0);
      if (dwellHours < 0) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Leg connection ${connection.id} has invalid dwell hours.`,
        });
      }
    }
  }

  if (sortedLegs.length > 0) {
    const firstLegOrigin = option.originCode || sortedLegs[0]?.originCode;
    const lastLegDestination = option.destinationCode || sortedLegs[sortedLegs.length - 1]?.destinationCode;
    if (!isNycCode(firstLegOrigin) || !isDehraDunCode(lastLegDestination)) {
      errors.push({
        code: 'ROUTE_OUT_OF_SCOPE',
        message: 'Route must start from New York City and end at Dehra Dun Airport.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function calculateMglRateOption(option: MglRateOption): MglCalculatedOption {
  const totalsByEquipment: Record<string, number> = {};
  const rowTotals: Array<{ rowId: string; rowName: string; total: number }> = [];

  const equipmentKeys = (option.equipmentColumns || []).map((c) => c.key);
  for (const key of equipmentKeys) totalsByEquipment[key] = 0;

  for (const row of option.chargeRows || []) {
    let rowTotal = 0;
    const include = row.includeInTotal !== false;

    for (const key of equipmentKeys) {
      const amount = Number(row.valuesByEquipment?.[key] ?? 0);
      if (include) {
        totalsByEquipment[key] = Number((totalsByEquipment[key] + amount).toFixed(2));
      }
      rowTotal += amount;
    }

    rowTotals.push({
      rowId: row.id,
      rowName: row.rowName,
      total: Number(rowTotal.toFixed(2)),
    });
  }

  const grandTotal = Number(
    Object.values(totalsByEquipment)
      .reduce((sum, value) => sum + Number(value || 0), 0)
      .toFixed(2),
  );

  return {
    optionId: option.id,
    totalsByEquipment,
    grandTotal,
    rowTotals,
  };
}

export function calculateMglQuotation(options: MglRateOption[]) {
  const setValidation = validateStandaloneOptionSet(options);
  return options.map((option) => {
    const validation = validateMglRateOption(option);
    const mergedValidation: MglValidationResult = {
      valid: validation.valid && setValidation.valid,
      errors: [...setValidation.errors, ...validation.errors],
      warnings: [...setValidation.warnings, ...validation.warnings],
    };
    const calculated = calculateMglRateOption(option);
    return {
      option,
      validation: mergedValidation,
      calculated,
    };
  });
}

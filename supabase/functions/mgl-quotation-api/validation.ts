export type TransportMode = 'air' | 'ocean' | 'road' | 'rail';
export type ContainerType = 'standard' | 'open_top' | 'flat_rack' | 'reefer' | 'platform';
export type ContainerSize = "20'" | "40'" | "40'HC" | "45'";
export type CommodityType = 'general' | 'hazardous' | 'perishable' | 'pharmaceutical' | 'fragile' | 'oversized';
export type RateType = 'spot' | 'contract' | 'market' | 'negotiated';
const ALLOWED_RATE_TYPES: RateType[] = ['spot', 'contract', 'market', 'negotiated'];

export type RateLeg = {
  id?: string;
  sequenceNo: number;
  mode: TransportMode;
  originCode: string;
  destinationCode: string;
  originName?: string;
  destinationName?: string;
  carrierName?: string;
  transitDays?: number;
  frequencyPerWeek?: number;
}

// Enhanced Commodity Classification Validation Service
function validateCommodityClassification(payload: RateOptionPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // HS Code validation
  if (payload.hsCode) {
    const hsCodePattern = /^\d{4}\.\d{2}(\.\d{2})?$/;
    if (!hsCodePattern.test(payload.hsCode)) {
      errors.push('HS code must be in format XXXX.XX or XXXX.XX.XX');
    }

    // HS code range validation (example ranges)
    const hsCodeNum = parseInt(payload.hsCode.replace(/\./g, ''));
    if (hsCodeNum < 100 || hsCodeNum > 999999) {
      errors.push('HS code must be between 0100.00 and 9999.99');
    }
  }

  // Commodity description validation
  if (payload.commodityDescription && payload.commodityDescription.length > 500) {
    errors.push('Commodity description must not exceed 500 characters');
  }

  // UN Number validation for hazardous materials
  if (payload.unNumber) {
    const unPattern = /^UN\d{4}$/;
    if (!unPattern.test(payload.unNumber)) {
      errors.push('UN Number must be in format UNXXXX');
    }
  }

  // Packing group validation
  if (payload.packingGroup && !['I', 'II', 'III'].includes(payload.packingGroup)) {
    errors.push('Packing group must be I, II, or III');
  }

  // Flash point validation for flammable materials
  if (payload.flashPointC !== undefined) {
    if (payload.flashPointC < -50 || payload.flashPointC > 300) {
      errors.push('Flash point must be between -50°C and 300°C');
    }
  }

  return { valid: errors.length === 0, errors };
}

// Enhanced Container Validation Service
function validateContainerCompatibility(payload: RateOptionPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Container ISO code validation
  if (payload.containerIsoCode) {
    const isoPattern = /^[A-Z]{4}\d{7}$/;
    if (!isoPattern.test(payload.containerIsoCode)) {
      errors.push('Container ISO code must be 4 letters followed by 7 digits');
    }
  }

  // Weight validation
  if (payload.containerTareWeightKg !== undefined && payload.containerTareWeightKg <= 0) {
    errors.push('Container tare weight must be positive');
  }

  if (payload.containerMaxPayloadKg !== undefined && payload.containerMaxPayloadKg <= 0) {
    errors.push('Container maximum payload must be positive');
  }

  // Container-commodity compatibility matrix
  const containerCompatibility: Record<ContainerType, CommodityType[]> = {
    standard: ['general', 'fragile', 'hazardous'],
    open_top: ['general', 'oversized', 'hazardous'],
    flat_rack: ['oversized', 'general'],
    reefer: ['perishable', 'pharmaceutical', 'hazardous'],
    platform: ['oversized']
  };

  if (payload.containerType && payload.commodityType) {
    const allowedCommodities = containerCompatibility[payload.containerType] || [];
    if (!allowedCommodities.includes(payload.commodityType)) {
      errors.push(`${payload.commodityType} commodity is not compatible with ${payload.containerType} container`);
    }
  }

  // Size-specific validation
  if (payload.containerSize === "20'" && payload.containerType === 'reefer') {
    // 20' reefers have specific limitations
    if (payload.commodityType === 'oversized') {
      errors.push('Oversized cargo not suitable for 20\' reefer containers');
    }
  }

  return { valid: errors.length === 0, errors };
}

// Enhanced Hazardous Materials Validation
function validateHazardousMaterials(payload: RateOptionPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // IMDG class validation
  if (payload.imdgClass) {
    const validImdgClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const imdgClassNum = payload.imdgClass.replace(/[^1-9]/g, '');
    if (!validImdgClasses.includes(imdgClassNum)) {
      errors.push('IMDG class must be between 1 and 9');
    }
  }

  // UN Number required for hazardous materials
  if (!payload.unNumber) {
    errors.push('UN Number is required for hazardous materials');
  }

  // Packing group required for hazardous materials
  if (!payload.packingGroup) {
    errors.push('Packing group is required for hazardous materials');
  }

  // Marine pollutant validation
  if (payload.marinePollutant && !payload.commodityDescription?.toLowerCase().includes('marine pollutant')) {
    errors.push('Marine pollutant flag requires proper commodity description');
  }

  // Hazardous materials cannot be transported in certain container types
  if (payload.containerType === 'platform' && payload.commodityType === 'hazardous') {
    errors.push('Hazardous materials cannot be transported in platform containers');
  }

  return { valid: errors.length === 0, errors };
}

// Enhanced Reefer Requirements Validation
function validateReeferRequirements(payload: RateOptionPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Temperature validation
  if (payload.temperatureControlMinC === undefined || payload.temperatureControlMaxC === undefined) {
    errors.push('Temperature range is required for reefer cargo');
  } else {
    if (payload.temperatureControlMinC < -50 || payload.temperatureControlMinC > 30) {
      errors.push('Minimum temperature must be between -50°C and 30°C');
    }
    if (payload.temperatureControlMaxC < -20 || payload.temperatureControlMaxC > 30) {
      errors.push('Maximum temperature must be between -20°C and 30°C');
    }
    if (payload.temperatureControlMinC >= payload.temperatureControlMaxC) {
      errors.push('Minimum temperature must be lower than maximum temperature');
    }
  }

  // Reefer settings validation
  if (payload.reeferSettings) {
    const { temperatureSetPointC, ventilationSetting, humidityControl } = payload.reeferSettings;
    
    if (temperatureSetPointC < -50 || temperatureSetPointC > 30) {
      errors.push('Temperature set point must be between -50°C and 30°C');
    }

    if (!['closed', 'open', 'partial'].includes(ventilationSetting)) {
      errors.push('Ventilation setting must be closed, open, or partial');
    }

    // Humidity control validation for specific commodities
    if (payload.commodityType === 'pharmaceutical' && !humidityControl) {
      errors.push('Humidity control required for pharmaceutical products');
    }
  }

  return { valid: errors.length === 0, errors };
}

// Enhanced Oversized Cargo Validation
function validateOversizedCargo(payload: RateOptionPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Dimension validation
  if (payload.oversizedLengthCm === undefined || 
      payload.oversizedWidthCm === undefined || 
      payload.oversizedHeightCm === undefined) {
    errors.push('All dimensions (length, width, height) are required for oversized cargo');
  } else {
    if (payload.oversizedLengthCm <= 0 || payload.oversizedLengthCm > 2000) {
      errors.push('Length must be between 1cm and 2000cm');
    }
    if (payload.oversizedWidthCm <= 0 || payload.oversizedWidthCm > 500) {
      errors.push('Width must be between 1cm and 500cm');
    }
    if (payload.oversizedHeightCm <= 0 || payload.oversizedHeightCm > 500) {
      errors.push('Height must be between 1cm and 500cm');
    }

    // Volume validation
    const volume = payload.oversizedLengthCm * payload.oversizedWidthCm * payload.oversizedHeightCm;
    if (volume > 500000000) { // 500 cubic meters
      errors.push('Cargo volume exceeds maximum allowed limit');
    }
  }

  // Container compatibility for oversized cargo
  if (payload.containerType && payload.containerType !== 'open_top' && payload.containerType !== 'flat_rack' && payload.containerType !== 'platform') {
    errors.push('Oversized cargo requires open-top, flat-rack, or platform container');
  }

  return { valid: errors.length === 0, errors };
};

export type TransitPoint = {
  id?: string;
  code: string;
  name?: string;
  mode: TransportMode;
  minConnectionHours?: number;
};

export type LegConnection = {
  id?: string;
  fromLegId: string;
  toLegId: string;
  transitPointId?: string;
  dwellHours?: number;
};

export type ChargeRow = {
  id?: string;
  rowCode?: string;
  rowName: string;
  currency?: string;
  includeInTotal?: boolean;
  remarks?: string;
  sortOrder?: number;
  valuesByEquipment: Record<string, number>;
};

export type RateOptionPayload = {
  id?: string;
  quoteId: string;
  quoteVersionId?: string;
  templateId?: string;
  optionName?: string;
  carrierName: string;
  rateType?: RateType;
  rateValidUntil?: string;
  transitTimeDays?: number;
  frequencyPerWeek?: number;
  mode?: 'single' | 'multimodal';
  equipmentColumns: Array<{ key: string; label: string }>;
  legs: RateLeg[];
  transitPoints?: TransitPoint[];
  legConnections?: LegConnection[];
  chargeRows: ChargeRow[];
  containerType?: ContainerType;
  containerSize?: ContainerSize;
  commodityType?: CommodityType;
  hsCode?: string;
  imdgClass?: string;
  temperatureControlMinC?: number;
  temperatureControlMaxC?: number;
  oversizedLengthCm?: number;
  oversizedWidthCm?: number;
  oversizedHeightCm?: number;
  originCode?: string;
  destinationCode?: string;
  standaloneMode?: boolean;
  optionOrdinal?: 1 | 2 | 3 | 4;
  multimodalRuleConfig?: Record<string, unknown>;
  remarks?: string;
  // Enhanced fields for commodity classification
  commodityDescription?: string;
  unNumber?: string;
  packingGroup?: 'I' | 'II' | 'III';
  flashPointC?: number;
  marinePollutant?: boolean;
  // Enhanced fields for container validation
  containerTareWeightKg?: number;
  containerMaxPayloadKg?: number;
  containerIsoCode?: string;
  reeferSettings?: {
    temperatureSetPointC: number;
    ventilationSetting: 'closed' | 'open' | 'partial';
    humidityControl?: boolean;
  };
};

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

const COMMODITY_CONTAINER_RULES: Record<CommodityType, ContainerType[]> = {
  general: ['standard', 'open_top', 'flat_rack', 'platform'],
  hazardous: ['standard', 'open_top', 'flat_rack'],
  perishable: ['reefer'],
  pharmaceutical: ['reefer'],
  fragile: ['standard', 'reefer'],
  oversized: ['open_top', 'flat_rack', 'platform'],
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

function normalizeCode(value: string | undefined) {
  return String(value || '').trim().toUpperCase();
}

function isNycCode(value: string | undefined) {
  return NYC_CODES.has(normalizeCode(value));
}

function isDehraDunCode(value: string | undefined) {
  return DEHRA_DUN_CODES.has(normalizeCode(value));
}

export function validatePayload(payload: RateOptionPayload): string[] {
  const errors: string[] = [];

  if (!payload.quoteId) errors.push('quoteId is required');
  if (!payload.carrierName) errors.push('carrierName is required');
  if (!payload.rateType) errors.push('rateType is required');
  if (payload.rateType && !ALLOWED_RATE_TYPES.includes(payload.rateType)) {
    errors.push(`rateType must be one of ${ALLOWED_RATE_TYPES.join(', ')}`);
  }
  if (
    payload.multimodalRuleConfig !== undefined &&
    (typeof payload.multimodalRuleConfig !== 'object' ||
      payload.multimodalRuleConfig === null ||
      Array.isArray(payload.multimodalRuleConfig))
  ) {
    errors.push('multimodalRuleConfig must be an object');
  }
  if (!Array.isArray(payload.equipmentColumns) || payload.equipmentColumns.length === 0) {
    errors.push('equipmentColumns must contain at least one column');
  }
  if (!Array.isArray(payload.legs) || payload.legs.length === 0) {
    errors.push('At least one transport leg is required');
  }
  if (payload.rateValidUntil) {
    const expiryTime = Date.parse(payload.rateValidUntil);
    if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
      errors.push('rateValidUntil cannot be in the past');
    }
  }

  const sortedLegs = [...(payload.legs || [])].sort((a, b) => a.sequenceNo - b.sequenceNo);
  sortedLegs.forEach((leg, index) => {
    if (leg.sequenceNo !== index + 1) {
      errors.push(`Invalid leg sequence for leg ${leg.id || `#${index + 1}`}`);
    }
    if (index > 0) {
      const prev = sortedLegs[index - 1];
      if (String(prev.destinationCode || '').toUpperCase() !== String(leg.originCode || '').toUpperCase()) {
        errors.push(`Route break between sequence ${prev.sequenceNo} and ${leg.sequenceNo}`);
      }
      const allowed = ALLOWED_MULTI_LEG_TRANSITIONS[prev.mode] || [];
      if (!allowed.includes(leg.mode)) {
        errors.push(`Unsupported transport transition from ${prev.mode} to ${leg.mode}`);
      }
    }
  });

  for (const row of payload.chargeRows || []) {
    for (const value of Object.values(row.valuesByEquipment || {})) {
      if (Number(value) < 0) {
        errors.push(`Negative amount is not allowed in row ${row.rowName}`);
      }
    }
  }

  const legsById = new Set((payload.legs || []).map((leg) => leg.id).filter(Boolean));
  const transitPointIds = new Set((payload.transitPoints || []).map((point) => point.id).filter(Boolean));
  for (const point of payload.transitPoints || []) {
    if (!String(point.code || '').trim()) {
      errors.push('transitPoints must include code');
    }
    if (!point.mode) {
      errors.push('transitPoints must include mode');
    }
    if (Number(point.minConnectionHours || 0) < 0) {
      errors.push('transitPoints minConnectionHours cannot be negative');
    }
  }
  for (const connection of payload.legConnections || []) {
    if (!connection.fromLegId || !connection.toLegId) {
      errors.push('legConnections must include fromLegId and toLegId');
      continue;
    }
    if (!legsById.has(connection.fromLegId) || !legsById.has(connection.toLegId)) {
      errors.push('legConnections must reference existing leg IDs');
    }
    if (connection.transitPointId && !transitPointIds.has(connection.transitPointId)) {
      errors.push('legConnections transitPointId must reference existing transit points');
    }
    if (Number(connection.dwellHours || 0) < 0) {
      errors.push('legConnections dwellHours cannot be negative');
    }
  }

  if (!payload.containerType || !payload.containerSize || !payload.commodityType) {
    errors.push('containerType, containerSize, and commodityType are required');
  }

  if (payload.containerType && payload.containerSize) {
    const key = `${payload.containerType}:${payload.containerSize}`;
    if (!CONTAINER_MULTIPLIERS[key]) {
      errors.push(`Unsupported container profile ${payload.containerType} ${payload.containerSize}`);
    }
  }

  if (payload.commodityType && payload.containerType) {
    const allowedContainers = COMMODITY_CONTAINER_RULES[payload.commodityType];
    if (!allowedContainers?.includes(payload.containerType)) {
      errors.push(`${payload.commodityType} is not allowed with ${payload.containerType}`);
    }
  }

  if (payload.commodityType === 'hazardous' && !String(payload.imdgClass || '').trim()) {
    errors.push('imdgClass is required for hazardous cargo');
  }

  if (
    (payload.commodityType === 'perishable' || payload.commodityType === 'pharmaceutical') &&
    payload.containerType === 'reefer'
  ) {
    const min = payload.temperatureControlMinC;
    const max = payload.temperatureControlMaxC;
    const hasTemperatureRange = Number.isFinite(min) && Number.isFinite(max);
    if (!hasTemperatureRange) {
      errors.push('temperatureControlMinC and temperatureControlMaxC are required for reefer cargo');
    } else if (Number(min) >= Number(max)) {
      errors.push('temperatureControlMinC must be lower than temperatureControlMaxC');
    }
  }

  if (payload.commodityType === 'oversized') {
    if (
      Number(payload.oversizedLengthCm || 0) <= 0 ||
      Number(payload.oversizedWidthCm || 0) <= 0 ||
      Number(payload.oversizedHeightCm || 0) <= 0
    ) {
      errors.push('oversized dimensions are required for oversized cargo');
    }
  }

  const firstLegOrigin = payload.originCode || sortedLegs[0]?.originCode;
  const lastLegDestination = payload.destinationCode || sortedLegs[sortedLegs.length - 1]?.destinationCode;
  if (sortedLegs.length > 0 && (!isNycCode(firstLegOrigin) || !isDehraDunCode(lastLegDestination))) {
    errors.push('Route must start from New York City and end at Dehra Dun Airport');
  }

  if (payload.standaloneMode && !payload.optionOrdinal) {
    errors.push('optionOrdinal is required when standaloneMode is true');
  }

  if (payload.optionOrdinal && ![1, 2, 3, 4].includes(payload.optionOrdinal)) {
    errors.push('optionOrdinal must be one of 1, 2, 3, 4');
  }

  // Enhanced commodity classification validation
  const commodityValidation = validateCommodityClassification(payload);
  errors.push(...commodityValidation.errors);

  // Enhanced container validation service
  const containerValidation = validateContainerCompatibility(payload);
  errors.push(...containerValidation.errors);

  // Enhanced hazardous materials validation
  if (payload.commodityType === 'hazardous') {
    const hazmatValidation = validateHazardousMaterials(payload);
    errors.push(...hazmatValidation.errors);
  }

  // Enhanced reefer validation for temperature-sensitive cargo
  if (payload.containerType === 'reefer' && 
      (payload.commodityType === 'perishable' || payload.commodityType === 'pharmaceutical')) {
    const reeferValidation = validateReeferRequirements(payload);
    errors.push(...reeferValidation.errors);
  }

  // Enhanced oversized cargo validation
  if (payload.commodityType === 'oversized') {
    const oversizedValidation = validateOversizedCargo(payload);
    errors.push(...oversizedValidation.errors);
  }

  return errors;
}

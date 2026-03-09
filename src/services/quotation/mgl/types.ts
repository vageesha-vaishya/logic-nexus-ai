export type TransportMode = 'air' | 'ocean' | 'road' | 'rail';
export type MglContainerType =
  | 'standard'
  | 'open_top'
  | 'flat_rack'
  | 'reefer'
  | 'platform';
export type MglContainerSize = "20'" | "40'" | "40'HC" | "45'";
export type MglCommodityType =
  | 'general'
  | 'hazardous'
  | 'perishable'
  | 'pharmaceutical'
  | 'fragile'
  | 'oversized';
export type MglRateType = 'spot' | 'contract' | 'market' | 'negotiated';

export interface MglEquipmentColumn {
  key: string;
  label: string;
  enabled?: boolean;
}

export interface MglTransportLeg {
  id: string;
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

export interface MglTransitPoint {
  id: string;
  code: string;
  name?: string;
  mode: TransportMode;
  minConnectionHours?: number;
}

export interface MglLegConnection {
  id: string;
  fromLegId: string;
  toLegId: string;
  transitPointId?: string;
  dwellHours?: number;
}

export interface MglChargeRow {
  id: string;
  rowCode?: string;
  rowName: string;
  currency: string;
  includeInTotal?: boolean;
  remarks?: string;
  valuesByEquipment: Record<string, number>;
}

export interface MglRateOption {
  id: string;
  quoteId?: string;
  quoteVersionId?: string;
  optionName?: string;
  carrierName: string;
  transitTimeDays?: number;
  frequencyPerWeek?: number;
  mode: 'single' | 'multimodal';
  rateType?: MglRateType;
  rateValidUntil?: string;
  equipmentColumns: MglEquipmentColumn[];
  legs: MglTransportLeg[];
  transitPoints?: MglTransitPoint[];
  legConnections?: MglLegConnection[];
  chargeRows: MglChargeRow[];
  containerType?: MglContainerType;
  containerSize?: MglContainerSize;
  commodityType?: MglCommodityType;
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
}

export interface MglScenarioConfig {
  quoteId?: string;
  quoteVersionId?: string;
  carrierName: string;
  containerType: MglContainerType;
  containerSize: MglContainerSize;
  commodityType: MglCommodityType;
  originCode: string;
  destinationCode: string;
  transitPoints?: MglTransitPoint[];
  legConnections?: MglLegConnection[];
  legs: MglTransportLeg[];
  baseChargeRows: MglChargeRow[];
  hsCode?: string;
  imdgClass?: string;
  temperatureControlMinC?: number;
  temperatureControlMaxC?: number;
  oversizedLengthCm?: number;
  oversizedWidthCm?: number;
  oversizedHeightCm?: number;
  rateValidUntil?: string;
  rateTypeMultipliers?: Partial<Record<MglRateType, number>>;
  equipmentColumns?: MglEquipmentColumn[];
}

export interface MglCalculatedOption {
  optionId: string;
  totalsByEquipment: Record<string, number>;
  grandTotal: number;
  rowTotals: Array<{ rowId: string; rowName: string; total: number }>;
}

export interface MglValidationIssue {
  code:
    | 'EMPTY_LEGS'
    | 'LEG_SEQUENCE_INVALID'
    | 'LEG_ROUTE_BREAK'
    | 'UNSUPPORTED_MODE_COMBINATION'
    | 'NEGATIVE_CHARGE'
    | 'CONTAINER_UNSUPPORTED'
    | 'CONTAINER_COMMODITY_INCOMPATIBLE'
    | 'ROUTE_OUT_OF_SCOPE'
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_OPTION_SET'
    | 'RATE_EXPIRED';
  message: string;
  legId?: string;
  rowId?: string;
}

export interface MglValidationResult {
  valid: boolean;
  errors: MglValidationIssue[];
  warnings: MglValidationIssue[];
}

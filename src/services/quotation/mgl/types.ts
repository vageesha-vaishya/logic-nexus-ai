export type TransportMode = 'air' | 'ocean' | 'road' | 'rail';

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
  equipmentColumns: MglEquipmentColumn[];
  legs: MglTransportLeg[];
  chargeRows: MglChargeRow[];
  remarks?: string;
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
    | 'NEGATIVE_CHARGE';
  message: string;
  legId?: string;
  rowId?: string;
}

export interface MglValidationResult {
  valid: boolean;
  errors: MglValidationIssue[];
  warnings: MglValidationIssue[];
}

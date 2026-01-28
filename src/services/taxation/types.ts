export interface TaxJurisdiction {
  id: string;
  code: string;
  name: string;
  type: 'COUNTRY' | 'STATE' | 'CITY' | 'DISTRICT';
  parentId?: string;
}

export interface TaxCode {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
}

export interface TaxRule {
  id: string;
  jurisdictionId: string;
  taxCodeId?: string;
  rate: number;
  priority: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  ruleType: 'STANDARD' | 'REDUCED' | 'EXEMPT';
}

export interface TaxCalculationRequest {
  jurisdictionCode: string;
  items: {
    amount: number;
    taxCode?: string;
  }[];
}

export interface TaxCalculationResult {
  totalTax: number;
  breakdown: {
    level: string;
    rate: number;
    amount: number;
  }[];
}

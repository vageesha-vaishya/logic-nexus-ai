export interface TaxJurisdiction {
  id: string;
  code: string;
  name: string;
  type: 'COUNTRY' | 'STATE' | 'CITY' | 'DISTRICT' | 'COUNTY';
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
    id?: string;
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
  lineItems: {
    id?: string;
    taxAmount: number;
    taxRate: number;
  }[];
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface NexusDeterminationRequest {
  origin: Address;
  destination: Address;
  tenantId: string; // To look up tenant's physical presence
}

export interface TenantNexus {
  id: string;
  tenantId: string;
  jurisdictionId: string;
  registrationNumber?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface NexusDeterminationResult {
  hasNexus: boolean;
  jurisdictions: string[]; // List of jurisdiction codes where nexus is established
}


export interface RequestContext {
  tenantId: string;
  domainId: string; // From platform_domains
  userId?: string;
  currency: string;
  metadata?: Record<string, any>;
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit?: string;
  // Dynamic attributes for domain-specific data (e.g., weight/volume for logistics, loan amount/term for banking)
  attributes: Record<string, any>; 
}

export interface QuoteResult {
  quoteId?: string;
  totalAmount: number;
  currency: string;
  breakdown: Record<string, any>; // Flexible structure for domain-specific breakdown
  validUntil?: Date;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

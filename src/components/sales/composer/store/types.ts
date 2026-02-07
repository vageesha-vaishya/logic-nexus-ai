export interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service' | 'pickup' | 'delivery' | 'main';
  serviceOnlyCategory?: string;
  carrierName?: string;
  carrierId?: string;
}

export interface Charge {
  id?: string;
  description: string;
  amount: number;
  currency: string;
  type: 'buying' | 'selling';
  category: string;
  basis: string;
  tax_percent?: number;
  status?: string;
}

export interface QuoteState {
  // Metadata
  quoteId: string | null;
  versionId: string | null;
  optionId: string | null;
  tenantId: string | null;
  marketAnalysis: string | null;
  confidenceScore: number | null;
  anomalies: any[];
  
  // Workflow
  currentStep: number;
  viewMode: 'overview' | 'composer';
  isLoading: boolean;
  isSaving: boolean;
  lastSyncTimestamp?: number;

  // Data
  legs: Leg[];
  charges: any[]; // Combined charges (buying/selling)
  quoteData: any; // Ideally typed as QuoteFormValues
  options: any[]; // All available options
  
  // Validation
  validationErrors: string[];
  validationWarnings: string[];
  
  // Pricing
  autoMargin: boolean;
  marginPercent: number;

  // Reference Data
  referenceData: {
    serviceTypes: any[];
    transportModes: any[];
    chargeCategories: any[];
    chargeBases: any[];
    currencies: any[];
    tradeDirections: any[];
    containerTypes: any[];
    containerSizes: any[];
    carriers: any[];
    chargeSides: any[];
  };
}

export type QuoteAction =
  | { type: 'INITIALIZE'; payload: Partial<QuoteState> }
  | { type: 'SET_REFERENCE_DATA'; payload: Partial<QuoteState['referenceData']> }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: 'overview' | 'composer' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'UPDATE_QUOTE_DATA'; payload: any }
  | { type: 'SET_LEGS'; payload: Leg[] }
  | { type: 'ADD_LEG'; payload: Leg }
  | { type: 'UPDATE_LEG'; payload: { id: string; updates: Partial<Leg> } }
  | { type: 'REMOVE_LEG'; payload: string }
  | { type: 'SET_CHARGES'; payload: any[] }
  | { type: 'ADD_COMBINED_CHARGE'; payload: any }
  | { type: 'UPDATE_COMBINED_CHARGE'; payload: { index: number; charge: any } }
  | { type: 'REMOVE_COMBINED_CHARGE'; payload: number }
  | { type: 'SET_OPTIONS'; payload: any[] }
  | { type: 'SET_VALIDATION'; payload: { errors: string[]; warnings: string[] } }
  | { type: 'SET_ANALYSIS_DATA'; payload: { marketAnalysis?: string | null; confidenceScore?: number | null; anomalies?: any[] } }
  | { type: 'SET_PRICING_CONFIG'; payload: { autoMargin?: boolean; marginPercent?: number } }
  | { type: 'RESET' };

import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import { QuoteState, QuoteAction } from './types';

const initialState: QuoteState = {
  quoteId: null,
  versionId: null,
  optionId: null,
  tenantId: null,
  marketAnalysis: null,
  confidenceScore: null,
  anomalies: [],
  currentStep: 1,
  viewMode: 'composer',
  isLoading: false,
  isSaving: false,
  legs: [],
  charges: [],
  quoteData: {},
  options: [],
  validationErrors: [],
  validationWarnings: [],
  autoMargin: true,
  marginPercent: 0,
  referenceData: {
    serviceTypes: [],
    transportModes: [],
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
    tradeDirections: [],
    containerTypes: [],
    containerSizes: [],
    carriers: [],
    chargeSides: []
  }
};

function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case 'INITIALIZE':
      return { ...state, ...action.payload };
    case 'SET_REFERENCE_DATA':
      return { 
        ...state, 
        referenceData: { ...state.referenceData, ...action.payload } 
      };
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };
    case 'UPDATE_QUOTE_DATA':
      return { ...state, quoteData: { ...state.quoteData, ...action.payload } };
    case 'SET_LEGS':
      return { ...state, legs: action.payload };
    case 'ADD_LEG':
      return { ...state, legs: [...state.legs, action.payload] };
    case 'UPDATE_LEG':
      return {
        ...state,
        legs: state.legs.map(leg => 
          leg.id === action.payload.id ? { ...leg, ...action.payload.updates } : leg
        )
      };
    case 'REMOVE_LEG':
      return { ...state, legs: state.legs.filter(l => l.id !== action.payload) };
    case 'SET_CHARGES':
      return { ...state, charges: action.payload };
    case 'ADD_COMBINED_CHARGE':
      return { ...state, charges: [...state.charges, action.payload] };
    case 'UPDATE_COMBINED_CHARGE':
      return {
        ...state,
        charges: state.charges.map((c, i) => i === action.payload.index ? action.payload.charge : c)
      };
    case 'REMOVE_COMBINED_CHARGE':
      return { ...state, charges: state.charges.filter((_, i) => i !== action.payload) };
    case 'SET_OPTIONS':
      return { ...state, options: action.payload };
    case 'SET_VALIDATION':
      return { 
        ...state, 
        validationErrors: action.payload.errors, 
        validationWarnings: action.payload.warnings 
      };
    case 'SET_ANALYSIS_DATA':
      return { ...state, ...action.payload };
    case 'SET_PRICING_CONFIG':
      return { ...state, ...action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const QuoteStoreContext = createContext<{
  state: QuoteState;
  dispatch: React.Dispatch<QuoteAction>;
} | null>(null);

export function QuoteStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, initialState);
  
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <QuoteStoreContext.Provider value={value}>
      {children}
    </QuoteStoreContext.Provider>
  );
}

export function useQuoteStore() {
  const context = useContext(QuoteStoreContext);
  if (!context) {
    throw new Error('useQuoteStore must be used within a QuoteStoreProvider');
  }
  return context;
}

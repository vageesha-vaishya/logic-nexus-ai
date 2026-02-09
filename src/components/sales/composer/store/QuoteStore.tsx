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
  isGeneratingSmart: false,
  legs: [],
  charges: [],
  quoteData: {},
  options: [],
  deletedLegIds: [],
  deletedChargeIds: [],
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
    chargeSides: [],
    serviceLegCategories: []
  },
  basisModal: {
    isOpen: false,
    target: null,
    config: {
      tradeDirection: '',
      containerType: '',
      containerSize: '',
      quantity: 1
    }
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
    case 'SET_GENERATING_SMART':
      return { ...state, isGeneratingSmart: action.payload };
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
    case 'REMOVE_LEG': {
      const legToRemove = state.legs.find(l => l.id === action.payload);
      const chargeIdsToDelete: string[] = [];
      if (legToRemove) {
        legToRemove.charges.forEach((charge: any) => {
          if (charge.buy?.dbChargeId) chargeIdsToDelete.push(charge.buy.dbChargeId);
          if (charge.sell?.dbChargeId) chargeIdsToDelete.push(charge.sell.dbChargeId);
        });
      }
      return { 
        ...state, 
        legs: state.legs.filter(l => l.id !== action.payload),
        deletedLegIds: [...state.deletedLegIds, action.payload],
        deletedChargeIds: [...state.deletedChargeIds, ...chargeIdsToDelete]
      };
    }
    case 'REMOVE_LEG_CHARGE': {
      const { legId, chargeIdx } = action.payload;
      const leg = state.legs.find(l => l.id === legId);
      if (!leg) return state;

      const chargeToRemove = leg.charges[chargeIdx];
      const chargeIdsToDelete: string[] = [];
      if (chargeToRemove) {
        if (chargeToRemove.buy?.dbChargeId) chargeIdsToDelete.push(chargeToRemove.buy.dbChargeId);
        if (chargeToRemove.sell?.dbChargeId) chargeIdsToDelete.push(chargeToRemove.sell.dbChargeId);
      }

      return {
        ...state,
        legs: state.legs.map(l => 
          l.id === legId 
            ? { ...l, charges: l.charges.filter((_, idx) => idx !== chargeIdx) }
            : l
        ),
        deletedChargeIds: [...state.deletedChargeIds, ...chargeIdsToDelete]
      };
    }
    case 'SET_CHARGES':
      return { ...state, charges: action.payload };
    case 'ADD_COMBINED_CHARGE':
      return { ...state, charges: [...state.charges, action.payload] };
    case 'UPDATE_COMBINED_CHARGE':
      return {
        ...state,
        charges: state.charges.map((c, i) => i === action.payload.index ? action.payload.charge : c)
      };
    case 'REMOVE_COMBINED_CHARGE': {
      const chargeToRemove = state.charges[action.payload];
      const chargeIdsToDelete: string[] = [];
      if (chargeToRemove) {
        if (chargeToRemove.buy?.dbChargeId) chargeIdsToDelete.push(chargeToRemove.buy.dbChargeId);
        if (chargeToRemove.sell?.dbChargeId) chargeIdsToDelete.push(chargeToRemove.sell.dbChargeId);
      }
      return { 
        ...state, 
        charges: state.charges.filter((_, i) => i !== action.payload),
        deletedChargeIds: [...state.deletedChargeIds, ...chargeIdsToDelete]
      };
    }
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
    case 'CLEAR_DELETIONS':
      return {
        ...state,
        deletedLegIds: [],
        deletedChargeIds: []
      };
    case 'OPEN_BASIS_MODAL':
      return {
        ...state,
        basisModal: {
          ...state.basisModal,
          isOpen: true,
          target: action.payload.target,
          config: action.payload.config || state.basisModal.config
        }
      };
    case 'CLOSE_BASIS_MODAL':
      return {
        ...state,
        basisModal: {
          ...state.basisModal,
          isOpen: false,
          target: null
        }
      };
    case 'UPDATE_BASIS_CONFIG':
      return {
        ...state,
        basisModal: {
          ...state.basisModal,
          config: { ...state.basisModal.config, ...action.payload }
        }
      };
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

export function QuoteStoreProvider({ children, initialState: customInitialState }: { children: ReactNode, initialState?: Partial<QuoteState> }) {
  const [state, dispatch] = useReducer(quoteReducer, { ...initialState, ...customInitialState });
  
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

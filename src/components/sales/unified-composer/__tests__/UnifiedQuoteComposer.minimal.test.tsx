import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock FormZone to avoid inner dependencies like useIncoterms
vi.mock('../FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">Form Zone</div>
}));

vi.mock('../ResultsZone', () => ({
  ResultsZone: () => <div data-testid="results-zone">Results Zone</div>
}));

vi.mock('../FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">Finalize Section</div>
}));

// Helper to create chainable mocks
const createSimpleMock = (data: any, error: any = null) => {
  const finalPromise = Promise.resolve({ data, error });
  
  const level5 = { 
    then: (res: any, rej: any) => finalPromise.then(res, rej),
    single: () => ({ then: (res: any, rej: any) => finalPromise.then(res, rej) }),
    maybeSingle: () => ({ then: (res: any, rej: any) => finalPromise.then(res, rej) }),
  };
  
  const level4 = { ...level5, select: () => level5, eq: () => level5, order: () => level5, limit: () => level5, in: () => level5 };
  const level3 = { ...level4, select: () => level4, eq: () => level4, order: () => level4, limit: () => level4, in: () => level4 };
  const level2 = { ...level3, select: () => level3, eq: () => level3, order: () => level3, limit: () => level3, in: () => level3 };
  const level1 = { ...level2, select: () => level2, eq: () => level2, order: () => level2, limit: () => level2, in: () => level2 };
  
  return level1;
};

// Mock dependencies with problematic structure
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(() => ({ 
    scopedDb: {
        from: (table: string) => {
            return createSimpleMock([]);
        },
        rpc: () => createSimpleMock(null)
    }, 
    context: { tenantId: 'test-tenant' }, 
    supabase: {} 
  })),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user' } })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: vi.fn(() => ({ containerTypes: [], containerSizes: [] })),
}));
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: vi.fn(() => ({
    fetchRates: vi.fn(),
    loading: false,
    rates: [],
    error: null,
  })),
}));
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: vi.fn(() => ({
    analyze: vi.fn(),
    suggestions: [],
    loading: false,
  })),
}));
vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useQuoteStore: vi.fn(() => ({ state: { options: {} }, dispatch: vi.fn() })),
}));
vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepository: vi.fn(() => ({ saveQuote: vi.fn(), saveDraft: vi.fn() })),
  useQuoteRepositoryContext: () => ({ chargeCategories: [], chargeBases: [], currencies: [], containerTypes: [], locations: [], refetch: vi.fn() }),
}));
vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    getConfiguration = vi.fn().mockResolvedValue({});
  }
}));

describe('UnifiedQuoteComposer Minimal', () => {
  it('renders without crashing', () => {
    console.log('Starting minimal test');
    const queryClient = new QueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedQuoteComposer />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(true).toBe(true);
  });
});

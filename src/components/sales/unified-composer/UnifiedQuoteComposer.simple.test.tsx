
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from './UnifiedQuoteComposer';

// Hoist the mock function
const { mockScopedDbFrom } = vi.hoisted(() => {
  return { mockScopedDbFrom: vi.fn() };
});

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: { from: mockScopedDbFrom },
    loading: false,
    error: null,
    context: {
      tenantId: 'test-tenant',
      franchiseId: 'test-franchise'
    }
  })
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'token' }
  })
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteStore: () => ({
    state: {
      quoteId: 'test-quote',
      versionId: 'test-version',
      referenceData: {
         containerTypes: [],
         containerSizes: []
      }
    },
    dispatch: vi.fn()
  })
}));

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    error: null,
    fetchRates: vi.fn()
  })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    suggestions: [],
    loading: false
  })
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: []
  })
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
  ThemeProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    getConfiguration = vi.fn().mockResolvedValue({})
  }
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    saveQuote: vi.fn(),
    loadQuote: vi.fn()
  })
}));

vi.mock('@/services/quotation/QuotationRankingService', () => ({
  QuotationRankingService: {
    rankOptions: vi.fn().mockReturnValue([])
  }
}));

// Mock child components to isolate the test
vi.mock('./FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">FormZone</div>
}));

vi.mock('./ResultsZone', () => ({
  ResultsZone: () => <div data-testid="results-zone">ResultsZone</div>
}));

vi.mock('./FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>
}));

// Helper to create safe chain
const createSafeChain = (name: string, data: any = []) => {
  const chain: any = { 
      _name: name,
      data: data, 
      error: null
  };
  
  const methods = ['select', 'eq', 'order', 'limit', 'abortSignal', 'upsert', 'in', 'or'];
  methods.forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  
  const singleResult = { data: Array.isArray(data) ? (data[0] || null) : data, error: null };
  chain.maybeSingle = vi.fn().mockResolvedValue(singleResult);
  chain.single = vi.fn().mockResolvedValue(singleResult);
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  
  return chain;
};

describe('UnifiedQuoteComposer Simple Test', () => {
  it('renders without crashing', () => {
    mockScopedDbFrom.mockImplementation((table: string) => {
        return createSafeChain(table, []);
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId="test-quote" />
      </MemoryRouter>
    );
    
    expect(true).toBe(true);
  });
});

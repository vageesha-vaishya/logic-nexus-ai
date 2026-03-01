
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { useCRM } from '@/hooks/useCRM';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { id: 'test-profile' },
  }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({
    multi_option_enabled: true,
  });
  return { QuotationConfigurationService: MockService };
});
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    fetchRates: vi.fn(),
    clearResults: vi.fn(),
  }),
  ContainerResolver: {},
}));
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn().mockResolvedValue({}),
  enrichPayload: vi.fn((data) => data),
}));

vi.mock('@/components/notifications/QuotationSuccessToast', () => ({
  showQuotationSuccessToast: vi.fn(),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteStore: () => ({
    state: {
      quoteId: null,
      versionId: null,
      optionId: null,
      tenantId: 'test-tenant-id',
      quoteData: null,
      legs: [],
      charges: [],
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
    containerTypes: [],
    locations: [],
    refetch: vi.fn(),
  }),
}));

vi.mock('@/services/quotation/QuotationNumberService');
vi.mock('@/services/pricing.service');
vi.mock('@/services/QuoteOptionService');
vi.mock('@/services/quotation/QuotationOptionCrudService');
vi.mock('@/services/quotation/QuotationRankingService');

// Mock child components to isolate testing
vi.mock('../FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">Form Zone</div>
}));
vi.mock('../ResultsZone', () => ({
  ResultsZone: () => <div data-testid="results-zone">Results Zone</div>
}));
vi.mock('../FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">Finalize Section</div>
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const createChainableMock = (data: any, error: any = null) => {
  const chain: any = {};
  
  const returnChain = () => chain;
  const returnPromise = () => Promise.resolve({ data, error });

  chain.select = vi.fn(returnChain);
  chain.eq = vi.fn(returnChain);
  chain.single = vi.fn(returnPromise);
  chain.maybeSingle = vi.fn(returnPromise);
  chain.order = vi.fn(returnChain);
  chain.in = vi.fn(returnChain);
  chain.insert = vi.fn(returnPromise);
  chain.update = vi.fn(returnPromise);
  chain.delete = vi.fn(returnPromise);
  
  // Robust thenable implementation
  const promise = Promise.resolve({ data, error });
  chain.then = (onFulfilled: any, onRejected: any) => promise.then(onFulfilled, onRejected);
  chain.catch = (onRejected: any) => promise.catch(onRejected);
  chain.finally = (onFinally: any) => promise.finally(onFinally);
  
  return chain;
};

describe('UnifiedQuoteComposer - Partial Load Failure', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('displays error when line items fail to load but keeps actions accessible', async () => {
    const mockScopedDb = {
      from: vi.fn((table: string) => {
        if (table === 'quotes') {
            return createChainableMock({
                id: 'test-quote-id',
                current_version_id: 'ver-1',
                tenant_id: 'test-tenant',
                transport_mode: 'ocean',
                status: 'DRAFT'
            });
        }
        if (table === 'quote_items') {
            // Simulate failure for quote_items
            return createChainableMock(null, { message: 'RLS denied', code: '42501' });
        }
        // Default success for others
        return createChainableMock([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (useCRM as any).mockReturnValue({
      scopedDb: mockScopedDb,
      context: { tenantId: 'test-tenant' },
      supabase: {},
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedQuoteComposer quoteId="test-quote-id" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading quote...')).not.toBeInTheDocument();
    });

    // Check for error message
    expect(screen.getByText('Failed to load line items')).toBeInTheDocument();
    expect(screen.getByText('Some data failed to load:')).toBeInTheDocument();
    
    // Verify FormZone is rendered (implying the page didn't crash)
    expect(screen.getByTestId('form-zone')).toBeInTheDocument();
  });
});

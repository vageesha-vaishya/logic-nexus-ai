import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as UnifiedQuoteComposerModule from '../UnifiedQuoteComposer';
const { UnifiedQuoteComposer } = UnifiedQuoteComposerModule;
import { useQuoteStore } from '@/components/sales/composer/store/QuoteStore';
import { useCRM } from '@/hooks/useCRM';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a stable mock for URLSearchParams to avoid reinitialization issues


// Hoist mocks to ensure stability
const { 
  mockDispatch, 
  mockNavigate,
  mockToast,
  mockInvokeAiAdvisor,
  mockSearchParams,
  mockSetSearchParams,
  mockForm
} = vi.hoisted(() => {
  const mockDispatch = vi.fn();
  const mockNavigate = vi.fn();
  const mockToast = vi.fn();
  const mockInvokeAiAdvisor = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSearchParams = new URLSearchParams();
  const mockSetSearchParams = vi.fn();
  
  const mockForm = {
    handleSubmit: (fn: any) => fn,
    reset: vi.fn(),
    setValue: vi.fn(),
    getValues: vi.fn(() => ({})),
    watch: vi.fn((arg) => {
      if (typeof arg === 'function') {
          return { unsubscribe: vi.fn() };
      }
      return {};
    }),
    register: vi.fn(),
    formState: { errors: {}, isDirty: false },
    control: {
        _subjects: { state: { next: vi.fn() } },
        register: vi.fn(),
        unregister: vi.fn(),
        getFieldState: vi.fn(),
        _names: { mount: new Set(), unMount: new Set(), array: new Set(), watch: new Set() },
        _proxyFormState: {},
        _formValues: {},
        _state: {},
        _options: {},
    },
    trigger: vi.fn(),
    clearErrors: vi.fn(),
    setError: vi.fn(),
    setFocus: vi.fn(),
  };

  return { 
    mockDispatch, 
    mockNavigate,
    mockToast,
    mockInvokeAiAdvisor,
    mockSearchParams,
    mockSetSearchParams,
    mockForm
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '' }),
    useParams: () => ({}),
  };
});

// Helper to create a chainable mock query object (new instance per call to avoid cycles)
const createMockQuery = (data: any) => {
    // We create a new object for each step in the chain to avoid circular references
    // while maintaining the chainable interface.
    const createChainStep = (currentData: any, stepName: string) => {
      const step = {
        select: vi.fn().mockImplementation(() => createChainStep(currentData, 'select')),
        eq: vi.fn().mockImplementation(() => createChainStep(currentData, 'eq')),
        neq: vi.fn().mockImplementation(() => createChainStep(currentData, 'neq')),
        ilike: vi.fn().mockImplementation(() => createChainStep(currentData, 'ilike')),
        in: vi.fn().mockImplementation(() => createChainStep(currentData, 'in')),
        order: vi.fn().mockImplementation(() => createChainStep(currentData, 'order')),
        limit: vi.fn().mockImplementation(() => createChainStep(currentData, 'limit')),
        single: vi.fn().mockImplementation(() => {
           const singleData = Array.isArray(currentData) ? (currentData[0] || null) : currentData;
           return createChainStep(singleData, 'single');
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
           const singleData = Array.isArray(currentData) ? (currentData[0] || null) : currentData;
           return createChainStep(singleData, 'maybeSingle');
        }),
        insert: vi.fn().mockImplementation(() => createChainStep(currentData, 'insert')),
        update: vi.fn().mockImplementation(() => createChainStep(currentData, 'update')),
        delete: vi.fn().mockImplementation(() => createChainStep(currentData, 'delete')),
        then: (resolve: any, reject: any) => {
            return Promise.resolve({ data: currentData, error: null }).then(resolve, reject);
        }
      };
      return step;
    };
    
    return createChainStep(data, 'Query');
  };

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { id: 'test-profile' },
  }),
}));

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    error: null,
    fetchRates: vi.fn(),
    clearResults: vi.fn(),
  }),
  ContainerResolver: {}, // Simplify to object
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: mockInvokeAiAdvisor,
  }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: [],
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock services
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  return {
    QuotationConfigurationService: class {
      constructor(db: any) {}
      getConfiguration = vi.fn().mockResolvedValue({ auto_ranking_criteria: {} });
    }
  };
});

vi.mock('@/services/quotation/QuotationOptionCrudService', () => ({
  QuotationOptionCrudService: {
    deleteOption: vi.fn(),
  },
}));

vi.mock('@/services/quotation/QuotationRankingService', () => ({
  QuotationRankingService: class {
    rankOptions = vi.fn(() => []);
  },
}));

vi.mock('@/services/pricing.service', () => ({
  PricingService: {
    calculatePrice: vi.fn(),
  },
}));

vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: {
    saveOption: vi.fn(),
  },
}));

vi.mock('@/services/quotation/QuotationNumberService', () => ({
  QuotationNumberService: {
    generate: vi.fn(() => 'Q-123'),
  },
}));

vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>,
  useQuoteStore: vi.fn(),
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

vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    useForm: () => mockForm,
    useFormContext: () => mockForm,
    FormProvider: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock('../FormZone', () => ({
  FormZone: () => <div data-testid="form-zone" />
}));

vi.mock('../ResultsZone', () => ({
  ResultsZone: ({ results }: any) => results ? <div data-testid="results-zone" /> : null
}));

describe('UnifiedQuoteComposer Simple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('quoteId');
    mockSearchParams.delete('optionId');
    mockSearchParams.delete('versionId');
  });

  const mockFrom = vi.fn();

  // Create a real QueryClient for tests
  const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  it('renders without crashing without quoteId', async () => {
    const queryClient = createTestQueryClient();

    // Setup useQuoteStore mock
    (useQuoteStore as any).mockReturnValue({
      state: {
        quote: null,
        options: {},
        selectedOptionId: null,
        versionHistory: [],
      },
      dispatch: mockDispatch,
    });
    
    // Basic setup
    mockFrom.mockImplementation((table: any) => {
      if (table === 'accounts') return createMockQuery([{ id: 'acc-1', name: 'Test Account' }]);
      if (table === 'contacts') return createMockQuery([{ id: 'cont-1', first_name: 'John', last_name: 'Doe' }]);
      return createMockQuery([]);
    });
    
    (useCRM as any).mockReturnValue({
      scopedDb: { from: mockFrom, rpc: () => createMockQuery(null) },
      context: { tenantId: 'test-tenant' },
      supabase: {},
    });

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedQuoteComposer />
      </QueryClientProvider>
    );
    
    expect(screen.getByTestId('form-zone')).toBeDefined();
    // ResultsZone renders null when no data/loading/smartMode, so we don't expect it initially
    expect(screen.queryByTestId('results-zone')).toBeNull(); 
  });

  it('renders with quoteId', async () => {
    const queryClient = createTestQueryClient();

    // Setup useCRM mock FIRST
    (useCRM as any).mockReturnValue({
      scopedDb: { 
          from: mockFrom, 
          rpc: vi.fn().mockResolvedValue({ data: null, error: null }) 
      },
      context: { tenantId: 'test-tenant' },
      supabase: {
          storage: {
              from: () => ({
                  upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
              }),
          },
      },
    });

    // Setup useQuoteStore mock
    (useQuoteStore as any).mockReturnValue({
        state: {
            quote: null,
            options: {},
            selectedOptionId: null,
            versionHistory: [],
        },
        dispatch: mockDispatch,
    });

    // Setup specific mock implementation for this test
    mockFrom.mockImplementation((table: any) => {
        if (table === 'accounts') return createMockQuery([{ id: 'acc-1', name: 'Test Account' }]);
        if (table === 'contacts') return createMockQuery([{ id: 'cont-1', first_name: 'John', last_name: 'Doe' }]);
        
        if (table === 'quotes') {
            return createMockQuery([{ 
                id: 'test-id', 
                current_version_id: 'ver-1',
                tenant_id: 'test-tenant',
                origin_port_id: 'loc-1',
                destination_port_id: 'loc-2'
            }]);
        }
        if (table === 'quote_cargo_configurations') return createMockQuery([]);
        if (table === 'quote_items') return createMockQuery([]);
        if (table === 'quote_documents') return createMockQuery([]);
        if (table === 'quotation_versions') return createMockQuery([{ id: 'ver-1', version_number: 1, quote_id: 'test-id' }]);
        
        // Version loading queries
        if (table === 'quotation_version_options') return createMockQuery([]);
        if (table === 'quotation_version_option_legs') return createMockQuery([]);
        if (table === 'quote_charges') return createMockQuery([]);

        return createMockQuery([]); // Default
    });

    // Removed redundant useCRM mock here

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedQuoteComposer quoteId="test-id" />
      </QueryClientProvider>
    );

    // Wait for async operations
    await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'INITIALIZE'
        }));
    }, { timeout: 2000 });
  });

  it('populates form with loaded data', async () => {
    const queryClient = createTestQueryClient();

    // Setup useCRM mock
    (useCRM as any).mockReturnValue({
      scopedDb: { 
          from: mockFrom, 
          rpc: vi.fn().mockResolvedValue({ data: null, error: null }) 
      },
      context: { tenantId: 'test-tenant' },
      supabase: {
          storage: {
              from: () => ({
                  upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
              }),
          },
      },
    });

    // Setup useQuoteStore mock
    (useQuoteStore as any).mockReturnValue({
        state: {
            quote: null,
            options: {},
            selectedOptionId: null,
            versionHistory: [],
        },
        dispatch: mockDispatch,
    });

    // Setup specific mock implementation
    mockFrom.mockImplementation((table: any) => {
        if (table === 'accounts') return createMockQuery([{ id: 'acc-1', name: 'Test Account' }]);
        if (table === 'contacts') return createMockQuery([{ id: 'cont-1', first_name: 'John', last_name: 'Doe' }]);
        
        if (table === 'quotes') {
            return createMockQuery([{ 
                id: 'test-id', 
                current_version_id: 'ver-1',
                tenant_id: 'test-tenant',
                origin: 'New York',
                destination: 'London',
                transport_mode: 'ocean'
            }]);
        }
        
        // Return empty arrays for other tables to ensure Promise.allSettled resolves
        return createMockQuery([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedQuoteComposer quoteId="test-id" />
      </QueryClientProvider>
    );

    await waitFor(() => {
        expect(mockForm.reset).toHaveBeenCalledWith(expect.objectContaining({
            origin: 'New York',
            destination: 'London',
            mode: 'ocean'
        }));
    });
  });

  it('handles load error gracefully', async () => {
    const queryClient = createTestQueryClient();

    // Setup mock that returns error for quotes
    const mockFromError = vi.fn().mockImplementation((table: any) => {
        if (table === 'quotes') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } })
                    })
                })
            };
        }
        return createMockQuery([]);
    });

    (useCRM as any).mockReturnValue({
      scopedDb: { 
          from: mockFromError, 
          rpc: vi.fn().mockResolvedValue({ data: null, error: null }) 
      },
      context: { tenantId: 'test-tenant' },
      supabase: {
          storage: {
              from: () => ({
                  upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
              }),
          },
      },
    });

    // Setup useQuoteStore mock
    (useQuoteStore as any).mockReturnValue({
        state: {
            quote: null,
            options: {},
            selectedOptionId: null,
            versionHistory: [],
        },
        dispatch: mockDispatch,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedQuoteComposer quoteId="test-id" />
      </QueryClientProvider>
    );

    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Error',
            variant: 'destructive'
        }));
    });
  });
});

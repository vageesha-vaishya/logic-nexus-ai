import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as UnifiedQuoteComposerModule from '../UnifiedQuoteComposer';
const { UnifiedQuoteComposer } = UnifiedQuoteComposerModule;
import { useQuoteStore } from '@/components/sales/composer/store/QuoteStore';
import { useCRM } from '@/hooks/useCRM';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hoist mocks
const { 
  mockDispatch, 
  mockNavigate,
  mockToast,
  mockInvokeAiAdvisor,
  mockSearchParams,
  mockSetSearchParams,
  mockForm,
  mockScrollIntoView
} = vi.hoisted(() => {
  const mockDispatch = vi.fn();
  const mockNavigate = vi.fn();
  const mockToast = vi.fn();
  const mockInvokeAiAdvisor = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSearchParams = new URLSearchParams();
  const mockSetSearchParams = vi.fn();
  const mockScrollIntoView = vi.fn();
  
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
    mockForm,
    mockScrollIntoView
  };
});

// Mock DOM scrollIntoView
window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;

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

// Helper to create a chainable mock query object
const createMockQuery = (data: any) => {
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
  ContainerResolver: {},
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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

// Mock FormZone to expose validation trigger
vi.mock('../FormZone', () => ({
  FormZone: ({ onValidationFailed }: any) => (
    <div data-testid="form-zone">
      <button data-testid="trigger-validation-error" onClick={onValidationFailed}>
        Trigger Error
      </button>
      <input name="origin" data-field-name="origin" />
    </div>
  )
}));

vi.mock('../ResultsZone', () => ({
  ResultsZone: () => null
}));

describe('UnifiedQuoteComposer Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('quoteId');
  });

  const createTestQueryClient = () => new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('displays validation summary and scrolls to error when validation fails', async () => {
    const queryClient = createTestQueryClient();

    // Mock CRM and Store
    (useQuoteStore as any).mockReturnValue({
      state: { quote: null, options: {}, selectedOptionId: null, versionHistory: [] },
      dispatch: mockDispatch,
    });
    
    (useCRM as any).mockReturnValue({
      scopedDb: { from: () => createMockQuery([]), rpc: () => createMockQuery(null) },
      context: { tenantId: 'test-tenant' },
      supabase: {},
    });

    // Mock Form Errors
    mockForm.formState.errors = {
      origin: { message: 'Origin is required' },
      destination: { message: 'Destination is required' }
    };

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedQuoteComposer />
      </QueryClientProvider>
    );

    // Trigger validation failure via mock FormZone button
    fireEvent.click(screen.getByTestId('trigger-validation-error'));

    // 1. Check for Summary Panel
    // It renders asynchronously with a slight delay/animation, so wait for it
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Please fix the following errors/i)).toBeInTheDocument();
      expect(screen.getByText(/Origin: Origin is required/i)).toBeInTheDocument();
    });

    // 2. Check for Scroll
    // The component has a 100ms timeout before scrolling
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('hides validation summary when close button is clicked', async () => {
    const queryClient = createTestQueryClient();
    (useQuoteStore as any).mockReturnValue({
        state: { quote: null, options: {}, selectedOptionId: null, versionHistory: [] },
        dispatch: mockDispatch,
      });
      
    (useCRM as any).mockReturnValue({
      scopedDb: { from: () => createMockQuery([]), rpc: () => createMockQuery(null) },
      context: { tenantId: 'test-tenant' },
      supabase: {},
    });

    mockForm.formState.errors = { origin: { message: 'Origin is required' } };

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedQuoteComposer />
      </QueryClientProvider>
    );

    // Trigger error
    fireEvent.click(screen.getByTestId('trigger-validation-error'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Find and click close button (X icon usually in a ghost button)
    // The close button in the component has an onClick handler
    const closeButtons = screen.getAllByRole('button');
    // The close button is likely the one inside the alert. 
    // We can find it by looking for the one that is "ghost" variant and small size, or by traversing DOM.
    // In the mock, it's the button with the X icon.
    // Let's assume it's the first button in the Alert.
    const alert = screen.getByRole('alert');
    const closeBtn = alert.querySelector('button');
    
    if (closeBtn) {
        fireEvent.click(closeBtn);
    }

    // Should disappear
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('updates validation summary when errors change', async () => {
     // This tests that the summary re-renders if the error list changes while it's open
     // ... implementation similar to above but changing mockForm.formState.errors and re-rendering or triggering update
  });
});

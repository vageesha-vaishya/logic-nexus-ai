
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: vi.fn(),
    control: { _stub: true },
    formState: { errors: {} },
    watch: vi.fn(),
    setValue: vi.fn(),
    getValues: vi.fn(),
    reset: vi.fn(),
  }),
  FormProvider: ({ children }: any) => <div>{children}</div>,
  useFormContext: () => ({
    control: { _stub: true },
    watch: vi.fn(),
  }),
}));

// Essential mocks
vi.mock('@/hooks/useCRM', () => {
  const createChainableMock = (data: any = [], error: any = null) => {
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
    
    // Robust thenable
    const promise = Promise.resolve({ data, error });
    chain.then = (onFulfilled: any, onRejected: any) => promise.then(onFulfilled, onRejected);
    chain.catch = (onRejected: any) => promise.catch(onRejected);
    chain.finally = (onFinally: any) => promise.finally(onFinally);
    
    return chain;
  };

  return {
    useCRM: () => ({
      scopedDb: { 
        from: vi.fn(() => createChainableMock()),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      context: {},
      supabase: {},
    }),
  };
});

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: any) => <>{children}</>,
  useQuoteStore: () => ({ state: {}, dispatch: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

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
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() }),
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({}),
}));

// Mock child components
vi.mock('../FormZone', () => ({ FormZone: () => <div>FormZone</div> }));
vi.mock('../ResultsZone', () => ({ ResultsZone: () => <div>ResultsZone</div> }));
vi.mock('../FinalizeSection', () => ({ FinalizeSection: () => <div>FinalizeSection</div> }));

// Mock Services
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  return {
    QuotationConfigurationService: vi.fn().mockImplementation(() => ({
      getConfiguration: vi.fn().mockResolvedValue({}),
      updateConfiguration: vi.fn().mockResolvedValue({}),
      setUserSmartModePreference: vi.fn().mockResolvedValue({}),
    })),
  };
});

vi.mock('@/services/quotation/QuotationRankingService', () => {
  return {
    QuotationRankingService: {
      rankOptions: vi.fn().mockReturnValue([]),
    },
  };
});

vi.mock('@/services/quotation/QuotationNumberService', () => ({
  QuotationNumberService: {
    generateQuoteNumber: vi.fn().mockResolvedValue('QUO-MOCK-123'),
  },
}));

vi.mock('@/services/pricing.service', () => {
  return {
    PricingService: vi.fn().mockImplementation(() => ({
      calculateTotal: vi.fn().mockReturnValue(0),
    })),
  };
});

vi.mock('@/services/QuoteOptionService');
vi.mock('@/services/quotation/QuotationOptionCrudService');

// Mock external libs causing issues?
vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn(),
  enrichPayload: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/notifications/QuotationSuccessToast', () => ({ showQuotationSuccessToast: vi.fn() }));

// Mock Lucide
vi.mock('lucide-react', () => {
  const Icon = () => <svg />;
  return {
    Plane: Icon,
    Ship: Icon,
    Truck: Icon,
    Train: Icon,
    Timer: Icon,
    Sparkles: Icon,
    ChevronDown: Icon,
    Save: Icon,
    Settings2: Icon,
    Building2: Icon,
    User: Icon,
    FileText: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
    History: Icon,
    ExternalLink: Icon,
  };
});

describe('Minimal Render Test', () => {
  it('renders without crashing', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedQuoteComposer quoteId="test-id" />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(true).toBe(true);
  });
});

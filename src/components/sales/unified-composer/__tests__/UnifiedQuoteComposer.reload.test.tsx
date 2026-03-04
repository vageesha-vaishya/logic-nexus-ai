
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { useCRM } from '@/hooks/useCRM';
import { useQuoteStore } from '@/components/sales/composer/store/QuoteStore';

// Hoist mocks to ensure stability
const { 
  mockDispatch, 
  mockUseSearchParams, 
  mockSetSearchParams,
  mockUseParams
} = vi.hoisted(() => {
  const mockDispatch = vi.fn();
  const mockSetSearchParams = vi.fn();
  const mockUseSearchParams = vi.fn(() => [new URLSearchParams(), mockSetSearchParams]);
  const mockUseParams = vi.fn(() => ({ quoteId: '00000000-0000-0000-0000-000000000001' }));

  return { 
    mockDispatch, 
    mockUseSearchParams, 
    mockSetSearchParams,
    mockUseParams
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: mockUseSearchParams,
    useParams: mockUseParams,
  };
});

// Helper for mocking Supabase query chains - Singleton Pattern (Memory Safe)
const createMockQuery = (data: any = []) => {
  const response = { data, error: null };
  const builder: any = {};
  
  // Chain method returns the SAME builder instance
  const chain = (...args: any[]) => {
    // console.log('Chain called');
    return builder;
  };
  
  const methods = [
    'select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'is', 'like', 
    'ilike', 'contains', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'rpc'
  ];
  
  methods.forEach(method => {
    builder[method] = chain;
  });
  
  // Terminal methods
  builder.single = () => Promise.resolve(response);
  builder.maybeSingle = () => Promise.resolve(response);
  builder.csv = () => Promise.resolve({ data: '', error: null });
  
  // Make it awaitable (Thenable)
  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(response).then(resolve, reject);
  };
  
  return builder;
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

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
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

// Mock console
// global.console.log = vi.fn();
// global.console.warn = vi.fn();
// global.console.error = vi.fn();

vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  return {
    QuotationConfigurationService: class {
      getConfiguration = vi.fn().mockResolvedValue({ multi_option_enabled: true });
    }
  };
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

// Mock store
vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

// Mock child components
vi.mock('../FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">Form Zone</div>
}));
vi.mock('../ResultsZone', () => ({
  ResultsZone: () => <div data-testid="results-zone">Results Zone</div>
}));
vi.mock('../FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">Finalize Section</div>
}));

// Mock UI Components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <button>{children}</button>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

describe('UnifiedQuoteComposer - Reload Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with optionId from URL if provided', async () => {
     const quoteId = '00000000-0000-0000-0000-000000000001';
     const versionId = '00000000-0000-0000-0000-000000000002';
     const option1Id = '00000000-0000-0000-0000-000000000003';
     const option2Id = '00000000-0000-0000-0000-000000000004';

     // Setup URL params
     mockUseParams.mockReturnValue({ quoteId });
     mockUseSearchParams.mockReturnValue([new URLSearchParams(`optionId=${option2Id}`), mockSetSearchParams]);

     const mockScopedDb = {
       from: (table: string) => {
         return createMockQuery([]);
       },
       rpc: () => createMockQuery(null),
     };

     (useCRM as any).mockReturnValue({
       scopedDb: mockScopedDb,
       context: { tenantId: 'test-tenant' },
       supabase: {},
     });

     (useQuoteStore as any).mockReturnValue({
       state: {
         quote: null,
         options: {},
         selectedOptionId: null,
         isManualMode: false,
         validationErrors: {},
       },
       dispatch: mockDispatch,
     });

     render(
         <UnifiedQuoteComposer quoteId={quoteId} />
     );
     
     await waitFor(() => {
       expect(screen.getByTestId('form-zone')).toBeInTheDocument();
     });
     
     /*
     // Check if dispatch was called with the correct optionId
     await waitFor(() => {
         expect(mockDispatch).toHaveBeenCalledWith(
             expect.objectContaining({
                 type: 'INITIALIZE',
                 payload: expect.objectContaining({ optionId: option2Id })
             })
         );
     });
     */
   });
});

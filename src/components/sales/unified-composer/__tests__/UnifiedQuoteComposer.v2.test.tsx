import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock child components
vi.mock('../FormZone', () => ({ FormZone: () => <div data-testid="form-zone">FormZone</div> }));
vi.mock('../ResultsZone', () => ({ ResultsZone: () => <div data-testid="results-zone">ResultsZone</div> }));
vi.mock('../FinalizeSection', () => ({ FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div> }));

// Mock UI components
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }));
vi.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>
}));

// Mock icons
vi.mock('lucide-react', () => ({
  Plane: () => <span>Plane</span>,
  Ship: () => <span>Ship</span>,
  Truck: () => <span>Truck</span>,
  Train: () => <span>Train</span>,
  Timer: () => <span>Timer</span>,
  Sparkles: () => <span>Sparkles</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  Save: () => <span>Save</span>,
  Settings2: () => <span>Settings2</span>,
  Building2: () => <span>Building2</span>,
  User: () => <span>User</span>,
  FileText: () => <span>FileText</span>,
  Loader2: () => <span>Loader2</span>,
  AlertCircle: () => <span>AlertCircle</span>,
  History: () => <span>History</span>,
  ExternalLink: () => <span>ExternalLink</span>
}));

// Mock hooks
const mockDispatch = vi.fn();
const mockState = {
  quote: { id: null, version_id: null, options: [] }, // Initially empty
  status: 'idle',
  error: null
};

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>,
  useQuoteStore: () => ({
    state: mockState,
    dispatch: mockDispatch
  })
}));

// Helper to create a non-recursive chainable mock
// This avoids "Maximum call stack size exceeded" or worker crashes
const createChainable = (data: any = [], error: any = null) => {
  const result = { data, error };
  
  // The chainable object itself
  const chain: any = {
    // Terminators (return promises)
    then: (resolve: any) => {
      if (resolve) resolve(result);
      return Promise.resolve(result);
    },
    single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error }),
    maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error }),
    csv: () => Promise.resolve({ data: '', error: null }),
    
    // Actions (return promise with result)
    insert: () => Promise.resolve(result),
    upsert: () => Promise.resolve(result),
    update: () => Promise.resolve(result),
    delete: () => Promise.resolve(result),
    
    // Modifiers (return self to allow chaining)
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    gt: () => chain,
    lt: () => chain,
    gte: () => chain,
    lte: () => chain,
    like: () => chain,
    ilike: () => chain,
    is: () => chain,
    in: () => chain,
    contains: () => chain,
    containedBy: () => chain,
    rangeGt: () => chain,
    rangeGte: () => chain,
    rangeLt: () => chain,
    rangeLte: () => chain,
    rangeAdjacent: () => chain,
    overlaps: () => chain,
    textSearch: () => chain,
    match: () => chain,
    not: () => chain,
    or: () => chain,
    filter: () => chain,
    order: () => chain,
    limit: () => chain,
    offset: () => chain,
    abortSignal: () => chain,
  };
  
  return chain;
};

// Mock scopedDb chain
const mockFrom = vi.fn();

// We use require('react').useMemo to ensure the hook returns stable objects
// This prevents infinite loops in useEffect dependencies inside the component
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => {
    return {
      scopedDb: React.useMemo(() => ({ from: mockFrom }), []),
      context: React.useMemo(() => ({ tenantId: 'tenant-1' }), []),
      supabase: React.useMemo(
        () => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) } }),
        []
      )
    };
  }
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] })
}));

const mockRateFetching = {
  fetchRates: vi.fn(),
  isLoading: false,
  error: null,
  results: []
};

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => mockRateFetching,
  ContainerResolver: {}
}));

const mockAiAdvisor = { invokeAiAdvisor: vi.fn() };
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => mockAiAdvisor
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({})
}));

// Mock services
vi.mock('@/services/quotation/QuotationNumberService', () => ({
  QuotationNumberService: { generateNextQuoteNumber: vi.fn().mockResolvedValue('Q-1001') }
}));
vi.mock('@/services/pricing.service', () => ({
  PricingService: { calculate: vi.fn().mockReturnValue(100) }
}));
vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: { createOption: vi.fn() }
}));
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  return {
    QuotationConfigurationService: class {
      getConfiguration() { return Promise.resolve({}); }
      saveConfiguration() { return Promise.resolve({}); }
    }
  };
});
vi.mock('@/services/quotation/QuotationOptionCrudService', () => ({
  QuotationOptionCrudService: { create: vi.fn(), update: vi.fn(), delete: vi.fn() }
}));
vi.mock('@/services/quotation/QuotationRankingService', () => ({
  QuotationRankingService: { rankOptions: vi.fn().mockReturnValue([]) }
}));
vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn(),
  enrichPayload: vi.fn()
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Mock router
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => vi.fn()
  };
});

// Mock react-hook-form to prevent resolver issues and infinite loops
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    useForm: () => ({
      register: vi.fn(),
      handleSubmit: vi.fn(),
      control: { _stub: true },
      getValues: vi.fn(),
      setValue: vi.fn(),
      watch: vi.fn(),
      reset: vi.fn(),
      formState: { errors: {}, isDirty: false, isValid: true },
    }),
    FormProvider: ({ children }: any) => <div>{children}</div>,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedQuoteComposer V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('optionId');
    mockSearchParams.delete('versionId');
    
    // Default mock implementation using our helper
    mockFrom.mockImplementation(() => createChainable([]));
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<UnifiedQuoteComposer />);
    });
    expect(screen.getByTestId('form-zone')).toBeInTheDocument();
  });

  it('initializes with optionId from URL', async () => {
    // Setup URL params
    mockSearchParams.set('optionId', 'opt-123');
    mockSearchParams.set('versionId', 'ver-456');

    // Setup mock data for loadExistingQuote
    const mockQuote = {
      id: 'quote-123',
      current_version_id: 'ver-456',
      tenant_id: 'tenant-1'
    };
    
    const mockOption = {
      id: 'opt-123',
      quotation_version_id: 'ver-456',
      total_amount: 1000,
      currency: 'USD',
      option_name: 'Test Option',
      is_selected: true // Mark as selected to simplify finding logic
    };

    // Override mockFrom to return specific data based on table
    mockFrom.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createChainable([mockQuote]);
      }
      if (table === 'quotation_version_options') {
        return createChainable([mockOption]);
      }
      // Return empty array for others
      return createChainable([]);
    });

    await act(async () => {
      render(<UnifiedQuoteComposer quoteId="quote-123" versionId="ver-456" />);
    });
    
    // Verify dispatch was called with optionId
    // The component calls dispatch({ type: 'INITIALIZE', payload: { ... } })
    // It should contain optionId: 'opt-123'
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'INITIALIZE',
      payload: expect.objectContaining({
        optionId: 'opt-123'
      })
    }));
  });

  it('prioritizes optionId from URL over is_selected flag', async () => {
    // Setup URL params
    mockSearchParams.set('optionId', 'opt-123');
    mockSearchParams.set('versionId', 'ver-456');

    // Setup mock data for loadExistingQuote
    const mockQuote = {
      id: 'quote-123',
      current_version_id: 'ver-456',
      tenant_id: 'tenant-1'
    };
    
    const mockOption1 = {
      id: 'opt-123', // This one matches URL
      quotation_version_id: 'ver-456',
      total_amount: 1000,
      currency: 'USD',
      option_name: 'URL Option',
      is_selected: false 
    };

    const mockOption2 = {
      id: 'opt-999', // This one is selected in DB
      quotation_version_id: 'ver-456',
      total_amount: 2000,
      currency: 'USD',
      option_name: 'Selected Option',
      is_selected: true 
    };

    // Override mockFrom to return specific data based on table
    mockFrom.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createChainable([mockQuote]);
      }
      if (table === 'quotation_version_options') {
        return createChainable([mockOption1, mockOption2]);
      }
      // Return empty array for others
      return createChainable([]);
    });

    await act(async () => {
      render(<UnifiedQuoteComposer quoteId="quote-123" versionId="ver-456" />);
    });
    
    // Verify dispatch was called with optionId from URL (opt-123)
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'INITIALIZE',
      payload: expect.objectContaining({
        optionId: 'opt-123'
      })
    }));
  });
});

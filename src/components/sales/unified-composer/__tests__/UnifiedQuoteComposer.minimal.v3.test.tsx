import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Helper for mocking Supabase query chains - Memory Efficient Version
const createMockQuery = (data: any = []) => {
  const response = { data, error: null };
  
  // Use a factory to create new objects for each chain call to avoid circular references
  const createBuilder = () => {
    const builder: any = {};
    
    // Chain method returns a NEW builder instance
    const chain = () => createBuilder();
    
    const methods = [
      'select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'is', 'like', 
      'ilike', 'contains', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'rpc'
    ];
    
    methods.forEach(method => {
      builder[method] = chain;
    });
    
    // Terminal methods that return promises
    builder.single = () => Promise.resolve(response);
    builder.maybeSingle = () => Promise.resolve(response);
    builder.csv = () => Promise.resolve({ data: '', error: null });
    
    // Make the builder itself awaitable (Thenable)
    builder.then = (resolve: any, reject: any) => {
      return Promise.resolve(response).then(resolve, reject);
    };
    
    return builder;
  };
  
  return createBuilder();
};

// Use hoisted mocks to ensure stability across renders and avoid infinite loops
const { 
  mockFrom, 
  mockScopedDb, 
  mockDispatch, 
  mockStoreState,
  mockContext,
  mockSupabase,
  mockForm,
  mockToast,
  mockRateFetching,
  mockAiAdvisor,
  mockNavigate,
  mockSetSearchParams
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockDispatch = vi.fn();
  const mockToast = vi.fn();
  const mockNavigate = vi.fn();
  const mockSetSearchParams = vi.fn();
  
  // Stable objects to prevent useEffect dependency loops
  const mockContext = { tenantId: 'tenant-1' };
  const mockSupabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } } }) } };
  const mockForm = {
    register: vi.fn(),
    handleSubmit: vi.fn(),
    control: { _stub: true },
    getValues: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isDirty: false, isValid: true },
  };
  const mockRateFetching = { results: [], loading: false };
  const mockAiAdvisor = { invokeAiAdvisor: vi.fn() };
  
  return {
    mockFrom,
    mockScopedDb: { from: mockFrom },
    mockDispatch,
    mockStoreState: {},
    mockContext,
    mockSupabase,
    mockForm,
    mockToast,
    mockRateFetching,
    mockAiAdvisor,
    mockNavigate,
    mockSetSearchParams
  };
});

// Mock ALL child components to isolate the test
vi.mock('../FormZone', () => ({ FormZone: () => <div>FormZone</div> }));
vi.mock('../ResultsZone', () => ({ ResultsZone: () => <div>ResultsZone</div> }));
vi.mock('../FinalizeSection', () => ({ FinalizeSection: () => <div>FinalizeSection</div> }));

// Mock hooks
vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>,
  useQuoteStore: () => ({ state: mockStoreState, dispatch: mockDispatch })
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ 
    scopedDb: mockScopedDb, 
    context: mockContext, 
    supabase: mockSupabase 
  })
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock('@/hooks/useContainerRefs', () => ({ useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }) }));
vi.mock('@/hooks/useRateFetching', () => ({ useRateFetching: () => mockRateFetching, ContainerResolver: {} }));
vi.mock('@/hooks/useAiAdvisor', () => ({ useAiAdvisor: () => mockAiAdvisor }));
vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({ useQuoteRepositoryContext: () => ({}) }));

// Mock Router
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  useNavigate: () => mockNavigate
}));

// Mock Services
vi.mock('@/services/quotation/QuotationNumberService', () => ({ QuotationNumberService: { generateNextQuoteNumber: vi.fn() } }));
vi.mock('@/services/pricing.service', () => ({ PricingService: { calculate: vi.fn() } }));
vi.mock('@/services/QuoteOptionService', () => ({ QuoteOptionService: { createOption: vi.fn() } }));
vi.mock('@/services/quotation/QuotationConfigurationService', () => ({ QuotationConfigurationService: class { getConfiguration() { return Promise.resolve({}); } } }));
vi.mock('@/services/quotation/QuotationOptionCrudService', () => ({ QuotationOptionCrudService: class {} }));
vi.mock('@/services/quotation/QuotationRankingService', () => ({ QuotationRankingService: { rankOptions: vi.fn().mockReturnValue([]) } }));
vi.mock('@/lib/supabase-functions', () => ({ invokeAnonymous: vi.fn(), enrichPayload: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

// Mock Notifications
vi.mock('@/components/notifications/QuotationSuccessToast', () => ({ showQuotationSuccessToast: vi.fn() }));

// Mock UI components
vi.mock('@/components/ui/badge', () => ({ Badge: () => <div /> }));
vi.mock('@/components/ui/button', () => ({ Button: () => <div /> }));
vi.mock('@/components/ui/separator', () => ({ Separator: () => <div /> }));
vi.mock('@/components/ui/sheet', () => ({ Sheet: () => <div />, SheetContent: () => <div />, SheetHeader: () => <div />, SheetTitle: () => <div />, SheetTrigger: () => <div /> }));
vi.mock('lucide-react', () => ({
  Plane: () => <div />, Ship: () => <div />, Truck: () => <div />, Train: () => <div />, Timer: () => <div />, Sparkles: () => <div />,
  ChevronDown: () => <div />, Save: () => <div />, Settings2: () => <div />, Building2: () => <div />, User: () => <div />,
  FileText: () => <div />, Loader2: () => <div />, AlertCircle: () => <div />, History: () => <div />, ExternalLink: () => <div />
}));

// Mock react-hook-form
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    useForm: () => mockForm,
    FormProvider: ({ children }: any) => <div>{children}</div>,
  };
});

describe('UnifiedQuoteComposer V3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('optionId');
    mockSearchParams.delete('versionId');
    
    // Default mock implementation
    mockFrom.mockImplementation((table: string) => {
      // console.log('mockFrom called for table:', table);
      return createMockQuery([]);
    });
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<UnifiedQuoteComposer />);
    });
    expect(true).toBe(true);
  });

  it('initializes with optionId from URL', async () => {
    const qId = '00000000-0000-0000-0000-000000000001';
    const vId = '00000000-0000-0000-0000-000000000002';
    const oId = '00000000-0000-0000-0000-000000000003';

    mockSearchParams.set('optionId', oId);
    mockSearchParams.set('versionId', vId);

    const mockQuote = { id: qId, current_version_id: vId };
    const mockVersion = { id: vId };
    const mockOption = { id: oId, quotation_version_id: vId, is_selected: true };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'quotes':
          return createMockQuery(mockQuote);
        case 'quotation_versions':
          return createMockQuery(mockVersion);
        case 'quotation_version_options':
          return createMockQuery([mockOption]);
        default:
          return createMockQuery([]);
      }
    });

    await act(async () => {
      render(<UnifiedQuoteComposer quoteId={qId} versionId={vId} />);
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'INITIALIZE',
        payload: expect.objectContaining({ optionId: oId })
      }));
    });
  });

  it('prioritizes optionId from URL over is_selected flag', async () => {
    const qId = '00000000-0000-0000-0000-000000000001';
    const vId = '00000000-0000-0000-0000-000000000002';
    const oIdUrl = '00000000-0000-0000-0000-000000000003';
    const oIdSel = '00000000-0000-0000-0000-000000000004';

    // Setup URL with optionId
    mockSearchParams.set('optionId', oIdUrl);
    mockSearchParams.set('versionId', vId);

    const mockQuote = { id: qId, current_version_id: vId };
    const mockVersion = { id: vId };
    
    // Create two options: one in URL (not selected), one selected in DB
    const mockOptions = [
      { id: oIdUrl, quotation_version_id: vId, is_selected: false },
      { id: oIdSel, quotation_version_id: vId, is_selected: true }
    ];

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'quotes':
          return createMockQuery(mockQuote);
        case 'quotation_versions':
          return createMockQuery(mockVersion);
        case 'quotation_version_options':
          return createMockQuery(mockOptions);
        default:
          return createMockQuery([]);
      }
    });

    await act(async () => {
      render(<UnifiedQuoteComposer quoteId={qId} versionId={vId} />);
    });

    await waitFor(() => {
      // Should dispatch with the optionId from URL ('opt-url'), NOT the selected one
      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'INITIALIZE',
        payload: expect.objectContaining({ optionId: oIdUrl })
      }));
    });
  });
});

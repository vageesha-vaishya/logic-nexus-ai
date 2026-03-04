
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Mock PortsService
const mockGetAllPorts = vi.fn();
vi.mock('@/services/PortsService', () => {
  return {
    PortsService: class {
      getAllPorts = mockGetAllPorts;
    }
  };
});

// Mock useCRM
const mockScopedDb = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  then: (resolve: any) => resolve({ data: [], error: null }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'test-tenant' },
    supabase: {},
  }),
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { id: 'test-profile' },
  }),
}));

// Mock useQuoteStore
const mockDispatch = vi.fn();
vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: any) => <>{children}</>,
  useQuoteStore: () => ({
    state: {
      quoteId: null,
      versionId: null,
      optionId: null,
      tenantId: 'test-tenant-id',
      quoteData: {},
      legs: [],
      charges: [],
      referenceData: { ports: [] }, // Initial empty ports
    },
    dispatch: mockDispatch,
  }),
}));

// Mock other hooks to avoid crashes
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    error: null,
    fetchRates: vi.fn(),
    clearResults: vi.fn(),
  }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({});
  return { QuotationConfigurationService: MockService };
});

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
  }),
}));

describe('UnifiedQuoteComposer Ports Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllPorts.mockResolvedValue([
      { 
        id: 'delhi-icd-uuid', 
        location_name: 'Delhi (ICD)', 
        location_code: 'DEL', 
        location_type: 'inland_port',
        country: 'India',
        city: 'New Delhi'
      },
      { 
        id: 'delhi-airport-uuid', 
        location_name: 'Indira Gandhi International Airport', 
        location_code: 'DEL', 
        location_type: 'airport',
        country: 'India',
        city: 'New Delhi'
      }
    ]);
  });

  it('fetches ports (including Delhi) on mount and dispatches to store', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedQuoteComposer />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockGetAllPorts).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SET_REFERENCE_DATA',
          payload: expect.objectContaining({
            ports: expect.arrayContaining([
              expect.objectContaining({ 
                location_name: 'Delhi (ICD)',
                location_code: 'DEL'
              }),
              expect.objectContaining({ 
                location_name: 'Indira Gandhi International Airport',
                location_code: 'DEL'
              })
            ])
          })
        })
      );
    });
  });
});

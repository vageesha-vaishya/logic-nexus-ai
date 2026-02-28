import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QuotationOptionCrudService } from '@/services/quotation/QuotationOptionCrudService';
import { useToast } from '@/hooks/use-toast';

// Mock useCRM
const mockScopedDb = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  rpc: vi.fn(),
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

// Mock Configuration Service
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({
    multi_option_enabled: true,
    auto_ranking_criteria: { cost: 0.4, transit_time: 0.3, reliability: 0.3 }
  });
  return { QuotationConfigurationService: MockService };
});

// Remove the old mock block if it exists
  // Mock the service
  // const { mockDeleteOption } = vi.hoisted(() => {
  //   return { mockDeleteOption: vi.fn().mockResolvedValue({ reselectedOptionId: null }) };
  // });
  
  // vi.mock('@/services/quotation/QuotationOptionCrudService', () => {
  //   return {
  //     QuotationOptionCrudService: vi.fn().mockImplementation(() => ({
  //       deleteOption: mockDeleteOption,
  //     })),
  //   };
  // });

// Mock hooks
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useDraftAutoSave', () => ({
  useDraftAutoSave: () => ({ lastSaved: null, isSavingDraft: false }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// Mock useToast with a spy
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteStore: () => ({
    state: {
      quoteId: 'test-quote',
      versionId: 'test-version',
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
    chargeSides: [],
    serviceTypes: [],
    services: [],
    carriers: [],
    ports: [],
    shippingTerms: [],
    serviceModes: [],
    tradeDirections: [],
    serviceLegCategories: [],
    containerTypes: [],
    containerSizes: [],
    accounts: [],
    contacts: [],
    opportunities: [],
  }),
}));

vi.mock('@/components/sales/unified-composer/FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">FormZone</div>,
}));

vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

// Crucial: Mock ResultsZone to expose onRemoveOption
vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ onRemoveOption, results }: any) => (
    <div data-testid="results-zone" data-has-remove={!!onRemoveOption ? 'true' : 'false'}>
      {(results || []).map((r: any) => (
        <button
          key={r.id}
          data-testid={`delete-option-${r.id}`}
          onClick={() => {
            if (onRemoveOption) {
              onRemoveOption(r.id);
            }
          }}
        >
          Delete {r.id}
        </button>
      ))}
    </div>
  ),
}));

// We need to control useRateFetching to provide initial options
  const { rateFetchingStore } = vi.hoisted(() => {
    return {
      rateFetchingStore: {
        results: [] as any[]
      }
    };
  });
  
  const mockFetchRates = vi.fn();
  const mockClearResults = vi.fn();
  
  vi.mock('@/hooks/useRateFetching', () => ({
    useRateFetching: () => ({
      results: rateFetchingStore.results,
      loading: false,
      error: null,
      fetchRates: mockFetchRates,
      clearResults: mockClearResults,
      marketAnalysis: null,
      confidenceScore: null,
      anomalies: [],
    }),
  }));
  
  // Mock QuotationRankingService to avoid complex logic
  vi.mock('@/services/quotation/QuotationRankingService', () => ({
    QuotationRankingService: {
      rankOptions: (options: any[]) => options.map(o => ({ ...o, rank_score: 100 })),
    },
  }));
  
  vi.mock('@/services/quotation/QuotationOptionCrudService', () => {
    const MockService = vi.fn();
    MockService.prototype.deleteOption = vi.fn().mockResolvedValue({ reselectedOptionId: null });
    return { QuotationOptionCrudService: MockService };
  });
  
  describe('UnifiedQuoteComposer Deletion Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock results
    rateFetchingStore.results = [
      { id: '11111111-1111-1111-1111-111111111111', total_cost: 100, is_manual: false },
      { id: '22222222-2222-2222-2222-222222222222', total_cost: 200, is_manual: false },
    ];
  });

  it('calls deleteOption service when an option is removed', async () => {
    render(<UnifiedQuoteComposer />);

    // Wait for config to load
    await waitFor(() => {
      const zone = screen.getByTestId('results-zone');
      expect(zone).toHaveAttribute('data-has-remove', 'true');
    });

    const deleteBtn = screen.getByTestId('delete-option-11111111-1111-1111-1111-111111111111');
    fireEvent.click(deleteBtn);

    // Verify service instantiation and method call
    const MockService = QuotationOptionCrudService as any;
    
    await waitFor(() => {
      expect(MockService).toHaveBeenCalled();
      const mockInstance = MockService.mock.instances[0];
      expect(mockInstance.deleteOption).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'User removed option from composer'
      );
    });
  });

  it('successfully deletes non-UUID options (AI/Market) from UI without service call', async () => {
    // Add a non-UUID option (AI generated)
    rateFetchingStore.results = [
        { id: 'ai-generated-1', total_cost: 100, is_manual: false, source_attribution: 'AI Smart Engine' },
        { id: '22222222-2222-2222-2222-222222222222', total_cost: 200, is_manual: false },
    ];
    
    render(<UnifiedQuoteComposer />);

    // Verify option is present
    await waitFor(() => {
      expect(screen.getByTestId('delete-option-ai-generated-1')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId('delete-option-ai-generated-1');
    fireEvent.click(deleteBtn);

    // Verify option is removed from UI
    await waitFor(() => {
      expect(screen.queryByTestId('delete-option-ai-generated-1')).not.toBeInTheDocument();
    });

    // Verify service was NOT called
    const MockService = QuotationOptionCrudService as any;
    expect(MockService).not.toHaveBeenCalled();
  });

  it('shows error toast if only one option remains', async () => {
    // Only one option
    rateFetchingStore.results = [
      { id: '11111111-1111-1111-1111-111111111111', total_cost: 100, is_manual: false },
    ];

    render(<UnifiedQuoteComposer />);
    
    // Wait for config to load
    await waitFor(() => {
      const zone = screen.getByTestId('results-zone');
      expect(zone).toHaveAttribute('data-has-remove', 'true');
    });

    const deleteBtn = screen.getByTestId('delete-option-11111111-1111-1111-1111-111111111111');
    fireEvent.click(deleteBtn);

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cannot delete',
      description: 'At least one option is required.',
      variant: 'destructive',
    }));

    const MockService = QuotationOptionCrudService as any;
    expect(MockService).not.toHaveBeenCalled();
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Mock dependencies
const { mockScopedDb, quoteStoreMock, rateFetchingMock, quoteRepositoryMock } = vi.hoisted(() => {
  return {
    mockScopedDb: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    quoteStoreMock: {
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
    },
    rateFetchingMock: {
      results: [],
      loading: false,
      error: null,
      fetchRates: vi.fn(),
      clearResults: vi.fn(),
      marketAnalysis: null,
      confidenceScore: null,
      anomalies: [],
    },
    quoteRepositoryMock: {
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
    }
  };
});

vi.mock('@/services/PortsService', () => ({
  PortsService: class {
    getAllPorts = vi.fn().mockResolvedValue([]);
    searchPorts = vi.fn().mockResolvedValue([]);
  }
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'test-tenant' },
    supabase: {},
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { id: 'test-profile' },
  }),
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({
    multi_option_enabled: true,
    auto_ranking_criteria: { cost: 0.4, transit_time: 0.3, reliability: 0.3 }
  });
  return { QuotationConfigurationService: MockService };
});

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => rateFetchingMock,
}));

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

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteStore: () => quoteStoreMock,
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => quoteRepositoryMock,
}));

vi.mock('@/components/sales/unified-composer/FormZone', () => ({
  FormZone: ({ initialValues }: any) => <div data-testid="form-zone">FormZone</div>,
}));

vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

// Mock ResultsZone to verify props passed to it
vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ results, selectedOptionId }: any) => (
    <div data-testid="results-zone" data-has-results={results ? 'true' : 'false'}>
      <div data-testid="results-count">{results?.length || 0}</div>
      {(results || []).map((r: any) => (
        <div key={r.id} data-testid={`option-${r.id}`}>
          {r.option_name || r.carrier || r.name}
        </div>
      ))}
    </div>
  ),
}));

const createSafeChain = (data: any = []) => {
  const chain: any = {};
  const methods = ['select', 'eq', 'or', 'in', 'order', 'limit', 'range', 'is', 'neq', 'abortSignal'];
  methods.forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });
  const singleResult = { data: Array.isArray(data) ? (data[0] || null) : data, error: null };
  chain.maybeSingle = vi.fn().mockResolvedValue(singleResult);
  chain.single = vi.fn().mockResolvedValue(singleResult);
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.delete = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: any) => Promise.resolve(resolve({ data, error: null }));
  return chain;
};

describe('UnifiedQuoteComposer Reproduction Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load options and pass them to ResultsZone when quoteId and versionId are provided', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const versionId = '00000000-0000-0000-0000-000000000002';
    const optionId = '11111111-1111-1111-1111-111111111111';

    const mockQuote = { 
      id: quoteId, 
      tenant_id: 'test-tenant',
      title: 'Test Quote',
      current_version_id: versionId 
    };

    const mockOptions = [
      { 
        id: optionId, 
        quotation_version_id: versionId,
        option_name: 'Test Option', 
        total_amount: 1000, 
        is_selected: true, 
        currency: 'USD' 
      }
    ];

    // Mock DB responses chain
    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = createSafeChain([]);

      if (table === 'quotes') {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockQuote, error: null });
      }
      if (table === 'quotation_version_options') {
        chain.order = vi.fn().mockResolvedValue({ data: mockOptions, error: null }) as any;
      }
      if (table === 'quotation_version_option_legs' || table === 'quote_charges') {
         if (table === 'quote_charges') {
             chain.in = vi.fn().mockResolvedValue({ data: [], error: null }) as any;
         } else {
             chain.order = vi.fn().mockResolvedValue({ data: [], error: null }) as any;
         }
      }

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} versionId={versionId} />
      </MemoryRouter>
    );

    // Wait for loadExistingQuote to finish
    await waitFor(() => {
        expect(mockScopedDb.from).toHaveBeenCalledWith('quotes');
        expect(mockScopedDb.from).toHaveBeenCalledWith('quotation_version_options');
    });

    const user = userEvent.setup();
    const resultsTab = await screen.findByRole('tab', { name: /Results & Finalize/i });
    await user.click(resultsTab);

    await waitFor(() => {
        const resultsZone = screen.getByTestId('results-zone');
        expect(resultsZone.getAttribute('data-has-results')).toBe('true');
        expect(screen.getByTestId('results-count')).toHaveTextContent('1');
        expect(screen.getByTestId(`option-${optionId}`)).toBeInTheDocument();
    });
  });

  it('should handle missing versionId by using current_version_id', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const currentVersionId = '00000000-0000-0000-0000-000000000003';
    
    const mockQuote = { 
      id: quoteId, 
      tenant_id: 'test-tenant', 
      current_version_id: currentVersionId 
    };
    
    // Mock DB to return options for the current version
    const optionId = '33333333-3333-3333-3333-333333333333';
    const mockOptions = [
        {
          id: optionId,
          quotation_version_id: currentVersionId,
          option_name: 'Current Option',
          total_amount: 500,
          currency: 'USD',
          is_selected: true
        }
    ];

    mockScopedDb.from.mockImplementation((table: string) => {
        const chain = createSafeChain([]);
  
        if (table === 'quotes') {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockQuote, error: null });
        }
        if (table === 'quotation_version_options') {
            chain.order = vi.fn().mockResolvedValue({ data: mockOptions, error: null }) as any;
        }
        if (table === 'quotation_version_option_legs' || table === 'quote_charges') {
            if (table === 'quote_charges') {
                chain.in = vi.fn().mockResolvedValue({ data: [], error: null }) as any;
            } else {
                chain.order = vi.fn().mockResolvedValue({ data: [], error: null }) as any;
            }
         }
  
        return chain;
      });

    // Render WITHOUT versionId
    render(
        <MemoryRouter>
          <UnifiedQuoteComposer quoteId={quoteId} />
        </MemoryRouter>
      );

    const user = userEvent.setup();
    const resultsTab = await screen.findByRole('tab', { name: /Results & Finalize/i });
    await user.click(resultsTab);

    await waitFor(() => {
        expect(screen.getByTestId('results-count')).toHaveTextContent('1');
        expect(screen.getByTestId(`option-${optionId}`)).toBeInTheDocument();
    });
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Mock useCRM
const { mockScopedDb } = vi.hoisted(() => {
  return {
    mockScopedDb: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      in: vi.fn().mockReturnThis(),
    }
  };
});

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

// Mock QuotationOptionCrudService
const mockDeleteOption = vi.fn().mockResolvedValue({ reselectedOptionId: null });
vi.mock('@/services/quotation/QuotationOptionCrudService', () => {
  return {
    QuotationOptionCrudService: vi.fn().mockImplementation(() => ({
      deleteOption: mockDeleteOption,
    })),
  };
});

// Mock useRateFetching - EMPTY RESULTS to simulate no market rates
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    error: null,
    fetchRates: vi.fn(), // Should not be called, but if called, returns empty
    clearResults: vi.fn(),
    marketAnalysis: null,
    confidenceScore: null,
    anomalies: [],
  }),
}));

// Mock other hooks
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

// Mock FormZone to allow triggering onGetRates
vi.mock('@/components/sales/unified-composer/FormZone', () => ({
  FormZone: ({ onGetRates }: any) => (
    <div data-testid="form-zone">
      <button 
        data-testid="get-rates-btn" 
        onClick={() => onGetRates({ mode: 'ocean', origin: 'A', destination: 'B' }, {}, false)}
      >
        Get Rates
      </button>
    </div>
  ),
}));

vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

// Mock ResultsZone to inspect what is rendered
vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ results, availableOptions }: any) => {
    if (results === null) return <div data-testid="empty-state">Empty State</div>;
    return (
      <div data-testid="results-zone">
        <div data-testid="results-count">{results?.length || 0}</div>
        {(results || []).map((r: any) => (
          <div key={r.id} data-testid={`option-${r.id}`} data-is-manual={r.is_manual}>
            {r.is_manual ? 'Manual' : 'Market'} Option {r.id}
          </div>
        ))}
        <div data-testid="available-options-count">{availableOptions?.length || 0}</div>
      </div>
    );
  },
}));

describe('UnifiedQuoteComposer Manual Only Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('automatically creates a manual option when Get Rates is clicked, and shows NO market rates', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer />
      </MemoryRouter>
    );

    // Initially no results
    expect(screen.queryByTestId('results-zone')).not.toBeInTheDocument();

    // Click Get Rates
    const getRatesBtn = screen.getByTestId('get-rates-btn');
    fireEvent.click(getRatesBtn);

    // Wait for results zone
    await waitFor(() => {
      expect(screen.getByTestId('results-zone')).toBeInTheDocument();
    });

    // Verify we have exactly 1 result
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');

    // Verify it is a manual option
    // The id is generated with Date.now(), so we check for 'manual-' prefix in the rendered text or data attribute
    // But since we can't predict the ID, we check the text content of the only option
    const option = screen.getByText(/Manual Option manual-/);
    expect(option).toBeInTheDocument();
    expect(option).toHaveAttribute('data-is-manual', 'true');

    // Verify available options count is 0 (no market rates hidden)
    expect(screen.getByTestId('available-options-count')).toHaveTextContent('0');
  });
});

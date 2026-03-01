
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(), // for promise chaining
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

// Mock other hooks
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    error: null,
    fetchRates: vi.fn(),
    clearResults: vi.fn(),
    marketAnalysis: null,
    confidenceScore: null,
    anomalies: [],
  }),
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

vi.mock('@/components/sales/unified-composer/FormZone', () => ({
  FormZone: ({ initialValues }: any) => <div data-testid="form-zone" data-initial-values={JSON.stringify(initialValues)}>FormZone</div>,
}));

vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ results, selectedOptionId }: any) => (
    <div data-testid="results-zone">
      <div data-testid="results-count">{results?.length || 0}</div>
      <div data-testid="selected-option-id">{selectedOptionId || 'none'}</div>
      {(results || []).map((r: any) => (
        <div key={r.id} data-testid={`option-${r.id}`}>
          Option {r.id}
        </div>
      ))}
    </div>
  ),
}));

describe('UnifiedQuoteComposer - Edit Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads existing quote with multiple options and restores state including cargo configs', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const versionId = '00000000-0000-0000-0000-000000000002';
    const option1Id = '11111111-1111-1111-1111-111111111111';
    const option2Id = '22222222-2222-2222-2222-222222222222';

    const mockQuote = { 
      id: quoteId, 
      tenant_id: 'test-tenant',
      title: 'Test Quote',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      opportunity_id: 'test-opp-id',
      total_weight: 0,
      total_volume: 0
    };

    const mockOptions = [
      { id: option1Id, total_amount: 1000, is_selected: false, currency: 'USD', option_name: 'Option 1' },
      { id: option2Id, total_amount: 1200, is_selected: true, currency: 'USD', option_name: 'Option 2' }
    ];

    const mockLegs: any[] = [];
    const mockCharges: any[] = [];
    
    const mockCargoConfigs = [
        { container_type: '20', container_size: 'Standard', quantity: 5 }
    ];
    
    const mockQuoteItems = [
        { weight_kg: 1000, volume_cbm: 10, product_name: 'Electronics' },
        { weight_kg: 500, volume_cbm: 5, product_name: 'Accessories' }
    ];

    // Mock DB responses
    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null })
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }
      if (table === 'quote_cargo_configurations') {
         chain.then = (resolve: any) => resolve({ data: mockCargoConfigs, error: null });
      }
      if (table === 'quote_items') {
         chain.then = (resolve: any) => resolve({ data: mockQuoteItems, error: null });
      }
      if (table === 'quotation_version_options') {
        chain.order = () => Promise.resolve({ data: mockOptions, error: null }) as any;
      }
      if (table === 'quotation_version_option_legs') {
         chain.order = () => Promise.resolve({ data: mockLegs, error: null }) as any;
      }
      if (table === 'quote_charges') {
         chain.in = () => Promise.resolve({ data: mockCharges, error: null }) as any;
      }

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} versionId={versionId} />
      </MemoryRouter>
    );

    // Wait for the form to be populated
    await waitFor(() => {
        const formZone = screen.getByTestId('form-zone');
        const initialValues = JSON.parse(formZone.getAttribute('data-initial-values') || '{}');
        
        expect(initialValues.quoteTitle).toBe('Test Quote');
        expect(initialValues.origin).toBe('Shanghai');
        expect(initialValues.opportunityId).toBe('test-opp-id');
        
        // Verify aggregated totals from quote_items
        expect(initialValues.weight).toBe('1500');
        expect(initialValues.volume).toBe('15');
        expect(initialValues.commodity).toBe('Electronics');
    });

    // Wait for options to be loaded
    await waitFor(() => {
        expect(screen.getByTestId('results-count')).toHaveTextContent('2');
    });

    // Verify correct options are displayed
    expect(screen.getByTestId(`option-${option1Id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`option-${option2Id}`)).toBeInTheDocument();

    // Verify correct option is selected (Option 2 was is_selected: true)
    expect(screen.getByTestId('selected-option-id')).toHaveTextContent(option2Id);
  });
});

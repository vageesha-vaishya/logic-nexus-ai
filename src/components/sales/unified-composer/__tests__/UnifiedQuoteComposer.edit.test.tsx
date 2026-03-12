
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Mock useCRM
const { mockScopedDb, mockSupabase, quoteStoreMock, rateFetchingMock, quoteRepositoryMock } = vi.hoisted(() => {
  return {
    mockScopedDb: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(),
    },
    mockSupabase: {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
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

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'test-tenant' },
    supabase: mockSupabase,
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
  FormZone: ({ initialValues }: any) => <div data-testid="form-zone" data-initial-values={JSON.stringify(initialValues)}>FormZone</div>,
}));

vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: ({ selectedOption, onRouteOptionChange, routeValidationIssues }: any) => (
    <div data-testid="finalize-section">
      <div data-testid="finalize-selected-option">{selectedOption?.id || ''}</div>
      <div data-testid="finalize-route-issues">{(routeValidationIssues || []).join('|')}</div>
      <button
        data-testid="apply-route-edit"
        onClick={() => onRouteOptionChange?.(selectedOption.id, [
          {
            id: `${selectedOption.id}-leg-1`,
            mode: 'ocean',
            origin: 'Busan Port',
            destination: 'Long Beach Terminal',
            departure_date: '2026-03-22',
            carrier: 'Edited Ocean Carrier',
          },
        ])}
      >
        Apply Route Edit
      </button>
    </div>
  ),
}));

vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ results, selectedOptionId }: any) => {
    const selected = (results || []).find((r: any) => r.id === selectedOptionId);
    return (
      <div data-testid="results-zone">
        <div data-testid="results-count">{results?.length || 0}</div>
        <div data-testid="selected-option-id">{selectedOptionId || 'none'}</div>
        <div data-testid="selected-option-carrier">{selected?.carrier || ''}</div>
        <div data-testid="selected-option-is-manual">{String(!!selected?.is_manual)}</div>
        <div data-testid="selected-option-origin">{selected?.legs?.[0]?.origin || ''}</div>
        <div data-testid="selected-option-destination">{selected?.legs?.[0]?.destination || ''}</div>
        <div data-testid="selected-option-departure">{selected?.legs?.[0]?.departure_date || ''}</div>
        {(results || []).map((r: any) => (
          <div key={r.id} data-testid={`option-${r.id}`}>
            Option {r.id}
          </div>
        ))}
      </div>
    );
  },
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
        or: () => chain,
        in: () => chain,
        is: () => chain,
        neq: () => chain,
        limit: () => chain,
        range: () => chain,
        abortSignal: () => chain,
        order: () => chain,
        insert: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null }))
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }
      if (table === 'quote_cargo_configurations') {
         chain.then = (resolve: any) => Promise.resolve(resolve({ data: mockCargoConfigs, error: null }));
      }
      if (table === 'quote_items') {
         chain.then = (resolve: any) => Promise.resolve(resolve({ data: mockQuoteItems, error: null }));
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

    const user = userEvent.setup();
    const resultsTab = await screen.findByRole('tab', { name: /Results & Finalize/i });
    await user.click(resultsTab);

    await waitFor(() => {
        expect(screen.getByTestId('results-count')).toHaveTextContent('2');
    });

    // Verify correct options are displayed
    expect(screen.getByTestId(`option-${option1Id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`option-${option2Id}`)).toBeInTheDocument();

    // Verify correct option is selected (Option 2 was is_selected: true)
    expect(screen.getByTestId('selected-option-id')).toHaveTextContent(option2Id);
  });

  it('hydrates loaded option leg fields from *_location_name columns', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000011';
    const versionId = '00000000-0000-0000-0000-000000000012';
    const optionId = '33333333-3333-3333-3333-333333333333';

    const mockQuote = {
      id: quoteId,
      tenant_id: 'test-tenant',
      title: 'Hydration Quote',
      origin: 'Shenzhen',
      destination: 'Hamburg',
      total_weight: 0,
      total_volume: 0,
    };

    const mockOptions = [
      {
        id: optionId,
        total_amount: 4813,
        is_selected: true,
        currency: 'USD',
        option_name: 'Smart Option',
        carrier_name: 'Global Smart Lines',
        source_attribution: 'AI Smart Engine',
      },
    ];

    const mockLegs = [
      {
        id: '44444444-4444-4444-4444-444444444444',
        quotation_version_option_id: optionId,
        transport_mode: 'ocean',
        sort_order: 1,
        carrier_name: 'Ocean Partner',
        origin_location_name: 'Shenzhen Factory',
        destination_location_name: 'Yantian Port',
        departure_date: '2026-03-12',
      },
    ];

    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        in: () => chain,
        is: () => chain,
        neq: () => chain,
        limit: () => chain,
        range: () => chain,
        abortSignal: () => chain,
        order: () => chain,
        insert: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null })),
      };

      if (table === 'quotes') chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      if (table === 'quotation_version_options') chain.order = () => Promise.resolve({ data: mockOptions, error: null }) as any;
      if (table === 'quotation_version_option_legs') chain.order = () => Promise.resolve({ data: mockLegs, error: null }) as any;
      if (table === 'quote_cargo_configurations') chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      if (table === 'quote_items') chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      if (table === 'quote_charges') chain.in = () => Promise.resolve({ data: [], error: null }) as any;

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} versionId={versionId} />
      </MemoryRouter>
    );

    const user = userEvent.setup();
    const resultsTab = await screen.findByRole('tab', { name: /Results & Finalize/i });
    await user.click(resultsTab);

    await waitFor(() => {
      expect(screen.getByTestId('selected-option-id')).toHaveTextContent(optionId);
      expect(screen.getByTestId('selected-option-is-manual')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-option-carrier')).toHaveTextContent('Global Smart Lines');
      expect(screen.getByTestId('selected-option-origin')).toHaveTextContent('Shenzhen Factory');
      expect(screen.getByTestId('selected-option-destination')).toHaveTextContent('Yantian Port');
      expect(screen.getByTestId('selected-option-departure')).toHaveTextContent('2026-03-12');
    });
  });

  it('recalculates smart option route fields after finalize route edit', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000021';
    const versionId = '00000000-0000-0000-0000-000000000022';
    const optionId = '55555555-5555-5555-5555-555555555555';

    const mockQuote = {
      id: quoteId,
      tenant_id: 'test-tenant',
      title: 'Editable Smart Quote',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      total_weight: 0,
      total_volume: 0,
    };

    const mockOptions = [
      {
        id: optionId,
        total_amount: 4200,
        is_selected: true,
        currency: 'USD',
        option_name: 'Smart Option',
        carrier_name: 'Global Smart Lines',
        source_attribution: 'AI Smart Engine',
      },
    ];

    const mockLegs = [
      {
        id: '66666666-6666-6666-6666-666666666666',
        quotation_version_option_id: optionId,
        transport_mode: 'ocean',
        sort_order: 1,
        carrier_name: 'Ocean Partner',
        origin_location_name: 'Shanghai Port',
        destination_location_name: 'LA Harbor',
        departure_date: '2026-03-14',
      },
    ];

    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        in: () => chain,
        is: () => chain,
        neq: () => chain,
        limit: () => chain,
        range: () => chain,
        abortSignal: () => chain,
        order: () => chain,
        insert: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null })),
      };

      if (table === 'quotes') chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      if (table === 'quotation_version_options') chain.order = () => Promise.resolve({ data: mockOptions, error: null }) as any;
      if (table === 'quotation_version_option_legs') chain.order = () => Promise.resolve({ data: mockLegs, error: null }) as any;
      if (table === 'quote_cargo_configurations') chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      if (table === 'quote_items') chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      if (table === 'quote_charges') chain.in = () => Promise.resolve({ data: [], error: null }) as any;
      if (table === 'carriers') chain.order = () => Promise.resolve({ data: [{ id: 'carrier-1', carrier_name: 'Edited Ocean Carrier', carrier_type: 'shipping_line' }], error: null }) as any;
      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} versionId={versionId} />
      </MemoryRouter>
    );

    const user = userEvent.setup();
    const resultsTab = await screen.findByRole('tab', { name: /Results & Finalize/i });
    await user.click(resultsTab);

    await waitFor(() => {
      expect(screen.getByTestId('selected-option-id')).toHaveTextContent(optionId);
      expect(screen.getByTestId('selected-option-origin')).toHaveTextContent('Shanghai Port');
      expect(screen.getByTestId('selected-option-destination')).toHaveTextContent('LA Harbor');
    });

    await user.click(screen.getByTestId('apply-route-edit'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-option-origin')).toHaveTextContent('Busan Port');
      expect(screen.getByTestId('selected-option-destination')).toHaveTextContent('Long Beach Terminal');
      expect(screen.getByTestId('selected-option-departure')).toHaveTextContent('2026-03-22');
      expect(screen.getByTestId('selected-option-id')).toHaveTextContent(optionId);
    });
  });
});

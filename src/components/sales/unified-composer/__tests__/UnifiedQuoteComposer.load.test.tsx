
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Mock useCRM
const { mockScopedDb, quoteStoreMock, rateFetchingMock, quoteRepositoryMock } = vi.hoisted(() => {
  return {
    mockScopedDb: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(),
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
    },
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

describe('UnifiedQuoteComposer Load Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads existing quote with multiple options and restores state', async () => {
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
      origin_port_data: { location_name: 'Shanghai', location_code: 'SHA' },
      destination_port_data: { location_name: 'Los Angeles', location_code: 'LAX' }
    };

    const mockOptions = [
      { id: option1Id, total_amount: 1000, is_selected: false, currency: 'USD', option_name: 'Option 1' },
      { id: option2Id, total_amount: 1200, is_selected: true, currency: 'USD', option_name: 'Option 2' }
    ];

    const mockLegs: any[] = [];
    const mockCharges: any[] = [];

    // Mock DB responses
    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        limit: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null }))
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }
      if (table === 'quotation_version_options') {
        // Return promise that resolves to data for await
        // The implementation in component uses: await scopedDb...order(...)
        // So we need to make sure the final call returns the data.
        // We can override the final chain method or just mock the promise resolution if we control the chain.
        // Actually, since we return 'chain' for all methods, we just need the LAST method called to return the promise.
        // But 'order' returns a promise-like object in Supabase client usually, or we await the chain.
        // In the component: await scopedDb...order()
        // So order() should return the promise.
        chain.order = () => Promise.resolve({ data: mockOptions, error: null }) as any;
      }
      if (table === 'quotation_version_option_legs') {
         chain.order = () => Promise.resolve({ data: mockLegs, error: null }) as any;
      }
      if (table === 'quote_charges') {
         // Component uses .in()... then implicit await. 
         // Actually component uses: await scopedDb...in()
         // Wait, the component code:
         // await scopedDb...in('quote_option_id', optionIds)
         // So in() must return the promise-like object or we need to handle it.
         // But wait, the component code actually has .select().in()
         // And typically in Supabase JS, you await the whole chain.
         // So any method in the chain returning the promise is fine if we just await the chain.
         // But here we are mocking.
         // If the component code is: await scopedDb.from().select().in()
         // Then in() needs to return the result? No, usually in() returns the builder.
         // The promise is evaluated when 'then' is called.
         
         // Let's look at the component code again:
         // await scopedDb.from(...).select(...).in(...)
         // So 'in' is the last call before await.
         // So 'in' should return a Promise that resolves to { data, error }.
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

  it('restores commodity from quotes.cargo_details when reopening a saved quote', async () => {
    const quoteId = '00000000-0000-0000-0000-0000000000aa';

    const mockQuote = {
      id: quoteId,
      tenant_id: 'test-tenant',
      title: 'Saved Quote With Commodity',
      transport_mode: 'ocean',
      origin: 'Nhava Sheva',
      destination: 'New York',
      origin_port_data: { location_name: 'Nhava Sheva', location_code: 'INNSA' },
      destination_port_data: { location_name: 'New York', location_code: 'USNYC' },
      cargo_details: {
        commodity: 'PARTS OF BABY CARRIAGES - 8715.00.00.40',
        total_weight_kg: 980,
        total_volume_cbm: 11.2,
        hts_code: '8715.00.00.40'
      }
    };

    mockScopedDb.from.mockImplementation((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        limit: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null }))
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const formZone = screen.getByTestId('form-zone');
      const initialValues = JSON.parse(formZone.getAttribute('data-initial-values') || '{}');
      expect(initialValues.commodity).toBe('PARTS OF BABY CARRIAGES - 8715.00.00.40');
      expect(initialValues.weight).toBe('980');
      expect(initialValues.volume).toBe('11.2');
    });
  });

  it('falls back to location ids when joined location names are unavailable', async () => {
    const quoteId = '00000000-0000-0000-0000-0000000000ab';
    const originId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const destinationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const mockQuote = {
      id: quoteId,
      tenant_id: 'test-tenant',
      title: 'Quote Without Joined Location Names',
      transport_mode: 'ocean',
      origin: null,
      destination: null,
      origin_port_id: originId,
      destination_port_id: destinationId,
      origin_port_data: null,
      destination_port_data: null,
    };

    mockScopedDb.from.mockImplementation((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        limit: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null })),
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const formZone = screen.getByTestId('form-zone');
      const initialValues = JSON.parse(formZone.getAttribute('data-initial-values') || '{}');
      expect(initialValues.origin).toBe(originId);
      expect(initialValues.destination).toBe(destinationId);
      expect(initialValues.originId).toBe(originId);
      expect(initialValues.destinationId).toBe(destinationId);
    });

    expect(
      screen.getByText('Origin name unavailable; loaded using stored location identifier')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Destination name unavailable; loaded using stored location identifier')
    ).toBeInTheDocument();
  });

  it('resolves and loads a quote when quoteId is a quote number', async () => {
    const quoteNumber = 'QUO-260309-00001';
    const resolvedQuoteId = '00000000-0000-0000-0000-0000000000ac';

    const mockQuote = {
      id: resolvedQuoteId,
      quote_number: quoteNumber,
      tenant_id: 'test-tenant',
      title: 'Recovered by quote number',
      transport_mode: 'ocean',
      origin: 'Mumbai',
      destination: 'Hamburg',
      origin_port_data: { location_name: 'Mumbai', location_code: 'INBOM' },
      destination_port_data: { location_name: 'Hamburg', location_code: 'DEHAM' },
    };

    mockScopedDb.from.mockImplementation((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        limit: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null })),
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteNumber} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const formZone = screen.getByTestId('form-zone');
      const initialValues = JSON.parse(formZone.getAttribute('data-initial-values') || '{}');
      expect(initialValues.quoteTitle).toBe('Recovered by quote number');
      expect(initialValues.origin).toBe('Mumbai');
      expect(initialValues.destination).toBe('Hamburg');
    });
  });

  it('recovers empty draft fields from latest version snapshot', async () => {
    const quoteId = '00000000-0000-0000-0000-0000000000ad';
    const mockQuote = {
      id: quoteId,
      quote_number: 'QUO-260309-00002',
      tenant_id: 'test-tenant',
      title: '',
      transport_mode: 'ocean',
      origin: null,
      destination: null,
      origin_port_id: null,
      destination_port_id: null,
      cargo_details: null,
      origin_port_data: null,
      destination_port_data: null,
    };
    const latestVersion = {
      id: '00000000-0000-0000-0000-0000000000ae',
      metadata: {
        snapshot: {
          quote: {
            title: 'Recovered snapshot quote',
            origin: 'Chennai',
            destination: 'Rotterdam',
            cargo_details: {
              commodity: 'Recovered Commodity',
              total_weight_kg: 2400,
              total_volume_cbm: 32.5,
            },
          },
        },
      },
    };

    mockScopedDb.from.mockImplementation((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        limit: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: [], error: null })),
      };

      if (table === 'quotes') {
        chain.maybeSingle = () => Promise.resolve({ data: mockQuote, error: null });
      }
      if (table === 'quotation_versions') {
        chain.order = () => Promise.resolve({ data: [latestVersion], error: null }) as any;
      }

      return chain;
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const formZone = screen.getByTestId('form-zone');
      const initialValues = JSON.parse(formZone.getAttribute('data-initial-values') || '{}');
      expect(initialValues.quoteTitle).toBe('Recovered snapshot quote');
      expect(initialValues.origin).toBe('Chennai');
      expect(initialValues.destination).toBe('Rotterdam');
      expect(initialValues.commodity).toBe('Recovered Commodity');
      expect(initialValues.weight).toBe('2400');
      expect(initialValues.volume).toBe('32.5');
    });
  });
});

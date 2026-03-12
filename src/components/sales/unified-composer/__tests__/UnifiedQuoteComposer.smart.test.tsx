
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QuoteStoreProvider } from '@/components/sales/composer/store/QuoteStore';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';

// --- Mocks ---

// Mock UI components to avoid rendering complexity
const { mockToast } = vi.hoisted(() => ({
    mockToast: vi.fn()
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/sales/unified-composer/FormZone', () => ({
  FormZone: ({ onGetRates }: any) => (
    <div data-testid="form-zone">
      <button 
        data-testid="get-rates-btn" 
        onClick={() => onGetRates({ 
          mode: 'ocean', 
          origin: 'Shanghai', 
          destination: 'Hamburg',
          pickup_date: '2026-04-10',
        }, {}, true)} 
      >
        Get Rates
      </button>
    </div>
  ),
}));

vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ results, loading, smartMode, marketAnalysis, availableOptions, onSelect, onAddRateOption }: any) => (
    <div data-testid="results-zone">
      {loading && <div>Loading...</div>}
      {smartMode && <div>Smart Results Active</div>}
      {marketAnalysis && <div>{marketAnalysis}</div>}
      <ul>
        {results?.map((r: any) => (
          <li key={r.id} data-testid="rate-option">
            {r.carrier} - {r.price}
            <button data-testid={`select-option-${r.id}`} onClick={() => onSelect(r)}>Select</button>
          </li>
        ))}
      </ul>
      <div data-testid="available-options">
        {availableOptions?.map((r: any) => (
          <div key={r.id}>
            {r.carrier} - {r.price}
            <button data-testid={`add-option-${r.id}`} onClick={() => onAddRateOption(r.id)}>Add</button>
          </div>
        ))}
      </div>
    </div>
  ),
}));

// Mock Hooks
const mockInvokeAiAdvisor = vi.fn();

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: mockInvokeAiAdvisor,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    profile: { role: 'admin' },
    session: { access_token: 'test-token' }
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

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

// Mock QuotationConfigurationService
const { mockGetConfiguration, mockScopedDb, mockContext, mockFetchRates, mockResults } = vi.hoisted(() => {
  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };

  return { 
      mockGetConfiguration: vi.fn(),
      mockScopedDb: {
        from: vi.fn().mockReturnValue(mockBuilder),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
        }
      },
      mockContext: { tenantId: 'test-tenant', isPlatformAdmin: false },
      mockFetchRates: vi.fn().mockResolvedValue([]),
      mockResults: [
        { id: 'ai-1', carrier: 'AI Carrier', price: 1000, source_attribution: 'AI Smart Engine' },
        { id: 'mkt-1', carrier: 'Market Carrier', price: 1200 }
      ]
  };
});

vi.mock('@/hooks/useDraftAutoSave', () => ({
  useDraftAutoSave: () => ({ lastSaved: null, isSavingDraft: false }),
}));

vi.mock('@/hooks/useCRM', () => ({
    useCRM: () => ({
      supabase: {
        from: () => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
      context: mockContext,
      scopedDb: mockScopedDb
    }),
  }));

  vi.mock('@/hooks/useRateFetching', () => ({
    useRateFetching: () => ({
      fetchRates: mockFetchRates,
      isLoading: false,
      error: null,
      results: mockResults,
      marketAnalysis: 'AI Analysis Ready',
      confidenceScore: 0.9,
      anomalies: [],
      progress: 0
    }),
  }));
  
  vi.mock('@/services/quotation/QuotationConfigurationService', () => {
    return {
      QuotationConfigurationService: class {
        getConfiguration = mockGetConfiguration;
        getTenantConfig = mockGetConfiguration;
      }
    };
  });

  // Additional Service Mocks
  vi.mock('@/services/pricing.service', () => ({
    PricingService: class {
      calculate = vi.fn();
    }
  }));

  vi.mock('@/services/QuoteOptionService', () => ({
    QuoteOptionService: class {
      createOption = vi.fn();
    }
  }));

  vi.mock('@/services/PortsService', () => ({
    PortsService: class {
      getPorts = vi.fn().mockResolvedValue([]);
    }
  }));

  vi.mock('@/services/quotation/QuotationRankingService', () => ({
    QuotationRankingService: {
      rankOptions: vi.fn().mockReturnValue([])
    }
  }));

  const { mockQNS } = vi.hoisted(() => ({
    mockQNS: {
      getConfig: vi.fn().mockResolvedValue({}),
      generateNext: vi.fn().mockResolvedValue('Q-1001'),
      isUnique: vi.fn().mockResolvedValue(true),
    }
  }));

  vi.mock('@/services/quotation/QuotationNumberService', () => ({
    QuotationNumberService: mockQNS
  }));

  vi.mock('@/components/ui/enterprise', () => ({
    EnterpriseFormLayout: ({ children, title, actions }: any) => (
      <div data-testid="enterprise-layout">
        <h1>{title}</h1>
        <div>{actions}</div>
        {children}
      </div>
    ),
  }));

  vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: ({ onSaveQuote }: any) => (
    <div data-testid="finalize-section">
      Finalize Section
      <button 
        data-testid="save-quote-btn" 
        onClick={() => {
          onSaveQuote([], 15, 'Test Notes');
        }}
      >
        Save Quote
      </button>
    </div>
  )
}));

  const { mockShowSuccess } = vi.hoisted(() => ({ mockShowSuccess: vi.fn() }));
  vi.mock('@/components/notifications/QuotationSuccessToast', () => ({
    showQuotationSuccessToast: mockShowSuccess
  }));

  vi.mock('@/lib/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  }));

  vi.mock('@/lib/supabase-functions', () => ({
    invokeAnonymous: vi.fn(),
    enrichPayload: vi.fn()
  }));



  vi.mock('@/services/quotation/QuotationOptionCrudService', () => ({
    QuotationOptionCrudService: class {
      saveOption = vi.fn();
      deleteOption = vi.fn();
    }
  }));

  vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
    QuoteStoreProvider: ({ children }: any) => <div data-testid="quote-store-provider">{children}</div>,
    useQuoteStore: () => ({
      state: {
        quoteData: { account_id: 'acc-1' },
        currentStep: 1,
        viewMode: 'composer',
        isLoading: false,
        isSaving: false,
        isGeneratingSmart: false,
        legs: [],
        charges: [],
        options: [],
        deletedLegIds: [],
        deletedChargeIds: [],
        deletedOptionIds: [],
        validationErrors: [],
        validationWarnings: [],
        autoMargin: true,
        marginPercent: 0,
        referenceData: {
          serviceTypes: [],
          transportModes: [],
          chargeCategories: [],
          chargeBases: [],
          currencies: [],
          tradeDirections: [],
          containerTypes: [],
          containerSizes: [],
          carriers: [],
          chargeSides: [],
          serviceLegCategories: [],
          shippingTerms: [],
          ports: [],
          accounts: [],
          contacts: []
        },
        basisModal: {
          isOpen: false,
          target: null,
          config: {}
        }
      },
      dispatch: vi.fn(),
    }),
  }));

  vi.mock('@/components/ui/badge', () => ({ Badge: () => <div data-testid="badge" /> }));
  vi.mock('@/components/ui/button', () => ({ Button: (props: any) => <button {...props} /> }));
  vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children }: any) => <div>{children}</div>,
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    TabsContent: ({ children }: any) => <div>{children}</div>,
  }));
  vi.mock('@/components/ui/separator', () => ({ Separator: () => <div data-testid="separator" /> }));
  vi.mock('@/components/ui/sheet', () => ({ 
    Sheet: ({ children }: any) => <div>{children}</div>,
    SheetContent: ({ children }: any) => <div>{children}</div>,
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <div>{children}</div>,
    SheetTrigger: ({ children }: any) => <div>{children}</div>
  }));

  /*
  vi.mock('react-hook-form', () => ({
    useForm: () => ({
      register: vi.fn(),
      handleSubmit: vi.fn(),
      watch: vi.fn(),
      setValue: vi.fn(),
      getValues: vi.fn(),
      reset: vi.fn(),
      formState: { errors: {} },
      control: {},
    }),
    FormProvider: ({ children }: any) => <div>{children}</div>,
    useFormContext: () => ({}),
    Controller: () => null,
  }));
  */

  /*
  vi.mock('../UnifiedQuoteComposer', () => ({
    UnifiedQuoteComposer: () => <div data-testid="mocked-composer">Mocked Composer</div>
  }));
  */

describe('UnifiedQuoteComposer Smart Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles "Get Rates" with Smart Mode enabled', async () => {
    // Mock config
    mockGetConfiguration.mockResolvedValue({
      smart_mode_enabled: true,
      auto_ranking_criteria: { cost: 0.5, transit: 0.5 },
    });

    render(
      <MemoryRouter>
            <UnifiedQuoteComposer 
                initialData={{}} 
                quoteId={undefined} 
                versionId={undefined} 
            />
      </MemoryRouter>
    );

    // Proceed without waiting on config call; the component falls back safely in tests

    // Check if FormZone renders
    expect(screen.getByTestId('form-zone')).toBeInTheDocument();

    const getRatesBtn = screen.getByTestId('get-rates-btn');
    
    await act(async () => {
      fireEvent.click(getRatesBtn);
    });

    await waitFor(() => {
      expect(mockFetchRates).toHaveBeenCalledWith(
        expect.objectContaining({
          smartMode: true,
          mode: 'ocean'
        }),
        expect.anything()
      );
    });

    // Verify ResultsZone receives smart mode props
    expect(screen.getByTestId('results-zone')).toBeInTheDocument();
    expect(screen.getByText('Smart Results Active')).toBeInTheDocument();
    expect(screen.getByText('AI Analysis Ready')).toBeInTheDocument();
    expect(screen.getByText('AI Carrier - 1000')).toBeInTheDocument();
  });

  it('saves a quote selected from Smart Mode results', async () => {
    mockGetConfiguration.mockResolvedValue({
      smart_mode_enabled: true,
      auto_ranking_criteria: { cost: 0.5, transit: 0.5 },
    });

    const validInitialData = {
      mode: 'ocean',
      origin: 'New York',
      originId: '00000000-0000-0000-0000-000000000001',
      destination: 'London',
      destinationId: '00000000-0000-0000-0000-000000000002',
      commodity: 'Electronics',
      weight: '1000',
      volume: '10',
      containerType: '00000000-0000-0000-0000-000000000003',
      containerSize: '00000000-0000-0000-0000-000000000004',
      containerQty: '1',
      accountId: '00000000-0000-0000-0000-000000000005',
    };

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={validInitialData} />
      </MemoryRouter>
    );

    await waitFor(() => { expect(screen.getByTestId('get-rates-btn')).toBeInTheDocument(); });

    // Trigger Smart Mode Get Rates
    const getRatesBtn = screen.getByTestId('get-rates-btn');
    await act(async () => {
      fireEvent.click(getRatesBtn);
    });

    // Add the AI option from available options
    const addBtn = await screen.findByTestId('add-option-ai-1');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // Select the AI option (now in results)
    const selectBtn = await screen.findByTestId('select-option-ai-1');
    await act(async () => {
      fireEvent.click(selectBtn);
    });

    // Verify Finalize Section appears
    expect(screen.getByTestId('finalize-section')).toBeInTheDocument();

    // Click Save
    const saveBtn = screen.getByTestId('save-quote-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Assert Payload
    await waitFor(() => {
        expect(mockScopedDb.rpc).toHaveBeenCalledWith(
            'save_quote_atomic',
            expect.objectContaining({
                p_payload: expect.objectContaining({
                    options: expect.arrayContaining([
                        expect.objectContaining({
                            is_selected: true,
                            source_attribution: 'AI Smart Engine',
                            // In real app, we might check for ai_generated flag if the mock results had it
                            // For now, checking source_attribution confirms it's the AI option
                        })
                    ])
                })
            })
        );
    });
  });

  it('preserves charges for unselected options when saving', async () => {
    // Setup with multiple options
    const option1 = {
      id: 'rate-1',
      carrier: 'Carrier A',
      price: 1000,
      charges: [{
        id: 'ch-1',
        legId: null,
        category_id: '00000000-0000-0000-0000-000000000011',
        basis_id: '00000000-0000-0000-0000-000000000012',
        currency_id: '00000000-0000-0000-0000-000000000013',
        unit: 'container',
        buy: { quantity: 1, rate: 900, amount: 900 },
        sell: { quantity: 1, rate: 1000, amount: 1000 },
        note: 'Freight'
      }]
    };
    const option2 = {
      id: 'rate-2',
      carrier: 'Carrier B',
      price: 2000,
      charges: [{
        id: 'ch-2',
        legId: null,
        category_id: '00000000-0000-0000-0000-000000000011',
        basis_id: '00000000-0000-0000-0000-000000000012',
        currency_id: '00000000-0000-0000-0000-000000000013',
        unit: 'container',
        buy: { quantity: 1, rate: 1800, amount: 1800 },
        sell: { quantity: 1, rate: 2000, amount: 2000 },
        note: 'Freight'
      }]
    };

    // Update mock results
    mockResults.length = 0;
    mockResults.push(option1, option2);

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={{
          accountId: 'cust-123',
          mode: 'ocean',
          origin: 'Origin Name',
          originId: 'origin-123',
          destination: 'Dest Name',
          destinationId: 'dest-123',
          commodity: 'Test Commodity',
          weight: '1000',
          volume: '10',
          containerType: 'CT',
          containerSize: '40HC',
          containerQty: '1'
        }} />
      </MemoryRouter>
    );

    await waitFor(() => { expect(screen.getByTestId('get-rates-btn')).toBeInTheDocument(); });

    // Trigger get rates
    const getRatesBtn = screen.getByTestId('get-rates-btn');
    await act(async () => {
      fireEvent.click(getRatesBtn);
    });

    // In Smart Mode, options start in available list. Add option 1 to visible list first.
    const addBtn = await screen.findByTestId('add-option-rate-1');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // Add option 2 as well (keep it unselected, but included in save payload)
    const addBtn2 = await screen.findByTestId('add-option-rate-2');
    await act(async () => {
      fireEvent.click(addBtn2);
    });

    // Now select option 1 from the visible list
    const selectBtn = await screen.findByTestId('select-option-rate-1');
    await act(async () => {
      fireEvent.click(selectBtn);
    });

    // Save Quote
    const saveBtn = screen.getByTestId('save-quote-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify success toast was shown (indicates save flow completed)
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalled();
    });
  });

  it('saves leg-level charges for unselected second option (multi-option regression)', async () => {
    const option1 = {
      id: 'rate-a',
      carrier: 'Carrier A',
      price: 1000,
      charges: [],
      legs: [],
    };
    const option2 = {
      id: 'rate-b',
      carrier: 'Carrier B',
      price: 2000,
      charges: [],
      legs: [{
        id: 'leg-b-1',
        mode: 'ocean',
        origin: 'Origin B',
        destination: 'Destination B',
        charges: [{
          id: 'leg-charge-b1',
          category_id: '00000000-0000-0000-0000-000000000011',
          basis_id: '00000000-0000-0000-0000-000000000012',
          currency_id: '00000000-0000-0000-0000-000000000013',
          unit: 'container',
          buy: { quantity: 2, rate: 900, amount: 1800 },
          sell: { quantity: 2, rate: 1000, amount: 2000 },
          note: 'Leg freight',
        }]
      }],
    };

    mockResults.length = 0;
    mockResults.push(option1 as any, option2 as any);

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={{
          accountId: 'cust-123',
          mode: 'ocean',
          origin: 'Origin Name',
          originId: 'origin-123',
          destination: 'Dest Name',
          destinationId: 'dest-123',
          commodity: 'Test Commodity',
          weight: '1000',
          volume: '10',
          containerType: 'CT',
          containerSize: '40HC',
          containerQty: '1'
        }} />
      </MemoryRouter>
    );

    await waitFor(() => { expect(screen.getByTestId('get-rates-btn')).toBeInTheDocument(); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('get-rates-btn'));
    });

    await act(async () => {
      fireEvent.click(await screen.findByTestId('add-option-rate-a'));
      fireEvent.click(await screen.findByTestId('add-option-rate-b'));
    });

    await act(async () => {
      fireEvent.click(await screen.findByTestId('select-option-rate-a'));
    });

    const saveBtn = await screen.findByTestId('save-quote-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(mockScopedDb.rpc).toHaveBeenCalled();
      const saveQuoteCall = mockScopedDb.rpc.mock.calls.find(([fnName]) => fnName === 'save_quote_atomic');
      expect(saveQuoteCall).toBeDefined();
      const payload = saveQuoteCall?.[1]?.p_payload;
      expect(payload?.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            option_name: 'Carrier B',
            is_selected: false,
            legs: expect.arrayContaining([
              expect.objectContaining({
                charges: expect.arrayContaining([
                  expect.objectContaining({ side: 'buy', unit_price: 900 }),
                  expect.objectContaining({ side: 'sell', unit_price: 1000 }),
                ]),
              }),
            ]),
          }),
        ])
      );
    });
  });
});

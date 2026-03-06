import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UnifiedQuoteComposer } from './UnifiedQuoteComposer';
/* import { UnifiedQuoteComposer } from './UnifiedQuoteComposer'; */
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
const { 
    mockScopedDb, 
    mockDispatch,
    mockContainerTypes,
    mockContainerSizes,
    mockFormReturn,
    mockRateFetchingReturn,
    mockQuoteRepositoryReturn,
    mockConfig
} = vi.hoisted(() => {
    // Helper inside hoisted block
    const createChain = (data: any = [], error: any = null) => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
                maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
                order: vi.fn().mockResolvedValue({ data, error }),
            })),
            order: vi.fn().mockResolvedValue({ data, error }),
        })),
        insert: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
        delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const mockConfig = {
        smart_mode_enabled: false
    };

    const mockFormReturn = {
        handleSubmit: (fn: any) => (e: any) => { e?.preventDefault(); fn(); },
        register: vi.fn(),
        setValue: vi.fn(),
        getValues: vi.fn().mockReturnValue({
            mode: 'ocean',
            origin: 'Origin',
            destination: 'Dest',
            originId: 'origin-uuid',
            destinationId: 'dest-uuid',
            commodity: 'Commodity',
            weight: '1000',
            volume: '10',
            containerType: '00000000-0000-0000-0000-000000000001',
            containerSize: '00000000-0000-0000-0000-000000000002',
            containerQty: '1',
            quoteTitle: 'Test Quote',
            accountId: 'acc-1',
            contactId: 'contact-1',
            opportunityId: 'opp-1'
        }),
        trigger: vi.fn().mockResolvedValue(true),
        watch: vi.fn(),
        formState: { errors: {}, isDirty: false },
        control: { _stub: true },
        reset: vi.fn(),
    };

    const mockRateFetchingReturn = {
        loading: false,
        results: [
            { 
                id: 'opt-1', 
                carrier: 'Carrier A', 
                amount: 1000, 
                transitTime: '20 days',
                service_type: 'port_to_port',
                charge_breakdown: [],
                legs: [{ id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' }],
                ai_generated: false
            }
        ],
        error: null,
        fetchRates: vi.fn().mockResolvedValue([]),
        clearRates: vi.fn(),
    };

    const mockQuoteRepositoryReturn = {
        chargeCategories: [{ id: 'cat-1', code: 'FRT', name: 'Freight' }],
        chargeBases: [{ id: 'basis-1', code: 'per_container', name: 'Per Container' }],
        currencies: [{ id: 'curr-1', code: 'USD', name: 'US Dollar' }],
        chargeSides: [{ id: 'side-1', code: 'buy', name: 'Buy' }, { id: 'side-2', code: 'sell', name: 'Sell' }]
    };

    return {
        mockScopedDb: {
            from: vi.fn(() => createChain()),
            rpc: vi.fn().mockResolvedValue({ data: 'new-quote-id', error: null }),
        },
        mockDispatch: vi.fn(),
        mockContainerTypes: [
            { id: '00000000-0000-0000-0000-000000000001', name: 'Standard Dry', code: '20GP' }
        ],
        mockContainerSizes: [
            { id: '00000000-0000-0000-0000-000000000002', name: '20ft', type_id: '00000000-0000-0000-0000-000000000001' }
        ],
        mockFormReturn,
        mockRateFetchingReturn,
        mockQuoteRepositoryReturn,
        mockConfig
    };
});

// Helper for test cases (re-defined outside for usage in tests)
const createSafeChain = (name: string, data: any = [], error: any = null) => ({
    select: vi.fn(() => ({
        eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
            maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
            order: vi.fn().mockResolvedValue({ data, error }),
        })),
        order: vi.fn().mockResolvedValue({ data, error }),
    })),
    insert: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Mock logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn((msg, ...args) => console.log('LOGGER INFO:', msg, ...args)),
        error: vi.fn((msg, ...args) => console.error('LOGGER ERROR:', msg, ...args)),
        warn: vi.fn((msg, ...args) => console.warn('LOGGER WARN:', msg, ...args)),
        debug: vi.fn((msg, ...args) => console.log('LOGGER DEBUG:', msg, ...args)),
    },
}));

vi.mock('@/hooks/useCRM', () => ({
    useCRM: () => ({
        scopedDb: mockScopedDb,
        context: { tenantId: 'tenant-123' },
        supabase: {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
            },
            functions: {
                invoke: vi.fn(),
            }
        }
    })
}));

vi.mock('@/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1' },
        profile: { role: 'admin' }
    })
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: vi.fn()
    })
}));

vi.mock('@/hooks/useRateFetching', () => ({
    useRateFetching: () => mockRateFetchingReturn,
    ContainerResolver: {}
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
    useQuoteRepositoryContext: () => mockQuoteRepositoryReturn
}));

vi.mock('@/hooks/useContainerRefs', () => ({
    useContainerRefs: () => ({
        containerTypes: mockContainerTypes,
        containerSizes: mockContainerSizes
    })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
    useAiAdvisor: () => ({
        invokeAiAdvisor: vi.fn()
    })
}));

vi.mock('@/services/quotation/QuotationNumberService', () => ({
    QuotationNumberService: {
        getConfig: vi.fn().mockResolvedValue({}),
        generateNext: vi.fn().mockResolvedValue('Q-1001'),
        isUnique: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('@/services/PortsService', () => {
    return {
        PortsService: class {
            constructor() {}
            searchPorts() { return Promise.resolve([]); }
            getAllPorts() { return Promise.resolve([]); }
        }
    };
});

vi.mock('@/services/pricing.service', () => ({
    PricingService: {
        calculate: vi.fn().mockReturnValue(100)
    }
}));

vi.mock('@/services/QuoteOptionService', () => ({
    QuoteOptionService: {
        saveOption: vi.fn().mockResolvedValue('opt-id')
    }
}));

vi.mock('@/lib/supabase-functions', () => ({
    invokeAnonymous: vi.fn().mockResolvedValue({}),
    enrichPayload: vi.fn(p => p)
}));

vi.mock('lucide-react', () => ({
    Plane: () => <svg />,
    Ship: () => <svg />,
    Truck: () => <svg />,
    Train: () => <svg />,
    Timer: () => <svg />,
    Sparkles: () => <svg />,
    ChevronDown: () => <svg />,
    Save: () => <svg />,
    Settings2: () => <svg />,
    Building2: () => <svg />,
    User: () => <svg />,
    FileText: () => <svg />,
    Loader2: () => <svg />,
    AlertCircle: () => <svg />,
    History: () => <svg />,
    ExternalLink: () => <svg />,
    X: () => <svg />,
}));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>
}));

vi.mock('@/components/ui/separator', () => ({
    Separator: () => <hr />
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
    QuoteStoreProvider: ({ children }: any) => <div data-testid="store-provider">{children}</div>,
    useQuoteStore: () => ({
        state: {
            quoteId: null,
            tenantId: 'tenant-123',
            franchiseId: 'franchise-123',
            quoteData: null,
            items: [],
            cargoConfigurations: [],
            options: []
        },
        dispatch: mockDispatch
    })
}));

vi.mock('@/components/ui/enterprise', () => ({
    EnterpriseFormLayout: ({ children }: any) => <div data-testid="enterprise-layout">{children}</div>
}));

vi.mock('@/components/ui/sheet', () => ({
    Sheet: ({ children }: any) => <div>{children}</div>,
    SheetContent: ({ children }: any) => <div>{children}</div>,
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <div>{children}</div>,
    SheetTrigger: ({ children }: any) => <button>{children}</button>
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => {
    return {
        QuotationConfigurationService: class {
            constructor() {}
            initialize() { return Promise.resolve(); }
            getConfiguration() { 
                return Promise.resolve({ 
                    id: 'config-1',
                    default_module: 'composer',
                    smart_mode_enabled: mockConfig.smart_mode_enabled,
                    multi_option_enabled: true,
                    auto_ranking_criteria: { cost: 0.4, transit_time: 0.3, reliability: 0.3 }
                }); 
            }
            getContainerTypes() { return []; }
            getPackageTypes() { return []; }
            isIncotermCompatible() { return true; }
        }
    };
});

vi.mock('@/services/quotation/QuotationRankingService', () => ({
    QuotationRankingService: {
        rankOptions: vi.fn(opts => opts)
    }
}));

vi.mock('@/services/quotation/QuotationOptionCrudService', () => {
    return {
        QuotationOptionCrudService: class {
            constructor() {}
            saveOption() { return Promise.resolve('opt-id'); }
            deleteOption() { return Promise.resolve({ reselectedOptionId: null }); }
        }
    };
});

vi.mock('@/components/notifications/QuotationSuccessToast', () => ({
    showQuotationSuccessToast: vi.fn()
}));

vi.mock('./FormZone', () => ({
    FormZone: ({ onGetRates }: any) => (
        <div data-testid="form-zone">
            <div data-field-name="origin">
                <input name="origin" data-testid="origin-field" />
            </div>
            <div data-field-name="commodity">
                <input name="commodity" data-testid="commodity-field" />
            </div>
            <button
                data-testid="search-btn"
                onClick={() => onGetRates(
                    { mode: 'ocean', origin: 'Origin', destination: 'Dest', originId: 'origin-uuid', destinationId: 'dest-uuid' },
                    { containerType: '00000000-0000-0000-0000-000000000001', containerSize: '00000000-0000-0000-0000-000000000002', containerQty: '1' },
                    false
                )}
            >
                Search
            </button>
        </div>
    )
}));

vi.mock('./ResultsZone', () => ({
    ResultsZone: ({ onSelect }: any) => (
        <div data-testid="results-zone">
            <button
                data-testid="select-option-btn"
                onClick={() => {
                    console.log('DEBUG: Clicking Select Option');
                    if (onSelect) {
                        onSelect({ 
                            id: 'opt-1', 
                            carrier: 'Carrier A', 
                            price: 1000,
                            legs: [{ id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' }],
                            ai_generated: true // Simulate AI option
                        });
                    } else {
                        console.log('DEBUG: onSelect is undefined');
                    }
                }}
            >
                Select Option
            </button>
        </div>
    )
}));

vi.mock('./FinalizeSection', () => ({
    FinalizeSection: ({ onSaveQuote, onDraftChange }: any) => (
        <div data-testid="finalize-section">
            <button
                data-testid="save-quote-btn"
                onClick={() => onSaveQuote([], 15, 'Test Notes')}
            >
                Save Quote
            </button>
            <button
                data-testid="save-quote-with-charges-btn"
                onClick={() => onSaveQuote([
                    { 
                        category_id: 'cat-1', 
                        basis_id: 'basis-1', 
                        currency_id: 'curr-1', 
                        unit: 'Box', 
                        buy: { rate: 100, quantity: 1, amount: 100 }, 
                        sell: { rate: 120, quantity: 1, amount: 120 }, 
                        legId: 'leg-1' 
                    }
                ], 15, 'Test Notes')}
            >
                Save Quote with Charges
            </button>
            <button
                data-testid="apply-remove-leg-draft-btn"
                onClick={() => {
                    onDraftChange?.({
                        legs: [{ id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' }],
                        charges: [],
                        marginPercent: 15
                    });
                }}
            >
                Apply Remove Leg Draft
            </button>
            <button
                data-testid="apply-add-leg-draft-btn"
                onClick={() => {
                    onDraftChange?.({
                        legs: [
                            { id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' },
                            { id: 'leg-new', mode: 'road', origin: 'Dest', destination: 'Final Inland' }
                        ],
                        charges: [],
                        marginPercent: 18
                    });
                }}
            >
                Apply Add Leg Draft
            </button>
        </div>
    )
}));

vi.mock('@/components/sales/composer/BasisModal', () => ({
    BasisModal: () => <div data-testid="basis-modal">Basis Modal</div>
}));

vi.mock('@/components/sales/composer/ai/AISidebar', () => ({
    AISidebar: () => <div data-testid="ai-sidebar">AI Sidebar</div>
}));

vi.mock('@/components/sales/composer/ErrorDisplay', () => ({
    ErrorDisplay: () => <div data-testid="error-display">Error Display</div>
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children }: any) => <div>{children}</div>,
    CardContent: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children }: any) => <div>{children}</div>,
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children }: any) => <div>{children}</div>,
    TabsContent: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>
}));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: any) => <div>{children}</div>,
    DialogContent: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/command', () => ({
    Command: ({ children }: any) => <div>{children}</div>,
    CommandInput: ({ onValueChange }: any) => <input onChange={(e) => onValueChange && onValueChange(e.target.value)} />,
    CommandEmpty: ({ children }: any) => <div>{children}</div>,
    CommandGroup: ({ children }: any) => <div>{children}</div>,
    CommandItem: ({ children, onSelect }: any) => <div onClick={onSelect}>{children}</div>
}));

vi.mock('@/components/ui/popover', () => ({
    Popover: ({ children }: any) => <div>{children}</div>,
    PopoverContent: ({ children }: any) => <div>{children}</div>,
    PopoverTrigger: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/separator', () => ({
    Separator: () => <hr />
}));

vi.mock('@/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: any) => <div>{children}</div>,
    TooltipContent: ({ children }: any) => <div>{children}</div>,
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
    TooltipTrigger: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@hookform/resolvers/zod', () => ({
    zodResolver: () => async (values: any) => ({
        values,
        errors: {}
    })
}));

vi.mock('react-hook-form', async () => {
    return {
        useForm: () => mockFormReturn,
        FormProvider: ({ children }: any) => <div>{children}</div>,
        useFormContext: () => mockFormReturn,
        Controller: () => null,
    };
});

describe('UnifiedQuoteComposer - Save Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFormReturn.trigger.mockResolvedValue(true);
        mockFormReturn.formState.errors = {};
        mockScopedDb.from.mockImplementation(() => createSafeChain('default', []));
        mockScopedDb.rpc.mockResolvedValue({ data: 'new-quote-id', error: null });
        mockConfig.smart_mode_enabled = false; // Reset to default
    });

    it('mocks QuotationConfigurationService correctly', async () => {
        const { QuotationConfigurationService } = await import('@/services/quotation/QuotationConfigurationService');
        const service = new QuotationConfigurationService(mockScopedDb);
        const config = await service.getConfiguration('tenant-1');
        expect(config).toEqual({
            id: 'config-1',
            default_module: 'composer',
            smart_mode_enabled: false,
            multi_option_enabled: true,
            auto_ranking_criteria: { cost: 0.4, transit_time: 0.3, reliability: 0.3 }
        });
    });

    it('renders without crashing', async () => {
        const initialData = {
            mode: 'ocean',
            origin: 'Origin',
            destination: 'Dest',
            originId: 'origin-uuid',
            destinationId: 'dest-uuid',
            commodity: 'Commodity',
            weight: '1000',
            volume: '10',
            containerType: '00000000-0000-0000-0000-000000000001',
            containerSize: '00000000-0000-0000-0000-000000000002',
            containerQty: '1'
        };
        
        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={initialData} />
            </MemoryRouter>
        );

        const storeProvider = await screen.findByTestId('store-provider');
        expect(storeProvider).toBeInTheDocument();
        
        // Select an option first to show FinalizeSection
        const selectBtn = await screen.findByTestId('select-option-btn');
        fireEvent.click(selectBtn);

        const saveBtn = await screen.findByTestId('save-quote-btn');
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(mockScopedDb.rpc).toHaveBeenCalledWith(
                'save_quote_atomic',
                expect.objectContaining({
                    p_payload: expect.objectContaining({
                        quote: expect.objectContaining({
                            transport_mode: 'ocean',
                            origin: 'Origin',
                            destination: 'Dest',
                            quote_number: 'Q-1001'
                        }),
                        options: expect.arrayContaining([
                            expect.objectContaining({
                                legs: expect.arrayContaining([
                                    expect.objectContaining({
                                        transport_mode: 'ocean'
                                    })
                                ])
                            })
                        ])
                    })
                })
            );
        });
    });

    it('saves a quote generated in Smart Mode', async () => {
        mockConfig.smart_mode_enabled = true; // Enable Smart Mode
        
        // Update mock results to simulate AI generated option
        const originalResults = [...mockRateFetchingReturn.results];
        mockRateFetchingReturn.results = [
            { 
                id: 'opt-1', 
                carrier: 'Carrier A', 
                amount: 1000, 
                transitTime: '20 days',
                service_type: 'port_to_port',
                charge_breakdown: [],
                legs: [{ id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' }],
                ai_generated: true
            }
        ];
        
        const initialData = {
            mode: 'ocean',
            origin: 'Origin',
            destination: 'Dest',
            originId: 'origin-uuid',
            destinationId: 'dest-uuid',
            commodity: 'Commodity',
            weight: '1000',
            volume: '10',
            containerType: '00000000-0000-0000-0000-000000000001',
            containerSize: '00000000-0000-0000-0000-000000000002',
            containerQty: '1'
        };

        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={initialData} />
            </MemoryRouter>
        );

        const storeProvider = await screen.findByTestId('store-provider');
        expect(storeProvider).toBeInTheDocument();
        
        // Select an option first to show FinalizeSection
        // Note: The mocked ResultsZone passes 'ai_generated: true' when clicked
        const selectBtn = await screen.findByTestId('select-option-btn');
        fireEvent.click(selectBtn);

        const saveBtn = await screen.findByTestId('save-quote-btn');
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockScopedDb.rpc).toHaveBeenCalledWith(
                'save_quote_atomic',
                expect.objectContaining({
                    p_payload: expect.objectContaining({
                        quote: expect.objectContaining({
                            transport_mode: 'ocean',
                        }),
                        options: expect.arrayContaining([
                            expect.objectContaining({
                                ai_generated: true
                            })
                        ])
                    })
                })
            );
        });

        // Restore original results
        mockRateFetchingReturn.results = originalResults;
    });

    it('saves a quote with specific charges', async () => {
        const initialData = {
            mode: 'ocean',
            origin: 'Origin',
            destination: 'Dest',
            originId: 'origin-uuid',
            destinationId: 'dest-uuid',
            commodity: 'Commodity',
            weight: '1000',
            volume: '10',
            containerType: '00000000-0000-0000-0000-000000000001',
            containerSize: '00000000-0000-0000-0000-000000000002',
            containerQty: '1'
        };
        
        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={initialData} />
            </MemoryRouter>
        );

        const storeProvider = await screen.findByTestId('store-provider');
        expect(storeProvider).toBeInTheDocument();
        
        // Select an option first to show FinalizeSection
        const selectBtn = await screen.findByTestId('select-option-btn');
        fireEvent.click(selectBtn);

        const saveBtn = await screen.findByTestId('save-quote-with-charges-btn');
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(mockScopedDb.rpc).toHaveBeenCalledWith(
                'save_quote_atomic',
                expect.objectContaining({
                    p_payload: expect.objectContaining({
                        options: expect.arrayContaining([
                            expect.objectContaining({
                                legs: expect.arrayContaining([
                                    expect.objectContaining({
                                        charges: expect.arrayContaining([
                                            expect.objectContaining({
                                                charge_code: 'cat-1',
                                                basis_id: 'basis-1',
                                                currency_id: 'curr-1',
                                                unit: 'Box',
                                                unit_price: 100, // buy rate
                                                quantity: 1,
                                                amount: 100,
                                                side: 'buy'
                                            }),
                                            expect.objectContaining({
                                                charge_code: 'cat-1',
                                                basis_id: 'basis-1',
                                                currency_id: 'curr-1',
                                                unit: 'Box',
                                                unit_price: 120, // sell rate
                                                quantity: 1,
                                                amount: 120,
                                                side: 'sell'
                                            })
                                        ])
                                    })
                                ])
                            })
                        ])
                    })
                })
            );
        });
    });

    it('persists commodity inside quote.cargo_details when saving', async () => {
        const initialData = {
            mode: 'ocean',
            origin: 'Origin',
            destination: 'Dest',
            originId: 'origin-uuid',
            destinationId: 'dest-uuid',
            commodity: 'PARTS OF BABY CARRIAGES - 8715.00.00.40',
            weight: '1250',
            volume: '14.5',
            containerType: '00000000-0000-0000-0000-000000000001',
            containerSize: '00000000-0000-0000-0000-000000000002',
            containerQty: '1',
            htsCode: '8715.00.00.40'
        };

        mockFormReturn.getValues.mockReturnValue({
            ...mockFormReturn.getValues(),
            ...initialData,
            containerCombos: [
              {
                type: '00000000-0000-0000-0000-000000000001',
                size: '00000000-0000-0000-0000-000000000002',
                qty: 1,
              },
            ],
        });

        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={initialData} />
            </MemoryRouter>
        );

        const selectBtn = await screen.findByTestId('select-option-btn');
        fireEvent.click(selectBtn);

        const saveBtn = await screen.findByTestId('save-quote-btn');
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockScopedDb.rpc).toHaveBeenCalledWith(
                'save_quote_atomic',
                expect.objectContaining({
                    p_payload: expect.objectContaining({
                        quote: expect.objectContaining({
                            cargo_details: expect.objectContaining({
                                commodity: 'PARTS OF BABY CARRIAGES - 8715.00.00.40',
                                total_weight_kg: 1250,
                                total_volume_cbm: 14.5,
                                hts_code: '8715.00.00.40',
                            }),
                        }),
                    }),
                })
            );
        });

        const rpcPayload = (mockScopedDb.rpc as any).mock.calls.at(-1)?.[1]?.p_payload;
        expect(rpcPayload?.cargo_configurations?.[0]).toEqual(
          expect.objectContaining({
            container_type_id: '00000000-0000-0000-0000-000000000001',
            container_size_id: '00000000-0000-0000-0000-000000000002',
          })
        );
    });

    it('shows validation summary and blocks save when form has errors', async () => {
        const scrollSpy = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: scrollSpy,
        });

        mockFormReturn.trigger.mockResolvedValue(false);
        mockFormReturn.formState.errors = {
            commodity: { message: 'Commodity is required' },
            origin: { message: 'Origin is required' },
        };

        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={{ mode: 'ocean' }} />
            </MemoryRouter>
        );

        const selectBtn = await screen.findByTestId('select-option-btn');
        fireEvent.click(selectBtn);

        const saveBtn = await screen.findByTestId('save-quote-btn');
        fireEvent.click(saveBtn);

        expect(await screen.findByLabelText(/validation summary/i)).toBeInTheDocument();
        expect(screen.getByText(/Commodity: Commodity is required/i)).toBeInTheDocument();
        expect(screen.getByText(/Origin: Origin is required/i)).toBeInTheDocument();
        expect(mockScopedDb.rpc).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText(/Commodity: Commodity is required/i));
        expect(scrollSpy).toHaveBeenCalled();
    });

    it('sends only remaining legs after a user removes one leg before save', async () => {
        mockRateFetchingReturn.results = [
            {
                id: 'opt-1',
                carrier: 'Carrier A',
                amount: 1000,
                transitTime: '20 days',
                service_type: 'port_to_port',
                charge_breakdown: [],
                legs: [
                    { id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' },
                    { id: 'leg-2', mode: 'road', origin: 'Dest', destination: 'Final' }
                ],
                ai_generated: false
            }
        ];

        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={{ mode: 'ocean', origin: 'Origin', destination: 'Dest' }} />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByTestId('select-option-btn'));
        fireEvent.click(await screen.findByTestId('apply-remove-leg-draft-btn'));
        fireEvent.click(await screen.findByTestId('save-quote-btn'));

        await waitFor(() => expect(mockScopedDb.rpc).toHaveBeenCalled());

        const rpcPayload = (mockScopedDb.rpc as any).mock.calls.at(-1)?.[1]?.p_payload;
        const savedOption = rpcPayload?.options?.find((o: any) => o.id === undefined || o.option_name === 'Carrier A');
        expect(savedOption?.legs).toHaveLength(1);
        expect(savedOption?.legs?.[0]).toEqual(
            expect.objectContaining({
                origin_location_name: 'Origin',
                destination_location_name: 'Dest',
                transport_mode: 'ocean'
            })
        );
    });

    it('persists added draft leg updates in save payload', async () => {
        mockRateFetchingReturn.results = [
            {
                id: 'opt-1',
                carrier: 'Carrier A',
                amount: 1000,
                transitTime: '20 days',
                service_type: 'port_to_port',
                charge_breakdown: [],
                legs: [{ id: 'leg-1', mode: 'ocean', origin: 'Origin', destination: 'Dest' }],
                ai_generated: false
            }
        ];

        render(
            <MemoryRouter>
                <UnifiedQuoteComposer initialData={{ mode: 'ocean', origin: 'Origin', destination: 'Dest' }} />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByTestId('select-option-btn'));
        fireEvent.click(await screen.findByTestId('apply-add-leg-draft-btn'));
        fireEvent.click(await screen.findByTestId('save-quote-btn'));

        await waitFor(() => expect(mockScopedDb.rpc).toHaveBeenCalled());

        const rpcPayload = (mockScopedDb.rpc as any).mock.calls.at(-1)?.[1]?.p_payload;
        const option = rpcPayload?.options?.[0];
        expect(option?.margin_percent).toBe(18);
        expect(option?.legs).toHaveLength(2);
        expect(option?.legs?.[1]).toEqual(
            expect.objectContaining({
                transport_mode: 'road',
                origin_location_name: 'Dest',
                destination_location_name: 'Final Inland'
            })
        );
    });
});

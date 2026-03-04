
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnifiedQuoteComposer } from './UnifiedQuoteComposer';
import { MemoryRouter } from 'react-router-dom';

// Inline mocks to avoid hoisting issues

// Mock logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/hooks/useCRM', () => {
    // Re-create the chain helper inside the mock
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

    const mockScopedDb = {
        from: vi.fn(() => createChain()),
        rpc: vi.fn().mockResolvedValue({ data: 'new-quote-id', error: null }),
    };

    return {
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
    };
});

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
    useRateFetching: () => ({
        loading: false,
        results: [
            { id: 'opt-1', carrier: 'Carrier A', amount: 1000, transitTime: 20 }
        ],
        marketAnalysis: null,
        confidenceScore: 0,
        anomalies: [],
        fetchRates: vi.fn().mockResolvedValue([]),
        clearRates: vi.fn(),
    }),
    ContainerResolver: {}
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
    useQuoteRepositoryContext: () => ({
        chargeCategories: [{ id: 'cat-1', code: 'FRT', name: 'Freight' }],
        chargeBases: [{ id: 'basis-1', code: 'per_container', name: 'Per Container' }],
        currencies: [{ id: 'curr-1', code: 'USD', name: 'US Dollar' }],
        chargeSides: [{ id: 'side-1', code: 'buy', name: 'Buy' }, { id: 'side-2', code: 'sell', name: 'Sell' }]
    })
}));

vi.mock('@/hooks/useContainerRefs', () => ({
    useContainerRefs: () => ({
        containerTypes: [{ id: '00000000-0000-0000-0000-000000000001', name: '20GP Name' }],
        containerSizes: [{ id: '00000000-0000-0000-0000-000000000002', name: 'Standard' }]
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
    QuoteStoreProvider: ({ children }: any) => <div>{children}</div>,
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
        dispatch: vi.fn()
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
            getConfiguration() { return Promise.resolve({ multi_option_enabled: true }); }
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
    ResultsZone: ({ onSelectOption }: any) => (
        <div data-testid="results-zone">
            <button
                data-testid="select-option-btn"
                onClick={() => onSelectOption({ id: 'option-1', total_amount: 100 })}
            >
                Select Option
            </button>
        </div>
    )
}));

vi.mock('./FinalizeSection', () => ({
    FinalizeSection: ({ onSaveQuote }: any) => (
        <div data-testid="finalize-section">
            <button
                data-testid="save-quote-btn"
                onClick={onSaveQuote}
            >
                Save Quote
            </button>
        </div>
    )
}));

vi.mock('@hookform/resolvers/zod', () => ({
    zodResolver: () => async (values: any) => ({
        values,
        errors: {}
    })
}));

vi.mock('react-hook-form', async () => {
    return {
        useForm: () => ({
            handleSubmit: (fn: any) => (e: any) => { e?.preventDefault(); fn(); },
            register: vi.fn(),
            setValue: vi.fn(),
            getValues: vi.fn(),
            watch: vi.fn(),
            formState: { errors: {}, isDirty: false },
            control: { _stub: true },
            reset: vi.fn(),
        }),
        FormProvider: ({ children }: any) => <div>{children}</div>,
        useFormContext: () => ({
            handleSubmit: (fn: any) => (e: any) => { e?.preventDefault(); fn(); },
            register: vi.fn(),
            setValue: vi.fn(),
            getValues: vi.fn(),
            watch: vi.fn(),
            formState: { errors: {}, isDirty: false },
            control: { _stub: true },
            reset: vi.fn(),
        }),
        Controller: () => null,
    };
});

describe('UnifiedQuoteComposer Crash Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        const searchBtn = await screen.findByTestId('search-btn');
        expect(searchBtn).toBeInTheDocument();
    });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Hoisted Mocks
// ---------------------------------------------------------------------------

const { mockScopedDb, mockSupabase, mockToast } = vi.hoisted(() => {
    const mockStorageFrom = vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null })
    }));

    // Helper to create a chainable mock object
    const createChain = (data: any = []) => {
        const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            neq: vi.fn(() => chain),
            gt: vi.fn(() => chain),
            lt: vi.fn(() => chain),
            gte: vi.fn(() => chain),
            lte: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            like: vi.fn(() => chain),
            ilike: vi.fn(() => chain),
            contains: vi.fn(() => chain),
            order: vi.fn(() => chain),
            limit: vi.fn(() => chain),
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockResolvedValue({ data: null, error: null }),
            delete: vi.fn().mockResolvedValue({ data: null, error: null }),
            rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve)
        };
        return chain;
    };

    return {
        mockToast: vi.fn(),
        mockScopedDb: {
            from: vi.fn((...args: any[]) => createChain([])),
            rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        mockSupabase: {
            storage: {
                from: mockStorageFrom
            },
            from: vi.fn((...args: any[]) => createChain([]))
        }
    };
});

// ---------------------------------------------------------------------------
// Component Mocks (Leaf Nodes)
// ---------------------------------------------------------------------------

// Mock LocationAutocomplete to avoid Google Maps dependency
vi.mock('@/components/common/LocationAutocomplete', () => ({
    LocationAutocomplete: ({ value, onChange, placeholder, 'data-testid': testId }: any) => (
        <input 
            data-testid={testId || `location-${placeholder}`}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="mock-location-input"
        />
    )
}));

// Mock SharedCargoInput to simplify cargo entry
vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
    SharedCargoInput: ({ value, onChange }: any) => (
        <div data-testid="shared-cargo-input">
            <input 
                data-testid="commodity-input"
                value={value?.commodity?.description || ''}
                onChange={e => onChange({ 
                    ...value, 
                    commodity: { ...value?.commodity, description: e.target.value } 
                })}
                placeholder="Commodity"
            />
            <input 
                data-testid="cargo-weight"
                value={value?.weight?.value || ''}
                onChange={e => onChange({ 
                    ...value, 
                    weight: { ...value?.weight, value: Number(e.target.value) } 
                })}
                placeholder="Weight"
            />
            <input 
                data-testid="cargo-volume"
                value={value?.volume || ''}
                onChange={e => onChange({ ...value, volume: Number(e.target.value) })}
                placeholder="Volume"
            />
        </div>
    )
}));

// Mock CommoditySelection
vi.mock('@/components/logistics/SmartCargoInput', () => ({
    CommoditySelection: ({ value, onChange }: any) => (
        <input 
            data-testid="commodity-input"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Commodity"
        />
    )
}));

// Mock FileUpload
vi.mock('@/components/ui/file-upload', () => ({
    FileUpload: ({ onChange }: any) => (
        <div data-testid="file-upload">
            <button onClick={() => onChange([{ name: 'new-file.pdf', size: 1024 }])}>
                Upload File
            </button>
        </div>
    )
}));

// Mock Results components
vi.mock('@/components/sales/shared/QuoteResultsList', () => ({
    QuoteResultsList: ({ results }: any) => (
        <div data-testid="quote-results-list">
            {results?.map((r: any) => (
                <div key={r.id} data-testid={`result-item-${r.id}`}>
                    {r.carrier} - {r.price}
                </div>
            ))}
        </div>
    )
}));

vi.mock('@/components/sales/shared/QuoteComparisonView', () => ({
    QuoteComparisonView: () => <div data-testid="quote-comparison-view">Comparison View</div>
}));

vi.mock('@/components/sales/shared/AiMarketAnalysis', () => ({
    AiMarketAnalysis: () => <div data-testid="ai-market-analysis">AI Analysis</div>
}));


// Mock FormZone to isolate data flow and prevent deep rendering issues
vi.mock('../FormZone', () => ({
   FormZone: ({ initialValues, initialExtended, onChange }: any) => {
       return (
           <div data-testid="form-zone">
               <input 
                   data-testid="commodity-input" 
                   defaultValue={initialValues?.commodity || ''}
                   onChange={(e) => {
                        const newValues = { ...initialValues, commodity: 'Updated Electronics' };
                        onChange?.(newValues);
                    }}
               />
               <input 
                   data-testid="location-Origin" 
                   defaultValue={initialValues?.origin || ''} 
               />
               <input 
                   data-testid="location-Destination" 
                   defaultValue={initialValues?.destination || ''} 
               />
               <input 
                   data-testid="cargo-weight" 
                   defaultValue={initialValues?.weight || ''} 
               />
               <input 
                   data-testid="cargo-volume" 
                   defaultValue={initialValues?.volume || ''} 
               />
           </div>
       );
   }
}));


vi.mock('../FinalizeSection', () => ({
    FinalizeSection: ({ onSaveQuote }: any) => (
        <div data-testid="finalize-section">
            <button 
                data-testid="save-quote-button" 
                onClick={() => onSaveQuote([], 15, '')}
            >
                Save Quote
            </button>
        </div>
    )
}));

// ---------------------------------------------------------------------------
// Service & Hook Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/hooks/useCRM', () => {
    // Return stable object reference to prevent infinite re-renders
    const crmContext = {
        scopedDb: mockScopedDb,
        context: { tenantId: 'test-tenant' },
        supabase: mockSupabase,
    };
    return {
        useCRM: () => crmContext,
    };
});

vi.mock('@/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user', email: 'test@example.com' },
        profile: { id: 'test-profile' },
    }),
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useRateFetching', () => {
    const stableResult = {
        results: [],
        loading: false,
        fetchRates: vi.fn(),
        clearResults: vi.fn(),
    };
    return {
        useRateFetching: () => stableResult,
        ContainerResolver: {},
    };
});

vi.mock('@/hooks/useContainerRefs', () => {
    const stableRefs = { 
        containerTypes: [{ id: 'ct-1', code: '20GP', name: '20ft General' }], 
        containerSizes: [{ id: 'cs-1', name: '20ft', iso_code: '22G1' }] 
    };
    return {
        useContainerRefs: () => stableRefs,
    };
});

vi.mock('@/hooks/useAiAdvisor', () => ({
    useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() }),
}));

vi.mock('@/hooks/useIncoterms', () => ({
    useIncoterms: () => ({ 
        incoterms: [{ code: 'FOB', name: 'Free on Board' }, { code: 'CIF', name: 'Cost, Insurance and Freight' }] 
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

vi.mock('@/services/quotation/QuotationRankingService', () => ({
    QuotationRankingService: {
        rankOptions: vi.fn().mockImplementation((options) => options),
    }
}));

vi.mock('@/services/quotation/QuotationOptionCrudService', () => {
    const MockService = vi.fn();
    MockService.prototype.deleteOption = vi.fn().mockResolvedValue({ reselectedOptionId: null });
    return { QuotationOptionCrudService: MockService };
});

vi.mock('@/services/pricing.service', () => ({
    PricingService: {
        calculateTotal: vi.fn().mockReturnValue(100),
    }
}));

vi.mock('@/services/QuoteOptionService', () => ({
    QuoteOptionService: {
        getOptions: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock('@/services/quotation/QuotationNumberService', () => {
    const MockService: any = vi.fn();
    MockService.prototype.generateNextQuoteNumber = vi.fn().mockResolvedValue('Q-1002');
    MockService.isUnique = vi.fn().mockResolvedValue(true);
    return { QuotationNumberService: MockService };
});

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
    useQuoteRepositoryContext: () => ({
        serviceTypes: [],
        services: [],
        carriers: [],
        ports: [],
        shippingTerms: [],
        currencies: [],
        chargeCategories: [],
        chargeSides: [],
        chargeBases: [],
        serviceModes: [],
        tradeDirections: [],
        serviceLegCategories: [],
        containerTypes: [],
        containerSizes: [],
        accounts: [],
        contacts: [],
        opportunities: [],
        isLoadingOpportunities: false,
        isLoadingServices: false,
        resolvedTenantId: 'test-tenant',
        setResolvedTenantId: vi.fn(),
        setAccounts: vi.fn(),
        setContacts: vi.fn(),
        setOpportunities: vi.fn(),
        setServices: vi.fn(),
    }),
}));

// Helper for chaining mock DB calls
const createMockChain = (data: any) => {
    const chain: any = {
        then: (resolve: any, reject: any) => {
            return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
    };
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.rpc = vi.fn(() => chain);
    return chain;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedQuoteComposer Integration (API-to-UI)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock setup for CRM data loading
        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'accounts') return createMockChain([{ id: 'acc-1', name: 'Test Account' }]);
            if (table === 'contacts') return createMockChain([{ id: 'con-1', first_name: 'John', last_name: 'Doe' }]);
            if (table === 'opportunities') return createMockChain([{ id: 'opp-1', name: 'Test Opp' }]);
            return createMockChain([]);
        });
    });

    it('populates FormZone inputs correctly from loaded quote data', async () => {
        const QUOTE_ID = 'test-quote-id';
        
        // Mock quote data
        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-1001',
                    status: 'draft',
                    tenant_id: 'test-tenant',
                    origin: 'New York',
                    destination: 'London',
                    current_version_id: 'v1',
                    cargo_details: {
                        commodity: 'Electronics',
                        total_weight_kg: 500,
                        total_volume_cbm: 5,
                        hts_code: '8500.00'
                    }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: 'v1', version_number: 1 }]);
            } else if (table === 'quote_documents') {
                return createMockChain([]);
            } else if (table === 'quote_cargo_configurations') {
                return createMockChain([]);
            } else if (table === 'accounts' || table === 'contacts' || table === 'opportunities') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[`/quotes/edit/${QUOTE_ID}`]}>
                    <Routes>
                        <Route path="/quotes/edit/:quoteId" element={<UnifiedQuoteComposer quoteId={QUOTE_ID} />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Verify inputs are populated
        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Electronics');
        }, { timeout: 3000 });
        
        expect(screen.getByTestId('location-Origin')).toHaveValue('New York');
        expect(screen.getByTestId('location-Destination')).toHaveValue('London');
        expect(screen.getByTestId('cargo-weight')).toHaveValue('500');
        expect(screen.getByTestId('cargo-volume')).toHaveValue('5');
    });

    it('updates composer state and persists changes when FormZone inputs change', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174000';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174001';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174002';
        const user = userEvent.setup();

        // Mock initial load
        mockScopedDb.from.mockImplementation((table: string) => {
            console.log(`[Test Mock DB] Querying table: ${table}`);
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-1001',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    cargo_details: { commodity: 'Initial', total_weight_kg: 100 }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quotation_version_options') {
                return createMockChain([{ 
                    id: OPTION_ID, 
                    quotation_version_id: VERSION_ID, 
                    is_selected: true,
                    option_name: 'Test Option',
                    total_amount: 1000,
                    currency: 'USD'
                }]);
            } else if (table === 'quotation_version_option_legs') {
                return createMockChain([]);
            } else if (table === 'quote_charges') {
                return createMockChain([]);
            } else if (table === 'quote_items') {
                return createMockChain([]);
            } else if (table === 'quote_documents') {
                return createMockChain([]);
            } else if (table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            // ... other tables empty
            return createMockChain([]);
        });

        // Mock save RPC
        mockScopedDb.rpc.mockResolvedValue({ data: QUOTE_ID, error: null });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[`/quotes/edit/${QUOTE_ID}`]}>
                    <Routes>
                        <Route path="/quotes/edit/:quoteId" element={<UnifiedQuoteComposer quoteId={QUOTE_ID} />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Wait for load
        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Initial');
        });

        // Change commodity
        const commodityInput = screen.getByTestId('commodity-input');
        await fireEvent.change(commodityInput, { target: { value: 'Updated Electronics' } });

        // Trigger Save (FinalizeSection is part of UnifiedQuoteComposer, assuming it's rendered)
        // Note: UnifiedQuoteComposer renders FinalizeSection at the bottom.
        // I need to make sure FinalizeSection is reachable. 
        // In the real component, FinalizeSection has a Save button.
        // Let's verify if FinalizeSection is rendered.
        
        // Find save button (FinalizeSection renders a Button with "Save Quote")
        const saveButton = screen.getByTestId('save-quote-button');
        await user.click(saveButton);

        // Verify RPC call has updated values
        await waitFor(() => {
             if (mockScopedDb.rpc.mock.calls.length === 0) {
                 throw new Error('RPC not called yet');
             }
        });

        console.log('RPC Calls:', JSON.stringify(mockScopedDb.rpc.mock.calls, null, 2));

        expect(mockScopedDb.rpc).toHaveBeenCalledWith(
            'save_quote_atomic',
            expect.objectContaining({
                p_payload: expect.objectContaining({
                    quote: expect.objectContaining({
                        cargo_details: expect.objectContaining({
                            commodity: 'Updated Electronics'
                        })
                    })
                })
            })
        );
    });
});

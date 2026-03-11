
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Hoisted Mocks
// ---------------------------------------------------------------------------

const { mockScopedDb, mockSupabase, mockToast, mockShowSuccess } = vi.hoisted(() => {
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
            or: vi.fn(() => chain),
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
        mockShowSuccess: vi.fn(),
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


vi.mock('../FormZone', async () => {
   // Use the mocked version of react-hook-form
   const { useFormContext } = await import('react-hook-form');

   return {
       FormZone: ({ onChange }: any) => {
           const { watch, setValue, getValues } = useFormContext<any>();

           const commodity = watch('commodity');
           const origin = watch('origin');
           const destination = watch('destination');
           const weight = watch('weight');
           const volume = watch('volume');

           const sync = () => {
               onChange?.(getValues());
           };

           return (
               <div data-testid="form-zone">
                   <input
                       data-testid="commodity-input"
                       value={commodity || ''}
                       onChange={(e) => {
                           setValue('commodity', e.target.value);
                           sync();
                       }}
                   />
                   <input
                       data-testid="location-Origin"
                       value={origin || ''}
                       onChange={(e) => {
                           setValue('origin', e.target.value);
                           sync();
                       }}
                   />
                   <input
                       data-testid="location-Destination"
                       value={destination || ''}
                       onChange={(e) => {
                           setValue('destination', e.target.value);
                           sync();
                       }}
                   />
                   <input
                       data-testid="cargo-weight"
                       value={weight || ''}
                       onChange={(e) => {
                           setValue('weight', e.target.value);
                           sync();
                       }}
                   />
                   <input
                       data-testid="cargo-volume"
                       value={volume || ''}
                       onChange={(e) => {
                           setValue('volume', e.target.value);
                           sync();
                       }}
                   />
                   <button
                       type="button"
                       data-testid="set-cargo-advanced"
                       onClick={() => {
                           setValue('originId', '00000000-0000-0000-0000-000000000111');
                           setValue('destinationId', '00000000-0000-0000-0000-000000000222');
                           setValue('accountId', 'acc-1');
                           setValue('commodity', 'Lithium Batteries');
                           setValue('weight', '555');
                           setValue('volume', '22.7');
                           setValue('dangerousGoods', true);
                           setValue('htsCode', '8507.60');
                           setValue('containerType', 'ct-1');
                           setValue('containerSize', 'cs-1');
                           setValue('containerQty', '2');
                           setValue('containerCombos', [{ type: 'ct-1', size: 'cs-1', qty: 2 }]);
                           setValue('cargoItem', {
                               id: 'main',
                               type: 'container',
                               quantity: 2,
                               dimensions: { l: 120, w: 80, h: 140, unit: 'cm' },
                               weight: { value: 555, unit: 'kg' },
                               volume: 22.7,
                               stackable: true,
                               commodity: { description: 'Lithium Batteries', hts_code: '8507.60' },
                               hazmat: { class: '9', unNumber: '3480', packingGroup: 'II' },
                               containerCombos: [{ typeId: 'ct-1', sizeId: 'cs-1', quantity: 2 }],
                               containerDetails: { typeId: 'ct-1', sizeId: 'cs-1' },
                           });
                           sync();
                       }}
                   >
                       Set Cargo Advanced
                   </button>
                   <button
                       type="button"
                       data-testid="set-cargo-edited"
                       onClick={() => {
                           setValue('originId', '00000000-0000-0000-0000-000000000111');
                           setValue('destinationId', '00000000-0000-0000-0000-000000000222');
                           setValue('accountId', 'acc-1');
                           setValue('commodity', 'Consumer Electronics');
                           setValue('weight', '600');
                           setValue('volume', '24.2');
                           setValue('dangerousGoods', false);
                           setValue('htsCode', '8517.12');
                           setValue('containerType', 'ct-1');
                           setValue('containerSize', 'cs-1');
                           setValue('containerQty', '3');
                           setValue('containerCombos', [{ type: 'ct-1', size: 'cs-1', qty: 3 }]);
                           setValue('cargoItem', {
                               id: 'main',
                               type: 'container',
                               quantity: 3,
                               dimensions: { l: 130, w: 90, h: 150, unit: 'cm' },
                               weight: { value: 600, unit: 'kg' },
                               volume: 24.2,
                               stackable: false,
                               commodity: { description: 'Consumer Electronics', hts_code: '8517.12' },
                               containerCombos: [{ typeId: 'ct-1', sizeId: 'cs-1', quantity: 3 }],
                               containerDetails: { typeId: 'ct-1', sizeId: 'cs-1' },
                           });
                           sync();
                       }}
                   >
                       Set Cargo Edited
                   </button>
                   <button
                       type="button"
                       data-testid="set-multi-container-combos"
                       onClick={() => {
                           setValue('originId', '00000000-0000-0000-0000-000000000111');
                           setValue('destinationId', '00000000-0000-0000-0000-000000000222');
                           setValue('accountId', 'acc-1');
                           setValue('commodity', 'Machinery');
                           setValue('weight', '900');
                           setValue('volume', '40');
                           setValue('containerType', 'ct-1');
                           setValue('containerSize', 'cs-1');
                           setValue('containerQty', '4');
                           setValue('containerCombos', [
                               { type: 'ct-1', size: 'cs-1', qty: 2 },
                               { type: 'ct-1', size: 'cs-1', qty: 2 },
                           ]);
                           setValue('cargoItem', {
                               id: 'main',
                               type: 'container',
                               quantity: 4,
                               dimensions: { l: 100, w: 100, h: 100, unit: 'cm' },
                               weight: { value: 900, unit: 'kg' },
                               volume: 40,
                               stackable: true,
                               commodity: { description: 'Machinery', hts_code: '8408.90' },
                               containerCombos: [
                                   { typeId: 'ct-1', sizeId: 'cs-1', quantity: 2 },
                                   { typeId: 'ct-1', sizeId: 'cs-1', quantity: 2 },
                               ],
                           });
                           sync();
                       }}
                   >
                       Set Multi Containers
                   </button>
               </div>
           );
       }
   };
});


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

vi.mock('@/components/notifications/QuotationSuccessToast', () => ({
    showQuotationSuccessToast: mockShowSuccess
}));

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
    chain.or = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
    chain.gt = vi.fn(() => chain);
    chain.lt = vi.fn(() => chain);
    chain.gte = vi.fn(() => chain);
    chain.lte = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.like = vi.fn(() => chain);
    chain.ilike = vi.fn(() => chain);
    chain.contains = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.rpc = vi.fn(() => chain);
    return chain;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedQuoteComposer Integration (API-to-UI)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })) as any);

        // Default mock setup for CRM data loading
        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'accounts') return createMockChain([{ id: 'acc-1', name: 'Test Account' }]);
            if (table === 'contacts') return createMockChain([{ id: 'con-1', first_name: 'John', last_name: 'Doe' }]);
            if (table === 'opportunities') return createMockChain([{ id: 'opp-1', name: 'Test Opp' }]);
            return createMockChain([]);
        });
    });

    const goToResultsTab = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('tab', { name: /Results & Finalize/i }));
        await waitFor(() => {
            expect(screen.getByTestId('save-quote-button')).toBeInTheDocument();
        });
    };

    it('populates FormZone inputs correctly from loaded quote data', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174000';
        
        // Mock quote data
        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'QUO-260309-00001',
                    title: 'Integration Test Quote',
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
        
        // Align supabase mock with the same data to satisfy loaders that use supabase
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'QUO-260309-00001',
                    title: 'Integration Test Quote',
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

    it('normalizes object commodity payload on reload', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174100';

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-2001',
                    status: 'draft',
                    tenant_id: 'test-tenant',
                    origin: 'Mumbai',
                    destination: 'Hamburg',
                    current_version_id: 'v1',
                    cargo_details: {
                        commodity: { description: 'Pharma API', hts_code: '3003.90' },
                        total_weight_kg: 250,
                        total_volume_cbm: 3.5,
                        hts_code: '3003.90'
                    }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: 'v1', version_number: 1 }]);
            } else if (table === 'quote_documents' || table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-2001',
                    status: 'draft',
                    tenant_id: 'test-tenant',
                    origin: 'Mumbai',
                    destination: 'Hamburg',
                    current_version_id: 'v1',
                    cargo_details: {
                        commodity: { description: 'Pharma API', hts_code: '3003.90' },
                        total_weight_kg: 250,
                        total_volume_cbm: 3.5,
                        hts_code: '3003.90'
                    }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: 'v1', version_number: 1 }]);
            } else if (table === 'quote_documents' || table === 'quote_cargo_configurations') {
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

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Pharma API');
        }, { timeout: 3000 });
    });

    it('prefers draft cargo_details over stale quote_items during reload', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174120';
        const VERSION_ID = 'v1';

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'QUO-260309-00001',
                    status: 'draft',
                    tenant_id: 'test-tenant',
                    origin: 'Miami',
                    destination: 'Santos',
                    current_version_id: VERSION_ID,
                    cargo_details: {
                        commodity: 'Updated Draft Commodity',
                        total_weight_kg: 640,
                        total_volume_cbm: 28.4,
                        hts_code: '8507.60',
                        quantity: 4,
                        cargo_type: 'unit',
                    }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quote_items') {
                return createMockChain([
                    { product_name: 'Stale Item Commodity', weight_kg: 100, volume_cbm: 10 }
                ]);
            } else if (table === 'quote_documents' || table === 'quote_cargo_configurations' || table === 'quotation_version_options' || table === 'quotation_version_option_legs' || table === 'quote_charges') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'QUO-260309-00001',
                    status: 'draft',
                    tenant_id: 'test-tenant',
                    origin: 'Miami',
                    destination: 'Santos',
                    current_version_id: VERSION_ID,
                    cargo_details: {
                        commodity: 'Updated Draft Commodity',
                        total_weight_kg: 640,
                        total_volume_cbm: 28.4,
                        hts_code: '8507.60',
                        quantity: 4,
                        cargo_type: 'unit',
                    }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quote_items') {
                return createMockChain([
                    { product_name: 'Stale Item Commodity', weight_kg: 100, volume_cbm: 10 }
                ]);
            } else if (table === 'quote_documents' || table === 'quote_cargo_configurations') {
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

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Updated Draft Commodity');
        }, { timeout: 3000 });

        expect(screen.getByTestId('cargo-weight')).toHaveValue('640');
        expect(screen.getByTestId('cargo-volume')).toHaveValue('28.4');
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
                    quote_number: 'QUO-260309-00001',
                    title: 'Integration Test Quote',
                    transport_mode: 'air',
                    origin: 'New York',
                    destination: 'London',
                    origin_port_id: '00000000-0000-0000-0000-000000000111',
                    destination_port_id: '00000000-0000-0000-0000-000000000222',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
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
            expect(screen.getByTestId('set-cargo-edited')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('set-cargo-edited'));

        // Change commodity
        const commodityInput = screen.getByTestId('commodity-input');
        await fireEvent.change(commodityInput, { target: { value: 'Updated Electronics' } });

        // Trigger Save (FinalizeSection is part of UnifiedQuoteComposer, assuming it's rendered)
        // Note: UnifiedQuoteComposer renders FinalizeSection at the bottom.
        // I need to make sure FinalizeSection is reachable. 
        // In the real component, FinalizeSection has a Save button.
        // Let's verify if FinalizeSection is rendered.
        
        // Find save button (FinalizeSection renders a Button with "Save Quote")
        await goToResultsTab(user);
        await user.click(screen.getByRole('button', { name: /Draft/i }));

        // Verify save call
        await waitFor(() => {
            const saveCall = mockScopedDb.rpc.mock.calls.find((call: any[]) => call[0] === 'save_quote_atomic');
            expect(saveCall).toBeTruthy();
            const payload = saveCall[1]?.p_payload;
            expect(payload).toEqual(
                expect.objectContaining({
                    quote: expect.objectContaining({
                        id: QUOTE_ID,
                        status: 'draft',
                        origin: 'New York',
                        destination: 'London',
                        transport_mode: 'air',
                        cargo_details: expect.objectContaining({
                            commodity: 'Updated Electronics',
                            total_weight_kg: 600,
                            total_volume_cbm: 24.2
                        })
                    }),
                    cargo_configurations: expect.any(Array)
                })
            );
        });
    });

    it('does not crash when save is attempted with invalid form values', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174000';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174001';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174002';
        const user = userEvent.setup();

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'QUO-260309-00001',
                    title: 'Integration Test Quote',
                    transport_mode: 'air',
                    origin: 'New York',
                    destination: 'London',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
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
            return createMockChain([]);
        });

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

        await waitFor(() => {
            expect(screen.getByTestId('set-cargo-edited')).toBeInTheDocument();
        });

        mockToast.mockClear();
        mockScopedDb.rpc.mockClear();

        const commodityInput = screen.getByTestId('commodity-input');
        await fireEvent.change(commodityInput, { target: { value: 'a' } });

        await goToResultsTab(user);
        const saveButton = screen.getByTestId('save-quote-button');
        await user.click(saveButton);

        expect(mockScopedDb.rpc).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Validation Error' }));
    });

    it('persists cargo snapshot across save -> reopen -> edit -> resave', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174200';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174201';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174202';
        const user = userEvent.setup();
        let storedCargoDetails: any = {
            commodity: 'Initial Commodity',
            total_weight_kg: 100,
            total_volume_cbm: 10,
            hts_code: '1111.11',
            dangerous_goods: false,
        };

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-3001',
                    transport_mode: 'ocean',
                    origin: 'Shanghai',
                    destination: 'Los Angeles',
                    origin_port_id: '00000000-0000-0000-0000-000000000333',
                    destination_port_id: '00000000-0000-0000-0000-000000000444',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
                    cargo_details: storedCargoDetails,
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quotation_version_options') {
                return createMockChain([{
                    id: OPTION_ID,
                    quotation_version_id: VERSION_ID,
                    is_selected: true,
                    option_name: 'Test Ocean Option',
                    total_amount: 1500,
                    currency: 'USD'
                }]);
            } else if (table === 'quotation_version_option_legs' || table === 'quote_charges' || table === 'quote_items' || table === 'quote_documents' || table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });

        mockScopedDb.rpc.mockImplementation(async (fn: string, payload: any) => {
            if (fn === 'save_quote_atomic') {
                storedCargoDetails = payload?.p_payload?.quote?.cargo_details || storedCargoDetails;
                return { data: QUOTE_ID, error: null };
            }
            return { data: null, error: null };
        });

        const firstClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { unmount } = render(
            <QueryClientProvider client={firstClient}>
                <MemoryRouter initialEntries={[`/quotes/edit/${QUOTE_ID}`]}>
                    <Routes>
                        <Route path="/quotes/edit/:quoteId" element={<UnifiedQuoteComposer quoteId={QUOTE_ID} />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Initial Commodity');
        });

        await user.click(screen.getByTestId('set-cargo-advanced'));
        await goToResultsTab(user);
        await user.click(screen.getByRole('button', { name: /Draft/i }));

        await waitFor(() => {
            const saveCalls = mockScopedDb.rpc.mock.calls.filter((c: any[]) => c[0] === 'save_quote_atomic');
            expect(saveCalls.length).toBeGreaterThan(0);
            const payload = saveCalls[saveCalls.length - 1][1]?.p_payload;
            expect(payload?.quote?.cargo_details).toEqual(
                expect.objectContaining({
                    commodity: 'Lithium Batteries',
                    dangerous_goods: true,
                    stackable: true,
                    dimensions: expect.objectContaining({ l: 120, w: 80, h: 140, unit: 'cm' }),
                    hazmat_details: expect.objectContaining({ class: '9', unNumber: '3480' }),
                })
            );
        });

        unmount();

        const secondClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={secondClient}>
                <MemoryRouter initialEntries={[`/quotes/edit/${QUOTE_ID}`]}>
                    <Routes>
                        <Route path="/quotes/edit/:quoteId" element={<UnifiedQuoteComposer quoteId={QUOTE_ID} />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Lithium Batteries');
        });

        await user.click(screen.getByTestId('set-cargo-edited'));
        await goToResultsTab(user);
        await user.click(screen.getByRole('button', { name: /Draft/i }));

        await waitFor(() => {
            const calls = mockScopedDb.rpc.mock.calls.filter((c: any[]) => c[0] === 'save_quote_atomic');
            const lastPayload = calls[calls.length - 1][1];
            expect(lastPayload.p_payload.quote.cargo_details).toEqual(
                expect.objectContaining({
                    commodity: 'Consumer Electronics',
                    dangerous_goods: false,
                    stackable: false,
                    dimensions: expect.objectContaining({ l: 130, w: 90, h: 150, unit: 'cm' }),
                })
            );
            expect(lastPayload.p_payload.quote.cargo_details.hazmat_details).toBeNull();
        });
    });

    it('saves all container combo rows with quantities', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174300';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174301';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174302';
        const user = userEvent.setup();

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-4001',
                    transport_mode: 'ocean',
                    origin: 'Dubai',
                    destination: 'Rotterdam',
                    origin_port_id: '00000000-0000-0000-0000-000000000333',
                    destination_port_id: '00000000-0000-0000-0000-000000000444',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
                    cargo_details: { commodity: 'Initial', total_weight_kg: 100, total_volume_cbm: 10 }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quotation_version_options') {
                return createMockChain([{
                    id: OPTION_ID,
                    quotation_version_id: VERSION_ID,
                    is_selected: true,
                    option_name: 'Test Option',
                    total_amount: 2000,
                    currency: 'USD'
                }]);
            } else if (table === 'quotation_version_option_legs' || table === 'quote_charges' || table === 'quote_items' || table === 'quote_documents' || table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });
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

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Initial');
        });

        await user.click(screen.getByTestId('set-multi-container-combos'));
        await goToResultsTab(user);
        await user.click(screen.getByRole('button', { name: /Draft/i }));

        await waitFor(() => {
            const saveCalls = mockScopedDb.rpc.mock.calls.filter((c: any[]) => c[0] === 'save_quote_atomic');
            expect(saveCalls.length).toBeGreaterThan(0);
            const payload = saveCalls[saveCalls.length - 1][1]?.p_payload;
            expect(payload?.cargo_configurations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ quantity: 2 }),
                    expect.objectContaining({ quantity: 2 }),
                ])
            );
        });
    });

    it('uses latest form cargoItem values for draft save payload', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174350';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174351';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174352';
        const user = userEvent.setup();

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'QUO-260309-00001',
                    transport_mode: 'ocean',
                    origin: 'Miami',
                    destination: 'Santos',
                    origin_port_id: '00000000-0000-0000-0000-000000000333',
                    destination_port_id: '00000000-0000-0000-0000-000000000444',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
                    cargo_details: {
                        commodity: 'Initial Commodity',
                        total_weight_kg: 100,
                        total_volume_cbm: 10,
                        commodity_details: { description: 'Initial Commodity', hts_code: '1111.11' },
                    },
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quotation_version_options') {
                return createMockChain([{
                    id: OPTION_ID,
                    quotation_version_id: VERSION_ID,
                    is_selected: true,
                    option_name: 'Test Option',
                    total_amount: 2000,
                    currency: 'USD',
                }]);
            } else if (table === 'quotation_version_option_legs' || table === 'quote_charges' || table === 'quote_items' || table === 'quote_documents' || table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });

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

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Initial Commodity');
        });

        await user.click(screen.getByTestId('set-cargo-edited'));
        await user.click(screen.getByRole('tab', { name: /Results & Finalize/i }));
        await user.click(screen.getByRole('button', { name: /^Draft$/i }));

        await waitFor(() => {
            const saveCalls = mockScopedDb.rpc.mock.calls.filter((c: any[]) => c[0] === 'save_quote_atomic');
            expect(saveCalls.length).toBeGreaterThan(0);
            const lastPayload = saveCalls[saveCalls.length - 1][1]?.p_payload;
            expect(lastPayload?.quote?.cargo_details).toEqual(
                expect.objectContaining({
                    commodity: 'Consumer Electronics',
                    total_weight_kg: 600,
                    total_volume_cbm: 24.2,
                    dangerous_goods: false,
                    hts_code: '8517.12',
                    stackable: false,
                    dimensions: expect.objectContaining({ l: 130, w: 90, h: 150, unit: 'cm' }),
                    commodity_details: expect.objectContaining({ description: 'Consumer Electronics', hts_code: '8517.12' }),
                })
            );
            expect(lastPayload?.quote?.cargo_details?.hazmat_details).toBeNull();
            expect(lastPayload?.cargo_configurations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ quantity: 3 }),
                ])
            );
        });
    });

    it('persists ocean-mode volume and weight from cargo item snapshot', async () => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174500';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174501';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174502';
        const user = userEvent.setup();

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-6001',
                    transport_mode: 'ocean',
                    origin: 'Chennai',
                    destination: 'Antwerp',
                    origin_port_id: '00000000-0000-0000-0000-000000000333',
                    destination_port_id: '00000000-0000-0000-0000-000000000444',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
                    cargo_details: { commodity: 'Initial', total_weight_kg: 100, total_volume_cbm: 10 }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quotation_version_options') {
                return createMockChain([{
                    id: OPTION_ID,
                    quotation_version_id: VERSION_ID,
                    is_selected: true,
                    option_name: 'Ocean Option',
                    total_amount: 1900,
                    currency: 'USD'
                }]);
            } else if (table === 'quotation_version_option_legs' || table === 'quote_charges' || table === 'quote_items' || table === 'quote_documents' || table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });
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

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Initial');
        });

        await user.click(screen.getByTestId('set-cargo-advanced'));
        await goToResultsTab(user);
        await user.click(screen.getByRole('button', { name: /Draft/i }));

        await waitFor(() => {
            const saveCalls = mockScopedDb.rpc.mock.calls.filter((c: any[]) => c[0] === 'save_quote_atomic');
            expect(saveCalls.length).toBeGreaterThan(0);
            const payload = saveCalls[saveCalls.length - 1][1]?.p_payload;
            expect(payload).toEqual(
                expect.objectContaining({
                    quote: expect.objectContaining({
                        cargo_details: expect.objectContaining({
                            total_weight_kg: 555,
                            total_volume_cbm: 22.7,
                        }),
                    }),
                })
            );
        });
    });

    it.each([
        'column "name" does not exist',
        'column "iso_code" does not exist',
    ])('retries save without cargo_configurations when DB returns legacy schema error: %s', async (legacyColumnError) => {
        const QUOTE_ID = '123e4567-e89b-12d3-a456-426614174400';
        const VERSION_ID = '123e4567-e89b-12d3-a456-426614174401';
        const OPTION_ID = '123e4567-e89b-12d3-a456-426614174402';
        const user = userEvent.setup();

        mockScopedDb.from.mockImplementation((table: string) => {
            if (table === 'quotes') {
                return createMockChain({
                    id: QUOTE_ID,
                    quote_number: 'Q-5001',
                    title: 'Legacy Schema Retry Quote',
                    transport_mode: 'ocean',
                    origin: 'Singapore',
                    destination: 'Jebel Ali',
                    origin_port_id: '00000000-0000-0000-0000-000000000333',
                    destination_port_id: '00000000-0000-0000-0000-000000000444',
                    current_version_id: VERSION_ID,
                    tenant_id: 'test-tenant',
                    account_id: 'acc-1',
                    cargo_details: { commodity: 'Initial', total_weight_kg: 100, total_volume_cbm: 10 }
                });
            } else if (table === 'quotation_versions') {
                return createMockChain([{ id: VERSION_ID, version_number: 1 }]);
            } else if (table === 'quotation_version_options') {
                return createMockChain([{
                    id: OPTION_ID,
                    quotation_version_id: VERSION_ID,
                    is_selected: true,
                    option_name: 'Test Option',
                    total_amount: 1200,
                    currency: 'USD'
                }]);
            } else if (table === 'quotation_version_option_legs' || table === 'quote_charges' || table === 'quote_items' || table === 'quote_documents' || table === 'quote_cargo_configurations') {
                return createMockChain([]);
            }
            return createMockChain([]);
        });

        let saveQuoteAtomicAttempts = 0;
        mockScopedDb.rpc.mockImplementation(async (fn: string) => {
            if (fn !== 'save_quote_atomic') {
                return { data: null, error: null };
            }
            saveQuoteAtomicAttempts += 1;
            if (saveQuoteAtomicAttempts === 1) {
                return { data: null, error: { message: legacyColumnError } };
            }
            return { data: QUOTE_ID, error: null };
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

        await waitFor(() => {
            expect(screen.getByTestId('commodity-input')).toHaveValue('Initial');
        });

        await user.click(screen.getByTestId('set-multi-container-combos'));
        await goToResultsTab(user);
        await user.click(screen.getByRole('button', { name: /Draft/i }));

        await waitFor(() => {
            const saveCalls = mockScopedDb.rpc.mock.calls.filter((c: any[]) => c[0] === 'save_quote_atomic');
            expect(saveCalls.length).toBeGreaterThanOrEqual(2);
            const secondPayload = saveCalls[1][1]?.p_payload;
            expect(Array.isArray(secondPayload?.cargo_configurations)).toBe(true);
            expect(secondPayload.cargo_configurations).toHaveLength(0);
        });
    });
});

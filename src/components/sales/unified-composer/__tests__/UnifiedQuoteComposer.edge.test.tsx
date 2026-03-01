import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as quoteStore from '@/components/sales/composer/store/QuoteStore';
import { QuoteState } from '@/components/sales/composer/store/types';
import { useCRM } from '@/hooks/useCRM';

// Hoist mocks to ensure they are available before imports
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'test-quote-id' }),
  };
});

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    profile: { id: 'test-profile' },
  }),
}));

// Mock useQuoteRepository
vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
    containerTypes: [],
  }),
}));

// Mock Services
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
        rankOptions: vi.fn().mockReturnValue([]),
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
    const MockService = vi.fn();
    MockService.prototype.generateNextQuoteNumber = vi.fn().mockResolvedValue('Q-1002');
    return { QuotationNumberService: MockService };
});

// Mock the scoped DB access
const createChainableMock = () => {
  const chain: any = {};
  
  const returnChain = () => chain;

  chain.then = vi.fn((resolve: any, reject: any) => {
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
  });

  chain.select = vi.fn(returnChain);
  chain.eq = vi.fn(returnChain);
  chain.single = vi.fn().mockResolvedValue({ data: {}, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: {}, error: null });
  chain.order = vi.fn(returnChain);
  chain.in = vi.fn(returnChain);
  chain.insert = vi.fn(returnChain);
  chain.update = vi.fn(returnChain);
  chain.delete = vi.fn(returnChain);
  
  return chain;
};

const mockScopedDb = {
  from: vi.fn().mockImplementation(() => createChainableMock()),
  rpc: vi.fn(),
};

// Mock useCRM
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

// Mock useRateFetching
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    fetchRates: vi.fn(),
  }),
  ContainerResolver: {},
}));

// Mock useAiAdvisor
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: { compliant: true }, error: null }),
  }),
}));

// Mock useContainerRefs
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: [],
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
    storage: {
        from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }))
    }
  },
}));

// Mock toast
const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock child components to isolate testing
vi.mock('../FormZone', () => ({
  FormZone: ({ initialValues, onChange }: any) => (
    <div data-testid="form-zone">
      <input
        data-testid="commodity-input"
        value={initialValues?.commodity || ''}
        onChange={(e) => onChange({ ...initialValues, commodity: e.target.value })}
        readOnly={!onChange}
      />
    </div>
  ),
}));

vi.mock('../QuoteResultsList', () => ({
  default: () => <div data-testid="quote-results-list">Results List</div>,
}));

vi.mock('../FinalizeSection', () => ({
  FinalizeSection: ({ onSaveQuote }: any) => (
    <div data-testid="finalize-section">
      <button 
        onClick={() => onSaveQuote([], 15, 'test notes')} 
        data-testid="save-button"
      >
        Save Quote
      </button>
    </div>
  ),
}));

describe('UnifiedQuoteComposer Edge Cases', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Mock initial quote store state
    vi.spyOn(quoteStore, 'useQuoteStore').mockReturnValue({
      state: {
        quoteId: null,
        versionId: null,
        isLoading: false,
        isSaving: false,
        legs: [],
        charges: [],
        options: [],
        // Add other necessary properties with default values
      } as unknown as QuoteState,
      dispatch: vi.fn(),
    });

    // Setup useCRM mock
    (useCRM as any).mockReturnValue({
        scopedDb: mockScopedDb,
        context: {
          tenantId: 'test-tenant-id',
          isPlatformAdmin: false,
          isTenantAdmin: true,
        },
        supabase: {
          storage: {
            from: vi.fn(() => ({
                upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }))
          }
        }
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/quotes/test-quote-id']}>
          <Routes>
            <Route path="/quotes/:id" element={<UnifiedQuoteComposer quoteId="test-quote-id" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('handles network error during quote loading gracefully', async () => {
    const auditLogInsertSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
    
    // Mock quotes table fetch to fail
    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = createChainableMock();
      if (table === 'quotes') {
        chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Network Error' } });
      }
      if (table === 'audit_logs') {
        chain.insert = auditLogInsertSpy;
      }
      return chain;
    });

    renderComponent();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Error',
        description: 'Failed to load quote data. Please try again.',
      }));
    }, { timeout: 5000 });
    
    // Verify audit logs
    expect(auditLogInsertSpy).toHaveBeenCalledTimes(2); // Attempt + Failure
    
    // Check for reload_attempt
    expect(auditLogInsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reload_attempt',
      resource_id: 'test-quote-id',
    }));

    // Check for reload_failure
    expect(auditLogInsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reload_failure',
      resource_id: 'test-quote-id',
      details: expect.objectContaining({
        status: 'failure',
        error: 'Failed to load quote after retries'
      })
    }));
  });

  it('logs audit events on successful reload', async () => {
    const auditLogInsertSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    
    // Mock successful quote load
    mockScopedDb.from.mockImplementation((table: string) => {
      const chain = createChainableMock();
      if (table === 'quotes') {
        chain.maybeSingle.mockResolvedValue({ 
          data: { 
            id: 'test-quote-id', 
            quote_id: 'Q-1001',
            current_version_id: validUuid
          }, 
          error: null 
        });
      }
      if (table === 'quotation_version_options') {
        chain.select.mockReturnThis();
        chain.eq.mockReturnThis();
        chain.order.mockResolvedValue({ 
            data: [{ id: 'opt-1', option_name: 'Opt 1', total_amount: 100 }], 
            error: null 
        });
      }
      if (table === 'audit_logs') {
        chain.insert = auditLogInsertSpy;
      }
      // Return success for other tables to ensure full load
      chain.select.mockReturnThis();
      chain.eq.mockReturnThis();
      chain.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }));
      
      return chain;
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('form-zone')).toBeInTheDocument();
    });
    
    // Wait for async operations to complete
    await waitFor(() => {
        expect(auditLogInsertSpy).toHaveBeenCalledTimes(2);
    });

    // Verify audit logs
    // attempt + success
    expect(auditLogInsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reload_attempt',
      resource_id: 'test-quote-id',
    }));

    expect(auditLogInsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reload_success',
      resource_id: 'test-quote-id',
      details: expect.objectContaining({
        status: 'success'
      })
    }));
  });

  it('handles malformed data during quote loading', async () => {
    // Mock quotes table fetch to return invalid structure
    mockScopedDb.from.mockImplementation((table) => {
      const chain = createChainableMock();
      if (table === 'quotes') {
        chain.maybeSingle.mockResolvedValue({
            data: {
              id: 'test-quote-id',
              // Missing required fields
              opportunity_id: 'opp-1'
            },
            error: null
        });
      }
      return chain;
    });

    renderComponent();

    await waitFor(() => {
       expect(screen.getByTestId('form-zone')).toBeInTheDocument();
    });
  });

  it('handles partial data loading (missing non-critical fields)', async () => {
    // Mock successful quote load but with missing optional fields
    mockScopedDb.from.mockImplementation((table) => {
      const chain = createChainableMock();
      if (table === 'quotes') {
        chain.maybeSingle.mockResolvedValue({
            data: {
              id: 'test-quote-id',
              cargo_details: { commodity: 'Test Commodity' },
              // Missing origin/destination/charges
            },
            error: null
        });
      }
      return chain;
    });

    renderComponent();

    // Check if form is populated with available data
    await waitFor(() => {
        const input = screen.getByTestId('commodity-input') as HTMLInputElement;
        expect(input.value).toBe('Test Commodity');
    });
  });

  it('handles save failure due to network error', async () => {
    const validVersionId = '00000000-0000-0000-0000-000000000001';
    const validOptionId = '00000000-0000-0000-0000-000000000002';

    mockScopedDb.rpc.mockImplementation((rpcName) => {
      if (rpcName === 'save_quote_atomic') {
        return Promise.resolve({ data: null, error: { message: 'Save Failed' } });
      }
      return Promise.resolve({ data: [], error: null });
    });

    // Mock options loading AND quotes loading
    mockScopedDb.from.mockImplementation((table) => {
        const chain = createChainableMock();

        if (table === 'quotation_version_options') {
            chain.then.mockImplementation((resolve: any) => resolve({ 
                data: [{ 
                    id: validOptionId, 
                    is_selected: true, 
                    option_name: 'Test Option',
                    total_amount: 1000,
                    currency: 'USD'
                }], 
                error: null 
            }));
        } else if (table === 'quotes') {
            chain.maybeSingle.mockResolvedValue({
                data: {
                    id: 'test-quote-id',
                    cargo_details: { commodity: 'Test Commodity' },
                    current_version_id: validVersionId
                },
                error: null
            });
        }
        return chain;
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('finalize-section')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() => {
       expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Save Failed',
      }));
    });
  });
});

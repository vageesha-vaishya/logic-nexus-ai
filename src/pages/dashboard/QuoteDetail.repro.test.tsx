
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import QuoteDetail from './QuoteDetail';
import { MemoryRouter } from 'react-router-dom';
import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';

// Mock child components
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>
}));
vi.mock('@/components/sales/quotation-versions/VersionHistoryPanel', () => ({
  VersionHistoryPanel: () => <div data-testid="version-history-panel" />
}));
vi.mock('@/components/sales/quotation-versions/SaveVersionDialog', () => ({
  SaveVersionDialog: () => <div data-testid="save-version-dialog" />
}));
vi.mock('@/components/sales/quotation-versions/QuotationComparisonDashboard', () => ({
  QuotationComparisonDashboard: ({ options }: { options: any[] }) => (
    <div data-testid="comparison-dashboard">
      {options.map(o => (
        <div key={o.id} data-testid="option-item">
          {o.carrier_name} - {o.rank_score}
        </div>
      ))}
    </div>
  )
}));
vi.mock('@/components/sales/QuotationVersionHistory', () => ({
  QuotationVersionHistory: () => <div data-testid="quotation-version-history" />
}));
vi.mock('@/components/sales/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: () => <div data-testid="unified-quote-composer" />
}));
vi.mock('@/components/sales/portal/ShareQuoteDialog', () => ({
  ShareQuoteDialog: () => <div />
}));
vi.mock('@/components/sales/SendQuoteDialog', () => ({
  SendQuoteDialog: () => <div />
}));
vi.mock('@/components/sales/QuotePreviewModal', () => ({
  QuotePreviewModal: () => <div />
}));
vi.mock('@/components/system/DetailScreenTemplate', () => ({
  DetailScreenTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock hooks - Hoisted to allow modification in tests
const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: mocks.useParams,
    useSearchParams: mocks.useSearchParams,
  };
});

// Mock services
vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    constructor() {}
    getConfiguration() {
      return Promise.resolve({ multi_option_enabled: true });
    }
  }
}));

// Mock Ranking Service
vi.spyOn(QuotationRankingService, 'rankOptions').mockImplementation((options) => {
  return options.map(o => ({
    ...o,
    rank_score: 95,
    rank_details: { cost_score: 90, time_score: 90, reliability_score: 90 }
  }));
});

// Mock useCRM and supabase
const mockScopedDb = {
  from: vi.fn(),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
      },
      functions: {
        invoke: vi.fn(),
      }
    },
    context: { tenantId: 'tenant-1' },
    scopedDb: mockScopedDb,
  })
}));

vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })
}));

// Helper to create chainable mock
const createMockChain = (data: any) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return chain;
};

describe('QuoteDetail Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useParams.mockReturnValue({ id: 'quote-123' });
    // Default to NO versionId in URL (simulating refresh/clean navigation)
    mocks.useSearchParams.mockReturnValue([new URLSearchParams({})]);
  });

  it('loads latest version options when URL versionId is missing', async () => {
    const quoteId = 'quote-123';
    const latestVersionId = 'ver-latest';
    
    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createMockChain({ 
            id: quoteId, 
            quote_number: 'Q-123', 
            tenant_id: 'tenant-1',
            current_version_id: latestVersionId 
        });
      }
      
      if (table === 'quotation_versions') {
        // Return latest version when queried by quote_id
        return createMockChain([
            { id: latestVersionId, version_number: 2, tenant_id: 'tenant-1' }
        ]);
      }
      
      if (table === 'quotation_version_options') {
        // This is the critical check: does it query with the LATEST version ID?
        // We'll capture the ID used in the query via spy, but returning data confirms it worked.
        return createMockChain([
          {
            id: 'opt-1',
            quotation_version_id: latestVersionId,
            carrier_rate_id: 'rate-1',
            total_amount: 1000,
            carrier: { name: 'Maersk' },
            carrier_rate: {
              carrier: { name: 'Maersk' },
              transit_time: '20 days',
              currency: 'USD'
            }
          }
        ]);
      }
      
      if (table === 'carrier_rates') {
        // Provide minimal rate info used by hydration
        return createMockChain([
          { id: 'rate-1', currency: 'USD', carrier_id: 'carrier-1' }
        ]);
      }
      
      if (table === 'carriers') {
        return createMockChain([
          { id: 'carrier-1', carrier_name: 'Maersk' }
        ]);
      }
      
      return createMockChain([]);
    });

    render(
      <MemoryRouter>
        <QuoteDetail />
      </MemoryRouter>
    );

    // Verify loading state resolves
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    // Verify comparison dashboard appears (meaning options were loaded)
    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toBeInTheDocument();
    });

  expect(screen.getByText(/Maersk/)).toBeInTheDocument();
        });

        it('clears state and shows loader when navigating to a different quote', async () => {
          // Initial setup for Quote 1
          mocks.useParams.mockReturnValue({ id: 'quote-1' });
          mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);

          const quote1 = { id: 'quote-1', quote_number: 'Q-1', tenant_id: 't1', current_version_id: 'v1' };
          const version1 = { id: 'v1', version_number: 1, tenant_id: 't1' };
          
          // Setup mock for initial load - handle both quotes
          mockScopedDb.from.mockImplementation((table: string) => {
             // For the second quote, we want to delay the response to verify loading state
             // We use mocks.useParams.mock.results to check what was last called
             const lastCall = mocks.useParams.mock.results[mocks.useParams.mock.results.length - 1];
             const isQuote2 = lastCall && lastCall.value && lastCall.value.id === 'quote-2';
             
             if (isQuote2) {
                  let isSingle = false;
                  const delayedChain: any = {
                     select: vi.fn().mockReturnThis(),
                     eq: vi.fn().mockReturnThis(),
                     or: vi.fn().mockReturnThis(),
                     in: vi.fn().mockReturnThis(),
                     order: vi.fn().mockReturnThis(),
                     limit: vi.fn().mockReturnThis(),
                     abortSignal: vi.fn().mockReturnThis(),
                     upsert: vi.fn().mockReturnThis(),
                  };
                  
                  delayedChain.single = vi.fn().mockImplementation(() => { isSingle = true; return delayedChain; });
                  delayedChain.maybeSingle = vi.fn().mockImplementation(() => { isSingle = true; return delayedChain; });
                  
                  delayedChain.then = (resolve: any) => setTimeout(() => {
                        const mockData = { id: 'quote-2', tenant_id: 't1', quote_number: 'Q-2', current_version_id: 'v2' };
                        resolve({ 
                            data: isSingle ? mockData : [mockData], 
                            error: null 
                        });
                  }, 100);

                  return delayedChain;
              }

             if (table === 'quotes') return createMockChain(quote1);
             if (table === 'quotation_versions') return createMockChain([version1]);
             if (table === 'quotation_version_options') return createMockChain([]);
             return createMockChain([]);
          });

          const { rerender } = render(
            <MemoryRouter>
              <QuoteDetail />
            </MemoryRouter>
          );

          // Wait for Quote 1 to load
          await waitFor(() => {
             expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
          });
          
          // Verify composer is present
          await waitFor(() => {
            expect(screen.getByTestId('unified-quote-composer')).toBeInTheDocument();
          });

          // Simulate navigation to Quote 2
          mocks.useParams.mockReturnValue({ id: 'quote-2' });
          
          // Force re-render with new params (simulating router update)
          rerender(
            <MemoryRouter>
              <QuoteDetail />
            </MemoryRouter>
          );

          // Expect loader to appear (loading state reset)
          // Note: In a real browser, this happens fast. In test, we might catch it.
          // The effect [id] runs, sets loading(true).
          
          await waitFor(() => {
             // We should see "Loading quotation details..."
             expect(screen.getByText(/Loading quotation details/i)).toBeInTheDocument();
          });
          
          // Verify composer is GONE during loading
          expect(screen.queryByTestId('unified-quote-composer')).not.toBeInTheDocument();
          
          // Wait for loading to finish and new quote to appear
          await waitFor(() => {
             expect(screen.queryByText(/Loading quotation details/i)).not.toBeInTheDocument();
          });
          
          // Verify composer is back
          expect(screen.getByTestId('unified-quote-composer')).toBeInTheDocument();
        });
    });

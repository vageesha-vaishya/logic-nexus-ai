import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import QuoteDetail from './QuoteDetail';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';

// Mock child components to avoid deep rendering
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
          {o.carrier_name} - {o.rank_score} - {o.total_amount} - {o.transit_time_days} - {o.reliability_score}
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

// Mock hooks
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'quote-123' }),
    useSearchParams: () => [new URLSearchParams({ versionId: 'ver-123' }), mockSetSearchParams],
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

describe('QuoteDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetSearchParams.mockReset();
  });

  it('fetches and maps comparison options with carrier and pricing data', async () => {
    // Setup mock responses
    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createMockChain({ id: 'quote-123', quote_number: 'Q-123', tenant_id: 'tenant-1' });
      }
      if (table === 'quotation_versions') {
        return createMockChain({ id: 'ver-123', version_number: 1, tenant_id: 'tenant-1' });
      }
      if (table === 'quotation_version_options') {
        const mockOptions = [
          {
            id: 'opt-1',
            quotation_version_id: 'ver-123',
            carrier_rate_id: 'rate-1',
            option_name: 'Premium',
            total_amount: 1000,
            total_transit_days: 20,
            reliability_score: 90,
          }
        ];
        return createMockChain(mockOptions);
      }
      if (table === 'carrier_rates') {
        return createMockChain([{ id: 'rate-1', currency: 'USD', carrier_id: 'carrier-1' }]);
      }
      if (table === 'carriers') {
        return createMockChain([{ id: 'carrier-1', carrier_name: 'Maersk' }]);
      }
      if (table === 'quote_charges') {
        return createMockChain([
          {
            id: 'ch-1',
            quote_option_id: 'opt-1',
            category_id: 'cat-1',
            amount: 1000,
            rate: 1000,
            currency_id: 'curr-1',
            note: 'Freight',
            sort_order: 1,
          },
        ]);
      }
      if (table === 'quotation_version_option_legs') {
        return createMockChain([]);
      }
      if (table === 'currencies') {
        return createMockChain([{ id: 'curr-1', code: 'USD' }]);
      }
      if (table === 'charge_categories') {
        return createMockChain([{ id: 'cat-1', name: 'Freight' }]);
      }
      return createMockChain([]);
    });

    render(
      <MemoryRouter>
        <QuoteDetail />
      </MemoryRouter>
    );

    // Verify loading state is gone (by checking for dashboard layout content)
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    // Verify options are fetched and rendered in comparison dashboard
    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toBeInTheDocument();
    });

    // Verify the ranking service was called
    expect(QuotationRankingService.rankOptions).toHaveBeenCalled();

    // Verify carrier name is resolved
    expect(screen.getByText(/Maersk/)).toBeInTheDocument();
    expect(screen.getByText(/Maersk - 95 - 1000 - 20 - 0.9/)).toBeInTheDocument();
  });

  it('recovers missing totals and carrier from legs mapping', async () => {
    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') return createMockChain({ id: 'quote-123', quote_number: 'Q-123', tenant_id: 'tenant-1' });
      if (table === 'quotation_versions') return createMockChain({ id: 'ver-123', version_number: 1, tenant_id: 'tenant-1' });
      if (table === 'quotation_version_options') {
        return createMockChain([{
          id: 'opt-2',
          quotation_version_id: 'ver-123',
          option_name: 'Economy',
          total_amount: 0,
          currency: 'USD',
          reliability_score: null,
          total_transit_days: null,
        }]);
      }
      if (table === 'carrier_rates') return createMockChain([]);
      if (table === 'carriers') return createMockChain([{ id: 'carrier-leg-1', carrier_name: 'MSC' }]);
      if (table === 'quotation_version_option_legs') {
        return createMockChain([{
          id: 'leg-1',
          quotation_version_option_id: 'opt-2',
          provider_id: 'carrier-leg-1',
          carrier_name: null,
          transit_time_hours: 72,
          sort_order: 1,
        }]);
      }
      if (table === 'quote_charges') {
        return createMockChain([{
          id: 'ch-2',
          quote_option_id: 'opt-2',
          category_id: 'cat-1',
          amount: 1200,
          rate: 1200,
          currency_id: 'curr-1',
          note: 'Freight',
          sort_order: 1,
        }]);
      }
      if (table === 'currencies') return createMockChain([{ id: 'curr-1', code: 'USD' }]);
      if (table === 'charge_categories') return createMockChain([{ id: 'cat-1', name: 'Freight' }]);
      return createMockChain([]);
    });

    render(
      <MemoryRouter>
        <QuoteDetail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText(/MSC - 95 - 1200 - 3 - 0.5/)).toBeInTheDocument();
  });
});

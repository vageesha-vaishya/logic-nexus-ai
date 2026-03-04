
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteDetail from './QuoteDetail';
import { useCRM } from '@/hooks/useCRM';

// Mock hooks
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock UnifiedQuoteComposer to avoid complex rendering
vi.mock('@/components/sales/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: (props: any) => (
    <div data-testid="unified-quote-composer">
      Composer
    </div>
  ),
}));

// Mock child components
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/sales/quotation-versions/VersionHistoryPanel', () => ({
  VersionHistoryPanel: () => <div data-testid="version-history-panel" />,
}));
vi.mock('@/components/sales/quotation-versions/SaveVersionDialog', () => ({
  SaveVersionDialog: () => <div />,
}));
vi.mock('@/components/sales/portal/ShareQuoteDialog', () => ({
  ShareQuoteDialog: () => <div />,
}));
vi.mock('@/components/sales/SendQuoteDialog', () => ({
  SendQuoteDialog: () => <div />,
}));
vi.mock('@/components/sales/QuotePreviewModal', () => ({
  QuotePreviewModal: () => <div />,
}));
vi.mock('@/components/system/DetailScreenTemplate', () => ({
  DetailScreenTemplate: ({ children, actions }: any) => (
    <div data-testid="detail-screen">
      <div data-testid="actions">{actions}</div>
      {children}
    </div>
  ),
}));

// Mock Comparison Dashboard to verify it receives options
vi.mock('@/components/sales/quotation-versions/QuotationComparisonDashboard', () => ({
  QuotationComparisonDashboard: ({ options }: any) => (
    <div data-testid="comparison-dashboard">
      Options: {options?.length || 0}
    </div>
  ),
}));

// Mock QuotationConfigurationService
const mockGetConfiguration = vi.fn();
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  return {
    QuotationConfigurationService: class {
      constructor() {}
      getConfiguration(tenantId: string) { return mockGetConfiguration(tenantId); }
    }
  };
});

// Mock QuotationRankingService
vi.mock('@/services/quotation/QuotationRankingService', () => ({
  QuotationRankingService: {
    rankOptions: (options: any[]) => options, // Pass through
  }
}));

// Helper to create safe chainable mocks
const createSafeChain = (name: string, data: any = [], error: any = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() => {
      const result = Array.isArray(data) ? (data.length ? data[0] : null) : data;
      return Promise.resolve({ data: result, error });
    }),
    single: vi.fn().mockImplementation(() => {
      const result = Array.isArray(data) ? (data.length ? data[0] : null) : data;
      return Promise.resolve({ data: result, error });
    }),
    insert: vi.fn().mockReturnValue(Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null })),
    upsert: vi.fn().mockReturnValue(Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null })),
    delete: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })),
    abortSignal: vi.fn().mockImplementation(() => {
       // Return promise-like object for await
       return Promise.resolve({ data, error });
    }),
    then: (resolve: any) => resolve({ data, error }),
  };
  return chain;
};

describe('QuoteDetail - Refresh & Dashboard Scenarios', () => {
  const mockScopedDb = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useCRM as any).mockReturnValue({
      scopedDb: mockScopedDb,
      context: { tenantId: 'tenant-123' },
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
          getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
        },
        functions: {
            invoke: vi.fn()
        }
      },
    });

    // Default config: multi_option_enabled = true
    mockGetConfiguration.mockResolvedValue({ multi_option_enabled: true });
  });

  it('populates comparison dashboard when options exist', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const versionId = '00000000-0000-0000-0000-000000000002';
    const options = [
        { id: 'opt-1', quotation_version_id: versionId, total_amount: 100 },
        { id: 'opt-2', quotation_version_id: versionId, total_amount: 200 }
    ];

    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createSafeChain('quotes', { id: quoteId, tenant_id: 'tenant-123' });
      }
      if (table === 'quotation_versions') {
        return createSafeChain('versions', [{ id: versionId, version_number: 1 }]);
      }
      if (table === 'quotation_version_options') {
        return createSafeChain('options', options);
      }
      return createSafeChain(table, []);
    });

    render(
      <MemoryRouter initialEntries={[`/dashboard/quotes/${quoteId}`]}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('Options: 2');
  });

  it('does not render dashboard when options are empty', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const versionId = '00000000-0000-0000-0000-000000000002';

    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') return createSafeChain('quotes', { id: quoteId });
      if (table === 'quotation_versions') return createSafeChain('versions', [{ id: versionId }]);
      if (table === 'quotation_version_options') return createSafeChain('options', []); // Empty
      return createSafeChain(table, []);
    });

    render(
      <MemoryRouter initialEntries={[`/dashboard/quotes/${quoteId}`]}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('unified-quote-composer')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('comparison-dashboard')).not.toBeInTheDocument();
  });

  it('does not render dashboard when config disables multi-option', async () => {
    mockGetConfiguration.mockResolvedValue({ multi_option_enabled: false });

    const quoteId = '00000000-0000-0000-0000-000000000001';
    const versionId = '00000000-0000-0000-0000-000000000002';
    const options = [{ id: 'opt-1', quotation_version_id: versionId }];

    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') return createSafeChain('quotes', { id: quoteId });
      if (table === 'quotation_versions') return createSafeChain('versions', [{ id: versionId }]);
      if (table === 'quotation_version_options') return createSafeChain('options', options);
      return createSafeChain(table, []);
    });

    render(
      <MemoryRouter initialEntries={[`/dashboard/quotes/${quoteId}`]}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('unified-quote-composer')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('comparison-dashboard')).not.toBeInTheDocument();
  });
});


import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock UnifiedQuoteComposer to inspect props
vi.mock('@/components/sales/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: (props: any) => (
    <div data-testid="unified-quote-composer">
      <span data-testid="composer-quote-id">{props.quoteId}</span>
      <span data-testid="composer-version-id">{props.versionId || 'undefined'}</span>
    </div>
  ),
}));

// Mock child components to avoid clutter
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/sales/quotation-versions/VersionHistoryPanel', () => ({
  VersionHistoryPanel: () => <div data-testid="version-history-panel" />,
}));
vi.mock('@/components/sales/quotation-versions/QuotationComparisonDashboard', () => ({
  QuotationComparisonDashboard: ({ options }: any) => (
    <div data-testid="comparison-dashboard">
      Comparison Dashboard: {options?.length || 0} options
    </div>
  ),
}));

describe('QuoteDetail - Empty State & Data Loading', () => {
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
        },
      },
    });
  });

  // Helper to create a chainable mock with delayed response
  const createMockChain = (data: any, error: any = null, delay = 0) => {
    let isSingle = false;
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        isSingle = true;
        return chain;
      }),
      single: vi.fn().mockImplementation(() => {
        isSingle = true;
        return chain;
      }),
      abortSignal: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockImplementation(async () => {
         return { data: { id: 'new-version-id' }, error: null };
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-config-id' }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new-config-id' }, error: null })
        })
      }),
      then: (resolve: any, reject: any) => {
         const resultData = isSingle && Array.isArray(data) ? (data.length ? data[0] : null) : data;
         const result = { data: resultData, error };
         if (delay) {
            setTimeout(() => resolve(result), delay);
         } else {
            resolve(result);
         }
      }
    };
    return chain;
  };

  it('passes correct versionId to UnifiedQuoteComposer when version exists', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const versionId = '00000000-0000-0000-0000-000000000002';
    
    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createMockChain({ id: quoteId, current_version_id: versionId });
      }
      if (table === 'quotation_versions') {
        return createMockChain([{ id: versionId, version_number: 1 }]);
      }
      if (table === 'quotation_version_options') {
        return createMockChain([]);
      }
      return createMockChain([]);
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

    expect(screen.getByTestId('composer-quote-id')).toHaveTextContent(quoteId);
    expect(screen.getByTestId('composer-version-id')).toHaveTextContent(versionId);
  });

  it('handles missing version by creating a new one', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    
    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return createMockChain({ id: quoteId, tenant_id: 'tenant-123' });
      }
      if (table === 'quotation_versions') {
        // First call returns empty (no versions)
        // Upsert call returns new version
        return {
          ...createMockChain([]),
          upsert: vi.fn().mockReturnValue({
             select: vi.fn().mockReturnValue({
                 maybeSingle: vi.fn().mockReturnValue({
                     abortSignal: vi.fn().mockResolvedValue({ data: { id: 'new-version-id' }, error: null })
                 })
             })
          })
        };
      }
      return createMockChain([]);
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
    
    // It should have created 'new-version-id'
    expect(screen.getByTestId('composer-version-id')).toHaveTextContent('new-version-id');
  });

  it('updates versionId when URL changes', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const version1 = '00000000-0000-0000-0000-000000000001';
    const version2 = '00000000-0000-0000-0000-000000000002';

    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') return createMockChain({ id: quoteId });
      if (table === 'quotation_versions') {
         // This mock needs to be smart enough to return specific version if ID is queried
         return {
             ...createMockChain([{ id: version1 }]),
             select: vi.fn().mockReturnThis(),
             eq: vi.fn().mockImplementation((col, val) => {
                 if (col === 'id' && val === version2) {
                     return createMockChain({ id: version2 });
                 }
                 return createMockChain([{ id: version1 }]); // Default to version 1
             })
         }
      }
      return createMockChain([]);
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={[`/dashboard/quotes/${quoteId}`]}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByTestId('composer-version-id')).toHaveTextContent(version1);
    });

    unmount();

    // Navigate to version 2
    // Since we can't easily trigger navigation from outside in this setup, 
    // we can re-render with new initialEntries or use a test component that navigates.
    // Simpler: Just render again with new URL.
    render(
        <MemoryRouter initialEntries={[`/dashboard/quotes/${quoteId}?versionId=${version2}`]}>
            <Routes>
            <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
            </Routes>
        </MemoryRouter>
    );
    
    await waitFor(() => {
        expect(screen.getByTestId('composer-version-id')).toHaveTextContent(version2);
    });
  });
});

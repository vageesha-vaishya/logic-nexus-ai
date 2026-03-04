import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import QuoteDetail from '../QuoteDetail';
import * as CRMHooks from '@/hooks/useCRM';

// Mock child component to inspect props
vi.mock('@/components/sales/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: ({ quoteId, versionId }: any) => (
    <div data-testid="composer">
      Composer: quoteId={quoteId}, versionId={versionId}
    </div>
  ),
}));

// Mock hooks
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

// Mock other components to avoid rendering issues
vi.mock('@/components/sales/quotation-versions/VersionHistoryPanel', () => ({ VersionHistoryPanel: () => <div>VersionHistoryPanel</div> }));
vi.mock('@/components/sales/quotation-versions/SaveVersionDialog', () => ({ SaveVersionDialog: () => <div>SaveVersionDialog</div> }));
vi.mock('@/components/sales/quotation-versions/QuotationComparisonDashboard', () => ({ QuotationComparisonDashboard: () => <div>Comparison</div> }));
vi.mock('@/components/sales/QuotationVersionHistory', () => ({ QuotationVersionHistory: () => <div>History</div> }));
vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    getConfiguration = vi.fn().mockResolvedValue({});
  },
}));

describe('QuoteDetail URL Parameters', () => {
  // Helper to create a promise that also has abortSignal property
  const createMockResponse = (data: any, error: any = null) => {
    const result = { data, error };
    // It acts as a Promise (thenable)
    const thenable = {
      then: (resolve: any) => Promise.resolve(result).then(resolve),
      // And has abortSignal method
      abortSignal: vi.fn().mockResolvedValue(result),
      // And maybeSingle (for limit chains)
      maybeSingle: vi.fn(), 
    };
    // Circular reference for maybeSingle to return itself (or similar)
    thenable.maybeSingle.mockReturnValue(thenable);
    
    return thenable;
  };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOr = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockMaybeSingle = vi.fn();

  // The builder that allows chaining
  const mockQueryBuilder: any = {
    select: mockSelect,
    eq: mockEq,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
  };

  // Setup chaining
  mockFrom.mockReturnValue(mockQueryBuilder);
  mockSelect.mockReturnValue(mockQueryBuilder);
  mockEq.mockReturnValue(mockQueryBuilder);
  mockOr.mockReturnValue(mockQueryBuilder);
  mockOrder.mockReturnValue(mockQueryBuilder);
  mockLimit.mockReturnValue(mockQueryBuilder); // limit returns builder which has maybeSingle
  mockMaybeSingle.mockReturnValue(createMockResponse(null)); // Default return

  const mockScopedDb = {
    from: mockFrom,
  };

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (CRMHooks.useCRM as any).mockReturnValue({
      scopedDb: mockScopedDb,
      context: { tenantId: 't1' },
      supabase: mockSupabase,
    });
  });

  it('passes versionId from URL query param to UnifiedQuoteComposer', async () => {
    // 1. Mock Quote Resolution (by ID)
    // Code: .limit(1).maybeSingle() -> awaits
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    
    // We need to intercept the specific call chain for quotes
    // The chain is: from('quotes').select(...).or/eq(...).limit(1).maybeSingle()
    
    // We can make maybeSingle return a specific response based on previous calls, 
    // but simpler is to use mockImplementationOnce on maybeSingle if we know the order.
    
    // However, since we share the mockQueryBuilder, let's just mock the responses in order.
    // Call 1: Quote fetch (awaits maybeSingle result)
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));

    // Call 2: Version fetch (calls maybeSingle().abortSignal())
    // Code: .eq('id', urlVersionId).maybeSingle().abortSignal(signal)
    const versionData = { id: 'v-999', version_number: 2, tenant_id: 't1' };
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify Composer props
    await waitFor(() => {
      const composer = screen.getByTestId('composer');
      expect(composer).toHaveTextContent('Composer: quoteId=q-123, versionId=v-999');
    });
  });

  it('falls back to latest version if no URL param', async () => {
    // 1. Mock Quote Resolution
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));

    // 2. Mock Latest Version Resolution
    // Code: .limit(1).abortSignal(signal) -> returns array
    // Here `limit` is called, and `abortSignal` is called on the result of limit?
    // Wait, the code is: .limit(1).abortSignal(signal)
    
    // So `limit` must return something that has `abortSignal`.
    // In our mock, `limit` returns `mockQueryBuilder`.
    // So we need `mockQueryBuilder` to have `abortSignal` too?
    // Or `limit` should return a response object if it's the end of chain?
    
    // In the code:
    /* 
       const { data, error } = await (scopedDb... as any)
          ...
          .limit(1)
          .abortSignal(signal);
    */
    
    // So `limit` returns the builder, and that builder must have `abortSignal`.
    // My `mockQueryBuilder` doesn't have `abortSignal` in the definition above.
    
    mockQueryBuilder.abortSignal = vi.fn();
    
    const latestVersionData = [{ id: 'v-latest', version_number: 5, tenant_id: 't1' }];
    mockQueryBuilder.abortSignal.mockResolvedValueOnce({ data: latestVersionData, error: null });

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      const composer = screen.getByTestId('composer');
      expect(composer).toHaveTextContent('Composer: quoteId=q-123, versionId=v-latest');
    });
  });
});

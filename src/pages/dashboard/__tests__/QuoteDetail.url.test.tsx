import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
  useDebug: () => debugMock,
}));

const debugMock = {
  info: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

// Mock other components to avoid rendering issues
vi.mock('@/components/sales/quotation-versions/VersionHistoryPanel', () => ({ VersionHistoryPanel: () => <div>VersionHistoryPanel</div> }));
vi.mock('@/components/sales/quotation-versions/SaveVersionDialog', () => ({ SaveVersionDialog: () => <div>SaveVersionDialog</div> }));
vi.mock('@/components/sales/quotation-versions/QuotationComparisonDashboard', () => ({
  QuotationComparisonDashboard: ({ selectedOptionId, options, onSelect }: any) => {
    const selectedOption = options?.find((option: any) => option.id === selectedOptionId) || options?.[0];
    return (
      <div data-testid="comparison-dashboard">
        selected={selectedOptionId || 'none'} options={options?.length || 0}
        selected-option-name={selectedOption?.option_name || 'none'}
        selected-option-total={selectedOption?.total_amount ?? 'none'}
        selected-option-rate={selectedOption?.average_rate ?? 'none'}
        selected-option-charges={selectedOption?.charges?.length ?? 0}
        selected-option-charges-total={selectedOption?.charges_total ?? 'none'}
        incomplete={options?.filter((option: any) => option?.data_completeness?.is_complete === false).length || 0}
        <button onClick={() => onSelect('opt-a')}>select-opt-a</button>
      </div>
    );
  },
}));
vi.mock('@/components/sales/QuotationVersionHistory', () => ({ QuotationVersionHistory: () => <div>History</div> }));
vi.mock('@/components/sales/QuotePreviewModal', () => ({ QuotePreviewModal: () => <div>Preview</div> }));
vi.mock('@/components/sales/portal/ShareQuoteDialog', () => ({ ShareQuoteDialog: () => <div>Share</div> }));
vi.mock('@/components/sales/SendQuoteDialog', () => ({ SendQuoteDialog: () => <div>Send</div> }));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));
vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    getConfiguration = vi.fn().mockResolvedValue({ multi_option_enabled: true });
  },
}));

describe('QuoteDetail URL Parameters', () => {
  let activeTable = '';
  let queryMode: 'select' | 'update' | 'other' = 'other';
  let optionRowsResponse: any[] | null = null;

  const createMockResponse = (data: any, error: any = null) => {
    const result = { data, error };
    return {
      then: (resolve: any) => Promise.resolve(result).then(resolve),
      abortSignal: vi.fn().mockResolvedValue(result),
    };
  };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockIn = vi.fn();
  const mockUpdate = vi.fn();
  const mockNeq = vi.fn();
  const mockOr = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockAbortSignal = vi.fn();

  // The builder that allows chaining
  const mockQueryBuilder: any = {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    update: mockUpdate,
    neq: mockNeq,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    abortSignal: mockAbortSignal,
  };

  // Setup chaining
  mockFrom.mockImplementation((table: string) => {
    activeTable = table;
    return mockQueryBuilder;
  });
  mockSelect.mockImplementation(() => {
    queryMode = 'select';
    return mockQueryBuilder;
  });
  mockEq.mockImplementation((column: string) => {
    if (activeTable === 'quotation_version_options' && column === 'quotation_version_id' && queryMode === 'select' && optionRowsResponse) {
      return Promise.resolve({ data: optionRowsResponse, error: null });
    }
    return mockQueryBuilder;
  });
  mockIn.mockReturnValue(mockQueryBuilder);
  mockUpdate.mockImplementation(() => {
    queryMode = 'update';
    return mockQueryBuilder;
  });
  mockNeq.mockResolvedValue({ error: null });
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

  const crmState = {
    scopedDb: mockScopedDb,
    context: { tenantId: 't1' },
    supabase: mockSupabase,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    activeTable = '';
    queryMode = 'other';
    optionRowsResponse = null;
    mockEq.mockReset();
    mockEq.mockImplementation((column: string) => {
      if (activeTable === 'quotation_version_options' && column === 'quotation_version_id' && queryMode === 'select' && optionRowsResponse) {
        return Promise.resolve({ data: optionRowsResponse, error: null });
      }
      return mockQueryBuilder;
    });
    mockIn.mockReset();
    mockIn.mockReturnValue(mockQueryBuilder);
    mockSelect.mockReset();
    mockSelect.mockImplementation(() => {
      queryMode = 'select';
      return mockQueryBuilder;
    });
    mockUpdate.mockReset();
    mockUpdate.mockImplementation(() => {
      queryMode = 'update';
      return mockQueryBuilder;
    });
    mockNeq.mockReset();
    mockNeq.mockResolvedValue({ error: null });
    mockAbortSignal.mockReset();
    (CRMHooks.useCRM as any).mockReturnValue(crmState);
  });

  const openComparisonTab = async () => {
    const user = userEvent.setup();
    const comparisonTab = await screen.findByRole('tab', { name: /Option Comparison/i });
    await user.click(comparisonTab);
  };

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
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999&optionId=opt-a']}>
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

  it('resolves route id through legacy identifier fallback when quote_number lookup is empty', async () => {
    const quoteData = { id: 'q-legacy', tenant_id: 't1', quote_number: 'Q-LEGACY' };
    const versionData = { id: 'v-legacy', version_number: 1, tenant_id: 't1' };

    mockMaybeSingle.mockReturnValueOnce(createMockResponse(null));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/legacy-quote-001?versionId=v-legacy']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      const composer = screen.getByTestId('composer');
      expect(composer).toHaveTextContent('Composer: quoteId=q-legacy, versionId=v-legacy');
    });

    expect(mockEq).toHaveBeenCalledWith('quote_number', 'legacy-quote-001');
    expect(mockEq).toHaveBeenCalledWith('id', 'legacy-quote-001');
  });

  it('respects optionId from URL for comparison selection state', async () => {
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    const versionData = { id: 'v-999', version_number: 2, tenant_id: 't1' };
    const optionRows = [
      { id: 'opt-a', option_name: 'Economy', quotation_version_id: 'v-999', total_amount: 1000, currency: 'USD', transit_days: 12, is_selected: false },
      { id: 'opt-b', option_name: 'Express', quotation_version_id: 'v-999', total_amount: 1200, currency: 'USD', transit_days: 10, is_selected: false },
    ];

    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));
    optionRowsResponse = optionRows;

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999&optionId=opt-b']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Quote Form' })).toHaveAttribute('aria-selected', 'true');
    });
    await openComparisonTab();
    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('selected=opt-b');
      expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('options=2');
    });
  });

  it('maps complete comparison fields and flags incomplete options', async () => {
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    const versionData = { id: 'v-999', version_number: 2, tenant_id: 't1' };
    const optionRows = [
      { id: 'opt-a', option_name: 'Economy', quotation_version_id: 'v-999', total_amount: 1000, currency: 'USD', transit_days: 12, is_selected: true },
      { id: 'opt-b', option_name: '', quotation_version_id: 'v-999', total_amount: -10, currency: 'USD', transit_days: 10, is_selected: false },
    ];

    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));
    optionRowsResponse = optionRows;
    mockIn.mockImplementation((column: string) => {
      if (activeTable === 'quote_charges' && column === 'quote_option_id') {
        return Promise.resolve({
          data: [
            { id: 'chg-1', quote_option_id: 'opt-a', category_id: null, amount: 750, rate: 30, currency_id: null, note: null, sort_order: 1 },
            { id: 'chg-2', quote_option_id: 'opt-a', category_id: null, amount: 250, rate: 20, currency_id: null, note: null, sort_order: 2 },
          ],
          error: null,
        });
      }
      return mockQueryBuilder;
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999&optionId=opt-a']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('composer')).toHaveTextContent('versionId=v-999');
    });
    await openComparisonTab();
    await waitFor(() => {
      const comparison = screen.getByTestId('comparison-dashboard');
      expect(comparison).toHaveTextContent('options=2');
      expect(comparison).toHaveTextContent('selected-option-name=Economy');
      expect(comparison).toHaveTextContent('selected-option-rate=25');
      expect(comparison).toHaveTextContent('selected-option-charges=2');
      expect(comparison).toHaveTextContent('incomplete=1');
    }, { timeout: 5000 });
  }, 15000);

  it('uses composer charges total for comparison amount and excludes balancing charge rows', async () => {
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    const versionData = { id: 'v-999', version_number: 2, tenant_id: 't1' };
    const optionRows = [
      { id: 'opt-a', option_name: 'Manual Quote 1', quotation_version_id: 'v-999', total_amount: 6646.3, currency: 'USD', transit_days: 12, is_selected: true },
    ];

    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));
    optionRowsResponse = optionRows;
    mockIn.mockImplementation((column: string) => {
      if (activeTable === 'quote_charges' && column === 'quote_option_id') {
        return Promise.resolve({
          data: [
            { id: 'chg-1', quote_option_id: 'opt-a', category_id: null, amount: 2000, rate: 25, currency_id: null, note: null, sort_order: 1 },
            { id: 'chg-2', quote_option_id: 'opt-a', category_id: null, amount: 1555, rate: 20, currency_id: null, note: null, sort_order: 2 },
            { id: 'chg-3', quote_option_id: 'opt-a', category_id: null, amount: 3091.3, rate: null, currency_id: null, note: 'Unitemized surcharges', sort_order: 3 },
          ],
          error: null,
        });
      }
      return mockQueryBuilder;
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999&optionId=opt-a']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('composer')).toHaveTextContent('versionId=v-999');
    });
    await openComparisonTab();
    await waitFor(() => {
      const comparison = screen.getByTestId('comparison-dashboard');
      expect(comparison).toHaveTextContent('selected-option-total=3555');
      expect(comparison).toHaveTextContent('selected-option-charges=2');
      expect(comparison).toHaveTextContent('selected-option-charges-total=3555');
      expect(comparison).toHaveTextContent('selected-option-rate=22.5');
    }, { timeout: 5000 });
  }, 15000);

  it('persists selected option when user selects another option', async () => {
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    const versionData = { id: 'v-999', version_number: 2, tenant_id: 't1' };
    const optionRows = [
      { id: 'opt-a', quotation_version_id: 'v-999', total_amount: 1000, currency: 'USD', transit_days: 12, is_selected: false },
      { id: 'opt-b', quotation_version_id: 'v-999', total_amount: 1200, currency: 'USD', transit_days: 10, is_selected: true },
    ];

    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));
    optionRowsResponse = optionRows;

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999&optionId=opt-b']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await openComparisonTab();
    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('selected=opt-b');
    });

    fireEvent.click(screen.getByText('select-opt-a'));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Option selected');
      expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('selected=opt-a');
    });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('rolls back selection when persistence fails', async () => {
    const quoteData = { id: 'q-123', tenant_id: 't1', quote_number: 'Q-100' };
    const versionData = { id: 'v-999', version_number: 2, tenant_id: 't1' };
    const optionRows = [
      { id: 'opt-a', quotation_version_id: 'v-999', total_amount: 1000, currency: 'USD', transit_days: 12, is_selected: false },
      { id: 'opt-b', quotation_version_id: 'v-999', total_amount: 1200, currency: 'USD', transit_days: 10, is_selected: true },
    ];

    mockMaybeSingle.mockReturnValueOnce(createMockResponse(quoteData));
    mockMaybeSingle.mockReturnValueOnce(createMockResponse(versionData));
    mockNeq.mockResolvedValue({ error: { message: 'db failed' } });
    optionRowsResponse = optionRows;

    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/q-123?versionId=v-999&optionId=opt-b']}>
        <Routes>
          <Route path="/dashboard/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await openComparisonTab();
    await waitFor(() => {
      expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('selected=opt-b');
    });

    fireEvent.click(screen.getByText('select-opt-a'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Failed to update selected option');
      expect(screen.getByTestId('comparison-dashboard')).toHaveTextContent('selected=opt-b');
    });
  });
});

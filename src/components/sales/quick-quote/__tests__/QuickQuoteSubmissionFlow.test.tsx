import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickQuoteModal } from '../QuickQuoteModal';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// Common DOM mocks for Radix UI
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Lightweight Select mock
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children, 'data-testid': testId }: any) => (
    <div data-testid={testId || 'mock-select'}>
      <select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid={testId ? `${testId}-native` : 'select-native'}>
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

// Mock results components to simplify assertions
vi.mock('../QuoteResultsList', () => ({
  QuoteResultsList: () => <div data-testid="quote-results-list">Results</div>,
}));
vi.mock('../QuoteComparisonView', () => ({
  QuoteComparisonView: () => <div data-testid="quote-comparison-view">Compare</div>,
}));

// Cargo and Location inputs simplified
vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
  SharedCargoInput: ({ value, onChange }: any) => (
    <div>
      <input data-testid="cargo-description" value={value?.description || ''} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      <input
        data-testid="cargo-weight"
        value={value?.weight?.value || ''}
        onChange={(e) => onChange({ ...value, weight: { value: e.target.value, unit: 'kg' } })}
      />
    </div>
  ),
}));
vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, placeholder, 'data-testid': testId }: any) => (
    <input
      data-testid={testId || `location-${placeholder}`}
      value={value || ''}
      onChange={(e) =>
        onChange(e.target.value, {
          code: e.target.value,
          name: e.target.value,
          location_code: e.target.value,
          location_name: e.target.value,
          city: 'City',
          country: 'Country',
        })
      }
      placeholder={placeholder}
    />
  ),
}));

// Toast spy
const toastSpy = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

// Debug logs no-op
vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({ log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Quote mapping stable
vi.mock('@/lib/quote-mapper', () => ({
  mapOptionToQuote: vi.fn((opt) => ({
    ...opt,
    option_name: 'Standard Service',
    total_amount: opt.total_amount ?? 1200,
    currency: 'USD',
    transit_time: { details: '3 days' },
    legs: [],
    charges: [],
    total_co2_kg: 11,
  })),
}));

// Pricing service calc stub
vi.mock('@/services/pricing.service', () => ({
  PricingService: class {
    calculateFinancials = vi.fn().mockResolvedValue({
      buyPrice: 900,
      marginAmount: 300,
      marginPercent: 25,
    });
  },
}));

// Stable supabase mocks (hoisted)
const mocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((cb: any) => cb({ data: [], error: null })),
  };
  const from = vi.fn(() => chain);
  const invoke = vi.fn();
  const mockSupabase = {
    from,
    functions: { invoke },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  };
  return { chain, from, invoke, mockSupabase };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: mocks.mockSupabase,
    context: { tenantId: 'test-tenant' },
    crmData: {},
  }),
}));

describe('QuickQuote submission flows', () => {
  beforeEach(() => {
    queryClient.clear();
    toastSpy.mockReset();
    mocks.invoke.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits and renders results when edge function succeeds', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        options: [
          {
            id: 'rate-1',
            carrier_name: 'Carrier A',
            total_amount: 1000,
            currency: 'USD',
            transit_time: { details: '2 days' },
            legs: [],
            charges: [],
          },
        ],
      },
      error: null,
    });

    // AI success fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            options: [],
            market_analysis: null,
            confidence_score: null,
            anomalies: [],
          }),
        text: () => Promise.resolve(''),
      })
    ) as any;

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <QuickQuoteModal>
            <button>Open Quote</button>
          </QuickQuoteModal>
        </BrowserRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByText('Open Quote'));
    await waitFor(() => {
      expect(screen.getByText('Quick Quote & AI Analysis')).toBeInTheDocument();
    });

    // Fill minimal fields (Air)
    fireEvent.click(screen.getByRole('tab', { name: /Air/i }));
    fireEvent.change(screen.getByTestId('location-origin'), { target: { value: 'JFK' } });
    fireEvent.change(screen.getByTestId('location-destination'), { target: { value: 'LHR' } });
    fireEvent.change(screen.getByTestId('cargo-description'), { target: { value: 'Electronics' } });
    fireEvent.change(screen.getByTestId('cargo-weight'), { target: { value: '100' } });

    fireEvent.click(screen.getByTestId('generate-quote-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
    });
  });

  it('falls back to simulation when edge function fails and shows toast', async () => {
    mocks.invoke.mockResolvedValue({
      data: { options: [] },
      error: { message: 'Function failed' },
    });

    // AI disabled by returning no options but still ok
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ options: [] }),
        text: () => Promise.resolve(''),
      })
    ) as any;

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <QuickQuoteModal>
            <button>Open Quote</button>
          </QuickQuoteModal>
        </BrowserRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByText('Open Quote'));
    await waitFor(() => {
      expect(screen.getByText('Quick Quote & AI Analysis')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Air/i }));
    fireEvent.change(screen.getByTestId('location-origin'), { target: { value: 'JFK' } });
    fireEvent.change(screen.getByTestId('location-destination'), { target: { value: 'LHR' } });
    fireEvent.change(screen.getByTestId('cargo-description'), { target: { value: 'Electronics' } });
    fireEvent.change(screen.getByTestId('cargo-weight'), { target: { value: '100' } });

    fireEvent.click(screen.getByTestId('generate-quote-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
    });
    expect(toastSpy).toHaveBeenCalled();
  });

  it('shows AI error toast when advisor fails', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        options: [
          {
            id: 'rate-1',
            carrier_name: 'Carrier A',
            total_amount: 1000,
            currency: 'USD',
            transit_time: { details: '2 days' },
            legs: [],
            charges: [],
          },
        ],
      },
      error: null,
    });

    // AI advisor failure
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'AI error' }),
        text: () => Promise.resolve('AI error'),
      })
    ) as any;

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <QuickQuoteModal>
            <button>Open Quote</button>
          </QuickQuoteModal>
        </BrowserRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByText('Open Quote'));
    await waitFor(() => {
      expect(screen.getByText('Quick Quote & AI Analysis')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Air/i }));
    fireEvent.change(screen.getByTestId('location-origin'), { target: { value: 'JFK' } });
    fireEvent.change(screen.getByTestId('location-destination'), { target: { value: 'LHR' } });
    fireEvent.change(screen.getByTestId('cargo-description'), { target: { value: 'Electronics' } });
    fireEvent.change(screen.getByTestId('cargo-weight'), { target: { value: '100' } });

    fireEvent.click(screen.getByTestId('generate-quote-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
    });
    expect(toastSpy).toHaveBeenCalled();
  });
});

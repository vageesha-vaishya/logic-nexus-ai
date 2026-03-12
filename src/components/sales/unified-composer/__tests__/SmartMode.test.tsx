import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { MemoryRouter } from 'react-router-dom';

// Mocks
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            single: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    },
    context: { tenantId: 'test-tenant' },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { role: 'sales_manager' },
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useQuoteStore', () => ({
  useQuoteStore: () => ({
    state: {},
    dispatch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() }),
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({}),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: [],
    loading: false,
  }),
}));

// Mock useRateFetching to control results
const mockFetchRates = vi.fn();
const mockRateResults = [
  {
    id: 'rate-1',
    carrier: 'Maersk',
    price: 1000,
    currency: 'USD',
    transitTime: '20 days',
    source_attribution: 'Standard Rate Engine',
  },
  {
    id: 'rate-2',
    carrier: 'MSC',
    price: 1200,
    currency: 'USD',
    transitTime: '18 days',
    source_attribution: 'Standard Rate Engine',
  },
];

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: mockRateResults,
    loading: false,
    fetchRates: mockFetchRates,
    clearResults: vi.fn(),
    marketAnalysis: 'AI Analysis Content',
    confidenceScore: 85,
  }),
}));

// Mock child components to avoid deep rendering issues
vi.mock('@/components/sales/shared/QuoteResultsList', () => ({
  QuoteResultsList: ({ results }: any) => (
    <div data-testid="quote-results-list">
      <div data-testid="results-count">{results.length}</div>
      {results.map((r: any) => (
        <div key={r.id} data-testid={`result-item-${r.id}`}>{r.carrier}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/sales/shared/AiMarketAnalysis', () => ({
  AiMarketAnalysis: ({ analysis }: any) => (
    <div data-testid="ai-market-analysis">{analysis}</div>
  ),
}));

// Mock QuotationConfigurationService
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({
    multi_option_enabled: true,
    default_module: 'composer'
  });
  return { QuotationConfigurationService: MockService };
});

// Mock FormZone to trigger search
vi.mock('../FormZone', () => ({
  FormZone: ({ onGetRates }: any) => (
    <div data-testid="form-zone">
      <button
        onClick={() => onGetRates({ mode: 'ocean', origin: 'Shanghai', destination: 'Hamburg' }, {}, false)}
        data-testid="get-rates-btn"
      >
        Get Rates
      </button>
      <button
        onClick={() => onGetRates({ mode: 'ocean', origin: 'Shanghai', destination: 'Hamburg' }, {}, true)}
        data-testid="get-smart-rates-btn"
      >
        Get Smart Rates
      </button>
    </div>
  ),
}));

describe('UnifiedQuoteComposer - Smart Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

it('Standard Mode: Opens manual composer without selecting market rates', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer />
      </MemoryRouter>
    );

    // Click "Get Rates" (Standard)
    fireEvent.click(screen.getByTestId('get-rates-btn'));

    // Wait for results to appear
    await waitFor(() => {
        expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    expect(mockFetchRates).not.toHaveBeenCalled();
    expect(screen.queryByTestId('result-item-rate-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-item-rate-2')).not.toBeInTheDocument();
  });

it('Smart Mode: Requests AI rates without auto-selecting market options', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer />
      </MemoryRouter>
    );

    // Click "Get Smart Rates"
    fireEvent.click(screen.getByTestId('get-smart-rates-btn'));

    await waitFor(() => {
      expect(mockFetchRates).toHaveBeenCalledWith(
        expect.objectContaining({
          smartMode: true,
          origin: 'Shanghai',
          destination: 'Hamburg',
        }),
        expect.any(Object)
      );
    });

    expect(screen.getByRole('tab', { name: 'General Information' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('quote-results-list')).not.toBeInTheDocument();
  });
});

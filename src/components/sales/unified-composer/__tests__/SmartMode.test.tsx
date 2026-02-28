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
    marketAnalysis: 'AI Analysis Content',
    confidenceScore: 85,
  }),
}));

// Mock child components to avoid deep rendering issues
vi.mock('@/components/sales/shared/QuoteResultsList', () => ({
  QuoteResultsList: ({ results }: any) => (
    <div data-testid="quote-results-list">
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
      <button onClick={() => onGetRates({}, {}, false)} data-testid="get-rates-btn">Get Rates</button>
      <button onClick={() => onGetRates({}, {}, true)} data-testid="get-smart-rates-btn">Get Smart Rates</button>
    </div>
  ),
}));

describe('UnifiedQuoteComposer - Smart Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Standard Mode: Selects default option', async () => {
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
    
    // Should show rate-1 (default selected)
    expect(screen.getByTestId('result-item-rate-1')).toBeInTheDocument();
    // rate-2 should be hidden from main list
    expect(screen.queryByTestId('result-item-rate-2')).not.toBeInTheDocument();
  });

  it('Smart Mode: Does NOT select default option, shows analysis', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer />
      </MemoryRouter>
    );

    // Click "Get Smart Rates"
    fireEvent.click(screen.getByTestId('get-smart-rates-btn'));

    // Wait for analysis to appear
    await waitFor(() => {
        expect(screen.getByTestId('ai-market-analysis')).toBeInTheDocument();
    });

    // Should NOT show any selected options in main list
    expect(screen.queryByTestId('quote-results-list')).not.toBeInTheDocument();
    
    // Should show Available Rates
    expect(screen.getByText('Available Market Rates')).toBeInTheDocument();
  });
});

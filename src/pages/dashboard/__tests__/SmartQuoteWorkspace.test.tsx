import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SmartQuoteWorkspace from '../SmartQuoteWorkspace';
import { useRateFetching } from '@/hooks/useRateFetching';

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { functions: { invoke: vi.fn() }, from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }), auth: { getUser: () => Promise.resolve({ data: { user: null } }) } },
    context: { tenantId: 'tenant-1' },
    scopedDb: { from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) },
  }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }) }),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>
}));

const defaultRateFetchingResult = {
  results: null as any,
  loading: false,
  error: null,
  marketAnalysis: null,
  confidenceScore: null,
  anomalies: [] as string[],
  fetchRates: vi.fn().mockResolvedValue([]),
  clearResults: vi.fn(),
};

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: vi.fn(),
}));

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, placeholder }: any) => (
    <input
      aria-label={placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/quotation/shared/QuoteResultsList', () => ({
  QuoteResultsList: ({ results }: any) => (
    <div data-testid="quote-results-list">List view: {results.length} options</div>
  ),
}));

vi.mock('@/components/quotation/shared/QuoteComparisonView', () => ({
  QuoteComparisonView: ({ options }: any) => (
    <div data-testid="quote-comparison-view">Compare view: {options.length} options</div>
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
        <SmartQuoteWorkspace />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SmartQuoteWorkspace', () => {
  beforeEach(() => {
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      fetchRates: vi.fn().mockResolvedValue([]),
      clearResults: vi.fn(),
    });
  });

  it('renders the Smart Quote form and an empty results placeholder', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
          <SmartQuoteWorkspace />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole('heading', { name: /smart quote/i })).toBeInTheDocument();
    expect(screen.getByText(/fill out the form to generate quotes/i)).toBeInTheDocument();
  });

  it('lets the user pick a transport mode and enter origin/destination', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
          <SmartQuoteWorkspace />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(getByText('Ocean')).toBeInTheDocument();
    expect(getByText('Air')).toBeInTheDocument();
  });

  it('calls fetchRates with the derived shared payload when Generate is clicked', async () => {
    const fetchRates = vi.fn().mockResolvedValue([]);
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      fetchRates,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText('Origin port, airport, or city'), {
      target: { value: 'Los Angeles' },
    });
    fireEvent.change(screen.getByLabelText('Destination port, airport, or city'), {
      target: { value: 'Shanghai' },
    });

    fireEvent.click(screen.getByRole('button', { name: /generate smart quotes/i }));

    await waitFor(() => expect(fetchRates).toHaveBeenCalledTimes(1));

    const [payload, containerResolver] = fetchRates.mock.calls[0];
    expect(payload).toMatchObject({
      mode: 'ocean',
      origin: 'Los Angeles',
      destination: 'Shanghai',
      commodity: '',
      weight: '0',
      dangerousGoods: false,
      smartMode: true,
    });
    expect(Array.isArray(payload.containerCombos)).toBe(true);
    expect(containerResolver).toHaveProperty('resolveContainerInfo');
  });

  it('renders the results panel with a List/Compare toggle once rate options are available', async () => {
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      results: [{ id: 'opt-1' }, { id: 'opt-2' }] as any,
    });

    renderPage();

    expect(screen.getByText(/^2 options$/i)).toBeInTheDocument();
    expect(screen.getByTestId('quote-results-list')).toHaveTextContent('List view: 2 options');
    expect(screen.queryByTestId('quote-comparison-view')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByTestId('quote-comparison-view')).toHaveTextContent('Compare view: 2 options');
    });
  });
});

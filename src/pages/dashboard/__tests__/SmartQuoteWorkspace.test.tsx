import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  error: null as string | null,
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult });
  });

  it('renders the Smart Quote form and an empty results placeholder', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /smart quote/i })).toBeInTheDocument();
    expect(screen.getByText(/fill out the form to generate quotes/i)).toBeInTheDocument();
  });

  it('lets the user pick a transport mode and enter origin/destination', async () => {
    renderPage();
    expect(screen.getByText('Ocean')).toBeInTheDocument();
    expect(screen.getByText('Air')).toBeInTheDocument();
  });

  it('calls fetchRates with the derived shared payload when Generate is clicked', async () => {
    const fetchRates = vi.fn().mockResolvedValue([]);
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult, fetchRates });

    renderPage();

    fireEvent.change(screen.getByLabelText('Origin port, airport, or city'), { target: { value: 'Los Angeles' } });
    fireEvent.change(screen.getByLabelText('Destination port, airport, or city'), { target: { value: 'Shanghai' } });
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

  it('shows the shipment recap strip once origin and destination are both filled', () => {
    renderPage();
    expect(screen.queryByTestId('shipment-recap-strip')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Origin port, airport, or city'), { target: { value: 'CNSHA' } });
    fireEvent.change(screen.getByLabelText('Destination port, airport, or city'), { target: { value: 'USLAX' } });

    expect(screen.getByTestId('shipment-recap-strip')).toBeInTheDocument();
  });

  it('shows a loading state in the results panel while a request is in flight', () => {
    // Regex is scoped to "ranking carriers" (the results-panel copy), not a broader
    // /generating|ranking/ pattern — the Generate button also reads "Generating..." while
    // loading, and a broader pattern would match both elements and make getByText throw.
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult, loading: true });
    renderPage();
    expect(screen.getByText(/ranking carriers/i)).toBeInTheDocument();
  });

  it('shows an inline error state in the results panel when the fetch fails', () => {
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult, error: 'No quotes available.' });
    renderPage();
    expect(screen.getByText('No quotes available.')).toBeInTheDocument();
  });

  it('renders a SmartQuoteRateCard per result once options are available, with no Browse/Compare tabs', async () => {
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      results: [
        { id: 'opt-1', carrier: 'Carrier One', price: 100, currency: 'USD', transitTime: '10 days', tier: 'cheapest' },
        { id: 'opt-2', carrier: 'Carrier Two', price: 200, currency: 'USD', transitTime: '5 days', tier: 'fastest' },
      ] as any,
    });

    renderPage();

    expect(screen.getByTestId('smart-quote-rate-card-opt-1')).toBeInTheDocument();
    expect(screen.getByTestId('smart-quote-rate-card-opt-2')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /compare/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /browse/i })).not.toBeInTheDocument();
  });
});

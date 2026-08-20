import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import SmartQuoteWorkspace from '../SmartQuoteWorkspace';
import { useRateFetching } from '@/hooks/useRateFetching';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      functions: { invoke: vi.fn() },
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }),
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    },
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
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: vi.fn(),
}));

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, placeholder }: any) => (
    <input aria-label={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const OPTION_WITH_LEG_CHARGES = {
  id: 'opt-1',
  carrier: 'Maersk',
  price: 1200,
  currency: 'USD',
  legs: [
    {
      id: 'leg-1',
      mode: 'ocean',
      carrier: 'Maersk',
      origin: 'CNSHA',
      destination: 'USLAX',
      // NOT part of RateLegSchema — Zod strips it on .parse(), which is exactly what Critical #2 was.
      charges: [
        { code: 'OFR', description: 'Ocean Freight', amount: 900, currency: 'USD' },
        { code: 'THC', description: 'Terminal Handling', amount: 300, currency: 'USD' },
      ],
    },
  ],
};

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

async function fillRoute() {
  fireEvent.change(screen.getByLabelText('Origin port, airport, or city'), { target: { value: 'CNSHA' } });
  fireEvent.change(screen.getByLabelText('Destination port, airport, or city'), { target: { value: 'USLAX' } });
}

describe('SmartQuoteWorkspace hand-off payload', () => {
  it('produces a payload that satisfies QuoteTransferSchema', () => {
    const formValues = { mode: 'ocean', origin: 'CNSHA', destination: 'USLAX', commodity: 'General Cargo' };
    // originDetails/destinationDetails are omitted here (rather than passed as null) because
    // QuoteTransferSchema's LocationDetailsSchema is `.optional()` but not `.nullable()`. The real
    // handler normalizes deriveSharedPayload's `null` defaults to `undefined` before validating —
    // see the null-coalescing on originDetails/destinationDetails in handleConvertToQuote.
    const extendedData = { containerType: 'dry', containerSize: '20ft', containerQty: '1', htsCode: '', dangerousGoods: false, specialHandling: '', vehicleType: 'van', pickupDate: '', deliveryDeadline: '' };
    const selectedOption = { id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD' };

    const transferPayload = {
      ...formValues,
      ...extendedData,
      containerCombos: [{ type: 'dry', size: '20ft', qty: 1 }],
      selectedRates: [selectedOption],
    };

    expect(() => QuoteTransferSchema.parse(transferPayload)).not.toThrow();
  });

  it('documents that QuoteTransferSchema.parse() strips leg-level charges (why the raw array is navigated)', () => {
    const parsed = QuoteTransferSchema.parse({
      origin: 'CNSHA',
      destination: 'USLAX',
      mode: 'ocean',
      selectedRates: [OPTION_WITH_LEG_CHARGES],
    });

    // Guard rail: if this ever starts passing `charges` through, the fix in handleConvertToQuote can
    // be simplified — but until then, navigating with parsed output would lose the financials.
    expect((parsed.selectedRates[0].legs as any)[0].charges).toBeUndefined();
  });
});

describe('SmartQuoteWorkspace navigation state (Critical #2 regression)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      results: [OPTION_WITH_LEG_CHARGES] as any,
    });
  });

  it('navigates with the RAW selected rate so leg-level charges survive the hand-off', async () => {
    renderPage();
    await fillRoute();

    fireEvent.click(within(screen.getByTestId('smart-quote-rate-card-opt-1')).getByRole('button', { name: /^select$/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));

    const [path, options] = navigateMock.mock.calls[0];
    expect(path).toBe('/dashboard/quotes/new');

    const state = options.state;
    expect(state.selectedRates).toHaveLength(1);
    expect(state.selectedRates[0].legs[0].charges).toEqual([
      { code: 'OFR', description: 'Ocean Freight', amount: 900, currency: 'USD' },
      { code: 'THC', description: 'Terminal Handling', amount: 300, currency: 'USD' },
    ]);
    // selectedRate (singular) and selectedRates (plural) must agree — the composer reads the plural.
    expect(state.selectedRate).toBe(state.selectedRates[0]);
    // The validated (schema-parsed) fields still come through.
    expect(state).toMatchObject({ origin: 'CNSHA', destination: 'USLAX', mode: 'ocean' });
  });

  it('degrades gracefully instead of blocking the hand-off when AI metadata is malformed', async () => {
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      results: [OPTION_WITH_LEG_CHARGES] as any,
      // Shapes QuoteTransferSchema would reject outright if passed through unsanitized.
      marketAnalysis: { text: 'not a string' } as any,
      confidenceScore: 'high' as any,
      anomalies: [{ kind: 'object-not-string' }] as any,
    });

    renderPage();
    await fillRoute();

    fireEvent.click(within(screen.getByTestId('smart-quote-rate-card-opt-1')).getByRole('button', { name: /^select$/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const state = navigateMock.mock.calls[0][1].state;
    expect(state.marketAnalysis).toBeNull();
    expect(state.confidenceScore).toBeNull();
    expect(state.anomalies).toEqual([]);
    expect(state.selectedRates[0].legs[0].charges).toHaveLength(2);
  });
});

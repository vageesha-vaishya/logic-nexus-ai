/**
 * Regression coverage for Critical #1 of the Smart Quote whole-branch review.
 *
 * QuoteNew.createQuoteShell() calls setSearchParams() to put ?id=<quoteId> in the URL. React Router
 * v6 navigates with `state: null` when setSearchParams is called without a second argument, so
 * location.state is destroyed *before* setInitializing(false) lets UnifiedQuoteComposer mount.
 * Reading location.state directly for initialData therefore always produced undefined by the time
 * the composer could consume it, silently killing the whole Smart Quote hand-off.
 *
 * The existing QuoteNewIntegration.test.tsx cannot catch this: its scopedDb mock has no `insert`,
 * so createQuoteShell throws before it ever reaches setSearchParams. This suite deliberately mocks
 * a *successful* shell creation so the setSearchParams navigation actually happens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteNew from '../QuoteNew';

const MockUnifiedComposer = vi.fn((_props: any) => <div data-testid="mock-unified-composer">Unified Composer</div>);
vi.mock('@/components/quotation/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: (props: any) => MockUnifiedComposer(props),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

function makeScopedDb() {
  return {
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { quote_number: 'Q-0001' }, error: null }) }),
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
      }),
      insert: (_row: any) => ({
        select: (_cols?: string) => ({
          single: () =>
            Promise.resolve(
              table === 'quotes'
                ? { data: { id: 'quote-1', quote_number: 'Q-0001' }, error: null }
                : { data: { id: 'version-1' }, error: null }
            ),
        }),
      }),
    }),
  };
}

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', user_metadata: { tenant_id: 'test-tenant' } } } }) },
      from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
      channel: () => ({ on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }), unsubscribe: () => ({}) }),
      removeChannel: vi.fn(),
    },
    context: { tenantId: 'test-tenant' },
    scopedDb: makeScopedDb(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    getConfiguration = vi.fn().mockResolvedValue({ default_module: 'unified' });
  },
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

const SMART_QUOTE_STATE = {
  origin: 'CNSHA',
  destination: 'USLAX',
  mode: 'ocean',
  commodity: 'General Cargo',
  containerCombos: [{ type: 'ct-1', size: 'cs-1', qty: 2 }],
  selectedRates: [
    {
      id: 'opt-1',
      carrier: 'Maersk',
      price: 1200,
      currency: 'USD',
      legs: [{ id: 'leg-1', carrier: 'Maersk', charges: [{ code: 'OFR', amount: 900 }] }],
    },
  ],
};

function renderQuoteNew() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: SMART_QUOTE_STATE }]}>
      <Routes>
        <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
      </Routes>
    </MemoryRouter>
  );
}

function composerCalls() {
  return MockUnifiedComposer.mock.calls.map((call) => call[0] as any);
}

describe('QuoteNew arrival-state snapshot (Critical #1 regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still passes initialData to the composer after createQuoteShell runs setSearchParams', async () => {
    renderQuoteNew();

    // Wait until the quote shell has been created and the ?id= navigation has happened.
    await waitFor(() => {
      expect(MockUnifiedComposer).toHaveBeenCalled();
      expect(composerCalls()[composerCalls().length - 1].quoteId).toBe('quote-1');
    });

    const lastProps = composerCalls()[composerCalls().length - 1];
    expect(lastProps.initialData).toBeDefined();
    expect(lastProps.initialData).toMatchObject({
      origin: 'CNSHA',
      destination: 'USLAX',
      mode: 'ocean',
    });
    // The hand-off payload — including leg-level charges — must survive the state-wiping navigation.
    expect(lastProps.initialData.selectedRates).toHaveLength(1);
    expect(lastProps.initialData.selectedRates[0].legs[0].charges).toEqual([{ code: 'OFR', amount: 900 }]);
    expect(lastProps.initialData.containerCombos).toEqual([{ type: 'ct-1', size: 'cs-1', qty: 2 }]);
  });

  it('keeps initialData referentially stable across re-renders (Important #3)', async () => {
    const { rerender } = renderQuoteNew();

    await waitFor(() => {
      expect(MockUnifiedComposer).toHaveBeenCalled();
      expect(composerCalls()[composerCalls().length - 1].quoteId).toBe('quote-1');
    });

    // Force a parent re-render that has nothing to do with the arrival state.
    rerender(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: SMART_QUOTE_STATE }]}>
        <Routes>
          <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
        </Routes>
      </MemoryRouter>
    );

    const identities = composerCalls().map((props) => props.initialData);
    expect(identities.length).toBeGreaterThan(1);
    expect(identities[0]).toBeDefined();
    // A new object identity on every render would re-fire the composer's pre-population effect
    // (deps: [initialData, form]), whose form.reset() would revert the user's in-progress edits.
    expect(new Set(identities).size).toBe(1);
  });
});

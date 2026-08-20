import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// ---------------------------------------------------------------------------
// Module mocks (copied from the boilerplate in UnifiedQuoteComposer.test.tsx,
// these override the global mocks from test/setup.ts)
// ---------------------------------------------------------------------------

// A scopedDb that resolves `quotes` lookups to a realistic freshly-created
// "shell" row — i.e. exactly what QuoteNew.tsx inserts before it hands the new
// quoteId to the composer: origin/destination/mode are written, but every
// cargo-detail column is still empty and there is no version/option data yet.
// The global test/setup.ts mock resolves every maybeSingle() to null, which
// would make loadExistingQuote bail out early and hide the bug under test.
const { scopedDbFromCalls, scopedDbMock } = vi.hoisted(() => {
  const scopedDbFromCalls: string[] = [];
  const shellQuoteRow: Record<string, unknown> = {
    id: 'shell-quote-1',
    quote_number: 'QT-SHELL-0001',
    tenant_id: 'test-tenant-id',
    franchise_id: null,
    status: 'draft',
    transport_mode: 'ocean',
    origin: 'CNSHA',
    destination: 'USLAX',
    origin_port_id: null,
    destination_port_id: null,
    current_version_id: null,
    cargo_details: null,
    billing_address: null,
    account_id: null,
    contact_id: null,
    opportunity_id: null,
    title: null,
    incoterms: null,
    dangerous_goods: null,
    vehicle_type: null,
    total_weight: null,
    total_volume: null,
    commodity: null,
  };

  const makeChain = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'in', 'is', 'or', 'order', 'limit', 'range', 'abortSignal',
    ]) {
      chain[method] = vi.fn(() => chain);
    }
    const row = table === 'quotes' ? shellQuoteRow : null;
    chain.single = vi.fn(async () => ({ data: row, error: null }));
    chain.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
    // Thenable so `await scopedDb.from(t).select().eq()` yields a list result,
    // which is how loadExistingQuote fetches cargo configs / items / docs /
    // versions. All empty: a fresh shell has no child rows.
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return chain;
  };

  return {
    scopedDbFromCalls,
    scopedDbMock: {
      from: vi.fn((table: string) => {
        scopedDbFromCalls.push(table);
        return makeChain(table);
      }),
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    context: {
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      franchiseId: null,
      isPlatformAdmin: false,
      isTenantAdmin: false,
      adminOverrideEnabled: false,
    },
    scopedDb: scopedDbMock,
    supabase: scopedDbMock,
    preferences: { tenant_id: 'test-tenant-id', franchise_id: null, admin_override_enabled: false },
    loadingPreferences: false,
    setScopePreference: vi.fn().mockResolvedValue(undefined),
    setAdminOverride: vi.fn().mockResolvedValue(undefined),
    setFranchisePreference: vi.fn().mockResolvedValue(undefined),
  }),
  CRMProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: null,
    loading: false,
    error: null,
    fetchRates: vi.fn(),
    clearResults: vi.fn(),
    marketAnalysis: null,
    confidenceScore: null,
    anomalies: [],
  }),
}));

vi.mock('@/hooks/useDraftAutoSave', () => ({
  useDraftAutoSave: () => ({ lastSaved: null, isSavingDraft: false }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockDispatch = vi.fn();

vi.mock('@/components/quotation/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteStore: () => ({
    state: {
      quoteId: null,
      versionId: null,
      optionId: null,
      tenantId: 'test-tenant-id',
      quoteData: null,
      legs: [],
      charges: [],
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock('@/components/quotation/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    chargeCategories: [{ id: 'cat-1', code: 'freight', name: 'Freight' }],
    chargeBases: [{ id: 'basis-1', code: 'shipment', name: 'Per Shipment' }],
    currencies: [{ id: 'cur-1', code: 'USD', name: 'USD' }],
    chargeSides: [{ id: 'side-1', code: 'buy', name: 'Buy' }],
    serviceTypes: [],
    services: [],
    carriers: [],
    ports: [],
    shippingTerms: [],
    serviceModes: [],
    tradeDirections: [],
    serviceLegCategories: [],
    containerTypes: [],
    containerSizes: [],
    accounts: [],
    contacts: [],
    opportunities: [],
  }),
}));

// `initialExtended` is serialised too (it's a real prop, passed at
// UnifiedQuoteComposer.tsx:4056) so the reload-clobber test below can assert on
// the cargo-detail fields the Smart Quote hand-off prefills.
vi.mock('@/components/quotation/unified-composer/FormZone', () => ({
  FormZone: (props: any) => (
    <div
      data-testid="form-zone"
      data-initial-values={JSON.stringify(props.initialValues || null)}
      data-initial-extended={JSON.stringify(props.initialExtended || null)}
    >
      FormZone
    </div>
  ),
}));

// Unlike the base test file's trivial mock, this one renders the `results`
// and `selectedOptionId` props so we can assert that the Smart Quote hand-off
// actually populated manualOptions (and therefore combinedResults/displayResults)
// with the selected rate, AND that the rate is actually selected (not merely
// visible) — selectedOptionId is a real prop passed at UnifiedQuoteComposer.tsx:4088.
vi.mock('@/components/quotation/unified-composer/ResultsZone', () => ({
  ResultsZone: (props: any) => (
    <div data-testid="results-zone" data-selected-option-id={props.selectedOptionId || ''}>
      {(props.results || []).map((opt: any) => (
        <div key={opt.id}>{opt.carrier}</div>
      ))}
    </div>
  ),
}));

// FinalizeSection only renders when selectedOption is truthy
// (UnifiedQuoteComposer.tsx:4091-4108), so asserting its presence is part of
// verifying the hand-off actually selects the option, not just lists it.
vi.mock('@/components/quotation/unified-composer/FinalizeSection', () => ({
  FinalizeSection: (props: any) => (
    <div data-testid="finalize-section" data-selected-option-id={props.selectedOption?.id || ''}>
      FinalizeSection
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedQuoteComposer Smart Quote hand-off', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopedDbFromCalls.length = 0;
  });

  // Lets every pending promise chain inside loadExistingQuote settle. All of its
  // awaits are microtask-based against the mocked scopedDb, so one macrotask
  // boundary drains the whole chain.
  const flushAsyncEffects = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const readInitialExtended = () =>
    JSON.parse(screen.getByTestId('form-zone').getAttribute('data-initial-extended') || 'null');

  // Radix Tabs unmounts the inactive "form" TabsContent, and the hand-off
  // switches straight to "results", so FormZone (and its serialised props) is
  // only reachable after navigating back.
  const openGeneralInformationTab = () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'General Information' }), { button: 0 });
  };

  it('pre-populates and SELECTS the rate (not merely lists it) and switches to the results tab when initialData.selectedRates is present', () => {
    const initialData = {
      mode: 'ocean',
      origin: 'CNSHA',
      destination: 'USLAX',
      commodity: 'General Cargo',
      selectedRates: [{ id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD', name: 'Best Value' }],
    };

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={initialData} />
      </MemoryRouter>
    );

    // Using getByRole('tab', ...) rather than getByText because the literal
    // "Quotation Composer" also renders as a button label elsewhere while
    // isSmartMode defaults true.
    expect(screen.getByRole('tab', { name: 'Quotation Composer' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Maersk')).toBeInTheDocument();

    // The rate must be actually SELECTED, not just visible in the results
    // list — that's what separates "the rate is visible" from "the rate is
    // selected and finalizable", which is the point of the hand-off.
    expect(screen.getByTestId('results-zone')).toHaveAttribute('data-selected-option-id', 'opt-1');
    expect(screen.getByTestId('finalize-section')).toBeInTheDocument();
    expect(screen.getByTestId('finalize-section')).toHaveAttribute('data-selected-option-id', 'opt-1');
  });

  it('does not switch tabs or populate options when initialData has no selectedRates', () => {
    const initialData = {
      mode: 'air',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      commodity: 'Electronics',
    };

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={initialData} />
      </MemoryRouter>
    );

    expect(screen.getByRole('tab', { name: 'General Information' })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByText('Maersk')).not.toBeInTheDocument();
    expect(screen.queryByTestId('finalize-section')).not.toBeInTheDocument();
  });

  it('does not re-clobber user edits when the parent re-renders with a new (but equivalent) initialData object reference', () => {
    // QuoteNew.tsx rebuilds `initialData` as a fresh object literal on every
    // render. The pre-population effect's deps are [initialData, form], so it
    // re-runs on every such re-render. This test guards against the
    // destructive statements (setManualOptions/setSelectedOption/
    // setActiveComposerSection) re-firing and undoing user navigation.
    const buildInitialData = () => ({
      mode: 'ocean',
      origin: 'CNSHA',
      destination: 'USLAX',
      commodity: 'General Cargo',
      selectedRates: [{ id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD', name: 'Best Value' }],
    });

    const { rerender } = render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={buildInitialData()} />
      </MemoryRouter>
    );

    // Starts on the results tab per the hand-off pre-population.
    expect(screen.getByRole('tab', { name: 'Quotation Composer' })).toHaveAttribute('data-state', 'active');

    // User navigates back to General Information. Radix Tabs activates on
    // mousedown (see @radix-ui/react-tabs TriggerImpl), not click, so we fire
    // that event directly rather than pulling in userEvent for a single
    // interaction.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'General Information' }), { button: 0 });
    expect(screen.getByRole('tab', { name: 'General Information' })).toHaveAttribute('data-state', 'active');

    // Parent re-renders with a brand-new `initialData` object (same shape and
    // content, different reference) — e.g. QuoteNew re-rendering because the
    // user typed into an unrelated field.
    rerender(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={buildInitialData()} />
      </MemoryRouter>
    );

    // The re-run of the effect must NOT snap the tab back to results.
    expect(screen.getByRole('tab', { name: 'General Information' })).toHaveAttribute('data-state', 'active');
  });

  // -------------------------------------------------------------------------
  // Regression: the shell-quote reload must not wipe the hand-off prefill.
  //
  // Real-app sequence QuoteNew.tsx produces (verified by reading QuoteNew.tsx):
  //   1. QuoteNew renders an "Initializing..." spinner while `initializing` is
  //      true; UnifiedQuoteComposer is NOT mounted yet.
  //   2. createQuoteShell() inserts the shell row and calls
  //      setCreatedQuoteId(quoteId); only afterwards does its `finally` block
  //      call setInitializing(false).
  //   3. QuoteNew re-renders with initializing === false and mounts the
  //      composer for the FIRST time with BOTH `quoteId` (the shell id) and
  //      `initialData` (the mount-time snapshot of location.state) present
  //      together on that single first render.
  //   4. On that mount the quoteId effect (declared *before* the hand-off
  //      prefill effect) would fire loadExistingQuote(), which reloads the
  //      shell row — whose cargo columns are all still empty — and
  //      unconditionally calls form.reset()/setInitialExtended() with them.
  // Origin/destination/mode survived because QuoteNew persists them in the
  // shell INSERT; the cargo details did not, because they only ever existed in
  // local state.
  //
  // There is NO "mount without quoteId, then quoteId arrives later" phase: the
  // composer is never rendered while `initializing` is true. Any test that
  // simulates that two-phase sequence lets the prefill effect run in an earlier
  // render pass and therefore cannot detect a guard that reads state the prefill
  // effect has not written yet.
  // -------------------------------------------------------------------------

  const buildHandOffInitialData = () => ({
    mode: 'ocean',
    origin: 'CNSHA',
    destination: 'USLAX',
    commodity: 'Lithium Batteries',
    weight: 12000,
    volume: 58,
    htsCode: '8507.60',
    incoterms: 'FOB',
    dangerousGoods: true,
    containerType: 'dry',
    containerSize: '40HC',
    containerQty: '2',
    containerCombos: [{ type: 'dry', size: '40HC', qty: 2 }],
    selectedRates: [{ id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD', name: 'Best Value' }],
  });

  it('does not reload (and therefore does not wipe) the prefill when quoteId and the Smart Quote hand-off arrive together on the first mount', async () => {
    // The REAL QuoteNew.tsx sequence: a single mount carrying both props. No
    // prior render exists in which the hand-off effect could have already run.
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId="shell-quote-1" initialData={buildHandOffInitialData()} />
      </MemoryRouter>
    );
    await flushAsyncEffects();

    // (c) The composer must not be stuck on its `editLoading` early return.
    // `editLoading` initialises to !!quoteId and is only ever cleared inside
    // loadExistingQuote, so a guard that skips the reload without clearing it
    // would leave this spinner up forever.
    expect(screen.queryByText('Loading quote...')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quotation Composer' })).toBeInTheDocument();

    // (a) The reload must be skipped entirely — no `quotes` fetch at all.
    expect(scopedDbFromCalls).not.toContain('quotes');
    expect(scopedDbMock.from).not.toHaveBeenCalledWith('quotes');

    // (b) The prefilled cargo details must survive untouched.
    openGeneralInformationTab();
    expect(readInitialExtended()).toMatchObject({
      containerCombos: [{ type: 'dry', size: '40HC', qty: 2 }],
      containerType: 'dry',
      containerSize: '40HC',
      containerQty: '2',
      incoterms: 'FOB',
      htsCode: '8507.60',
      dangerousGoods: true,
    });

    // The selected rate must survive too: a fresh shell has no saved option
    // rows, so a reload would have had nothing to restore it with.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Quotation Composer' }), { button: 0 });
    expect(screen.getByTestId('results-zone')).toHaveAttribute('data-selected-option-id', 'opt-1');
    expect(screen.getByTestId('finalize-section')).toHaveAttribute('data-selected-option-id', 'opt-1');
  });

  it('keeps the hand-off prefill after the parent re-renders with a fresh initialData literal and the same quoteId', async () => {
    // QuoteNew re-renders for unrelated reasons (e.g. setVersionId resolving
    // after the shell INSERT). loadExistingQuote is a useCallback whose identity
    // can change, so the quoteId effect can re-fire — the guard must still hold.
    const { rerender } = render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId="shell-quote-1" initialData={buildHandOffInitialData()} />
      </MemoryRouter>
    );
    await flushAsyncEffects();

    rerender(
      <MemoryRouter>
        <UnifiedQuoteComposer
          quoteId="shell-quote-1"
          versionId="shell-version-1"
          initialData={buildHandOffInitialData()}
        />
      </MemoryRouter>
    );
    await flushAsyncEffects();

    expect(screen.queryByText('Loading quote...')).not.toBeInTheDocument();
    expect(scopedDbFromCalls).not.toContain('quotes');

    openGeneralInformationTab();
    expect(readInitialExtended()).toMatchObject({
      containerCombos: [{ type: 'dry', size: '40HC', qty: 2 }],
      incoterms: 'FOB',
      htsCode: '8507.60',
      dangerousGoods: true,
    });
  });

  it('still reloads the quote for the normal edit path (quoteId with no Smart Quote hand-off)', async () => {
    // The guard keys off the hand-off ref, which only flips when
    // initialData.selectedRates was present. Opening an existing quote to edit
    // passes no initialData at all, so the reload must still run — this also
    // covers the post-refresh case, where router location.state is gone.
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId="shell-quote-1" />
      </MemoryRouter>
    );
    await flushAsyncEffects();

    expect(scopedDbFromCalls).toContain('quotes');
    expect(scopedDbMock.from).toHaveBeenCalledWith('quotes');
  });
});

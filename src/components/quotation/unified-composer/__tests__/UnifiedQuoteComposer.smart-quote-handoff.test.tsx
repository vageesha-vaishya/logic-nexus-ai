import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// ---------------------------------------------------------------------------
// Module mocks (copied from the boilerplate in UnifiedQuoteComposer.test.tsx,
// these override the global mocks from test/setup.ts)
// ---------------------------------------------------------------------------

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

vi.mock('@/components/quotation/unified-composer/FormZone', () => ({
  FormZone: (props: any) => (
    <div data-testid="form-zone" data-initial-values={JSON.stringify(props.initialValues || null)}>
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
  });

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
});

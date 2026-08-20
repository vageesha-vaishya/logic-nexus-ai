import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
// prop so we can assert that the Smart Quote hand-off actually populated
// manualOptions (and therefore combinedResults/displayResults) with the
// selected rate.
vi.mock('@/components/quotation/unified-composer/ResultsZone', () => ({
  ResultsZone: (props: any) => (
    <div data-testid="results-zone">
      {(props.results || []).map((opt: any) => (
        <div key={opt.id}>{opt.carrier}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/quotation/unified-composer/FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedQuoteComposer Smart Quote hand-off', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-populates the selected rate and switches to the results tab when initialData.selectedRates is present', () => {
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

    expect(screen.getByText('Quotation Composer')).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Maersk')).toBeInTheDocument();
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

    expect(screen.getByText('General Information')).toHaveAttribute('data-state', 'active');
    expect(screen.queryByText('Maersk')).not.toBeInTheDocument();
  });
});

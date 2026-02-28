import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import React from 'react';

// Mock child components
vi.mock('../FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">FormZone</div>
}));

// Mock ResultsZone to expose the onAddManualOption prop
vi.mock('../ResultsZone', () => ({
  ResultsZone: ({ onAddManualOption, results }: any) => (
    <div data-testid="results-zone">
      <div data-testid="results-count">{results.length}</div>
      <div data-testid="has-add">{String(!!onAddManualOption)}</div>
      {onAddManualOption && (
        <button onClick={onAddManualOption} data-testid="add-manual-btn">Add Manual</button>
      )}
      <ul>
        {results.map((r: any) => (
          <li key={r.id} data-testid={`option-${r.id}`}>
            {r.carrier} - {r.is_manual ? 'Manual' : 'Auto'}
          </li>
        ))}
      </ul>
    </div>
  )
}));

vi.mock('../FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>
}));

vi.mock('../SmartModeSettings', () => ({
  SmartModeSettings: () => <div data-testid="smart-settings">SmartModeSettings</div>
}));

// Mock hooks
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [{ id: 'auto-1', carrier: 'Auto Carrier', is_manual: false }],
    loading: false,
    fetchRates: vi.fn(),
  })
}));

const mockScopedDb = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: {} }),
        maybeSingle: () => Promise.resolve({ data: { multi_option_enabled: true, auto_ranking_criteria: { cost: 0.4, transit_time: 0.3, reliability: 0.3 } } }),
      }),
      order: () => Promise.resolve({ data: [] }),
    }),
  }),
  rpc: () => Promise.resolve({ data: null, error: null }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'test-tenant' }
  })
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  useQuoteStore: () => ({
    state: { quoteData: null },
    dispatch: vi.fn()
  }),
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/hooks/useDraftAutoSave', () => ({
  useDraftAutoSave: () => ({ lastSaved: null })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() })
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] })
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
    chargeSides: [],
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
  })
}));

describe('UnifiedQuoteComposer - Manual Options', () => {
  it('allows adding manual options and combines them with auto results', async () => {
    render(<UnifiedQuoteComposer />);

    // Initially should show 1 auto result (from mock)
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    expect(screen.getByTestId('option-auto-1')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('has-add')).toHaveTextContent('true');
    });

    // Click add manual option
    const addBtn = screen.getByTestId('add-manual-btn');
    fireEvent.click(addBtn);

    // Should now have 2 results
    await waitFor(() => {
      expect(screen.getByTestId('results-count')).toHaveTextContent('2');
    });

    // Check for manual option
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent('Manual');
  });
});

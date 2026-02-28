import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QuotationOptionCrudService } from '@/services/quotation/QuotationOptionCrudService';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

// Mock useCRM
const { mockScopedDb } = vi.hoisted(() => {
  return {
    mockScopedDb: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn(),
    }
  };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'test-tenant' },
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } } }) },
      functions: { invoke: vi.fn() }
    },
  }),
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { id: 'test-profile' },
  }),
}));

// Mock Configuration Service
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({
    multi_option_enabled: true,
    auto_ranking_criteria: { cost: 0.4, transit_time: 0.3, reliability: 0.3 }
  });
  return { QuotationConfigurationService: MockService };
});

// Mock hooks
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useDraftAutoSave', () => ({
  useDraftAutoSave: () => ({ lastSaved: null, isSavingDraft: false }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// Mock useToast with a spy
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteStore: () => ({
    state: {
      quoteId: 'test-quote',
      versionId: 'test-version',
      optionId: null,
      tenantId: 'test-tenant-id',
      quoteData: null,
      legs: [],
      charges: [],
    },
    dispatch: vi.fn(),
  }),
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
  }),
}));

vi.mock('@/components/sales/unified-composer/FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">FormZone</div>,
}));

vi.mock('@/components/sales/unified-composer/FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

// Mock ResultsZone to expose onAddManualOption
vi.mock('@/components/sales/unified-composer/ResultsZone', () => ({
  ResultsZone: ({ onRemoveOption, onAddRateOption, onAddManualOption, results, availableOptions }: any) => (
    <div
      data-testid="results-zone"
      data-has-remove={String(!!onRemoveOption)}
    >
      <div data-testid="results-count">{results?.length || 0}</div>
      {(results || []).map((r: any) => (
        <div key={r.id} data-testid={`option-${r.id}`}>
          <span data-testid={`type-${r.id}`}>{r.is_manual ? 'Manual' : 'Auto'}</span>
          <button data-testid={`delete-${r.id}`} onClick={() => onRemoveOption(r.id)}>Delete</button>
        </div>
      ))}
      {onAddManualOption && (
        <button
          data-testid="add-manual-btn"
          onClick={onAddManualOption}
        >
          Add Manual Option
        </button>
      )}
    </div>
  ),
}));

// We need to control useRateFetching to provide initial options
const { rateFetchingStore } = vi.hoisted(() => {
  return {
    rateFetchingStore: {
      results: [] as any[]
    }
  };
});

const mockFetchRates = vi.fn();
const mockClearResults = vi.fn();

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: rateFetchingStore.results,
    loading: false,
    error: null,
    fetchRates: mockFetchRates,
    clearResults: mockClearResults,
    marketAnalysis: null,
    confidenceScore: null,
    anomalies: [],
  }),
}));

// Mock QuotationRankingService
vi.mock('@/services/quotation/QuotationRankingService', () => ({
  QuotationRankingService: {
    rankOptions: (options: any[]) => options.map(o => ({ ...o, rank_score: 100 })),
  },
}));

vi.mock('@/services/quotation/QuotationOptionCrudService', () => {
  const MockService = vi.fn();
  MockService.prototype.deleteOption = vi.fn().mockResolvedValue({ reselectedOptionId: null });
  return { QuotationOptionCrudService: MockService };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock PricingService
vi.mock('@/services/pricing.service', () => ({
  PricingService: vi.fn(),
}));

// Mock QuoteOptionService
vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: vi.fn(),
}));

// Mock QuotationNumberService
vi.mock('@/services/quotation/QuotationNumberService', () => ({
  QuotationNumberService: {
    getConfig: vi.fn().mockResolvedValue({}),
    isUnique: vi.fn().mockResolvedValue(true),
    generateNext: vi.fn().mockResolvedValue('QT-1001'),
  },
}));

// Mock Supabase Functions
vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn(),
  enrichPayload: (p: any) => p,
}));

describe('UnifiedQuoteComposer Manual Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock results
    rateFetchingStore.results = [
      { id: 'auto-1', total_cost: 100, is_manual: false },
    ];
  });

  it('allows adding manual options via ResultsZone callback', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={undefined} versionId={undefined} />
      </MemoryRouter>
    );

    // Initially should show 1 auto result (from mock)
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    expect(screen.getByTestId('option-auto-1')).toBeInTheDocument();

    // Find add manual button
    await waitFor(() => {
      expect(screen.getByTestId('add-manual-btn')).toBeInTheDocument();
    });

    // Click add manual option
    const addBtn = screen.getByTestId('add-manual-btn');
    fireEvent.click(addBtn);

    // Should now have 2 results
    await waitFor(() => {
      expect(screen.getByTestId('results-count')).toHaveTextContent('2');
    });

    // Check for manual option
    // The manual option ID is generated, so we check for content "Manual"
    const manualOptions = screen.getAllByText('Manual');
    expect(manualOptions.length).toBeGreaterThan(0);
  });

  it('allows removing a manually added option', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer />
      </MemoryRouter>
    );

    // Initial check
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');

    // Add manual option
    const addBtn = screen.getByTestId('add-manual-btn');
    fireEvent.click(addBtn);

    // Verify addition
    await waitFor(() => {
      expect(screen.getByTestId('results-count')).toHaveTextContent('2');
    });

    // Find the manual option delete button
    const manualSpan = screen.getByText('Manual');
    const optionContainer = manualSpan.closest('div');
    if (!optionContainer) throw new Error('Option container not found');
    const deleteBtn = within(optionContainer).getByText('Delete');
    
    fireEvent.click(deleteBtn);

    // Verify removal
    await waitFor(() => {
      expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    });
    
    expect(screen.queryByText('Manual')).not.toBeInTheDocument();
   });

   it('prevents deleting the last remaining option', async () => {
    render(
      <MemoryRouter>
        <UnifiedQuoteComposer />
      </MemoryRouter>
    );
    
    // Initially 1 auto option
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    
    // Try to delete it
    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);
    
    // Should still have 1 option
    await waitFor(() => {
      expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    });
    
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cannot delete',
      description: 'At least one option is required.'
    }));
  });
 });

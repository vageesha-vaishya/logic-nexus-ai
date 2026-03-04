
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnifiedQuoteComposer } from './UnifiedQuoteComposer';
import { MemoryRouter } from 'react-router-dom';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

// Hoist mock objects to ensure stable references across renders
const { mockCRMReturn, mockScopedDbFrom } = vi.hoisted(() => {
  const mockScopedDbFrom = vi.fn();
  const mockCRMReturn = {
    scopedDb: { from: mockScopedDbFrom },
    context: { tenantId: 'tenant-123' }, // Stable context
    user: { id: 'user-123' },
    profile: { first_name: 'Test', last_name: 'User' },
    loading: false,
    error: null,
    refreshContext: vi.fn(),
    isPlatformAdmin: false
  };
  return { mockCRMReturn, mockScopedDbFrom };
});

vi.mock('../../../hooks/useCRM', () => ({
  useCRM: vi.fn(() => mockCRMReturn)
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'fake-token', user: { id: 'user-123' } },
    user: { id: 'user-123' },
    signOut: vi.fn()
  })
}));

vi.mock('../../../hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: []
  })
}));

vi.mock('../../../hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn()
  })
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
    chargeSides: []
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  }))
}));

// Mock child components to isolate tests
vi.mock('./ResultsZone', () => ({
  ResultsZone: () => <div data-testid="results-zone">ResultsZone</div>
}));

vi.mock('./FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">FormZone</div>
}));

// Mock QuoteStore
vi.mock('../composer/store/QuoteStore', () => ({
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>,
  useQuoteStore: () => ({
    state: {
      quoteId: null,
      versionId: null,
      selectedOption: null,
      manualOptions: [],
      mode: 'ocean'
    },
    dispatch: vi.fn()
  })
}));

// Mock Hooks
vi.mock('../../../hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    error: null,
    fetchRates: vi.fn()
  })
}));

// Mock QuotationConfigurationService
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  return {
    QuotationConfigurationService: class {
      constructor() {}
      getConfiguration(tenantId: string) { 
        return Promise.resolve({
          id: 'config-1',
          default_module: 'composer',
          smart_mode_enabled: false,
          multi_option_enabled: true
        });
      }
    }
  };
});

// Helper to create safe chainable mocks
const createSafeChain = (name: string, data: any = []) => {
  const chain: any = {};
  
  // Methods that return the chain itself
  const methods = ['select', 'eq', 'in', 'order', 'limit', 'range', 'is'];
  
  methods.forEach(m => {
    // Return SELF by default to avoid infinite object creation depth
    chain[m] = vi.fn().mockReturnThis();
  });
  
  // Promise-like behavior
  chain.then = (resolve: any, reject: any) => {
      resolve({ data, error: null });
  };

  // Terminal methods that return promises
  const singleResult = { data: Array.isArray(data) ? (data[0] || null) : data, error: null };

  chain.maybeSingle = vi.fn().mockResolvedValue(singleResult);
  chain.single = vi.fn().mockResolvedValue(singleResult);
  chain.upsert = vi.fn().mockReturnValue(Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null }));
  chain.insert = vi.fn().mockReturnValue(Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null }));
  chain.delete = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
  
  return chain;
};

describe('UnifiedQuoteComposer - Version Fallback', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default fallback for any table not explicitly handled
    mockScopedDbFrom.mockImplementation((table: string) => {
      return createSafeChain(table, []);
    });
  });

  it('uses prop versionId when provided, ignoring current_version_id', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const propVersionId = '00000000-0000-0000-0000-000000000003';
    const currentVersionId = '00000000-0000-0000-0000-000000000002';

    const quotesChain = createSafeChain('quotes', {
      id: quoteId,
      tenant_id: 'tenant-123',
      current_version_id: currentVersionId,
      transport_mode: 'ocean'
    });
    
    const optionsChain = createSafeChain('quotation_version_options', []);

    mockScopedDbFrom.mockImplementation((table: string) => {
      if (table === 'quotes') return quotesChain;
      if (table === 'quotation_version_options') return optionsChain;
      return createSafeChain(table, []);
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} versionId={propVersionId} />
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(optionsChain.eq).toHaveBeenCalledWith('quotation_version_id', propVersionId);
    });
  });

  it('uses current_version_id when versionId prop is missing', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const currentVersionId = '00000000-0000-0000-0000-000000000002';

    const quotesChain = createSafeChain('quotes', {
      id: quoteId,
      tenant_id: 'tenant-123',
      current_version_id: currentVersionId,
      transport_mode: 'ocean'
    });
    
    const optionsChain = createSafeChain('quotation_version_options', []);

    mockScopedDbFrom.mockImplementation((table: string) => {
      if (table === 'quotes') return quotesChain;
      if (table === 'quotation_version_options') return optionsChain;
      return createSafeChain(table, []);
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} />
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(optionsChain.eq).toHaveBeenCalledWith('quotation_version_id', currentVersionId);
    });
  });

  it('falls back to latest version when versionId prop AND current_version_id are missing', async () => {
    const quoteId = '00000000-0000-0000-0000-000000000001';
    const latestVersionId = '00000000-0000-0000-0000-000000000099';

    const quotesChain = createSafeChain('quotes', {
      id: quoteId,
      tenant_id: 'tenant-123',
      current_version_id: null,
      transport_mode: 'ocean'
    });
    
    // NOTE: The component fetches quotation_versions in parallel with quote details
    // It does NOT wait for versions to load before checking for current_version_id?
    // Let's check logic:
    // It loads quoteRow. 
    // It fetches versions in parallel (versionsResult).
    // Then it checks: let targetVersionId = versionId || raw.current_version_id;
    // If !targetVersionId, it checks versionsResult.
    
    const versionsChain = createSafeChain('quotation_versions', [
        { id: latestVersionId, version_number: 2 },
        { id: 'old-version', version_number: 1 }
    ]);
    
    const optionsChain = createSafeChain('quotation_version_options', []);

    mockScopedDbFrom.mockImplementation((table: string) => {
      if (table === 'quotes') return quotesChain;
      if (table === 'quotation_versions') return versionsChain;
      if (table === 'quotation_version_options') return optionsChain;
      return createSafeChain(table, []);
    });

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer quoteId={quoteId} />
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(optionsChain.eq).toHaveBeenCalledWith('quotation_version_id', latestVersionId);
    });
  });

});

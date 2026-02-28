import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
const mockScopedDb = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  rpc: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

// Mock Configuration Service to avoid DB calls
vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const MockService = vi.fn();
  MockService.prototype.getConfiguration = vi.fn().mockResolvedValue({
    multi_option_enabled: true,
    default_module: 'composer'
  });
  return { QuotationConfigurationService: MockService };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'test-tenant' },
    supabase: {},
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { id: 'test-profile' },
  }),
}));

// Mock FormZone to trigger onChange
vi.mock('../FormZone', () => ({
  FormZone: ({ onSaveDraft, onChange }: any) => {
    // Simulate form data change on mount so lastFormData is populated
    React.useEffect(() => {
        if (onChange) {
            onChange({
                mode: 'ocean',
                origin: 'Test Origin',
                destination: 'Test Destination',
                quoteTitle: 'Test Quote',
            });
        }
    }, []);

    return (
      <div data-testid="form-zone">
        <button data-testid="save-draft-btn" onClick={onSaveDraft}>
          Save Draft
        </button>
      </div>
    );
  },
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

vi.mock('../ResultsZone', () => ({
  ResultsZone: () => <div data-testid="results-zone">ResultsZone</div>,
}));

vi.mock('../FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">FinalizeSection</div>,
}));

// Helper component to track location changes
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.search}</div>;
}

describe('UnifiedQuoteComposer Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates URL search params when saving a new draft', async () => {
    // Mock successful save
    const newQuoteId = '12345678-1234-1234-1234-123456789012';
    mockScopedDb.rpc.mockResolvedValue({ data: newQuoteId, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/quotes/new']}>
          <Routes>
            <Route
              path="/dashboard/quotes/new"
              element={
                <>
                  <UnifiedQuoteComposer />
                  <LocationDisplay />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify initial URL has no params
    expect(screen.getByTestId('location-display')).toHaveTextContent('');

    // Wait for form data to settle
    await waitFor(() => new Promise(r => setTimeout(r, 10)));

    // Click save draft
    const saveBtn = screen.getByTestId('save-draft-btn');
    fireEvent.click(saveBtn);

    // Verify RPC call
    await waitFor(() => {
        expect(mockScopedDb.rpc).toHaveBeenCalledWith(
          'save_quote_atomic',
          expect.objectContaining({
            p_payload: expect.objectContaining({
              quote: expect.objectContaining({
                status: 'draft',
              }),
            }),
          })
        );
    });

    // Verify URL update (this confirms setSearchParams was called and worked)
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(`?id=${newQuoteId}`);
    });
  });

  it('does not update URL if quote ID already exists', async () => {
    const existingId = 'existing-id';
    
    // Mock existing quote load
    const mockQuote = {
      data: {
        id: existingId,
        quote_number: 'Q-1000',
        title: 'Test Quote',
        transport_mode: 'ocean',
        status: 'draft',
      },
      error: null
    };
    mockScopedDb.single.mockResolvedValue(mockQuote);
    mockScopedDb.maybeSingle.mockResolvedValue(mockQuote);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/dashboard/quotes/new?id=${existingId}`]}>
          <Routes>
            <Route
              path="/dashboard/quotes/new"
              element={
                <>
                  <UnifiedQuoteComposer quoteId={existingId} versionId="v1" />
                  <LocationDisplay />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Mock save
    mockScopedDb.rpc.mockResolvedValue({ data: existingId, error: null });

    // Wait for loading to finish
    await waitFor(() => {
        expect(screen.queryByText('Loading quote...')).not.toBeInTheDocument();
    });

    // Click save
    fireEvent.click(screen.getByTestId('save-draft-btn'));

    // Verify URL remains the same
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(`?id=${existingId}`);
    });
  });
});

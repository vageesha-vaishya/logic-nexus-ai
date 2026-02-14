import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MultiModalQuoteComposer } from '../../MultiModalQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks Setup ---

vi.mock('@/components/debug/pipeline/usePipelineInterceptor', () => ({
  usePipelineInterceptor: () => ({ capture: vi.fn() })
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Mock Partial Data (Missing text fields, but has IDs/Items)
const mockPartialQuoteData = {
  id: 'quote-partial-123',
  tenant_id: 'tenant-123',
  // Missing origin/destination names
  origin: null,
  destination: null,
  // Has Port IDs
  origin_port_id: 'port-shanghai',
  destination_port_id: 'port-la',
  
  // Missing totals
  total_weight: 0,
  total_volume: 0,
  
  // Has items
  items: [
    { weight_kg: 100, volume_cbm: 5, quantity: 2, description: 'Partial Item 1' },
    { weight_kg: 200, volume_cbm: 10, quantity: 1, description: 'Partial Item 2' }
  ],
  
  status: 'DRAFT'
};

// Reference Data Mocks
const mockReferenceData = {
  ports: [
    { id: 'port-shanghai', name: 'Shanghai Port', code: 'CNSHA' },
    { id: 'port-la', name: 'Los Angeles Port', code: 'USLAX' }
  ],
  currencies: [],
  carriers: [],
  serviceTypes: [],
  chargeCategories: [],
  chargeBasis: []
};

// Mock Builder
const createMockBuilder = (mockResult: any) => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ 
      data: Array.isArray(mockResult) ? (mockResult.length > 0 ? mockResult[0] : null) : mockResult, 
      error: null 
    })),
    then: (resolve: any) => Promise.resolve({ data: mockResult, error: null }).then(resolve)
  };
  return builder;
};

// useCRM Mock
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      client: {
        auth: { getUser: () => Promise.resolve({ data: { user: { user_metadata: { tenant_id: 'tenant-123' } } } }) },
      },
      from: (table: string) => {
        if (table === 'ports_locations') return createMockBuilder(mockReferenceData.ports);
        if (table === 'quotes') return createMockBuilder(mockPartialQuoteData);
        // Mock items fetch
        if (table === 'quote_items') return createMockBuilder(mockPartialQuoteData.items);
        
        return createMockBuilder([]);
      }
    },
    context: { tenantId: 'tenant-123' }
  })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn().mockResolvedValue({ data: {} }) })
}));

vi.mock('@/services/pricing.service', () => ({
  PricingService: class {
    subscribeToUpdates() { return { unsubscribe: () => {} }; }
  }
}));

vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: class { constructor() {} }
}));

describe('Partial Data Population (Fallback Logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-fill origin/destination from port IDs when text fields are empty', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer 
          quoteId="quote-partial-123" 
          versionId="ver-123" 
          tenantId="tenant-123" 
        />
      </QueryClientProvider>
    );

    // Verify Origin is populated from Port Name
    await waitFor(() => {
      expect(screen.getByDisplayValue('Shanghai Port')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify Destination is populated from Port Name
    expect(screen.getByDisplayValue('Los Angeles Port')).toBeInTheDocument();
  });

  it('should calculate total weight/volume from quote items when totals are zero', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer 
          quoteId="quote-partial-123" 
          versionId="ver-123" 
          tenantId="tenant-123" 
        />
      </QueryClientProvider>
    );

    // Wait for load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Shanghai Port')).toBeInTheDocument();
    });

    // Check if totals are calculated
    // Total Weight = 100 + 200 = 300
    // Total Volume = 5 + 10 = 15
    // Note: The UI might not display these directly on the first tab easily if they are in "Cargo Details" section which might be collapsed or in a custom component.
    // However, SharedCargoInput displays them.
    
    // We can check if the value 300 and 15 are present in inputs
    // The inputs for weight/volume might have type="number"
    const weightInput = screen.getByDisplayValue('300');
    expect(weightInput).toBeInTheDocument();
    
    const volumeInput = screen.getByDisplayValue('15');
    expect(volumeInput).toBeInTheDocument();
  });
});

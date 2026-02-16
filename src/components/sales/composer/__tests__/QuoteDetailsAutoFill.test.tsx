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

// Mock Data with EMPTY origin/destination but SET port_ids
const mockQuoteDataAutoFill = {
  id: 'quote-autofill',
  tenant_id: 'tenant-123',
  reference: 'QT-AUTOFILL',
  origin: '', // EMPTY - Should be filled by port
  destination: '', // EMPTY - Should be filled by port
  origin_port_id: 'port-shanghai',
  destination_port_id: 'port-la',
  shipping_term_id: 'term-fob',
  carrier_id: 'carrier-maersk',
  service_type_id: 'service-fcl',
  account_id: 'acc-123',
  contact_id: 'contact-123',
  commodity: 'Electronics',
  total_weight: 500,
  total_volume: 20,
  container_type: '40HC',
  currencyId: 'curr-usd',
  accounts: { name: 'Acme Corp' },
  contacts: { first_name: 'John', last_name: 'Doe' },
  status: 'DRAFT'
};

const mockReferenceData = {
  ports: [
    { id: 'port-shanghai', name: 'Shanghai Port', code: 'CNSHA' },
    { id: 'port-la', name: 'Los Angeles Port', code: 'USLAX' }
  ],
  shippingTerms: [
    { id: 'term-fob', name: 'FOB', code: 'FOB' }
  ],
  carriers: [
    { id: 'carrier-maersk', carrier_name: 'Maersk' }
  ],
  serviceTypes: [
    { id: 'service-fcl', name: 'FCL', code: 'FCL' }
  ],
  currencies: [
    { id: 'curr-usd', code: 'USD', name: 'US Dollar' }
  ],
  chargeCategories: [],
  chargeBasis: []
};

// Mock Builder
const createMockBuilder = (mockResult: any) => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    is: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ 
      data: Array.isArray(mockResult) ? mockResult[0] : mockResult, 
      error: null 
    })),
    maybeSingle: vi.fn(() => Promise.resolve({ 
      data: Array.isArray(mockResult) ? (mockResult.length > 0 ? mockResult[0] : null) : mockResult, 
      error: null 
    })),
    then: (resolve: any) => Promise.resolve({ data: mockResult, error: null }).then(resolve)
  };
  return builder;
};

// Service Mocks
vi.mock('@/services/pricing.service', () => ({
  PricingService: class {
    subscribeToUpdates() { return { unsubscribe: () => {} }; }
    calculateFinancials(rate: number) { return { buyPrice: rate * 0.8, sellPrice: rate }; }
  }
}));

vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: class {
    constructor() {}
  }
}));

// useCRM Mock
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      client: {
        auth: { getUser: () => Promise.resolve({ data: { user: { user_metadata: { tenant_id: 'tenant-123' } } } }) },
        from: (table: string) => {
            if (table === 'ports_locations') return createMockBuilder(mockReferenceData.ports);
            if (table === 'shipping_terms') return createMockBuilder(mockReferenceData.shippingTerms);
            if (table === 'carriers') return createMockBuilder(mockReferenceData.carriers);
            if (table === 'service_types') return createMockBuilder(mockReferenceData.serviceTypes);
            if (table === 'currencies') return createMockBuilder(mockReferenceData.currencies);
            
            if (table === 'quotes') return createMockBuilder(mockQuoteDataAutoFill);
            if (table === 'quotation_versions') return createMockBuilder({ id: 'ver-123', tenant_id: 'tenant-123' });
            if (table === 'quotation_version_options') return createMockBuilder([{ id: 'opt-123', tenant_id: 'tenant-123' }]);
            if (table === 'quotation_version_option_legs') return createMockBuilder([]);
            if (table === 'quote_charges') return createMockBuilder([]);
            
            return createMockBuilder([]);
        }
      },
      from: (table: string) => {
          if (table === 'ports_locations') return createMockBuilder(mockReferenceData.ports);
          if (table === 'shipping_terms') return createMockBuilder(mockReferenceData.shippingTerms);
          if (table === 'carriers') return createMockBuilder(mockReferenceData.carriers);
          if (table === 'service_types') return createMockBuilder(mockReferenceData.serviceTypes);
          if (table === 'currencies') return createMockBuilder(mockReferenceData.currencies);
          
          if (table === 'quotes') return createMockBuilder(mockQuoteDataAutoFill);
          if (table === 'quotation_versions') return createMockBuilder({ id: 'ver-123', tenant_id: 'tenant-123' });
          if (table === 'quotation_version_options') return createMockBuilder([{ id: 'opt-123', tenant_id: 'tenant-123' }]);
          if (table === 'quotation_version_option_legs') return createMockBuilder([]);
          if (table === 'quote_charges') return createMockBuilder([]);
          
          return createMockBuilder([]);
      }
    },
    context: { tenantId: 'tenant-123' }
  })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: {} })
  })
}));

describe('Quote Details Auto-Fill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should automatically fill origin and destination text inputs based on port IDs', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer 
          quoteId="quote-autofill" 
          versionId="ver-123" 
          optionId="opt-123" 
          tenantId="tenant-123" 
        />
      </QueryClientProvider>
    );

    // Wait for auto-fill to happen
    await waitFor(() => {
      // "Shanghai Port" should be in the display value of the Origin Input
      // The Input component is rendered with value={quoteData.origin}
      const originInput = screen.getByDisplayValue('Shanghai Port');
      expect(originInput).toBeInTheDocument();
      expect(originInput.tagName).toBe('INPUT');
    }, { timeout: 5000 });

    await waitFor(() => {
      const destInput = screen.getByDisplayValue('Los Angeles Port');
      expect(destInput).toBeInTheDocument();
    });
  });
});

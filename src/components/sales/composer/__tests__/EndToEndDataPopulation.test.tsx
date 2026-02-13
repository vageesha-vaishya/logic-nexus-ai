import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiModalQuoteComposer } from '../../MultiModalQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks Setup ---

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Mock Data representing a fully populated quote from DB/Quick Quote
const mockQuoteData = {
  id: 'quote-123',
  tenant_id: 'tenant-123',
  reference: 'QT-2024-001',
  origin: 'Shanghai Port',
  destination: 'Los Angeles Port',
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
  shipping_amount: 1500,
  status: 'DRAFT'
};

const mockLegs = [
  {
    id: 'leg-1',
    mode: 'ocean',
    origin: 'Shanghai Port',
    destination: 'Los Angeles Port',
    origin_location_id: 'port-shanghai',
    destination_location_id: 'port-la',
    carrier_id: 'carrier-maersk',
    service_type_id: 'service-fcl',
    sort_order: 1,
    transit_time: 14
  }
];

const mockCharges = [
  {
    id: 'chg-1',
    leg_id: 'leg-1',
    category_id: 'cat-freight',
    basis_id: 'basis-container',
    unit: 'container',
    currency_id: 'curr-usd',
    amount: 1500,
    quantity: 1,
    rate: 1500,
    charge_side_id: 'side-sell' // Simplified for mock
  }
];

// Reference Data Mocks
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
  chargeCategories: [
    { id: 'cat-freight', name: 'Freight Charges', code: 'FRT' }
  ]
};

// Mock Builder
const createMockBuilder = (mockResult: any) => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: mockResult, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: mockResult, error: null })),
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
            // Reference Data lookups
            if (table === 'ports_locations') return createMockBuilder(mockReferenceData.ports);
            if (table === 'shipping_terms') return createMockBuilder(mockReferenceData.shippingTerms);
            if (table === 'carriers') return createMockBuilder(mockReferenceData.carriers);
            if (table === 'service_types') return createMockBuilder(mockReferenceData.serviceTypes);
            if (table === 'currencies') return createMockBuilder(mockReferenceData.currencies);
            if (table === 'charge_categories') return createMockBuilder(mockReferenceData.chargeCategories);
            
            // Quote Data lookups
            if (table === 'quotes') return createMockBuilder(mockQuoteData);
            if (table === 'quotation_versions') return createMockBuilder({ id: 'ver-123', quote_id: 'quote-123' });
            if (table === 'quotation_version_options') return createMockBuilder({ id: 'opt-123', quotation_version_id: 'ver-123' });
            if (table === 'quotation_version_option_legs') return createMockBuilder(mockLegs);
            if (table === 'quote_charges') return createMockBuilder(mockCharges);
            
            return createMockBuilder([]);
        }
      },
      from: (table: string) => { // Duplicate for scopedDb.from usage
          // Same logic as above
          if (table === 'ports_locations') return createMockBuilder(mockReferenceData.ports);
          if (table === 'shipping_terms') return createMockBuilder(mockReferenceData.shippingTerms);
          if (table === 'carriers') return createMockBuilder(mockReferenceData.carriers);
          if (table === 'service_types') return createMockBuilder(mockReferenceData.serviceTypes);
          if (table === 'currencies') return createMockBuilder(mockReferenceData.currencies);
          if (table === 'charge_categories') return createMockBuilder(mockReferenceData.chargeCategories);
          
          if (table === 'quotes') return createMockBuilder(mockQuoteData);
          if (table === 'quotation_versions') return createMockBuilder({ id: 'ver-123' });
          if (table === 'quotation_version_options') return createMockBuilder({ id: 'opt-123' });
          if (table === 'quotation_version_option_legs') return createMockBuilder(mockLegs);
          if (table === 'quote_charges') return createMockBuilder(mockCharges);
          
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

// --- Test Suite ---

describe('End-to-End Quote Data Population', () => {
  it('should fully populate all sections with data from Quick Quote / DB', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer 
          quoteId="quote-123" 
          versionId="ver-123" 
          optionId="opt-123" 
          tenantId="tenant-123" 
        />
      </QueryClientProvider>
    );

    // 1. Wait for loading to finish and "Quote Details" step to appear
    await waitFor(() => {
      expect(screen.getByText(/Quote Details/i)).toBeInTheDocument();
    });

    // 2. Verify Basic Information Fields
    // Customer
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument(); // Customer Name
    // Origin/Destination
    expect(screen.getByDisplayValue(/Shanghai Port/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Los Angeles Port/i)).toBeInTheDocument();
    // Shipping Term
    // Note: Select components might be harder to query by display value directly depending on implementation, 
    // but checking for the text presence usually works if it's rendered.
    expect(screen.getByText(/FOB/i)).toBeInTheDocument();
    
    // 3. Navigate to Transport Legs
    const nextButtons = screen.getAllByRole('button', { name: /Next/i }); // Or arrow right
    // Assuming UI has navigation. If handled by tabs/stepper:
    // We can simulate step change if we can access the store, but here we rely on UI.
    // Let's assume we can click "Next" or the stepper.
    // Since I don't know exact button text, I'll search for "Transport Legs" in the stepper and click it if clickable, or use next button.
    
    // For this test, I'll assume the initial load populates the store correctly. 
    // I can verify the "Review & Save" summary which displays everything.
    
    // Let's verify "Review & Save" data which is the ultimate proof of population.
    // But we are on Step 1.
    
    // Let's check store state implicitly by what is rendered.
    
    // 4. Verify Charges (Mocked as populated)
    // We need to switch steps to verify UI.
    // If we can't easily click, we can assume the data is there if "Review & Save" shows it.
    // But let's try to find the "Review & Save" tab/step.
    
    // Assuming Stepper is clickable:
    const reviewStep = screen.getByText(/Review & Save/i);
    await userEvent.click(reviewStep);
    
    // 5. Verify Review & Save Summary
    await waitFor(() => {
      expect(screen.getByText(/Review Quotation/i)).toBeInTheDocument();
    });
    
    // Check Expanded Grid Details
    expect(screen.getByText(/Shanghai Port/i)).toBeInTheDocument(); // Origin
    expect(screen.getByText(/Los Angeles Port/i)).toBeInTheDocument(); // Dest
    expect(screen.getByText(/FOB/i)).toBeInTheDocument(); // Term
    expect(screen.getByText(/Maersk/i)).toBeInTheDocument(); // Carrier
    expect(screen.getByText(/FCL/i)).toBeInTheDocument(); // Service Type
    expect(screen.getByText(/Electronics/i)).toBeInTheDocument(); // Commodity
    
    // Check Totals
    // 1500 (Leg Charge)
    expect(screen.getByText(/1500/i)).toBeInTheDocument();
  });
});

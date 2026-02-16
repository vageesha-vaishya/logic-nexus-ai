import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const mockCharges = [
  {
    id: 'chg-1-sell',
    leg_id: 'leg-1',
    category_id: 'cat-freight',
    basis_id: 'basis-container',
    unit: 'container',
    currency_id: 'curr-usd',
    amount: 1500,
    quantity: 1,
    rate: 1500,
    charge_side_id: 'side-sell',
    charge_sides: { code: 'SELL' },
    note: 'Freight'
  },
  {
    id: 'chg-1-buy',
    leg_id: 'leg-1',
    category_id: 'cat-freight',
    basis_id: 'basis-container',
    unit: 'container',
    currency_id: 'curr-usd',
    amount: 1200,
    quantity: 1,
    rate: 1200,
    charge_side_id: 'side-buy',
    charge_sides: { code: 'BUY' },
    note: 'Freight'
  }
];

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
    transit_time: 14,
    legType: 'transport',
    quote_charges: mockCharges // Correct property name for relation
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
  ],
  chargeBasis: [
    { id: 'basis-container', name: 'Per Container', code: 'CTR' }
  ]
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
            // Reference Data lookups
            if (table === 'ports_locations') return createMockBuilder(mockReferenceData.ports);
            if (table === 'shipping_terms') return createMockBuilder(mockReferenceData.shippingTerms);
            if (table === 'carriers') return createMockBuilder(mockReferenceData.carriers);
            if (table === 'service_types') return createMockBuilder(mockReferenceData.serviceTypes);
            if (table === 'currencies') return createMockBuilder(mockReferenceData.currencies);
            if (table === 'charge_categories') return createMockBuilder(mockReferenceData.chargeCategories);
            
            // Quote Data lookups
            if (table === 'quotes') return createMockBuilder(mockQuoteData);
            if (table === 'quotation_versions') return createMockBuilder({ id: 'ver-123', quote_id: 'quote-123', tenant_id: 'tenant-123' });
            if (table === 'quotation_version_options') return createMockBuilder([{ id: 'opt-123', quotation_version_id: 'ver-123', tenant_id: 'tenant-123' }]);
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
          if (table === 'quotation_versions') return createMockBuilder({ id: 'ver-123', tenant_id: 'tenant-123' });
          if (table === 'quotation_version_options') return createMockBuilder([{ id: 'opt-123', tenant_id: 'tenant-123' }]);
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    // 1. Wait for loading to finish and "Quote Details" step to appear with data
    await waitFor(() => {
      // Check for value population to ensure data is loaded
      expect(screen.getByDisplayValue(/Shanghai Port/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 2. Verify Basic Information Fields
    // Label check (static)
    expect(screen.getByLabelText(/Origin Location/i)).toBeInTheDocument();
    
    // Customer
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument(); // Customer Name
    // Origin/Destination
    expect(screen.getByDisplayValue(/Shanghai Port/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Los Angeles Port/i)).toBeInTheDocument();
    // Shipping Term
    // Note: Select components might be harder to query by display value directly depending on implementation, 
    // but checking for the text presence usually works if it's rendered.
    expect(screen.getAllByText(/FOB/i).length).toBeGreaterThan(0);
    
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
    // Use fireEvent to click the stepper directly as it might be more reliable in this test environment
    const reviewStep = screen.getByText(/Review & Save/i);
    fireEvent.click(reviewStep);
    
    // 5. Verify Review & Save Summary
    // Note: In test environment, the step transition might be async or require state update
    // We'll rely on waitFor to catch the appearance of the new step content
    await waitFor(() => {
       // Debug: print current body if failing
       // console.log(document.body.innerHTML);
       expect(screen.getByText(/Review Quotation/i)).toBeInTheDocument();
    }, { timeout: 15000 });
    
    // Check Expanded Grid Details
    await waitFor(() => {
      // Check for presence of key data elements in the summary
      const summaryText = document.body.textContent || '';
      if (!summaryText.includes('Shanghai Port')) {
        // console.log('DEBUG: Summary text not found. Current body:', document.body.innerHTML);
      }
      expect(screen.getAllByText(/Shanghai Port/i).length).toBeGreaterThan(0); // Origin
    });
    expect(screen.getAllByText(/Los Angeles Port/i).length).toBeGreaterThan(0); // Dest
    expect(screen.getAllByText(/FOB/i).length).toBeGreaterThan(0); // Term
    expect(screen.getAllByText(/Maersk/i).length).toBeGreaterThan(0); // Carrier
    expect(screen.getAllByText(/FCL/i).length).toBeGreaterThan(0); // Service Type
    expect(screen.getAllByText(/Electronics/i).length).toBeGreaterThan(0); // Commodity
    
    // Check Totals
    // 1500 (Leg Charge + Total Sell Price) - Should appear at least once
    const sellPrices = screen.getAllByText(/1500/i);
    expect(sellPrices.length).toBeGreaterThan(0);

    // Check Buy Cost (1200) - Should appear at least once (Leg Buy + Total Buy)
    const buyCosts = screen.getAllByText(/1200/i);
    expect(buyCosts.length).toBeGreaterThan(0);

    // Check Profit (300) - Should appear at least once (Leg Profit + Total Profit)
    const profits = screen.getAllByText(/300/i);
    expect(profits.length).toBeGreaterThan(0);
  }, 30000);

  it('should display correctly populated origin/destination and port selection', async () => {
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

    // Wait for initial load and verify Input value
    await waitFor(() => {
      expect(screen.getByDisplayValue('Shanghai Port')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify Port Select displays the correct text
    // The SelectValue should display "Shanghai Port (CNSHA)" based on the mock data
    // We look for the text within the Select Trigger
    const portSelectText = screen.getByText('Shanghai Port (CNSHA)');
    expect(portSelectText).toBeInTheDocument();

    // Verify Destination Port Select as well
    const destSelectText = screen.getByText('Los Angeles Port (USLAX)');
    expect(destSelectText).toBeInTheDocument();
  });
});

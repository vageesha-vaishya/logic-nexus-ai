
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteNew from '../QuoteNew';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { tenant_id: 'test-tenant' } } } }) },
      channel: () => ({
        on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
        unsubscribe: () => ({})
      }),
      removeChannel: vi.fn()
    },
    context: { tenantId: 'test-tenant' },
    scopedDb: {
      from: (table: string) => ({
        select: () => {
          if (table === 'service_types') return Promise.resolve({ data: [{ id: 'st-ocean', name: 'Ocean FCL', code: 'ocean' }], error: null });
          if (table === 'carriers') return Promise.resolve({ data: [
            { id: 'c-maersk', carrier_name: 'Maersk', scac: 'MAEU' },
            { id: 'c-msc', carrier_name: 'MSC', scac: 'MSC' }
          ], error: null });
          return Promise.resolve({ data: [], error: null });
        }
      })
    }
  })
}));

// Mock QuoteForm to verify props
const MockQuoteForm = vi.fn((props: any) => <div data-testid="mock-quote-form">Mock Form</div>);
vi.mock('@/components/sales/quote-form/QuoteFormRefactored', () => ({
  QuoteFormRefactored: (props: any) => MockQuoteForm(props)
}));

// Mock Toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

// Mock Logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

describe('QuoteNew Integration Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly maps Quick Quote state to Detailed Quote form values', async () => {
    // 1. Prepare Test Data
    const quickQuoteState = {
      origin: 'Shanghai, China',
      destination: 'Los Angeles, USA',
      mode: 'Ocean',
      originId: 'port-shanghai',
      destinationId: 'port-la',
      pickupDate: '2023-11-01',
      deliveryDeadline: '2023-12-01',
      commodity: 'Electronics',
      weight: 1500,
      volume: 20.5,
      dims: '100x50x40', // 100x50x40 cm
      incoterms: 'FOB',
      selectedRate: {
        id: 'rate-1',
        carrier: 'Maersk',
        price: 5000,
        currency: 'USD',
        validUntil: '2023-11-15'
      },
      htsCode: '8542.31',
      specialHandling: 'Fragile',
      vehicleType: 'Truck'
    };

    // 2. Render Component with Router State
    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: quickQuoteState }]}>
        <Routes>
          <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
        </Routes>
      </MemoryRouter>
    );

    // 3. Wait for hydration (useEffect calls) AND mapping completion
    await waitFor(() => {
        const calls = MockQuoteForm.mock.calls;
        if (calls.length === 0) throw new Error('No calls yet');
        const lastCall = calls[calls.length - 1][0] as any;
        expect(lastCall.initialData?.shipping_amount).toBe('5000');
        // Also wait for master data resolution
        expect(lastCall.initialData?.carrier_id).toBe('c-maersk');
    });

    // 4. Inspect the props passed to QuoteForm
    const calls = MockQuoteForm.mock.calls;
    const lastCall = calls[calls.length - 1][0] as any;
    const { initialData } = lastCall;

    console.log('Mapped Values:', initialData);

    // 5. Assertions
    expect(initialData).toMatchObject({
      title: expect.stringContaining('Quote for Electronics'),
      commodity: 'Electronics',
      total_weight: '1500',
      total_volume: '20.5',
      incoterms: 'FOB', // Explicit mapping we added
      shipping_amount: '5000', // Mapped from rate price
      origin_port_id: 'port-shanghai',
      destination_port_id: 'port-la',
      valid_until: '2023-11-15',
      pickup_date: '2023-11-01',
      delivery_deadline: '2023-12-01',
      vehicle_type: 'Truck',
      special_handling: 'Fragile'
    });

    // Check Notes for overflow data
    expect(initialData.notes).not.toContain('**Pickup Date**');
    expect(initialData.notes).not.toContain('**Delivery Deadline**');
    expect(initialData.notes).not.toContain('**Special Handling**: Fragile');
    expect(initialData.notes).not.toContain('**Vehicle Type**: Truck');
    
    // Check Items Mapping
    expect(initialData.items).toHaveLength(1);
    const item = initialData.items[0];
    expect(item).toMatchObject({
      type: 'loose',
      product_name: 'Electronics',
      quantity: 1,
      unit_price: 5000 // Verified unit price mapping
    });
    
    // Check Attributes (Dims & HTS)
    expect(item.attributes).toMatchObject({
      weight: 1500,
      volume: 20.5,
      hs_code: '8542.31',
      length: 100,
      width: 50,
      height: 40
    });
  });

  it('handles decimal dimensions correctly', async () => {
    const decimalState = {
        origin: 'A', destination: 'B', mode: 'Air',
        commodity: 'Test',
        dims: '12.5x10.5x5.5'
    };

    render(
        <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: decimalState }]}>
          <Routes>
            <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
          </Routes>
        </MemoryRouter>
    );

    await waitFor(() => expect(MockQuoteForm).toHaveBeenCalled());
    const lastCall = MockQuoteForm.mock.calls[MockQuoteForm.mock.calls.length - 1][0] as any;
    const attributes = lastCall.initialData.items[0].attributes;

    expect(attributes).toMatchObject({
        length: 12.5,
        width: 10.5,
        height: 5.5
    });
  });

  it('prioritizes carrier_id from rate option over name matching', async () => {
    const carrierState = {
        origin: 'A', destination: 'B', mode: 'Ocean',
        commodity: 'Test',
        selectedRate: {
            id: 'rate-2',
            carrier_id: 'c-msc', // Explicit ID
            carrier: 'Maersk',   // Name says Maersk (Mismatch test)
            price: 1000,
            currency: 'USD'
        }
    };

    render(
        <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: carrierState }]}>
          <Routes>
            <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
          </Routes>
        </MemoryRouter>
    );

    await waitFor(() => {
        const calls = MockQuoteForm.mock.calls;
        const lastCall = calls[calls.length - 1][0] as any;
        expect(lastCall.initialData?.carrier_id).toBe('c-msc');
    });
    const lastCall = MockQuoteForm.mock.calls[MockQuoteForm.mock.calls.length - 1][0] as any;
    
    // Should match MSC (c-msc) because carrier_id was provided, ignoring 'Maersk' name
    expect(lastCall.initialData.carrier_id).toBe('c-msc');
  });

  it('falls back to carrier name matching if carrier_id is missing', async () => {
    const carrierState = {
        origin: 'A', destination: 'B', mode: 'Ocean',
        commodity: 'Test',
        selectedRate: {
            id: 'rate-3',
            carrier: 'Maersk', // Only Name
            price: 1000,
            currency: 'USD'
        }
    };

    render(
        <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: carrierState }]}>
          <Routes>
            <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
          </Routes>
        </MemoryRouter>
    );

    await waitFor(() => {
        const calls = MockQuoteForm.mock.calls;
        const lastCall = calls[calls.length - 1][0] as any;
        expect(lastCall.initialData?.carrier_id).toBe('c-maersk');
    });
    const lastCall = MockQuoteForm.mock.calls[MockQuoteForm.mock.calls.length - 1][0] as any;
    
    // Should match Maersk (c-maersk) by name
    expect(lastCall.initialData.carrier_id).toBe('c-maersk');
  });

  it('calculates unit_price correctly for multiple containers', async () => {
    const multiContainerState = {
        origin: 'A', destination: 'B', mode: 'Ocean',
        containerCombos: [
            { type: '20GP', size: '20', qty: 2 },
            { type: '40GP', size: '40', qty: 1 }
        ],
        selectedRate: {
            id: 'rate-4',
            carrier: 'Maersk',
            price: 3000, // Total price for 3 containers
            currency: 'USD'
        }
    };

    render(
        <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: multiContainerState }]}>
          <Routes>
            <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
          </Routes>
        </MemoryRouter>
    );
// 3. Verify
    await waitFor(() => {
        const calls = MockQuoteForm.mock.calls;
        if (calls.length === 0) throw new Error('No calls yet');
        const lastCall = calls[calls.length - 1][0] as any;
        expect(lastCall.initialData?.items).toBeDefined();
        expect(lastCall.initialData?.items?.length).toBeGreaterThan(0);
    });
    
    const lastCall = MockQuoteForm.mock.calls[MockQuoteForm.mock.calls.length - 1][0] as any;
    const items = lastCall.initialData.items;

    expect(items).toHaveLength(2); // 2 types of containers
    // Total qty = 3. Price = 3000. Unit Price = 1000.
    expect(items[0].unit_price).toBe(1000);
    expect(items[1].unit_price).toBe(1000);
  });
});

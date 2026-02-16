
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteNew from '../QuoteNew';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { QuoteTransformService } from '@/lib/services/quote-transform.service';

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { tenant_id: 'test-tenant' } } } }) },
      from: (table: string) => ({
        select: () => {
          if (table === 'ports_locations') {
            return Promise.resolve({
              data: [
                { id: 'port-shanghai', location_name: 'Shanghai, China', location_code: 'CNSHA', country: 'China' },
                { id: 'port-la', location_name: 'Los Angeles, USA', location_code: 'USLAX', country: 'USA' }
              ],
              error: null
            });
          }
          return Promise.resolve({ data: [], error: null });
        }
      }),
      channel: () => ({
        on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
        unsubscribe: () => ({})
      }),
      removeChannel: vi.fn()
    },
    context: { tenantId: 'test-tenant' },
    scopedDb: {
      from: (table: string) => {
        if (table === 'incoterms') {
          return {
            select: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: 'term-fob', incoterm_code: 'FOB', incoterm_name: 'Free on Board' }
                    ],
                    error: null
                  })
              })
            })
          };
        }

        return {
          select: () => {
            if (table === 'service_types') {
              return Promise.resolve({
                data: [{ id: 'st-ocean', name: 'Ocean FCL', code: 'ocean' }],
                error: null
              });
            }
            if (table === 'carriers') {
              return Promise.resolve({
                data: [
                  { id: 'c-maersk', carrier_name: 'Maersk', scac: 'MAEU' },
                  { id: 'c-msc', carrier_name: 'MSC', scac: 'MSC' }
                ],
                error: null
              });
            }
            if (table === 'container_types') {
              return Promise.resolve({
                data: [
                  { id: 'ct-20gp', name: '20GP', code: '20GP' }
                ],
                error: null
              });
            }
            if (table === 'container_sizes') {
              return Promise.resolve({
                data: [
                  { id: 'cs-20gp', name: '20GP', code: '20GP', type_id: 'ct-20gp' }
                ],
                error: null
              });
            }
            return Promise.resolve({ data: [], error: null });
          }
        };
      }
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@/components/debug/pipeline/PipelineContext', () => ({
  usePipeline: () => ({ capture: vi.fn() }),
  PipelineProvider: ({ children }: any) => children
}));

vi.mock('@/components/debug/pipeline/PipelineDashboard', () => ({
  PipelineDashboard: () => null
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
      incoterms: 'FOB',
      shipping_amount: '5000',
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

  it('prioritizes carrier_id from rate option over name matching', () => {
    const carriers = [
      { id: 'c-maersk', carrier_name: 'Maersk', scac: 'MAEU' },
      { id: 'c-msc', carrier_name: 'MSC', scac: 'MSC' }
    ];

    const rate = {
      id: 'rate-2',
      carrier_id: 'c-msc',
      carrier: 'Maersk',
      price: 1000,
      currency: 'USD'
    } as any;

    const resolvedId = QuoteTransformService.resolveCarrierId(rate, carriers);

    expect(resolvedId).toBe('c-msc');
  });

  it('falls back to carrier name matching if carrier_id is missing', () => {
    const carriers = [
      { id: 'c-maersk', carrier_name: 'Maersk', scac: 'MAEU' },
      { id: 'c-msc', carrier_name: 'MSC', scac: 'MSC' }
    ];

    const rate = {
      id: 'rate-3',
      carrier: 'Maersk',
      price: 1000,
      currency: 'USD'
    } as any;

    const resolvedId = QuoteTransformService.resolveCarrierId(rate, carriers);

    expect(resolvedId).toBe('c-maersk');
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

  it('wires container size metadata into generated quote items', () => {
    const masterData = {
      serviceTypes: [],
      carriers: [],
      ports: [],
      containerTypes: [{ id: 'ct-20gp', name: '20GP', code: '20GP' }],
      containerSizes: [{ id: 'cs-20gp', name: '20GP', code: '20GP', type_id: 'ct-20gp' }],
      shippingTerms: []
    } as any;

    const state = {
      origin: 'A',
      destination: 'B',
      mode: 'Ocean',
      commodity: 'Electronics',
      containerCombos: [
        { type: '20GP', size: '20GP', qty: 1 }
      ],
      selectedRate: {
        id: 'rate-5',
        carrier: 'Maersk',
        price: 1000,
        currency: 'USD'
      }
    } as any;

    const result = QuoteTransformService.transformToQuoteForm(state, masterData);

    expect(result.items).toBeDefined();
    expect(result.items?.[0]).toMatchObject({
      container_type_id: 'ct-20gp',
      container_size_id: 'cs-20gp'
    });
  });

  it('resolves origin and destination port ids using resolvePortId', () => {
    const ports = [
      { id: 'port-shanghai', location_name: 'Shanghai, China', location_code: 'CNSHA', country: 'China' },
      { id: 'port-la', location_name: 'Los Angeles, USA', location_code: 'USLAX', country: 'USA' }
    ];

    const originByName = QuoteTransformService.resolvePortId('Shanghai, China', ports, undefined, undefined);
    const destinationByCode = QuoteTransformService.resolvePortId(undefined, ports, 'USLAX', undefined);

    expect(originByName).toBe('port-shanghai');
    expect(destinationByCode).toBe('port-la');
  });

  it('prefers explicit port id over name and code', () => {
    const ports = [
      { id: 'port-shanghai', location_name: 'Shanghai, China', location_code: 'CNSHA', country: 'China' },
      { id: 'port-la', location_name: 'Los Angeles, USA', location_code: 'USLAX', country: 'USA' }
    ];

    const resolved = QuoteTransformService.resolvePortId('Shanghai, China', ports, 'CNSHA', 'port-la');

    expect(resolved).toBe('port-la');
  });
});

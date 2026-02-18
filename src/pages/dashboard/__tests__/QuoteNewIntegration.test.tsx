
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteNew from '../QuoteNew';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { QuoteTransformService } from '@/lib/services/quote-transform.service';

// Mock UnifiedQuoteComposer (QuoteNew now renders this instead of QuoteFormRefactored)
const MockUnifiedComposer = vi.fn((props: any) => <div data-testid="mock-unified-composer">Unified Composer</div>);
vi.mock('@/components/sales/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: (props: any) => MockUnifiedComposer(props)
}));

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

  it('renders UnifiedQuoteComposer with initialData from navigation state', async () => {
    const quickQuoteState = {
      origin: 'Shanghai, China',
      destination: 'Los Angeles, USA',
      mode: 'Ocean',
      commodity: 'Electronics',
      weight: 1500,
      volume: 20.5,
    };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: quickQuoteState }]}>
        <Routes>
          <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
        </Routes>
      </MemoryRouter>
    );

    // QuoteNew renders UnifiedQuoteComposer with initialData
    await waitFor(() => {
      expect(MockUnifiedComposer).toHaveBeenCalled();
    });

    const lastCall = MockUnifiedComposer.mock.calls[MockUnifiedComposer.mock.calls.length - 1][0] as any;
    expect(lastCall.initialData).toMatchObject({
      origin: 'Shanghai, China',
      destination: 'Los Angeles, USA',
      mode: 'Ocean',
      commodity: 'Electronics',
    });
  });

  it('renders UnifiedQuoteComposer without initialData when no state', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new' }]}>
        <Routes>
          <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(MockUnifiedComposer).toHaveBeenCalled();
    });

    const lastCall = MockUnifiedComposer.mock.calls[MockUnifiedComposer.mock.calls.length - 1][0] as any;
    expect(lastCall.initialData).toBeUndefined();
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

  it('passes accountId from state to UnifiedQuoteComposer', async () => {
    const stateWithAccount = {
      origin: 'A', destination: 'B', mode: 'Ocean',
      accountId: 'acc-123',
      contactId: 'con-456',
    };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard/quotes/new', state: stateWithAccount }]}>
        <Routes>
          <Route path="/dashboard/quotes/new" element={<QuoteNew />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(MockUnifiedComposer).toHaveBeenCalled();
    });

    const lastCall = MockUnifiedComposer.mock.calls[MockUnifiedComposer.mock.calls.length - 1][0] as any;
    expect(lastCall.initialData.accountId).toBe('acc-123');
    expect(lastCall.initialData.contactId).toBe('con-456');
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

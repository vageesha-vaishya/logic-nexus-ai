import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiModalQuoteComposer } from '../MultiModalQuoteComposer';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockRpc = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === 'charge_sides') {
    const response = {
      data: [
        { id: 'buy-side-id', code: 'buy', name: 'Buy' },
        { id: 'sell-side-id', code: 'sell', name: 'Sell' },
      ],
      error: null,
    };

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(response),
      }),
    } as any;
  }

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as any;
});

const mockChannel = vi.fn(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      client: {
        channel: mockChannel,
      },
      from: mockFrom,
      rpc: mockRpc,
    },
    context: { tenantId: 'tenant-1', franchiseId: 'franchise-1' },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { user_metadata: {}, app_metadata: {} },
    isPlatformAdmin: () => false,
  }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn(),
  }),
}));

vi.mock('@/components/debug/pipeline/usePipelineInterceptor', () => ({
  usePipelineInterceptor: vi.fn(),
}));

describe('MultiModalQuoteComposer - RPC save integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'quote-id-1', error: null });
  });

  const renderWithClient = () =>
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MultiModalQuoteComposer
          quoteId="quote-id-1"
          versionId="version-id-1"
          optionId="11111111-1111-1111-1111-111111111111"
          initialState={{
            currentStep: 4,
            tenantId: 'tenant-1',
            optionId: '11111111-1111-1111-1111-111111111111',
            legs: [
              {
                id: 'leg-1',
                mode: 'air',
                serviceTypeId: 'svc-1',
                origin: 'JFK',
                destination: 'LHR',
                legType: 'transport',
                serviceOnlyCategory: 'doc',
                carrierName: 'Test Carrier',
                carrierId: '00000000-0000-0000-0000-000000000000',
                charges: [
                  {
                    category_id: 'cat-1',
                    currency_id: 'cur-1',
                    basis_id: null,
                    unit: null,
                    note: '',
                    buy: {
                      quantity: 1,
                      rate: 50,
                      amount: 50,
                      dbChargeId: null,
                    },
                    sell: {
                      quantity: 1,
                      rate: 100,
                      amount: 100,
                      dbChargeId: null,
                    },
                  },
                ],
              },
            ],
            quoteData: {
              total_weight: '100',
            },
          }}
        />
      </QueryClientProvider>
    );

  it('calls save_quote_atomic RPC when saving with leg charges payload', async () => {
    const { getByRole } = renderWithClient();

    const saveButton = await waitFor(() =>
      getByRole('button', { name: /save quotation/i })
    );

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
    });

    const payload = mockRpc.mock.calls[0][1].p_payload;
    const option = payload.options[0];
    const leg = option.legs[0];
    const sellCharge = leg.charges.find((c: any) => c.side === 'sell');
    const buyCharge = leg.charges.find((c: any) => c.side === 'buy');

    expect(leg.transport_mode).toBe('air');
    expect(leg.carrier_id).toBe('00000000-0000-0000-0000-000000000000');
    expect(leg.origin_location_name).toBe('JFK');
    expect(leg.destination_location_name).toBe('LHR');
    expect(leg.service_only_category).toBe('doc');
    expect(leg.leg_type).toBe('transport');

    expect(buyCharge.category_id).toBe('cat-1');
    expect(buyCharge.charge_code).toBe('cat-1');
    expect(buyCharge.side).toBe('buy');
    expect(buyCharge.charge_side_id).toBe('buy-side-id');

    expect(sellCharge.category_id).toBe('cat-1');
    expect(sellCharge.charge_code).toBe('cat-1');
    expect(sellCharge.side).toBe('sell');
    expect(sellCharge.charge_side_id).toBe('sell-side-id');
    expect(sellCharge.unit_price).toBe(100);
    expect(sellCharge.quantity).toBe(1);
  });

  it('serializes combined buy and sell charges into combined_charges', async () => {
    const { getByRole } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MultiModalQuoteComposer
          quoteId="quote-id-2"
          versionId="version-id-2"
          optionId="22222222-2222-2222-2222-222222222222"
          initialState={{
            currentStep: 4,
            tenantId: 'tenant-1',
            optionId: '22222222-2222-2222-2222-222222222222',
            legs: [
              {
                id: 'leg-2',
                mode: 'sea',
                serviceTypeId: 'svc-2',
                origin: 'SHA',
                destination: 'NYC',
                legType: 'transport',
                serviceOnlyCategory: '',
                carrierName: 'Carrier B',
                carrierId: '',
                charges: [],
              },
            ],
            charges: [
              {
                id: 'combined-1',
                category_id: 'cat-combined',
                basis_id: null,
                unit: null,
                currency_id: 'cur-1',
                note: 'Test combined',
                buy: {
                  quantity: 2,
                  rate: 10,
                  amount: 20,
                  dbChargeId: null,
                },
                sell: {
                  quantity: 2,
                  rate: 15,
                  amount: 30,
                  dbChargeId: null,
                },
              },
            ],
            quoteData: {},
          }}
        />
      </QueryClientProvider>
    );

    const saveButton = await waitFor(() =>
      getByRole('button', { name: /save quotation/i })
    );

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
    });

    const payload = mockRpc.mock.calls[0][1].p_payload;
    const option = payload.options[0];
    const combined = option.combined_charges;

    expect(Array.isArray(combined)).toBe(true);

    const buyEntry = combined.find((c: any) => c.side === 'buy');
    const sellEntry = combined.find((c: any) => c.side === 'sell');

    expect(buyEntry.category_id).toBe('cat-combined');
    expect(buyEntry.charge_code).toBe('cat-combined');
    expect(buyEntry.side).toBe('buy');
    expect(buyEntry.charge_side_id).toBe('buy-side-id');
    expect(buyEntry.unit_price).toBe(10);
    expect(buyEntry.quantity).toBe(2);

    expect(sellEntry.category_id).toBe('cat-combined');
    expect(sellEntry.charge_code).toBe('cat-combined');
    expect(sellEntry.side).toBe('sell');
    expect(sellEntry.charge_side_id).toBe('sell-side-id');
    expect(sellEntry.unit_price).toBe(15);
    expect(sellEntry.quantity).toBe(2);
  });

  it('maps service-only legs without carrierId to carrier_id null and preserves category', async () => {
    const { getByRole } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MultiModalQuoteComposer
          quoteId="quote-id-3"
          versionId="version-id-3"
          optionId="33333333-3333-3333-3333-333333333333"
          initialState={{
            currentStep: 4,
            tenantId: 'tenant-1',
            optionId: '33333333-3333-3333-3333-333333333333',
            legs: [
              {
                id: 'leg-3',
                mode: 'service',
                serviceTypeId: 'svc-3',
                origin: 'N/A',
                destination: 'N/A',
                legType: 'service',
                serviceOnlyCategory: 'custom-service',
                carrierName: 'Service Provider',
                carrierId: '',
                charges: [
                  {
                    category_id: 'svc-cat',
                    currency_id: 'cur-1',
                    basis_id: null,
                    unit: null,
                    note: '',
                    buy: {
                      quantity: 0,
                      rate: 0,
                      amount: 0,
                      dbChargeId: null,
                    },
                    sell: {
                      quantity: 1,
                      rate: 10,
                      amount: 10,
                      dbChargeId: null,
                    },
                  },
                ],
              },
            ],
            quoteData: {},
          }}
        />
      </QueryClientProvider>
    );

    const saveButton = await waitFor(() =>
      getByRole('button', { name: /save quotation/i })
    );

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
    });

    const payload = mockRpc.mock.calls[0][1].p_payload;
    const option = payload.options[0];
    const leg = option.legs[0];

    expect(leg.carrier_id).toBeNull();
    expect(leg.service_only_category).toBe('custom-service');
    expect(leg.leg_type).toBe('service');
  });
});

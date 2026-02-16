import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMissingOptionsOrChargesAnomaly, useQuoteRepositoryForm } from '../useQuoteRepository';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
);

// Mock useCRM and useAuth
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockGt = vi.fn();
const mockOrder = vi.fn();
const mockIs = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockSelect,
}));

// Chain mocks
const mockChain: any = {
  maybeSingle: mockMaybeSingle,
  eq: mockEq,
  limit: mockLimit,
  gt: mockGt,
  order: mockOrder,
  is: mockIs,
  then: (resolve: any) => resolve({ data: [], error: null })
};

mockInsert.mockReturnValue({ select: mockSelect });
mockUpdate.mockReturnValue({ eq: mockEq });
mockDelete.mockReturnValue({ eq: mockEq });
mockSelect.mockReturnValue(mockChain);
mockEq.mockReturnValue(mockChain); // Allow chaining
mockGt.mockReturnValue(mockChain);
mockOrder.mockReturnValue(mockChain);
mockLimit.mockReturnValue(mockChain);
mockIs.mockReturnValue(mockChain);

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      from: mockFrom,
      rpc: mockRpc,
    },
    context: { tenantId: 'test-tenant' },
    supabase: { // Also mock supabase as it might be used for other things
        from: mockFrom,
    }
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    roles: [],
  }),
}));

vi.mock('../QuoteContext', () => ({
  useQuoteContext: () => ({
    resolvedTenantId: 'test-tenant',
    setResolvedTenantId: vi.fn(),
    setAccounts: vi.fn(),
    setContacts: vi.fn(),
    setOpportunities: vi.fn(),
    setServices: vi.fn(),
    accounts: [],
    contacts: [],
    opportunities: [],
    serviceTypes: [],
  }),
}));

vi.mock('@/lib/feature-flags', async () => {
  const actual = await vi.importActual<any>('@/lib/feature-flags');
  return {
    ...actual,
    useAppFeatureFlag: vi.fn((key: string, defaultValue: boolean = false) => ({
      enabled: defaultValue,
      isLoading: false,
      error: null,
    })),
  };
});

describe('useQuoteRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default success responses
    mockMaybeSingle.mockResolvedValue({ data: { id: 'new-quote-id' }, error: null });
    mockRpc.mockResolvedValue({ data: 'new-quote-id', error: null });
    mockInsert.mockReturnValue({ select: () => ({ maybeSingle: mockMaybeSingle }) });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should save a new quote using atomic RPC', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });
    
    const quoteData = {
      title: 'Test Quote',
      items: [
        {
          product_name: 'Item 1',
          quantity: 10,
          unit_price: 100,
          discount_percent: 5,
        },
      ],
      // ... other fields
    } as any;

    const id = await result.current.saveQuote({ data: quoteData });

    expect(mockRpc).toHaveBeenCalledWith('save_quote_atomic', expect.objectContaining({
        p_payload: expect.objectContaining({
            quote: expect.objectContaining({
                title: 'Test Quote',
            }),
            items: expect.arrayContaining([
                expect.objectContaining({
                    product_name: 'Item 1',
                    quantity: 10,
                    unit_price: 100,
                    discount_percent: 5,
                })
            ])
        })
    }));
    expect(id).toBe('new-quote-id');
  });

  it('should update an existing quote using atomic RPC', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });
    
    const quoteData = {
      title: 'Updated Quote',
      items: [
        {
          product_name: 'Item 2',
          quantity: 5,
          unit_price: 200,
        },
      ],
    } as any;

    await result.current.saveQuote({ quoteId: 'existing-id', data: quoteData });

    expect(mockRpc).toHaveBeenCalledWith('save_quote_atomic', expect.objectContaining({
        p_payload: expect.objectContaining({
            quote: expect.objectContaining({
                id: 'existing-id',
                title: 'Updated Quote',
            }),
            items: expect.arrayContaining([
                expect.objectContaining({
                    product_name: 'Item 2',
                })
            ])
        })
    }));
  });

  it('maps is_primary to is_selected in options payload', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });

    const quoteData = {
      title: 'Quote With Options',
      items: [],
      options: [
        { id: 'opt-primary', is_primary: true, legs: [] },
        { id: 'opt-secondary', is_primary: false, legs: [] },
      ],
    } as any;

    await result.current.saveQuote({ data: quoteData });

    expect(mockRpc).toHaveBeenCalledWith(
      'save_quote_atomic',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          options: expect.arrayContaining([
            expect.objectContaining({ is_selected: true }),
            expect.objectContaining({ is_selected: false }),
          ]),
        }),
      })
    );
  });

  it('omits non-uuid option ids so new options are inserted', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });

    const quoteData = {
      title: 'Quote With New Options',
      items: [],
      options: [
        { id: 'temporary-id', is_primary: true, legs: [] },
      ],
    } as any;

    await result.current.saveQuote({ data: quoteData });

    const rpcArgs = mockRpc.mock.calls[0][1] as any;
    const optionPayload = rpcArgs.p_payload.options[0];

    expect(optionPayload.id).toBeUndefined();
    expect(optionPayload.is_selected).toBe(true);
  });

  it('maps leg charges into RPC payload with pricing fields', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });

    const quoteData = {
      title: 'Quote With Charges',
      items: [],
      options: [
        {
          id: 'opt-1',
          is_primary: true,
          legs: [
            {
              id: 'leg-1',
              carrier_id: 'carrier-1',
              transport_mode: 'air',
              origin_location_name: 'JFK',
              destination_location_name: 'LHR',
              transit_time_days: 7,
              charges: [
                {
                  id: 'temp-charge-id',
                  amount: 100,
                  currency: 'USD',
                  charge_code: 'charge-cat-id',
                  basis: 'PER_KG',
                  unit_price: 10,
                  quantity: 10,
                  note: 'Test charge',
                },
              ],
            },
          ],
        },
      ],
    } as any;

    await result.current.saveQuote({ data: quoteData });

    const rpcArgs = mockRpc.mock.calls[0][1] as any;
    const chargePayload = rpcArgs.p_payload.options[0].legs[0].charges[0];

    expect(chargePayload).toMatchObject({
      amount: 100,
      currency: 'USD',
      charge_code: 'charge-cat-id',
      basis: 'PER_KG',
      unit_price: 10,
      quantity: 10,
      note: 'Test charge',
    });
    expect(chargePayload.id).toBeUndefined();
  });

  it('preserves service_only_category and leg_type in options legs payload', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });

    const quoteData = {
      title: 'Quote With Service Leg',
      items: [],
      options: [
        {
          id: 'opt-1',
          is_primary: true,
          legs: [
            {
              id: 'leg-1',
              carrier_id: 'carrier-1',
              transport_mode: 'service',
              service_only_category: 'custom-service',
              leg_type: 'service',
              origin_location_name: 'N/A',
              destination_location_name: 'N/A',
              transit_time_days: 0,
              charges: [],
            },
          ],
        },
      ],
    } as any;

    await result.current.saveQuote({ data: quoteData });

    const rpcArgs = mockRpc.mock.calls[0][1] as any;
    const legPayload = rpcArgs.p_payload.options[0].legs[0];

    expect(legPayload.service_only_category).toBe('custom-service');
    expect(legPayload.leg_type).toBe('service');
  });

  it('validateSavedQuote triggers toast and anomaly update when options or charges are missing', async () => {
    process.env.NODE_ENV = 'development';

    const mockFlag = useAppFeatureFlag as unknown as vi.Mock;
    mockFlag.mockReturnValue({
      enabled: false,
      isLoading: false,
      error: null,
    });

    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });

    const quoteData = {
      title: 'Quote Without Charges',
      items: [],
      options: [],
    } as any;

    const versionRow: any = {
      id: 'version-1',
      quote_id: 'new-quote-id',
      tenant_id: 'tenant-1',
      version_number: 1,
      anomalies: [],
      quotation_version_options: [],
    };

    mockMaybeSingle.mockResolvedValueOnce({ data: versionRow, error: null });

    await result.current.saveQuote({ data: quoteData });

    const warningMock: any = (toast as any).warning;

    expect(warningMock).toHaveBeenCalledWith(
      'Quote saved but has no options or charges. Please review before sending.'
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        anomalies: expect.arrayContaining([
          expect.objectContaining({
            type: 'MISSING_OPTIONS_OR_CHARGES',
            quote_id: 'new-quote-id',
            version_id: 'version-1',
            severity: 'WARNING',
          }),
        ]),
      })
    );
  });

  it('uses phase 2 guard feature flag to escalate anomaly severity to ERROR', async () => {
    process.env.NODE_ENV = 'development';

    const mockFlag = useAppFeatureFlag as unknown as vi.Mock;
    mockFlag.mockReturnValue({
      enabled: true,
      isLoading: false,
      error: null,
    });

    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(
      () => useQuoteRepositoryForm({ form: mockForm }),
      { wrapper }
    );

    const quoteData = {
      title: 'Quote Without Charges',
      items: [],
      options: [],
    } as any;

    const versionRow: any = {
      id: 'version-2',
      quote_id: 'new-quote-id',
      tenant_id: 'tenant-1',
      version_number: 2,
      anomalies: [],
      quotation_version_options: [],
    };

    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'new-quote-id' }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: versionRow, error: null });

    await result.current.saveQuote({ data: quoteData });

    expect(mockUpdate).toHaveBeenCalled();
    const updateArg: any = mockUpdate.mock.calls[0][0];
    const anomaly = Array.isArray(updateArg.anomalies) ? updateArg.anomalies[0] : null;
    expect(anomaly).toMatchObject({
      type: 'MISSING_OPTIONS_OR_CHARGES',
      quote_id: 'new-quote-id',
      severity: 'ERROR',
    });
  });

  it('buildMissingOptionsOrChargesAnomaly builds enriched anomaly payload shape', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    const version: any = {
      id: 'version-1',
      quote_id: 'quote-1',
      tenant_id: 'tenant-1',
      version_number: 2,
      quotation_version_options: [
        {
          id: 'opt-1',
          quotation_version_option_legs: [
            {
              id: 'leg-1',
              quotation_version_option_leg_charges: [{ id: 'ch-1' }, { id: 'ch-2' }],
            },
          ],
        },
        {
          id: 'opt-2',
          quotation_version_option_legs: [
            {
              id: 'leg-2',
              quotation_version_option_leg_charges: [],
            },
          ],
        },
      ],
    };

    const anomaly = buildMissingOptionsOrChargesAnomaly(version, 'quote-1');

    expect(anomaly).toMatchObject({
      type: 'MISSING_OPTIONS_OR_CHARGES',
      severity: 'WARNING',
      message: 'Quote version saved without options or charges',
      quote_id: 'quote-1',
      version_id: 'version-1',
      version_number: 2,
      tenant_id: 'tenant-1',
      option_count: 2,
      charge_count: 2,
      timestamp: '2025-01-01T00:00:00.000Z',
    });

    const emptyVersion: any = {
      id: 'version-2',
      quote_id: 'quote-2',
      tenant_id: 'tenant-2',
      version_number: 3,
      quotation_version_options: [],
    };

    const strictAnomaly = buildMissingOptionsOrChargesAnomaly(emptyVersion, 'quote-2', {
      strictGuards: true,
    });

    expect(strictAnomaly).toMatchObject({
      type: 'MISSING_OPTIONS_OR_CHARGES',
      severity: 'ERROR',
      quote_id: 'quote-2',
      version_id: 'version-2',
      version_number: 3,
      tenant_id: 'tenant-2',
      option_count: 0,
      charge_count: 0,
    });
  });
});

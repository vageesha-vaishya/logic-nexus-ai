import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks (override global where needed)
// ---------------------------------------------------------------------------

const mockInvokeFn = vi.fn();
const mockFromChain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
  error: null,
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      functions: { invoke: mockInvokeFn },
      from: vi.fn(() => mockFromChain),
      auth: { getUser: mockGetUser },
    },
    context: {
      userId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000002',
    },
  }),
}));

const mockInvokeAiAdvisor = vi.fn();
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: mockInvokeAiAdvisor }),
}));

const {
  mockUseAppFeatureFlag,
  mockBuildHybridRouteConfiguration,
  mockMetricsRecord,
} = vi.hoisted(() => ({
  mockUseAppFeatureFlag: vi.fn((flagKey: string) => ({
    enabled: flagKey === 'hybrid_route_configuration_v1',
  })),
  mockBuildHybridRouteConfiguration: vi.fn(async ({ options }: any) => ({
    options,
    validationIssues: [],
    auditTrail: [],
  })),
  mockMetricsRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: {
    HYBRID_ROUTE_CONFIGURATION_V1: 'hybrid_route_configuration_v1',
    HYBRID_ROUTE_METRICS_DASHBOARD_V1: 'hybrid_route_metrics_dashboard_v1',
  },
  useAppFeatureFlag: mockUseAppFeatureFlag,
}));

vi.mock('@/services/quotation/hybrid-route-configuration', () => ({
  buildHybridRouteConfiguration: mockBuildHybridRouteConfiguration,
}));

vi.mock('@/services/quotation/HybridRouteMetricsService', () => ({
  HybridRouteMetricsService: class MockHybridRouteMetricsService {
    record = mockMetricsRecord;
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/quote-mapper', () => ({
  mapOptionToQuote: (input: any) => input,
  calculateQuoteFinancials: (input: any) => input,
}));

vi.mock('@/services/pricing.service', () => {
  return {
    PricingService: class MockPricingService {
      calculateFinancials = vi.fn().mockResolvedValue({
        sellPrice: 1000,
        buyPrice: 800,
        marginAmount: 200,
        marginPercent: 20,
      });
    },
  };
});

vi.mock('@/lib/simulation-engine', () => ({
  generateSimulatedRates: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/container-utils', () => ({
  formatContainerSize: vi.fn().mockReturnValue('container'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import the hook under test AFTER mocks are registered
// ---------------------------------------------------------------------------
import { useRateFetching } from '@/hooks/useRateFetching';
import { generateSimulatedRates } from '@/lib/simulation-engine';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockParams = {
  mode: 'ocean',
  origin: 'Shanghai',
  destination: 'Rotterdam',
  commodity: 'Electronics',
  smartMode: false,
};

const mockResolver = {
  resolveContainerInfo: vi.fn().mockReturnValue({
    type: 'DRY',
    size: '20',
    iso_code: '22G1',
  }),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRateFetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeAiAdvisor.mockResolvedValue({ data: null, error: null });
    vi.mocked(generateSimulatedRates).mockReturnValue([]);
    mockUseAppFeatureFlag.mockImplementation((flagKey: string) => ({
      enabled: flagKey === 'hybrid_route_configuration_v1',
    }));
    mockBuildHybridRouteConfiguration.mockImplementation(async ({ options }: any) => ({
      options,
      validationIssues: [],
      auditTrail: [],
    }));
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useRateFetching());

    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.marketAnalysis).toBeNull();
    expect(result.current.confidenceScore).toBeNull();
    expect(result.current.anomalies).toEqual([]);
    expect(typeof result.current.fetchRates).toBe('function');
    expect(typeof result.current.clearResults).toBe('function');
  });

  it('clearResults sets results to null', async () => {
    const { result } = renderHook(() => useRateFetching());

    // Populate results first via a successful fetch
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          { id: 'r1', carrier: 'Test', price: 1000, total_amount: 1000, currency: 'USD', transit_days: 14 },
        ],
      },
      error: null,
    });

    await act(async () => {
      await result.current.fetchRates(mockParams, mockResolver);
    });

    expect(result.current.results).not.toBeNull();

    // Now clear
    act(() => {
      result.current.clearResults();
    });

    expect(result.current.results).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.marketAnalysis).toBeNull();
    expect(result.current.confidenceScore).toBeNull();
    expect(result.current.anomalies).toEqual([]);
  });

  it('fetchRates sets loading during execution', async () => {
    // Use a deferred promise so we can observe loading=true
    let resolveInvoke!: (value: any) => void;
    mockInvokeFn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    const { result } = renderHook(() => useRateFetching());

    expect(result.current.loading).toBe(false);

    let fetchPromise: Promise<any>;
    act(() => {
      fetchPromise = result.current.fetchRates(mockParams, mockResolver);
    });

    // loading should be true while the invoke is pending
    expect(result.current.loading).toBe(true);

    // Resolve the pending invoke
    await act(async () => {
      resolveInvoke({
        data: {
          options: [
            { id: 'r1', carrier: 'Test', price: 1000, total_amount: 1000, currency: 'USD', transit_days: 14 },
          ],
        },
        error: null,
      });
      await fetchPromise!;
    });

    // loading should be false after completion
    expect(result.current.loading).toBe(false);
  });

  it('returns results after successful fetch', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          { id: 'r1', carrier: 'Test', price: 1000, total_amount: 1000, currency: 'USD', transit_days: 14 },
        ],
      },
      error: null,
    });
    mockInvokeAiAdvisor.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(mockParams, mockResolver);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.results).not.toBeNull();
    expect(Array.isArray(result.current.results)).toBe(true);
    expect(result.current.results!.length).toBeGreaterThan(0);

    // Verify the rate option was processed
    const firstResult = result.current.results![0];
    expect(firstResult.carrier).toBe('Test');
    expect(firstResult.currency).toBe('USD');
    expect(firstResult.verified).toBe(true);

    // Verify supabase.functions.invoke was called with rate-engine
    expect(mockInvokeFn).toHaveBeenCalledWith(
      'rate-engine',
      expect.objectContaining({
        body: expect.objectContaining({
          mode: 'ocean',
          origin: 'Shanghai',
          destination: 'Rotterdam',
        }),
      }),
    );
  });

  it('passes pickupDate as requested_departure_date to hybrid configuration', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          { id: 'r1', carrier: 'Test', price: 1000, total_amount: 1000, currency: 'USD', transit_days: 14 },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates({
        ...mockParams,
        pickupDate: '2026-03-22',
      } as any, mockResolver);
    });

    expect(mockBuildHybridRouteConfiguration).toHaveBeenCalled();
    const lastCallArg = mockBuildHybridRouteConfiguration.mock.calls.at(-1)?.[0];
    expect(lastCallArg.routeInput.requested_departure_date).toBe('2026-03-22');
  });

  it('uses route fallback for simulated options when engines return no options', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: { options: [] },
      error: null,
    });
    vi.mocked(generateSimulatedRates).mockReturnValueOnce([
      { id: 'sim-1', carrier: 'Sim Carrier', total_amount: 900, currency: 'USD', legs: [] },
    ] as any);

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(mockParams, mockResolver);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.results).not.toBeNull();
    expect(result.current.results!.length).toBeGreaterThan(0);
    expect(result.current.results![0].legs?.[0]?.origin).toBe('Shanghai');
    expect(result.current.results![0].legs?.[0]?.destination).toBe('Rotterdam');
  });

  it('normalizes mode-specific leg endpoint keys across multimodal fallback legs', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: { options: [] },
      error: null,
    });
    vi.mocked(generateSimulatedRates).mockReturnValueOnce([
      {
        id: 'sim-multi-1',
        carrier: 'Sim Multimodal',
        total_amount: 2100,
        currency: 'USD',
        mode: 'multimodal',
        legs: [
          { mode: 'road', pickup_location: 'Factory Shanghai', dropoff_location: 'Shanghai Port' },
          { mode: 'ocean', pol: 'Shanghai Port', pod: 'Long Beach Port' },
          { mode: 'road', from: 'Long Beach Port', delivery_location: 'Los Angeles DC' },
        ],
      },
    ] as any);

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(
        { ...mockParams, smartMode: false, mode: 'multimodal', origin: 'Factory Shanghai', destination: 'Los Angeles DC' },
        mockResolver
      );
    });

    expect(result.current.error).toBeNull();
    expect(result.current.results).not.toBeNull();

    const resultOption = result.current.results!.find((opt) => opt.id === 'sim-multi-1');
    expect(resultOption).toBeDefined();
    expect(resultOption!.legs?.[0]?.origin).toBe('Factory Shanghai');
    expect(resultOption!.legs?.[0]?.destination).toBe('Shanghai Port');
    expect(resultOption!.legs?.[1]?.origin).toBe('Shanghai Port');
    expect(resultOption!.legs?.[1]?.destination).toBe('Long Beach Port');
    expect(resultOption!.legs?.[2]?.origin).toBe('Long Beach Port');
    expect(resultOption!.legs?.[2]?.destination).toBe('Los Angeles DC');
  });

  it('maintains smart-mode leg continuity when intermediate endpoints are sparse', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          {
            id: 'legacy-sparse-1',
            carrier: 'Legacy Sparse',
            total_amount: 1000,
            currency: 'USD',
            origin: 'Shenzhen Factory',
            destination: 'Berlin DC',
            legs: [
              { mode: 'road', pickup_location: 'Shenzhen Factory' },
              { mode: 'ocean' },
              { mode: 'rail', destination_station: 'Berlin DC' },
            ],
          },
        ],
      },
      error: null,
    });
    mockInvokeAiAdvisor.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(
        { ...mockParams, smartMode: true, mode: 'multimodal', origin: 'Shenzhen Factory', destination: 'Berlin DC' },
        mockResolver
      );
    });

    expect(result.current.error).toBeNull();
    expect(mockInvokeAiAdvisor).toHaveBeenCalled();
    const option = result.current.results?.find((opt) => opt.id === 'legacy-sparse-1');
    expect(option).toBeDefined();
    expect(option!.legs?.[0]?.origin).toBe('Shenzhen Factory');
    expect(option!.legs?.[0]?.destination).toBeTruthy();
    expect(option!.legs?.[1]?.origin).toBe(option!.legs?.[0]?.destination);
    expect(option!.legs?.[1]?.destination).toBeTruthy();
    expect(option!.legs?.[2]?.origin).toBe(option!.legs?.[1]?.destination);
    expect(option!.legs?.[2]?.destination).toBe('Berlin DC');
  });

  it('hydrates carrier and departure date aliases for smart quote legs', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          {
            id: 'legacy-smart-alias-1',
            carrier_name: 'Global Smart Lines',
            total_amount: 1600,
            currency: 'USD',
            origin: 'Factory Alpha',
            destination: 'Warehouse Omega',
            legs: [
              {
                mode: 'road',
                from_location: 'Factory Alpha',
                to_location: 'Port One',
                provider_name: 'Road Partner',
                estimated_departure_date: '12/03/2026',
              },
              {
                mode: 'ocean',
                from_port: 'Port One',
                to_port: 'Port Two',
                carrier: { name: 'Ocean Partner' },
                departure_datetime: '2026-03-13T12:00:00Z',
              },
            ],
          },
        ],
      },
      error: null,
    });
    mockInvokeAiAdvisor.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(
        { ...mockParams, smartMode: true, origin: 'Factory Alpha', destination: 'Warehouse Omega' },
        mockResolver
      );
    });

    const option = result.current.results?.find((opt) => opt.id === 'legacy-smart-alias-1');
    expect(option).toBeDefined();
    expect(option!.legs?.[0]?.carrier).toBe('Road Partner');
    expect(option!.legs?.[1]?.carrier).toBe('Ocean Partner');
    expect(option!.legs?.[0]?.departure_date).toBe('2026-03-12');
    expect(option!.legs?.[1]?.departure_date).toBe('2026-03-13');
    expect(option!.legs?.[0]?.origin).toBe('Factory Alpha');
    expect(option!.legs?.[1]?.destination).toBe('Port Two');
  });

  it('propagates option-level carrier and departure date to sparse smart legs', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          {
            id: 'legacy-smart-fallback-1',
            carrier_name: 'Fallback Smart Carrier',
            total_amount: 2400,
            currency: 'USD',
            origin: 'Plant A',
            destination: 'DC Z',
            departure_date: '2026-04-01',
            legs: [
              { mode: 'road', pickup_location: 'Plant A' },
              { mode: 'ocean' },
              { mode: 'road', delivery_location: 'DC Z' },
            ],
          },
        ],
      },
      error: null,
    });
    mockInvokeAiAdvisor.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(
        { ...mockParams, smartMode: true, origin: 'Plant A', destination: 'DC Z' },
        mockResolver
      );
    });

    const option = result.current.results?.find((opt) => opt.id === 'legacy-smart-fallback-1');
    expect(option).toBeDefined();
    expect(option!.legs).toHaveLength(3);
    expect(option!.origin).toBe('Plant A');
    expect(option!.destination).toBe('DC Z');
    expect(option!.legs?.[0]?.carrier).toBe('Fallback Smart Carrier');
    expect(option!.legs?.[1]?.carrier).toBe('Fallback Smart Carrier');
    expect(option!.legs?.[2]?.carrier).toBe('Fallback Smart Carrier');
    expect(option!.legs?.[0]?.departure_date).toBe('2026-04-01');
    expect(option!.legs?.[1]?.departure_date).toBe('2026-04-01');
    expect(option!.legs?.[2]?.departure_date).toBe('2026-04-01');
    expect(option!.legs?.[0]?.origin).toBe('Plant A');
    expect(option!.legs?.[0]?.destination).toBe('DC Z');
    expect(option!.legs?.[1]?.origin).toBe('DC Z');
    expect(option!.legs?.[1]?.destination).toBe('DC Z');
    expect(option!.legs?.[2]?.origin).toBe('DC Z');
    expect(option!.legs?.[2]?.destination).toBe('DC Z');
  });
});

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
});

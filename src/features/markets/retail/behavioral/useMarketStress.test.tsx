import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      }),
    },
  },
}));

import { useMarketStress } from './useMarketStress';
import type { MarketStress } from './types';

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useMarketStress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses high stress and exposes isHighStress=true', async () => {
    const payload: MarketStress = {
      nifty_change_pct: -2.3,
      vix_current: 21.5,
      vix_prev: 14.0,
      stress_level: 'high',
      nifty_ltp: 21800,
    };
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => payload });

    const { result } = renderHook(() => useMarketStress(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.stress_level).toBe('high');
    expect(result.current.isHighStress).toBe(true);
    expect(result.current.isMediumStress).toBe(false);
  });

  it('exposes isMediumStress=true for medium level', async () => {
    const payload: MarketStress = {
      nifty_change_pct: -1.2,
      vix_current: 16,
      vix_prev: 14,
      stress_level: 'medium',
      nifty_ltp: 22000,
    };
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => payload });

    const { result } = renderHook(() => useMarketStress(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.isHighStress).toBe(false);
    expect(result.current.isMediumStress).toBe(true);
  });

  it('flags an error when fetch fails', async () => {
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const { result } = renderHook(() => useMarketStress(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isHighStress).toBe(false);
  });
});

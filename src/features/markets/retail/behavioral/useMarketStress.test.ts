import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/utils';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'tok' }, roles: [] }),
}));

const mockStress = {
  nifty_change_pct: -2.3,
  vix_current: 21.5,
  vix_prev: 14.0,
  stress_level: 'high',
  nifty_ltp: 21800,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockStress,
  }) as any;
});

describe('useMarketStress', () => {
  it('fetches market stress and derives isHighStress', async () => {
    const { useMarketStress } = await import('./useMarketStress');
    const { result } = renderHook(() => useMarketStress(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.stress_level).toBe('high');
    expect(result.current.isHighStress).toBe(true);
    expect(result.current.isMediumStress).toBe(false);
  });

  it('fetches from correct URL with auth header', async () => {
    const { useMarketStress } = await import('./useMarketStress');
    renderHook(() => useMarketStress(), { wrapper: createWrapper() });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toContain('/v1/retail/behavioral/market-stress');
    expect(opts?.headers?.Authorization).toBe('Bearer tok');
  });
});

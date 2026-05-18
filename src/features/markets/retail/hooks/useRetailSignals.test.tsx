import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    session: { access_token: 'test-token' },
    roles: [],
  }),
}));

import { useRetailSignals } from './useRetailSignals';

const sampleRow = {
  id: 's1',
  ts: '2026-05-18T10:00:00Z',
  instrument_id: 'instr-1',
  signal_type: 'buy',
  direction: 'long',
  confidence: 0.73,
  score: 0.7,
  rationale: 'momentum',
  price_at_signal: 2890,
  expires_at: '2026-05-19T10:00:00Z',
  horizon: 'short_term',
  asset_class: 'equity',
  metadata: {
    explanations: {
      beginner: 'Good buy.',
      casual: 'RSI rising.',
      self_directed: 'EMA20 > EMA50 cross.',
    },
  },
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
};

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useRetailSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [sampleRow],
    });
  });

  it('fetches /v1/retail/signals and returns parsed rows', async () => {
    const { result } = renderHook(() => useRetailSignals(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].instrument?.symbol).toBe('RELIANCE');
    expect(result.current.data?.[0].metadata.explanations?.beginner).toBe('Good buy.');
  });

  it('sends the Supabase access token as Bearer auth', async () => {
    renderHook(() => useRetailSignals(), { wrapper: createWrapper() });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const auth = init.headers.Authorization ?? init.headers.authorization;
    expect(auth).toBe('Bearer test-token');
  });

  it('passes filters through as query-string params', async () => {
    renderHook(
      () => useRetailSignals({ assetClass: 'mutual_fund', horizon: 'long_term', minConfidence: 0.7, limit: 5 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const qs = new URL(url, 'http://x').searchParams;
    expect(qs.get('asset_class')).toBe('mutual_fund');
    expect(qs.get('horizon')).toBe('long_term');
    expect(qs.get('min_confidence')).toBe('0.7');
    expect(qs.get('limit')).toBe('5');
  });

  it('throws on non-2xx response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'oops' }),
    });
    const { result } = renderHook(() => useRetailSignals(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

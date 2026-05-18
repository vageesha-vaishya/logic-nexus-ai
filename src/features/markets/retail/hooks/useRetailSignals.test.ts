import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/utils';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    session: { access_token: 'tok-123' },
    roles: [],
  }),
}));

const mockSignals = [
  {
    id: 's1',
    ts: '2026-05-18T10:00:00Z',
    instrument_id: 'instr-1',
    signal_type: 'buy',
    direction: 'long',
    confidence: 0.73,
    score: 73,
    horizon: 'short_term',
    asset_class: 'equity',
    rationale: 'EMA cross',
    price_at_signal: 2890,
    expires_at: null,
    strategy_id: null,
    portfolio_id: null,
    generated_by: 'signal_generator',
    risk_params: { stop_loss_pct: 2.5, target_pct: 5.5, r_r: 2.2 },
    metadata: {
      explanations: {
        beginner: 'Reliance looks good to buy.',
        casual: 'RSI rising. Confidence 73%.',
        self_directed: 'EMA20 > EMA50. Vol +65%.',
      },
    },
    instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
  },
];

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => mockSignals,
}) as any;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockSignals,
  }) as any;
});

describe('useRetailSignals', () => {
  it('fetches from /v1/retail/signals and returns RetailSignal[]', async () => {
    const { useRetailSignals } = await import('./useRetailSignals');
    const { result } = renderHook(() => useRetailSignals(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].instrument?.symbol).toBe('RELIANCE');
    expect(result.current.data![0].metadata.explanations?.beginner).toBe('Reliance looks good to buy.');
  });

  it('passes auth token in Authorization header', async () => {
    const { useRetailSignals } = await import('./useRetailSignals');
    renderHook(() => useRetailSignals(), { wrapper: createWrapper() });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, options] = (fetch as any).mock.calls[0];
    expect(options?.headers?.Authorization).toBe('Bearer tok-123');
  });

  it('applies filters as query params', async () => {
    const { useRetailSignals } = await import('./useRetailSignals');
    renderHook(
      () => useRetailSignals({ assetClass: 'equity', horizon: 'short_term', minConfidence: 0.70 }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url] = (fetch as any).mock.calls.at(-1);
    expect(url).toContain('asset_class=equity');
    expect(url).toContain('horizon=short_term');
    expect(url).toContain('min_confidence=0.7');
  });
});

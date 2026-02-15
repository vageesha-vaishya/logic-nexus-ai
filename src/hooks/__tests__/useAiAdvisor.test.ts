import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiAdvisor } from '../useAiAdvisor';

describe('useAiAdvisor 403 fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key'
      },
      configurable: true
    });
  });

  it('retries with anon key on 403 and succeeds', async () => {
    const first = {
      ok: false,
      status: 403,
      text: async () => 'Forbidden'
    } as any;
    const second = {
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    } as any;
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const { invokeAiAdvisor } = useAiAdvisor();
    const res = await invokeAiAdvisor({ action: 'test', payload: {} });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ ok: true });
  });
});

describe('useAiAdvisor lookup_codes returns IDs when available', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key'
      },
      configurable: true
    });
  });

  it('returns suggestions with details.id for matched codes', async () => {
    const response = {
      ok: true,
      status: 200,
      json: async () => ({
        suggestions: [
          { label: 'Los Angeles (USLAX)', value: 'USLAX', details: { code: 'USLAX', id: 'p-lax', name: 'Los Angeles', country: 'US' } },
          { label: 'Shanghai (CNSHA)', value: 'CNSHA', details: { code: 'CNSHA', id: 'p-sha', name: 'Shanghai', country: 'CN' } }
        ]
      })
    } as any;
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(response);

    const { invokeAiAdvisor } = useAiAdvisor();
    const res = await invokeAiAdvisor({ action: 'lookup_codes', payload: { query: 'LAX', mode: 'ocean' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.error).toBeNull();
    expect(res.data?.suggestions?.[0]?.details?.id).toBe('p-lax');
  });
});

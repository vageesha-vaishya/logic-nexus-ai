import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiAdvisor } from '../useAiAdvisor';
import { invokeFunction } from '@/lib/supabase-functions';

vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: vi.fn(),
}));

describe('useAiAdvisor 403 fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetAllMocks();
  });

  it('returns data when invokeFunction succeeds', async () => {
    (invokeFunction as any).mockResolvedValueOnce({ data: { ok: true }, error: null });

    const { invokeAiAdvisor } = useAiAdvisor();
    const res = await invokeAiAdvisor({ action: 'test', payload: {} });

    expect(invokeFunction).toHaveBeenCalledTimes(1);
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ ok: true });
  });
});

describe('useAiAdvisor lookup_codes returns IDs when available', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetAllMocks();
  });

  it('returns suggestions with details.id for matched codes', async () => {
    (invokeFunction as any).mockResolvedValueOnce({
      data: {
        suggestions: [
          { label: 'Los Angeles (USLAX)', value: 'USLAX', details: { code: 'USLAX', id: 'p-lax', name: 'Los Angeles', country: 'US' } },
          { label: 'Shanghai (CNSHA)', value: 'CNSHA', details: { code: 'CNSHA', id: 'p-sha', name: 'Shanghai', country: 'CN' } }
        ]
      },
      error: null
    });

    const { invokeAiAdvisor } = useAiAdvisor();
    const res = await invokeAiAdvisor({ action: 'lookup_codes', payload: { query: 'LAX', mode: 'ocean' } });

    expect(invokeFunction).toHaveBeenCalledTimes(1);
    expect(res.error).toBeNull();
    expect(res.data?.suggestions?.[0]?.details?.id).toBe('p-lax');
  });
});

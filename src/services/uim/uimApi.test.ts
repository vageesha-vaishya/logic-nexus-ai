import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UimApiError, uimApiRequest } from './uimApi';

describe('uimApiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends version negotiation headers and returns payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uimApiRequest<{ ok: boolean }>({
      method: 'GET',
      path: '/forms/overview',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/uim/forms/overview'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Accept-Version': 'v1',
          'X-API-Version': 'v1',
        }),
      }),
    );
  });

  it('throws UimApiError on non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'storage not ready', code: 'UIM_FORM_STORAGE_NOT_READY' }),
    }));

    await expect(
      uimApiRequest({
        method: 'GET',
        path: '/forms/overview',
      }),
    ).rejects.toBeInstanceOf(UimApiError);
  });

  it('retries analytics routes on same-origin fallback when configured base returns 404', async () => {
    vi.stubEnv('VITE_UIM_API_BASE_URL', 'https://api.example.com/api/v2/uim');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Route not found' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { ok: true } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uimApiRequest<{ output: { ok: boolean } }>({
      method: 'GET',
      path: '/analytics/kpis',
    });

    expect(result.output.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v2/uim/analytics/kpis',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

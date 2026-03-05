import { beforeEach, describe, expect, it, vi } from 'vitest';
import healthHandler from '@/pages/api/v1/health';
import { ContainerMetadataApiService } from '@/services/logistics/ContainerMetadataApiService';

vi.mock('@/pages/api/_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));

function mockReqRes() {
  const req = { method: 'GET', query: {}, headers: {} } as any;
  let statusCode = 200;
  let payload: any;
  const res = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      statusCode = code;
      return {
        json: (data: unknown) => {
          payload = data;
        },
        end: () => {},
      };
    }),
    _getStatusCode: () => statusCode,
    _getData: () => payload,
  } as any;
  return { req, res };
}

describe('Container health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when db and cache checks are healthy', async () => {
    vi.spyOn(ContainerMetadataApiService.prototype, 'checkHealth').mockResolvedValue({ db: true, cache: true });
    const { req, res } = mockReqRes();

    await healthHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().status).toBe('ok');
  });

  it('returns 503 when health checks fail', async () => {
    vi.spyOn(ContainerMetadataApiService.prototype, 'checkHealth').mockResolvedValue({ db: false, cache: true });
    const { req, res } = mockReqRes();

    await healthHandler(req, res);

    expect(res._getStatusCode()).toBe(503);
    expect(res._getData().status).toBe('degraded');
  });
});

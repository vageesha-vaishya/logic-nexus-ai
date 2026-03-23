import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './platform-domains';
import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../_utils/http';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { getCachedJson, setCachedJson } from '../_utils/redisCache';

vi.mock('../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceDomainAccess: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../_utils/redisCache', () => ({
  getCachedJson: vi.fn(),
  setCachedJson: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, any> } {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v1/platform-domains cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-domain-cache',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1', role: 'tenant_admin', permissions: [] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: null,
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(enforceDomainAccess).mockResolvedValue({
      authorizedDomainCodes: ['LOGISTICS'],
      tenantDomainCount: 1,
    } as any);
  });

  it('returns cached domain payload when available', async () => {
    vi.mocked(getCachedJson).mockResolvedValue({
      domains: [{ id: 'd-1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true }],
      tenantDomainCount: 1,
      tenantId: 'tenant-1',
      isPlatformAdmin: false,
    } as any);

    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect(setCachedJson).not.toHaveBeenCalled();
  });

  it('bypasses cache when refresh is requested', async () => {
    vi.mocked(getCachedJson).mockResolvedValue({
      domains: [{ id: 'd-stale', code: 'STALE', name: 'Stale', description: null, is_active: true }],
      tenantDomainCount: 1,
      tenantId: 'tenant-1',
      isPlatformAdmin: false,
    } as any);
    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'd-1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true }],
        error: null,
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(fromChain),
    } as any);

    const req: ApiRequest = { method: 'GET', query: { refresh: '1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(getCachedJson).not.toHaveBeenCalled();
    expect(setCachedJson).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        domains: [{ id: 'd-1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true }],
      }),
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './domain-config';
import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';

vi.mock('../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceDomainAccess: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
  sanitizeQueryId: vi.fn(),
}));

vi.mock('../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn((res: ApiResponse, error: Error, correlationId: string) =>
    res.status(400).json({ error: error.message, correlationId })),
}));

vi.mock('../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

type MockResponse = ApiResponse & {
  statusCode?: number;
  jsonBody?: unknown;
  headers: Record<string, string | string[]>;
};

function createResponse(): MockResponse {
  const res: MockResponse = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (data: unknown) => {
          res.jsonBody = data;
        },
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v1/domain-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-domain-config',
      tenantId: 'tenant-1',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'platform_domain_admin',
      permissions: ['domains.config.read', 'domains.config.write'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: null,
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(sanitizeQueryId).mockImplementation((value: unknown) => String(value || ''));
    vi.mocked(enforceDomainAccess).mockResolvedValue({
      authorizedDomainCodes: ['LOGISTICS'],
      tenantDomainCount: 1,
    } as any);
  });

  it('returns domain configuration on GET', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { code: 'LOGISTICS' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'cfg-1',
          domain_id: 'domain-1',
          plugin_name: 'QUOTATION',
          environment: 'prod',
          json_settings: { retry: 2 },
        },
        error: null,
      });
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const from = vi.fn((table: string) => ({
      select,
      eq,
      limit,
      maybeSingle,
      upsert: vi.fn().mockReturnThis(),
    }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { domain_id: 'domain-1', plugin_name: 'quotation', environment: 'prod' },
      headers: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(expect.objectContaining({
      version: 'v1',
      data: expect.objectContaining({ plugin_name: 'QUOTATION' }),
    }));
    expect(enforceAnyPermission).toHaveBeenCalledWith(['domains.config.read', 'domains.config.write'], ['domains.config.read']);
  });

  it('updates domain configuration on PUT', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { code: 'LOGISTICS' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'cfg-1',
          domain_id: 'domain-1',
          plugin_name: 'QUOTATION',
          environment: 'prod',
          json_settings: { retry: 3 },
        },
        error: null,
      });
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const upsert = vi.fn().mockReturnThis();
    const from = vi.fn((table: string) => ({
      select,
      eq,
      limit,
      maybeSingle,
      upsert,
    }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'PUT',
      query: {},
      body: {
        domainId: 'domain-1',
        pluginName: 'quotation',
        environment: 'prod',
        jsonSettings: { retry: 3 },
      },
      headers: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalledWith(['domains.config.read', 'domains.config.write'], ['domains.config.write']);
  });
});

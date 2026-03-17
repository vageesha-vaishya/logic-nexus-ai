import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './tenant-branding.css';
import type { ApiRequest, ApiResponse } from '../_utils/types';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { buildTenantBrandingStylesheet, resolveTenantBranding } from '@/services/branding/brandingResolver';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  parseHeaderValue,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';

vi.mock('../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  parseHeaderValue: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
  sanitizeQueryId: vi.fn(),
}));

vi.mock('../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/services/branding/brandingResolver', () => ({
  resolveTenantBranding: vi.fn(),
  buildTenantBrandingStylesheet: vi.fn(),
}));

type MockResponse = ApiResponse & {
  statusCode?: number;
  jsonBody?: unknown;
  endedWith?: unknown;
  headers: Record<string, string | string[]>;
  end: (text?: string) => void;
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
        end: (text?: string) => {
          res.endedWith = text;
        },
      };
    }),
    end: vi.fn((text?: string) => {
      res.endedWith = text;
    }),
  };
  return res;
}

function createTenantQueryResult() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'tenant-1',
        name: 'Acme',
        slug: 'acme',
        domain: 'acme.com',
        logo_url: 'logos/main.png',
        branding_settings: {},
        settings: {},
      },
      error: null,
    }),
  };
}

describe('GET /api/v1/tenant-branding.css', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-1',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      tenantId: 'tenant-1',
      isPlatformAdmin: false,
    } as any);
    vi.mocked(sanitizeQueryId).mockImplementation((value: unknown) => String(value || ''));
    vi.mocked(parseHeaderValue).mockReturnValue('portal.acme.com:443');
    vi.mocked(resolveTenantBranding).mockReturnValue({
      tenantId: 'tenant-1',
      tenantName: 'Acme',
    } as any);
    vi.mocked(buildTenantBrandingStylesheet).mockReturnValue(':root{--tenant-brand-primary:#2563EB;}');
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => createTenantQueryResult()),
    } as any);
  });

  it('returns generated stylesheet', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: {
        hostname: 'Portal.Acme.com',
        domain_code: 'logistics',
      },
      headers: { host: 'portal.acme.com:443' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenNthCalledWith(1, req);
    expect(enforceRateLimit).toHaveBeenNthCalledWith(2, req, 'tenant-1');
    expect(resolveTenantBranding).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', tenantName: 'Acme' }),
      expect.objectContaining({
        hostname: 'portal.acme.com',
        domainCode: 'LOGISTICS',
      })
    );
    expect(buildTenantBrandingStylesheet).toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('text/css; charset=utf-8');
    expect(res.headers['Cache-Control']).toBe('public, max-age=300');
    expect(res.statusCode).toBe(200);
    expect(res.endedWith).toBe(':root{--tenant-brand-primary:#2563EB;}');
  });

  it('returns 405 for unsupported methods', async () => {
    const req: ApiRequest = {
      method: 'PUT',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.headers.Allow).toEqual(['GET']);
    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        error: 'Method PUT Not Allowed',
        correlationId: 'corr-1',
      })
    );
  });

  it('returns 404 end when tenant is missing', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    } as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: { host: 'portal.acme.com:443' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.endedWith).toBeUndefined();
  });

  it('delegates failures to sendErrorResponse', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('Unauthorized'));
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-1');
  });

  it('blocks tenant override attempts for non-platform users', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: { tenant_id: 'tenant-2' },
      headers: { host: 'portal.acme.com:443' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-1');
    const error = vi.mocked(sendErrorResponse).mock.calls[0]?.[1] as Error;
    expect(error.message).toBe('Forbidden');
  });
});

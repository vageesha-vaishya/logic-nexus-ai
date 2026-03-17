import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './tenant-branding';
import type { ApiRequest, ApiResponse } from '../_utils/types';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { resolveTenantBranding } from '@/services/branding/brandingResolver';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
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
  logApiEvent: vi.fn(),
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

describe('GET /api/v1/tenant-branding', () => {
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
      tenantSlug: 'acme',
      logoUrl: 'https://cdn.test/logos/main.png',
      faviconUrl: '',
      companyName: 'Acme',
      primaryColor: '#2563EB',
      secondaryColor: '#1D4ED8',
      accentColor: '#F59E0B',
      fontFamily: 'Inter, system-ui, sans-serif',
      customCss: '',
      whiteLabelEnabled: false,
      headerText: '',
      subHeaderText: '',
      footerText: '',
      disclaimerText: '',
      metadata: {
        domain: 'acme.com',
        hostname: 'portal.acme.com',
        resolvedAt: '2026-03-17T13:00:00.000Z',
      },
    } as any);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => createTenantQueryResult()),
    } as any);
  });

  it('returns resolved branding payload', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: {
        hostname: 'Portal.Acme.com',
        domain_code: 'logistics',
        franchise_id: 'franchise-1',
      },
      headers: { host: 'portal.acme.com:443' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'PUT'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenNthCalledWith(1, req);
    expect(enforceRateLimit).toHaveBeenNthCalledWith(2, req, 'tenant-1');
    expect(resolveTenantBranding).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', tenantName: 'Acme' }),
      {
        hostname: 'portal.acme.com',
        domainCode: 'LOGISTICS',
        franchiseId: 'franchise-1',
      }
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1' }),
        correlationId: 'corr-1',
        version: 'v1',
      })
    );
    expect(logApiEvent).toHaveBeenCalled();
  });

  it('returns 405 for unsupported methods', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.headers.Allow).toEqual(['GET', 'PUT']);
    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        error: 'Method POST Not Allowed',
        correlationId: 'corr-1',
      })
    );
  });

  it('returns 404 when tenant is missing', async () => {
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
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        error: 'Tenant not found',
        correlationId: 'corr-1',
        version: 'v1',
      })
    );
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

  it('updates branding for scoped tenant with PUT', async () => {
    const tenantMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'tenant-1', settings: {} },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateChain = {
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tenants') {
          return {
            ...updateChain,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: tenantMaybeSingle,
          };
        }
        return createTenantQueryResult();
      }),
    } as any);

    const req: ApiRequest = {
      method: 'PUT',
      query: {},
      headers: { host: 'portal.acme.com:443' },
      body: {
        brandingSettings: {
          primary_color: '#2563EB',
          custom_css: 'body{color:red;}',
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1' }),
        correlationId: 'corr-1',
      })
    );
    expect(updateEq).toHaveBeenCalledWith('id', 'tenant-1');
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

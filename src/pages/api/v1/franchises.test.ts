import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './franchises';
import type { ApiRequest, ApiResponse } from '../_utils/types';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';

vi.mock('../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
  sanitizeQueryId: vi.fn(),
}));

vi.mock('../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

type MockResponse = ApiResponse & {
  statusCode?: number;
  jsonBody?: unknown;
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
        end: vi.fn(),
      };
    }),
    end: vi.fn(),
  };
  return res;
}

describe('GET /api/v1/franchises', () => {
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
      permissions: ['admin.franchises.manage'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: null,
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(sanitizeQueryId).mockImplementation((value: unknown) => String(value || ''));
  });

  function mockSupabaseWithFranchises(rows: any[] = [{ id: 'fr-1', tenant_id: 'tenant-1' }]) {
    const franchisesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    } as any;
    franchisesQuery.then = (resolve: any) => resolve({ data: rows, error: null });

    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const auditQuery = { insert: auditInsert };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'franchises') return franchisesQuery;
        if (table === 'audit_logs') return auditQuery;
        return {};
      }),
    } as any);
    return { franchisesQuery, auditInsert };
  }

  it('returns tenant-scoped franchises for tenant users', async () => {
    const { franchisesQuery } = mockSupabaseWithFranchises();
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(franchisesQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(expect.objectContaining({ data: expect.any(Array), version: 'v1' }));
  });

  it('blocks tenant users from tenant override requests', async () => {
    mockSupabaseWithFranchises();
    const req: ApiRequest = { method: 'GET', query: { tenant_id: 'tenant-2' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-1');
    const error = vi.mocked(sendErrorResponse).mock.calls[0]?.[1] as Error;
    expect(error.message).toBe('Forbidden');
  });

  it('returns all franchises for platform admins', async () => {
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: null,
      franchiseId: null,
      isPlatformAdmin: true,
      adminOverrideEnabled: false,
    } as any);
    const { franchisesQuery } = mockSupabaseWithFranchises([{ id: 'fr-1' }, { id: 'fr-2' }]);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(franchisesQuery.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything());
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(expect.objectContaining({ data: [{ id: 'fr-1' }, { id: 'fr-2' }] }));
  });

  it('supports tenant and franchise scoped query params for platform admins', async () => {
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: null,
      franchiseId: null,
      isPlatformAdmin: true,
      adminOverrideEnabled: false,
    } as any);
    const { franchisesQuery } = mockSupabaseWithFranchises([{ id: 'fr-2', tenant_id: 'tenant-2' }]);
    const req: ApiRequest = {
      method: 'GET',
      query: { tenant_id: 'tenant-2', franchise_id: 'fr-2' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(franchisesQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-2');
    expect(franchisesQuery.eq).toHaveBeenCalledWith('id', 'fr-2');
    expect(franchisesQuery.limit).toHaveBeenCalledWith(1);
    expect(res.statusCode).toBe(200);
  });

  it('returns 405 for unsupported methods', async () => {
    mockSupabaseWithFranchises();
    const req: ApiRequest = { method: 'POST', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.headers.Allow).toEqual(['GET']);
    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual(expect.objectContaining({ error: 'Method POST Not Allowed' }));
  });

  it('delegates failures to sendErrorResponse', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('Unauthorized'));
    mockSupabaseWithFranchises();
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-1');
    expect(logApiEvent).toHaveBeenCalled();
  });
});

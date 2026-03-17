import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '@/pages/api/v1/franchises';
import { getSupabaseAdminClient } from '@/pages/api/_utils/supabaseAdmin';
import { authenticateRequest, resolveAndApplyAccessContext } from '@/pages/api/_utils/http';

vi.mock('@/pages/api/_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(() => ({
    correlationId: 'corr-1',
    tenantId: '',
    franchiseId: '',
    userId: '',
    role: '',
    isPlatformAdmin: false,
    adminOverrideEnabled: false,
  })),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(() => false),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('@/pages/api/_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function mockReqRes(overrides: Partial<any> = {}) {
  const req = {
    method: 'GET',
    query: {},
    headers: {},
    ...overrides,
  } as any;

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

describe('Franchises API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all franchises for tenant admin tenant scope', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['admin.franchises.manage'],
    });

    vi.mocked(resolveAndApplyAccessContext).mockImplementation(async (_req: any, ctx: any) => {
      ctx.tenantId = 'tenant-1';
      ctx.franchiseId = '';
      ctx.role = 'tenant_admin';
      ctx.userId = 'user-1';
      return {
        userId: 'user-1',
        roles: ['tenant_admin'],
        isPlatformAdmin: false,
        tenantId: 'tenant-1',
        franchiseId: null,
        adminOverrideEnabled: false,
        overrideTenantId: null,
        overrideFranchiseId: null,
      };
    });

    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 'fr-1', name: 'North Branch', tenant_id: 'tenant-1' },
        { id: 'fr-2', name: 'South Branch', tenant_id: 'tenant-1' },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq, order });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'franchises') return { select };
        if (table === 'audit_logs') return { insert };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const { req, res } = mockReqRes({ headers: { 'x-tenant-id': 'tenant-1' } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().data).toHaveLength(2);
    expect(eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(eq).not.toHaveBeenCalledWith('id', expect.anything());
  });

  it('blocks requests when resolved tenant scope is missing', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-2',
      role: 'tenant_admin',
      permissions: ['admin.franchises.manage'],
    });

    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-2',
      roles: ['tenant_admin'],
      isPlatformAdmin: false,
      tenantId: null,
      franchiseId: null,
      adminOverrideEnabled: false,
      overrideTenantId: null,
      overrideFranchiseId: null,
    });

    const supabase = { from: vi.fn() } as any;
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(res._getData().error).toBe('Forbidden');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './pilot-users';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): {
  statusCode: number;
  jsonBody: unknown;
  headers: Record<string, string | string[]>;
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} & ApiResponse {
  const res = {
    statusCode: 200,
    jsonBody: undefined as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
        end: () => undefined,
      };
    }),
  };
  return res as typeof res & ApiResponse;
}

describe('pilot-users v2 API', () => {
  let customRolesEqMock: ReturnType<typeof vi.fn>;
  let userCustomRolesInMock: ReturnType<typeof vi.fn>;
  let profileInMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-pilot-1' } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-admin',
      role: 'tenant_admin',
      permissions: ['view_amro_dashboard'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-admin',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({
      isAuthorized: true,
      subscriptionStatus: 'active',
      graceUntil: null,
      source: 'database',
      validatedAt: '2026-03-20T00:00:00.000Z',
    } as any);

    customRolesEqMock = vi.fn().mockResolvedValue({
      data: [
        { id: 'role-pilot-1', tenant_id: 'tenant-1', name: 'Pilot', is_active: true },
        { id: 'role-co-pilot-1', tenant_id: 'tenant-1', name: 'Co-pilot', is_active: true },
      ],
      error: null,
    });
    userCustomRolesInMock = vi.fn().mockResolvedValue({
      data: [
        { user_id: 'u-1', role_id: 'role-pilot-1', tenant_id: 'tenant-1' },
        { user_id: 'u-2', role_id: 'role-co-pilot-1', tenant_id: 'tenant-1' },
        { user_id: 'u-3', role_id: 'role-pilot-1', tenant_id: 'tenant-2' },
      ],
      error: null,
    });
    profileInMock = vi.fn().mockResolvedValue({
      data: [
        { id: 'u-1', first_name: 'Captain', last_name: 'Rao', email: 'captain.rao@example.com', is_active: true },
        { id: 'u-2', first_name: 'First', last_name: 'Officer', email: 'fo@example.com', is_active: true },
      ],
      error: null,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === 'custom_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: customRolesEqMock,
          }),
        };
      }
      if (table === 'user_custom_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: userCustomRolesInMock,
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            in: profileInMock,
          }),
        };
      }
      return {};
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);
  });

  it('returns tenant-scoped pilot users mapped for the dropdown', async () => {
    const req: ApiRequest = {
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = createResponse() as any;

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records).toEqual([
      {
        user_id: 'u-1',
        display_name: 'Captain Rao',
        email: 'captain.rao@example.com',
      },
    ]);
    expect((res.jsonBody as any)?.output?.co_pilot_records).toEqual([
      {
        user_id: 'u-2',
        display_name: 'First Officer',
        email: 'fo@example.com',
      },
    ]);
    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalled();
    expect(enforceRateLimit).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(resolveAndApplyAccessContext).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('returns empty crew records when tenant has no active pilot or co-pilot custom roles', async () => {
    customRolesEqMock.mockResolvedValueOnce({
      data: [{ id: 'role-engineer-1', tenant_id: 'tenant-1', name: 'Engineer', is_active: true }],
      error: null,
    });
    const req: ApiRequest = {
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = createResponse() as any;

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records).toEqual([]);
    expect((res.jsonBody as any)?.output?.co_pilot_records).toEqual([]);
    expect(userCustomRolesInMock).not.toHaveBeenCalled();
    expect(profileInMock).not.toHaveBeenCalled();
  });

  it('routes downstream query failures through the shared error handler', async () => {
    customRolesEqMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'custom role lookup failed' },
    });
    const req: ApiRequest = {
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalled();
  });
});

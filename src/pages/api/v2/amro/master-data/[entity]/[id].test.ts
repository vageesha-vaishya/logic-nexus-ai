import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './[id]';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';

vi.mock('../../../../_utils/http', () => ({
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

vi.mock('../../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): ApiResponse & {
  statusCode?: number;
  jsonBody?: unknown;
  headers: Record<string, unknown>;
} {
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

describe('/api/v2/amro/master-data/[entity]/[id]', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, AMRO_MASTER_DATA_V2_ENABLED: 'true' };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-master-data-id',
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
      permissions: ['view_amro_dashboard', 'edit_aircraft_records'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: null,
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({
      isAuthorized: true,
      subscriptionStatus: 'active',
      source: 'database',
      validatedAt: '2026-03-24T00:00:00.000Z',
    } as any);
  });

  it('returns a single record for GET by id', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: 'ac-1', tail_number: 'N100AA', tenant_id: 'tenant-1' },
      error: null,
    });
    const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eqIdMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqTenantMock = vi.fn().mockReturnValue({ eq: eqIdMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqTenantMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { entity: 'aircraft', id: 'ac-1' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalledWith(
      ['view_amro_dashboard', 'edit_aircraft_records'],
      ['view_amro_dashboard', 'edit_aircraft_records'],
    );
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.record?.id).toBe('ac-1');
  });

  it('returns 404 when record is not found', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eqIdMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqTenantMock = vi.fn().mockReturnValue({ eq: eqIdMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqTenantMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { entity: 'aircraft', id: 'missing-id' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toBe('Record not found');
  });
});

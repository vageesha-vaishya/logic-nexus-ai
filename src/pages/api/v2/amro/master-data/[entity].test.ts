import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './[entity]';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
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
} from '../../../_utils/http';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

vi.mock('../../../_utils/http', () => ({
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

vi.mock('../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): ApiResponse & {
  statusCode?: number;
  jsonBody?: unknown;
  endBody?: string;
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
        end: (text?: string) => {
          res.endBody = text || '';
        },
      };
    }),
  };
  return res;
}

describe('/api/v2/amro/master-data/[entity]', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, AMRO_MASTER_DATA_V2_ENABLED: 'true' };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-master-data',
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

  it('returns paginated records for supported entity GET', async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1', tail_number: 'N100AA', status: 'active' }],
      count: 1,
      error: null,
    });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'aircraft',
        page: '1',
        page_size: '25',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalledWith(
      ['view_amro_dashboard', 'edit_aircraft_records'],
      ['view_amro_dashboard', 'edit_aircraft_records'],
    );
    expect(fromMock).toHaveBeenCalledWith('aircraft');
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records?.length).toBe(1);
    expect((res.jsonBody as any)?.output?.entity).toBe('aircraft');
  });

  it('returns paginated records for regulator profiles GET', async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      data: [{ id: 'reg-1', regulator_code: 'FAA', regulator_name: 'Federal Aviation Administration', jurisdiction: 'US' }],
      count: 1,
      error: null,
    });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'regulator_profiles',
        page: '1',
        page_size: '25',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(fromMock).toHaveBeenCalledWith('regulator_profiles');
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.entity).toBe('regulator_profiles');
    expect((res.jsonBody as any)?.output?.records?.[0]?.regulator_code).toBe('FAA');
  });

  it('returns empty records when entity table is unavailable', async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      data: null,
      count: null,
      error: { message: 'relation "public.regulator_profiles" does not exist' },
    });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'regulator_profiles',
        page: '1',
        page_size: '25',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.entity).toBe('regulator_profiles');
    expect((res.jsonBody as any)?.output?.records).toEqual([]);
    expect((res.jsonBody as any)?.output?.total).toBe(0);
  });

  it('retries without unavailable columns when select clause has missing column', async () => {
    const rangeMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        count: null,
        error: { message: 'column policy_snapshot_id does not exist' },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'wpt-1', template_code: 'TMP-001', template_name: 'Transit Check', maintenance_type: 'line' }],
        count: 1,
        error: null,
      });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'work_package_templates',
        page: '1',
        page_size: '25',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(selectMock.mock.calls[0]?.[0]).toContain('policy_snapshot_id');
    expect(selectMock.mock.calls[1]?.[0]).not.toContain('policy_snapshot_id');
    expect((res.jsonBody as any)?.output?.records?.length).toBe(1);
  });

  it('rejects unsupported methods', async () => {
    const req: ApiRequest = {
      method: 'PUT',
      query: {
        entity: 'aircraft',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect((res.jsonBody as any)?.error).toContain('Method PUT Not Allowed');
    expect(res.headers.Allow).toEqual(['GET', 'POST']);
  });

  it('returns 401 when authentication fails', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('Unauthorized'));
    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'aircraft',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect((res.jsonBody as any)?.error).toBe('Unauthorized');
  });

  it('returns validation results without inserting records for validate_only POST', async () => {
    const fromMock = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: {
        entity: 'parts_inventory',
        validate_only: 'true',
      },
      body: {
        part_number: 'PN-100',
        warehouse_location: 'MAIN',
        quantity_on_hand: 2,
        quantity_reserved: 3,
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.validation?.is_valid).toBe(false);
    expect((res.jsonBody as any)?.output?.validation?.issues?.length).toBeGreaterThan(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

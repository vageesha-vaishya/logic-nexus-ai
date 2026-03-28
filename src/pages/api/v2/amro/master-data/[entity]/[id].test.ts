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
    const existingQuery: any = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: maybeSingleMock,
    };
    existingQuery.eq.mockReturnValue(existingQuery);
    existingQuery.limit.mockReturnValue(existingQuery);
    const selectMock = vi.fn().mockReturnValue(existingQuery);
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
    const existingQuery: any = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: maybeSingleMock,
    };
    existingQuery.eq.mockReturnValue(existingQuery);
    existingQuery.limit.mockReturnValue(existingQuery);
    const selectMock = vi.fn().mockReturnValue(existingQuery);
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

  it('returns PATCH validation results when validate_only is enabled', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: 'inv-1', part_number: 'PN-100', tenant_id: 'tenant-1' },
      error: null,
    });
    const existingQuery: any = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: maybeSingleMock,
    };
    existingQuery.eq.mockReturnValue(existingQuery);
    existingQuery.limit.mockReturnValue(existingQuery);
    const selectMock = vi.fn().mockReturnValue(existingQuery);
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { entity: 'parts_inventory', id: 'inv-1', validate_only: 'true' },
      body: {
        quantity_on_hand: 1,
        quantity_reserved: 2,
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.validation?.is_valid).toBe(false);
    expect((res.jsonBody as any)?.output?.validation?.issues?.length).toBeGreaterThan(0);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('updates only provided PATCH fields for aircraft records', async () => {
    const existingMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ac-1',
        tenant_id: 'tenant-1',
        tail_number: 'N100AA',
        registration: 'N100AA',
        serial_number: 'SN-100',
        aircraft_type: 'A320',
        aircraft_model: 'A320-200',
        model: 'A320-200',
        status: 'active',
      },
      error: null,
    });
    const existingQuery: any = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: existingMaybeSingleMock,
    };
    existingQuery.eq.mockReturnValue(existingQuery);
    existingQuery.limit.mockReturnValue(existingQuery);
    const existingSelectMock = vi.fn().mockReturnValue(existingQuery);

    const updateMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ac-1',
        tenant_id: 'tenant-1',
        tail_number: 'N100AB',
        registration: 'N100AB',
      },
      error: null,
    });
    const updateQuery: any = {
      eq: vi.fn(),
      select: vi.fn(),
      limit: vi.fn(),
      maybeSingle: updateMaybeSingleMock,
    };
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.limit.mockReturnValue(updateQuery);
    const updateMock = vi.fn().mockReturnValue(updateQuery);

    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'aircraft') {
        if (fromMock.mock.calls.length === 1) {
          return { select: existingSelectMock };
        }
        return { update: updateMock };
      }
      if (table === 'maintenance_events') {
        return { insert: auditInsertMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { entity: 'aircraft', id: 'ac-1' },
      body: {
        tail_number: 'N100AB',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    const updatePayload = updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatePayload.tail_number).toBe('N100AB');
    expect(updatePayload.registration).toBe('N100AB');
    expect(updatePayload.status).toBeUndefined();
    expect(updatePayload.model).toBeUndefined();
    expect(updatePayload.manufacturer_id).toBeUndefined();
    expect(updatePayload.updated_by).toBe('user-1');
    expect(res.statusCode).toBe(200);
  });
});

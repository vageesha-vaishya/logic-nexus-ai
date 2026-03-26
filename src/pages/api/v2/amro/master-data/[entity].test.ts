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
    const eqMock = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1', tail_number: 'N100AA', status: 'active' }],
      count: 1,
      error: null,
    });
    const rangeMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
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

  it('accepts hyphenated flight logs entity route segment', async () => {
    const eqTenantMock = vi.fn();
    const eqDeletedMock = vi.fn().mockResolvedValue({
      data: [{ id: 'fl-1', aircraft_id: 'ac-1', is_deleted: false }],
      count: 1,
      error: null,
    });
    eqTenantMock.mockReturnValue({ eq: eqDeletedMock });
    const rangeMock = vi.fn().mockReturnValue({ eq: eqTenantMock });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const aircraftEnrichIn = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1', tail_number: 'N100AA', status: 'active' }],
      error: null,
    });
    const aircraftEnrichEqTenant = vi.fn().mockReturnValue({ in: aircraftEnrichIn });
    const aircraftEnrichSelect = vi.fn().mockReturnValue({ eq: aircraftEnrichEqTenant });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({ select: selectMock })
      .mockReturnValueOnce({ select: aircraftEnrichSelect });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'flight-logs',
        page: '1',
        page_size: '25',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(fromMock).toHaveBeenCalledWith('flight_logs');
    expect(eqTenantMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(eqDeletedMock).toHaveBeenCalledWith('is_deleted', false);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.entity).toBe('flight_logs');
  });

  it('filters flight logs by date range, pilot, flight number, and aircraft registration', async () => {
    const flightLogsResolve = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'fl-1',
          tenant_id: 'tenant-1',
          aircraft_id: 'ac-1',
          flight_date: '2026-03-01',
          flight_number: 'LN100',
          pilot_name: 'Jane Doe',
          is_deleted: false,
        },
      ],
      count: 1,
      error: null,
    });
    const flightLogsIn = vi.fn().mockReturnValue({ or: flightLogsResolve });
    const flightLogsIlikeFlight = vi.fn().mockReturnValue({ in: flightLogsIn });
    const flightLogsIlikePilot = vi.fn().mockReturnValue({ ilike: flightLogsIlikeFlight });
    const flightLogsLte = vi.fn().mockReturnValue({ ilike: flightLogsIlikePilot });
    const flightLogsGte = vi.fn().mockReturnValue({ lte: flightLogsLte });
    const flightLogsEqDeleted = vi.fn().mockReturnValue({ gte: flightLogsGte });
    const flightLogsEqTenant = vi.fn().mockReturnValue({ eq: flightLogsEqDeleted });
    const flightLogsRange = vi.fn().mockReturnValue({ eq: flightLogsEqTenant });
    const flightLogsOrder = vi.fn().mockReturnValue({ range: flightLogsRange });
    const flightLogsSelect = vi.fn().mockReturnValue({ order: flightLogsOrder });

    const aircraftRegistrationResolve = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1' }],
      error: null,
    });
    const aircraftRegistrationIlike = vi.fn().mockReturnValue({ or: aircraftRegistrationResolve });
    const aircraftRegistrationEqTenant = vi.fn().mockReturnValue({ ilike: aircraftRegistrationIlike });
    const aircraftRegistrationSelect = vi.fn().mockReturnValue({ eq: aircraftRegistrationEqTenant });

    const aircraftEnrichIn = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1', tail_number: 'N900LN', status: 'active' }],
      error: null,
    });
    const aircraftEnrichEqTenant = vi.fn().mockReturnValue({ in: aircraftEnrichIn });
    const aircraftEnrichSelect = vi.fn().mockReturnValue({ eq: aircraftEnrichEqTenant });

    const fromMock = vi
      .fn()
      .mockReturnValueOnce({ select: aircraftRegistrationSelect })
      .mockReturnValueOnce({ select: flightLogsSelect })
      .mockReturnValueOnce({ select: aircraftEnrichSelect });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'flight_logs',
        page: '1',
        page_size: '25',
        flight_from: '2026-03-01',
        flight_to: '2026-03-31',
        pilot_name: 'Jane',
        flight_number: 'LN',
        aircraft_registration: 'N900',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(flightLogsGte).toHaveBeenCalledWith('flight_date', '2026-03-01');
    expect(flightLogsLte).toHaveBeenCalledWith('flight_date', '2026-03-31');
    expect(flightLogsIlikePilot).toHaveBeenCalledWith('pilot_name', '%Jane%');
    expect(flightLogsIlikeFlight).toHaveBeenCalledWith('flight_number', '%LN%');
    expect(flightLogsIn).toHaveBeenCalledWith('aircraft_id', ['ac-1']);
    expect((res.jsonBody as any)?.output?.records?.[0]?.aircraft_registration).toBe('N900LN');
    expect((res.jsonBody as any)?.output?.records?.[0]?.aircraft_status).toBe('active');
    expect(res.statusCode).toBe(200);
  });

  it('applies tenant scoping to master data queries', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [{ id: 'man-1', manufacturer_code: 'BOE', name: 'Boeing', is_active: true }],
      count: 1,
      error: null,
    });
    const rangeMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity: 'manufacturers',
        page: '1',
        page_size: '25',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.entity).toBe('manufacturers');
  });

  it('returns paginated records for regulator profiles GET', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [{ id: 'reg-1', regulator_code: 'FAA', regulator_name: 'Federal Aviation Administration', jurisdiction: 'US' }],
      count: 1,
      error: null,
    });
    const rangeMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
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
    const eqMock = vi.fn().mockResolvedValue({
      data: null,
      count: null,
      error: { message: 'relation "public.regulator_profiles" does not exist' },
    });
    const rangeMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
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
    const eqMock = vi
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
    const rangeMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
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

  it('rejects assembly models with cross-tenant references', async () => {
    const manufacturersInMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const manufacturersEqMock = vi.fn().mockReturnValue({ in: manufacturersInMock });
    const manufacturersSelectMock = vi.fn().mockReturnValue({ eq: manufacturersEqMock });
    const assemblyTypesInMock = vi.fn().mockResolvedValue({
      data: [{ id: 'type-1', tenant_id: 'tenant-1', franchise_id: null, is_active: true }],
      error: null,
    });
    const assemblyTypesEqMock = vi.fn().mockReturnValue({ in: assemblyTypesInMock });
    const assemblyTypesSelectMock = vi.fn().mockReturnValue({ eq: assemblyTypesEqMock });

    const fromMock = vi.fn((table: string) => {
      if (table === 'manufacturers') {
        return { select: manufacturersSelectMock };
      }
      if (table === 'assembly_types') {
        return { select: assemblyTypesSelectMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: {
        entity: 'assembly_models',
      },
      body: {
        manufacturer_id: 'man-1',
        assembly_type_id: 'type-1',
        model_code: 'MDL-100',
        name: 'Model 100',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.error).toContain('Validation failed');
  });
});

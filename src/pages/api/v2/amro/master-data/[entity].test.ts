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
    const aircraftEnrichEqTenant = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1', tail_number: 'N100AA', status: 'active' }],
      error: null,
    });
    const aircraftEnrichIn = vi.fn().mockReturnValue({ eq: aircraftEnrichEqTenant });
    const aircraftEnrichSelect = vi.fn().mockReturnValue({ in: aircraftEnrichIn });
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

    const aircraftEnrichEqTenant = vi.fn().mockResolvedValue({
      data: [{ id: 'ac-1', tail_number: 'N900LN', status: 'active' }],
      error: null,
    });
    const aircraftEnrichIn = vi.fn().mockReturnValue({ eq: aircraftEnrichEqTenant });
    const aircraftEnrichSelect = vi.fn().mockReturnValue({ in: aircraftEnrichIn });

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
        entity: 'work_order_templates',
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

  it('normalizes aircraft status alias and model fallback during create', async () => {
    const manufacturersSelectMock = vi.fn().mockResolvedValue({
      data: [{ id: 'man-1', manufacturer_code: 'BOE', name: 'Boeing', is_active: true }],
      error: null,
    });
    const insertMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ac-2',
        tail_number: 'N200AA',
        serial_number: 'SN-200',
        aircraft_type: 'A320',
        aircraft_model: 'A320neo',
        model: 'A320neo',
        status: 'retired',
        manufacturer_id: 'man-1',
      },
      error: null,
    });
    const insertSelectMock = vi.fn().mockReturnValue({ maybeSingle: insertMaybeSingleMock });
    const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const assemblyModelsInMock = vi.fn().mockResolvedValue({
      data: [{ id: 'model-1', manufacturer_id: 'man-1', model_code: 'A320neo', name: 'A320neo', primary_model: 'A320neo', is_active: true }],
      error: null,
    });
    const assemblyModelsEqMock = vi.fn().mockReturnValue({ in: assemblyModelsInMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'manufacturers') {
        return { select: manufacturersSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      if (table === 'aircraft') {
        return { insert: insertMock };
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
      method: 'POST',
      query: {
        entity: 'aircraft',
      },
      body: {
        tail_number: 'N200AA',
        serial_number: 'SN-200',
        aircraft_type: 'A320',
        aircraft_model: 'A320neo',
        manufacturer: 'Boeing',
        status: 'inactive',
        manufacturing_date: '2026-03-01',
        engine_install_history: [{ engine_serial_number: 'ENG-200-1', engine_position: 'L', installed_at: '2026-03-01' }],
        thrust_rating_change_log: [{ engine_serial_number: 'ENG-200-1', rated_thrust: 27000, effective_from: '2026-03-02' }],
        on_wing_lifecycle_records: [{ engine_serial_number: 'ENG-200-1', event_type: 'on_wing_start', event_at: '2026-03-03' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    const insertPayload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertPayload?.status).toBe('retired');
    expect(insertPayload?.model).toBe('A320neo');
    expect(insertPayload?.manufacturer_id).toBe('man-1');
    expect(insertPayload?.manufacturing_date).toBe('2026-03-01');
    expect(insertPayload?.engine_install_history).toEqual([{ engine_serial_number: 'ENG-200-1', engine_position: 'L', installed_at: '2026-03-01' }]);
    expect(insertPayload?.thrust_rating_change_log).toEqual([{ engine_serial_number: 'ENG-200-1', rated_thrust: 27000, effective_from: '2026-03-02' }]);
    expect(insertPayload?.on_wing_lifecycle_records).toEqual([{ engine_serial_number: 'ENG-200-1', event_type: 'on_wing_start', event_at: '2026-03-03' }]);
    expect(res.statusCode).toBe(201);
  });

  it('generates a deterministic placeholder serial when aircraft is submitted without serial number', async () => {
    const manufacturersSelectMock = vi.fn().mockResolvedValue({
      data: [{ id: 'man-1', manufacturer_code: 'BOE', name: 'Boeing', is_active: true }],
      error: null,
    });
    const insertMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ac-3',
        tail_number: 'N300AA',
        serial_number: 'NSN-N300AA',
        aircraft_type: 'A320',
        aircraft_model: 'A320neo',
        manufacturer_id: 'man-1',
        status: 'active',
      },
      error: null,
    });
    const insertSelectMock = vi.fn().mockReturnValue({ maybeSingle: insertMaybeSingleMock });
    const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const assemblyModelsInMock = vi.fn().mockResolvedValue({
      data: [{ id: 'model-1', manufacturer_id: 'man-1', model_code: 'A320neo', name: 'A320neo', primary_model: 'A320neo', is_active: true }],
      error: null,
    });
    const assemblyModelsEqMock = vi.fn().mockReturnValue({ in: assemblyModelsInMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'manufacturers') {
        return { select: manufacturersSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      if (table === 'aircraft') {
        return { insert: insertMock };
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
      method: 'POST',
      query: {
        entity: 'aircraft',
      },
      body: {
        tail_number: 'N300AA',
        serial_number: 'N/A',
        aircraft_type: 'A320',
        aircraft_model: 'A320neo',
        manufacturer: 'Boeing',
        status: 'active',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    const insertPayload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertPayload?.serial_number).toBe('NSN-N300AA');
    expect(res.statusCode).toBe(201);
  });

  it('returns aircraft validation issue when manufacturing_date format is invalid', async () => {
    const manufacturersSelectMock = vi.fn().mockResolvedValue({
      data: [{ id: 'man-1', manufacturer_code: 'BOE', name: 'Boeing', is_active: true }],
      error: null,
    });
    const assemblyModelsInMock = vi.fn().mockResolvedValue({
      data: [{ id: 'model-1', manufacturer_id: 'man-1', model_code: 'A320neo', name: 'A320neo', primary_model: 'A320neo', is_active: true }],
      error: null,
    });
    const assemblyModelsEqMock = vi.fn().mockReturnValue({ in: assemblyModelsInMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'manufacturers') {
        return { select: manufacturersSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: {
        entity: 'aircraft',
        validate_only: 'true',
      },
      body: {
        tail_number: 'N400AA',
        serial_number: 'SN-400',
        aircraft_type: 'A320',
        aircraft_model: 'A320neo',
        manufacturer_id: 'man-1',
        status: 'active',
        manufacturing_date: '03-28-2026',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.validation?.is_valid).toBe(false);
    expect(
      ((res.jsonBody as any)?.output?.validation?.issues || []).some(
        (issue: any) => issue?.field === 'manufacturing_date' && String(issue?.message || '').includes('YYYY-MM-DD'),
      ),
    ).toBe(true);
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
    expect((res.jsonBody as any)?.output?.validation?.is_valid).toBe(false);
    expect(((res.jsonBody as any)?.output?.validation?.issues || []).length).toBeGreaterThan(0);
  });

  it('rejects aircraft create when aircraft_model does not belong to selected manufacturer', async () => {
    const manufacturersSelectMock = vi.fn().mockResolvedValue({
      data: [
        { id: 'man-1', manufacturer_code: 'BOE', name: 'Boeing', is_active: true },
        { id: 'man-2', manufacturer_code: 'AIR', name: 'Airbus', is_active: true },
      ],
      error: null,
    });
    const assemblyModelsInMock = vi.fn().mockResolvedValue({
      data: [{ id: 'model-air-1', manufacturer_id: 'man-2', model_code: 'A320-200', name: 'A320-200', primary_model: 'A320-200', is_active: true }],
      error: null,
    });
    const assemblyModelsEqMock = vi.fn().mockReturnValue({ in: assemblyModelsInMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'manufacturers') {
        return { select: manufacturersSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'aircraft' },
      body: {
        tail_number: 'N500AA',
        serial_number: 'SN-500',
        aircraft_type: 'NarrowBody',
        manufacturer_id: 'man-2',
        aircraft_model: 'B737-800',
        status: 'active',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    const issues = ((res.jsonBody as any)?.output?.validation?.issues || []) as Array<{ field?: string; message?: string }>;
    expect(issues.some((issue) => issue.field === 'aircraft_model' && String(issue.message || '').includes('selected manufacturer'))).toBe(true);
  });

  it('rejects aircraft bulk import rows with manufacturer-model dependency mismatch', async () => {
    const manufacturersSelectMock = vi.fn().mockResolvedValue({
      data: [{ id: 'man-1', manufacturer_code: 'BOE', name: 'Boeing', is_active: true }],
      error: null,
    });
    const assemblyModelsInMock = vi.fn().mockResolvedValue({
      data: [{ id: 'model-boe-1', manufacturer_id: 'man-1', model_code: 'B737-800', name: 'B737-800', primary_model: 'B737-800', is_active: true }],
      error: null,
    });
    const assemblyModelsEqMock = vi.fn().mockReturnValue({ in: assemblyModelsInMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'manufacturers') {
        return { select: manufacturersSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'aircraft', validate_only: 'true' },
      body: {
        operation: 'bulk_import',
        records: [
          {
            tail_number: 'N501AA',
            serial_number: 'SN-501',
            aircraft_type: 'NarrowBody',
            manufacturer_id: 'man-1',
            aircraft_model: 'A320-200',
            status: 'active',
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const results = ((res.jsonBody as any)?.output?.validation?.results || []) as Array<{ issues?: Array<{ field?: string; message?: string }> }>;
    expect(results[0]?.issues?.some((issue) => issue.field === 'aircraft_model' && String(issue.message || '').includes('selected manufacturer'))).toBe(true);
  });

  it('creates work package template and reads link snapshot after insert', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        record: {
          id: 'wpt-1',
          template_code: 'WP-LINE-001',
          template_name: 'Line Check Package',
          maintenance_type: 'line',
          tasks_json: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
        },
        created_relationships: [
          {
            work_order_template_id: 'wpt-1',
            task_template_id: '11111111-1111-4111-8111-111111111111',
            tenant_id: 'tenant-1',
            model_id: 'model-1',
          },
        ],
      },
      error: null,
    });
    const linkEqTemplateMock = vi.fn().mockResolvedValue({
      data: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
      error: null,
    });
    const linkEqTenantMock = vi.fn().mockReturnValue({ eq: linkEqTemplateMock });
    const linkSelectMock = vi.fn().mockReturnValue({ eq: linkEqTenantMock });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'work_package_template_task_templates') {
        return { select: linkSelectMock };
      }
      if (table === 'maintenance_events') {
        return { insert: auditInsertMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock, rpc: rpcMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'work_order_templates' },
      body: {
        template_code: 'WP-LINE-001',
        version: 1,
        active: true,
        template_name: 'Line Check Package',
        maintenance_type: 'line',
        scope_json: [],
        tasks_json: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    const rpcPayload = (rpcArgs?.p_payload || {}) as Record<string, unknown>;
    expect(Array.isArray(rpcPayload.tasks_json)).toBe(true);
    expect(Array.isArray(rpcPayload.scope_json)).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('work_package_template_task_templates');
    expect(linkEqTemplateMock).toHaveBeenCalledWith('work_order_template_id', 'wpt-1');
  });

  it('roundtrips model_id and aircraft_model in work package template create flow', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        record: {
          id: 'wpt-model-1',
          template_code: 'WP-MODEL-001',
          template_name: 'Model Context Package',
          maintenance_type: 'line',
          tasks_json: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
        },
        created_relationships: [
          {
            work_order_template_id: 'wpt-model-1',
            task_template_id: '11111111-1111-4111-8111-111111111111',
            tenant_id: 'tenant-1',
            model_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        ],
      },
      error: null,
    });
    const linkEqTemplateMock = vi.fn().mockResolvedValue({
      data: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
      error: null,
    });
    const linkEqTenantMock = vi.fn().mockReturnValue({ eq: linkEqTemplateMock });
    const linkSelectMock = vi.fn().mockReturnValue({ eq: linkEqTenantMock });
    const patchMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'wpt-model-1',
        template_code: 'WP-MODEL-001',
        template_name: 'Model Context Package',
        maintenance_type: 'line',
        assembly_models_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        aircraft_model: 'A320neo',
      },
      error: null,
    });
    const patchQuery: any = {
      eq: vi.fn(),
      select: vi.fn(),
      limit: vi.fn(),
      maybeSingle: patchMaybeSingleMock,
    };
    patchQuery.eq.mockReturnValue(patchQuery);
    patchQuery.select.mockReturnValue(patchQuery);
    patchQuery.limit.mockReturnValue(patchQuery);
    const patchUpdateMock = vi.fn().mockReturnValue(patchQuery);
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'work_package_template_task_templates') {
        return { select: linkSelectMock };
      }
      if (table === 'work_order_templates') {
        return { update: patchUpdateMock };
      }
      if (table === 'maintenance_events') {
        return { insert: auditInsertMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock, rpc: rpcMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'work_order_templates' },
      body: {
        template_code: 'WP-MODEL-001',
        version: 1,
        active: true,
        template_name: 'Model Context Package',
        maintenance_type: 'line',
        assembly_models_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        aircraft_model: 'A320neo',
        scope_json: [],
        tasks_json: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    const rpcPayload = (rpcArgs?.p_payload || {}) as Record<string, unknown>;
    expect(rpcPayload.assembly_models_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(rpcPayload.aircraft_model).toBe('A320neo');
    expect(patchUpdateMock).toHaveBeenCalledWith({
      assembly_models_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      aircraft_model: 'A320neo',
    });
    expect((res.jsonBody as any)?.output?.record?.assembly_models_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect((res.jsonBody as any)?.output?.record?.aircraft_model).toBe('A320neo');
  });

  it('rolls back atomic create when task_template_id does not exist', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Validation failed: task_template_id not found (99999999-9999-4999-8999-999999999999)' },
    });
    const fromMock = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock, rpc: rpcMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'work_order_templates' },
      body: {
        template_code: 'WP-LINE-ROLLBACK',
        version: 1,
        active: true,
        template_name: 'Rollback Check',
        maintenance_type: 'line',
        scope_json: [],
        tasks_json: [{ task_template_id: '99999999-9999-4999-8999-999999999999' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(String((res.jsonBody as any)?.error || '')).toContain('Validation failed: task_template_id not found');
    expect(fromMock).not.toHaveBeenCalledWith('maintenance_events');
  });

  it('creates work package template with no selected tasks and returns empty relationships', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        record: {
          id: 'wpt-empty-1',
          template_code: 'WP-EMPTY-001',
          template_name: 'Empty Tasks',
          maintenance_type: 'line',
          tasks_json: [],
        },
        created_relationships: [],
      },
      error: null,
    });
    const linkEqTemplateMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const linkEqTenantMock = vi.fn().mockReturnValue({ eq: linkEqTemplateMock });
    const linkSelectMock = vi.fn().mockReturnValue({ eq: linkEqTenantMock });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'work_package_template_task_templates') {
        return { select: linkSelectMock };
      }
      if (table === 'maintenance_events') {
        return { insert: auditInsertMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock, rpc: rpcMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'work_order_templates' },
      body: {
        template_code: 'WP-EMPTY-001',
        version: 1,
        active: true,
        template_name: 'Empty Tasks',
        maintenance_type: 'line',
        scope_json: [],
        tasks_json: [],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(Array.isArray((res.jsonBody as any)?.output?.created_task_relationships)).toBe(true);
    expect(((res.jsonBody as any)?.output?.created_task_relationships || []).length).toBe(0);
    expect(linkEqTemplateMock).toHaveBeenCalledWith('work_order_template_id', 'wpt-empty-1');
  });

  it('creates ATA code with parent hierarchy context', async () => {
    const franchiseMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: '22222222-2222-4222-8222-222222222222' },
      error: null,
    });
    const franchiseQuery: any = {
      eq: vi.fn(),
      maybeSingle: franchiseMaybeSingleMock,
    };
    franchiseQuery.eq.mockReturnValue(franchiseQuery);
    const franchiseSelectMock = vi.fn().mockReturnValue(franchiseQuery);

    const ataSelectMaybeSingleMock = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          franchise_id: '22222222-2222-4222-8222-222222222222',
          level: 2,
          code: '24',
          is_active: true,
        },
        error: null,
      });
    const ataSelectQuery: any = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: ataSelectMaybeSingleMock,
    };
    ataSelectQuery.eq.mockReturnValue(ataSelectQuery);
    ataSelectQuery.limit.mockReturnValue(ataSelectQuery);
    const ataSelectMock = vi.fn().mockReturnValue(ataSelectQuery);
    const ataInsertMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ata-child',
        tenant_id: 'tenant-1',
        franchise_id: '22222222-2222-4222-8222-222222222222',
        code: '24-10',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 3,
        chapter_code: '24',
        parent_code_ref: '24',
        is_active: true,
      },
      error: null,
    });
    const ataInsertSelectMock = vi.fn().mockReturnValue({ maybeSingle: ataInsertMaybeSingleMock });
    const ataInsertMock = vi.fn().mockReturnValue({ select: ataInsertSelectMock });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });

    const fromMock = vi.fn((table: string) => {
      if (table === 'franchises') return { select: franchiseSelectMock };
      if (table === 'ata_codes') return { select: ataSelectMock, insert: ataInsertMock };
      if (table === 'maintenance_events') return { insert: auditInsertMock };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'ata_codes' },
      body: {
        code: '24-10',
        description: 'Electrical Power',
        chapter_code: '24',
        parent_id: '11111111-1111-4111-8111-111111111111',
        franchise_id: '22222222-2222-4222-8222-222222222222',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    const insertPayload = (ataInsertMock.mock.calls[0]?.[0] || {}) as Record<string, unknown>;
    expect(insertPayload.code).toBe('24-10');
    expect(insertPayload.level).toBe(3);
    expect(insertPayload.parent_code_ref).toBe('24');
    expect(insertPayload.tenant_id).toBe('tenant-1');
    expect(res.statusCode).toBe(201);
  });

  it('returns ATA chapter_code validation issue for malformed values', async () => {
    const ataSelectMaybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const ataSelectQuery: any = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: ataSelectMaybeSingleMock,
    };
    ataSelectQuery.eq.mockReturnValue(ataSelectQuery);
    ataSelectQuery.limit.mockReturnValue(ataSelectQuery);
    const ataSelectMock = vi.fn().mockReturnValue(ataSelectQuery);
    const fromMock = vi.fn((table: string) => {
      if (table === 'ata_codes') return { select: ataSelectMock };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { entity: 'ata_codes', validate_only: 'true' },
      body: {
        code: '24',
        chapter_code: '240',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.validation?.is_valid).toBe(false);
    expect(
      ((res.jsonBody as any)?.output?.validation?.issues || []).some(
        (issue: any) => issue?.field === 'chapter_code' && String(issue?.message || '').includes('exactly 2 characters'),
      ),
    ).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('ata_codes');
  });
});

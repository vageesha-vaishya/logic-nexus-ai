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

  it('returns validation issue when updated aircraft_model does not belong to effective manufacturer', async () => {
    const existingMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ac-2',
        tenant_id: 'tenant-1',
        manufacturer_id: 'man-2',
        aircraft_model: 'A320-200',
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

    const assemblyModelsEqManufacturerMock = vi.fn().mockResolvedValue({
      data: [{ id: 'model-air-1', manufacturer_id: 'man-2', model_code: 'A320-200', name: 'A320-200', primary_model: 'A320-200', is_active: true }],
      error: null,
    });
    const assemblyModelsEqTenantMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqManufacturerMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqTenantMock });

    const fromMock = vi.fn((table: string) => {
      if (table === 'aircraft') {
        return { select: existingSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { entity: 'aircraft', id: 'ac-2', validate_only: 'true' },
      body: {
        aircraft_model: 'B737-800',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const issues = ((res.jsonBody as any)?.output?.validation?.issues || []) as Array<{ field?: string; message?: string }>;
    expect(issues.some((issue) => issue.field === 'aircraft_model' && String(issue.message || '').includes('selected manufacturer'))).toBe(true);
  });

  it('updates work package template and reads synchronized link snapshot', async () => {
    const existingMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'wpt-1',
        tenant_id: 'tenant-1',
        template_code: 'WP-LINE-001',
        template_name: 'Line Check Package',
        maintenance_type: 'line',
        tasks_json: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }],
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
        id: 'wpt-1',
        tenant_id: 'tenant-1',
        template_name: 'Line Check Updated',
        assembly_models_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        aircraft_model: 'A320neo',
        tasks_json: [{ task_template_id: '22222222-2222-4222-8222-222222222222' }],
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

    const linkEqTemplateMock = vi.fn().mockResolvedValue({
      data: [{ task_template_id: '22222222-2222-4222-8222-222222222222' }],
      error: null,
    });
    const linkEqTenantMock = vi.fn().mockReturnValue({ eq: linkEqTemplateMock });
    const linkSelectMock = vi.fn().mockReturnValue({ eq: linkEqTenantMock });
    const relationDeleteEqTemplateMock = vi.fn().mockResolvedValue({ error: null });
    const relationDeleteEqTenantMock = vi.fn().mockReturnValue({ eq: relationDeleteEqTemplateMock });
    const relationDeleteMock = vi.fn().mockReturnValue({ eq: relationDeleteEqTenantMock });
    const relationInsertMock = vi.fn().mockResolvedValue({ error: null });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const taskTemplatesInMock = vi.fn().mockResolvedValue({
      data: [{ id: '22222222-2222-4222-8222-222222222222', assembly_models: 'model-1', franchise_id: null }],
      error: null,
    });
    const taskTemplatesEqMock = vi.fn().mockReturnValue({ in: taskTemplatesInMock });
    const taskTemplatesSelectMock = vi.fn().mockReturnValue({ eq: taskTemplatesEqMock });
    const assemblyModelsLimitMock = vi.fn().mockResolvedValue({
      data: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', franchise_id: null, model_code: 'A320neo', name: 'A320neo', primary_model: 'A320neo' }],
      error: null,
    });
    const assemblyModelsOrSecondaryMock = vi.fn().mockReturnValue({ limit: assemblyModelsLimitMock });
    const assemblyModelsOrPrimaryMock = vi.fn().mockReturnValue({ limit: assemblyModelsLimitMock, or: assemblyModelsOrSecondaryMock });
    const assemblyModelsEqMock = vi.fn().mockReturnValue({ or: assemblyModelsOrPrimaryMock });
    const assemblyModelsSelectMock = vi.fn().mockReturnValue({ eq: assemblyModelsEqMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'work_package_templates') {
        if (fromMock.mock.calls.length === 1) {
          return { select: existingSelectMock };
        }
        return { update: updateMock };
      }
      if (table === 'work_package_template_task_templates') {
        return { select: linkSelectMock, delete: relationDeleteMock, insert: relationInsertMock };
      }
      if (table === 'task_templates') {
        return { select: taskTemplatesSelectMock };
      }
      if (table === 'assembly_models') {
        return { select: assemblyModelsSelectMock };
      }
      if (table === 'maintenance_events') {
        return { insert: auditInsertMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { entity: 'work_package_templates', id: 'wpt-1' },
      body: {
        template_name: 'Line Check Updated',
        assembly_models_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        aircraft_model: 'A320neo',
        tasks_json: [{ task_template_id: '22222222-2222-4222-8222-222222222222' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updatePayload = (updateMock.mock.calls[0]?.[0] || {}) as Record<string, unknown>;
    expect(updatePayload.assembly_models_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(updatePayload.aircraft_model).toBe('A320neo');
    expect((res.jsonBody as any)?.output?.record?.assembly_models_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect((res.jsonBody as any)?.output?.record?.aircraft_model).toBe('A320neo');
    expect(fromMock).toHaveBeenCalledWith('work_package_template_task_templates');
    expect(linkEqTemplateMock).toHaveBeenCalledWith('work_package_template_id', 'wpt-1');
  });

  it('rejects ATA update when parent relationship introduces a circular chain', async () => {
    const existingMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ata-1',
        tenant_id: 'tenant-1',
        code: '24',
        parent_id: null,
        franchise_id: null,
        level: 1,
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

    const ataSelectMaybeSingleMock = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'ata-child', parent_id: 'ata-1' }, error: null });
    const ataSelectQuery: any = {
      eq: vi.fn(),
      neq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: ataSelectMaybeSingleMock,
    };
    ataSelectQuery.eq.mockReturnValue(ataSelectQuery);
    ataSelectQuery.neq.mockReturnValue(ataSelectQuery);
    ataSelectQuery.limit.mockReturnValue(ataSelectQuery);
    const ataSelectMock = vi.fn().mockReturnValue(ataSelectQuery);
    const ataUpdateMock = vi.fn();

    const fromMock = vi.fn((table: string) => {
      if (table === 'ata_codes') {
        if (fromMock.mock.calls.length === 1) return { select: existingSelectMock };
        return { select: ataSelectMock, update: ataUpdateMock };
      }
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { entity: 'ata_codes', id: 'ata-1' },
      body: {
        parent_id: 'ata-child',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(String((res.jsonBody as any)?.error || '')).toContain('Circular ATA hierarchy is not allowed');
    expect(ataUpdateMock).not.toHaveBeenCalled();
  });

  it('soft deletes ATA code by setting is_active=false', async () => {
    const existingMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ata-10',
        tenant_id: 'tenant-1',
        code: '10',
        is_active: true,
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

    const deleteEqTenantMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEqIdMock = vi.fn().mockReturnValue({ eq: deleteEqTenantMock });
    const ataUpdateMock = vi.fn().mockReturnValue({ eq: deleteEqIdMock });
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'ata_codes') {
        if (fromMock.mock.calls.length === 1) return { select: existingSelectMock };
        return { update: ataUpdateMock };
      }
      if (table === 'maintenance_events') return { insert: auditInsertMock };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'DELETE',
      query: { entity: 'ata_codes', id: 'ata-10' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(ataUpdateMock).toHaveBeenCalledWith({
      is_active: false,
      updated_by: 'user-1',
    });
    expect(deleteEqIdMock).toHaveBeenCalledWith('id', 'ata-10');
    expect(deleteEqTenantMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  createAmroPartRecord,
  PartsApiError,
  createAmroPartsCatalogApi,
  deleteAmroPartRecord,
  mapLiveApiRecordToPartInventoryRecord,
  updateAmroPartRecord,
} from './livePartsCatalogApi';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-1' } } })),
      refreshSession: vi.fn(async () => ({ data: { session: { access_token: 'token-1' } } })),
    },
  },
}));

describe('live parts catalog api adapter', () => {
  it('maps live api records to workbench inventory records', () => {
    const mapped = mapLiveApiRecordToPartInventoryRecord({
      id: 'inv-1',
      partNumber: 'AMRO-PN-1',
      serialNumber: 'SN-1',
      description: 'Hydraulic manifold',
      status: 'low_stock',
      lifecycleStatus: 'inspection_due',
      quantityOnHand: 10,
      quantityReserved: 3,
      warehouseLocation: 'WH-A-01',
      supplierName: 'AeroLink',
      criticality: 'high',
      ataChapter: '27',
    });
    expect(mapped.part_number).toBe('AMRO-PN-1');
    expect(mapped.quantity_available).toBe(7);
    expect(mapped.status).toBe('low_stock');
    expect(mapped.lifecycle_status).toBe('inspection_due');
    expect(mapped.criticality).toBe('high');
  });

  it('loads and maps records from /api/v2/amro/parts endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        correlationId: 'corr-123',
        output: {
          page: 1,
          page_size: 25,
          total: 1,
          records: [
            {
              id: 'inv-2',
              partNumber: 'AMRO-PN-2',
              status: 'available',
              quantityOnHand: 4,
              quantityReserved: 1,
              warehouseLocation: 'WH-B-02',
              criticality: 'critical',
            },
          ],
        },
      }),
    });
    const api = createAmroPartsCatalogApi(fetchMock as never, {
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      userId: 'user-1',
      accessToken: 'token-1',
    });
    const result = await api.listParts({ page: 1, pageSize: 25, status: 'all', criticality: 'all' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(firstHeaders.get('Authorization')).toBe('Bearer token-1');
    expect(firstHeaders.get('x-tenant-id')).toBe('tenant-1');
    expect(firstHeaders.get('x-franchise-id')).toBe('franchise-1');
    expect(firstHeaders.get('x-user-id')).toBe('user-1');
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.part_number).toBe('AMRO-PN-2');
    expect(result.requestId).toBe('corr-123');
    expect(result.hasMore).toBe(false);
  });

  it('supports create, update, and delete mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await createAmroPartRecord({
      part_number: 'AMRO-PN-3',
      status: 'available',
      quantity_on_hand: 3,
      quantity_reserved: 0,
      warehouse_location: 'WH-A-01',
      criticality: 'normal',
    }, fetchMock as never);
    await updateAmroPartRecord('inv-3', { status: 'reserved', serial_number: '' }, fetchMock as never);
    await deleteAmroPartRecord('inv-3', fetchMock as never);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    const updateBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}'));
    expect(createBody.supplier_name).toBeUndefined();
    expect(createBody.criticality).toBeUndefined();
    expect(createBody.ata_chapter).toBeUndefined();
    expect(createBody.part_number).toBe('AMRO-PN-3');
    expect(updateBody.serial_number).toBeNull();
  });

  it('exposes auth diagnostics when API responds with 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'Unauthorized',
        auth_diagnostics: {
          failure_category: 'permission',
          reason_code: 'missing_permission_dashboards_view',
          remediation: 'Grant dashboards.view',
        },
      }),
    });
    const api = createAmroPartsCatalogApi(fetchMock as never, {
      tenantId: 'tenant-1',
      userId: 'user-1',
      accessToken: 'token-1',
    });
    await expect(api.listParts({ page: 1, pageSize: 20, status: 'all', criticality: 'all' }))
      .rejects.toBeInstanceOf(PartsApiError);
  });

  it('maps fallback auth diagnostics from code when auth_diagnostics is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'Missing or malformed Authorization header',
        code: 'MISSING_TOKEN',
      }),
    });
    const api = createAmroPartsCatalogApi(fetchMock as never);
    await expect(api.listParts({ page: 1, pageSize: 20, status: 'all', criticality: 'all' }))
      .rejects.toMatchObject({
        status: 401,
        authDiagnostics: {
          reasonCode: 'missing_token',
        },
      });
  });

  it('surfaces mutation validation issue details in update error messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Validation failed',
        issues: [{ field: 'serial_number', message: 'serial_number must match /^[A-Z0-9-]{0,64}$/' }],
      }),
    });
    await expect(updateAmroPartRecord('inv-4', { serial_number: 'bad serial' }, fetchMock as never))
      .rejects.toThrow(/serial_number/);
  });

  it('surfaces unsupported field diagnostics from API details', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Payload contains unsupported fields for inventory-only AMRO parts route',
        details: {
          rejected_non_inventory_fields: ['supplier_name'],
        },
      }),
    });
    await expect(updateAmroPartRecord('inv-5', { supplier_name: 'X' }, fetchMock as never))
      .rejects.toThrow(/unsupported fields: supplier_name/);
  });
});

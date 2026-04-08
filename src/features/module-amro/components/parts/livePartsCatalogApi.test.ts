import { describe, expect, it, vi } from 'vitest';
import {
  createAmroPartRecord,
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
    const api = createAmroPartsCatalogApi(fetchMock as never);
    const result = await api.listParts({ page: 1, pageSize: 25, status: 'all', criticality: 'all' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    await updateAmroPartRecord('inv-3', { status: 'reserved' }, fetchMock as never);
    await deleteAmroPartRecord('inv-3', fetchMock as never);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

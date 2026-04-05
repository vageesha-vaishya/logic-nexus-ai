import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './items';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { resolveUimAccess } from '../_shared';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-projections-items' })),
    enforceHttps: vi.fn(),
    enforceRateLimit: vi.fn(),
    handlePreflight: vi.fn(() => false),
  };
});

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../_shared', async () => {
  const actual = await vi.importActual<object>('../_shared');
  return {
    ...actual,
    resolveUimAccess: vi.fn(),
  };
});

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
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
      };
    }),
  };
  return res;
}

describe('/api/v2/uim/projections/items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('returns enriched projection rows with catalog and MRO attributes', async () => {
    const projectionRange = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'snap-1',
          inventory_item_id: 'inv-1',
          projected_available_quantity: 5,
          projected_reserved_quantity: 1,
          projected_consumed_quantity: 2,
          last_ledger_id: 'led-1',
          last_ledger_at: '2026-01-01T01:00:00Z',
          replay_version: 3,
          updated_at: '2026-01-01T01:00:00Z',
        },
      ],
      count: 1,
      error: null,
    });
    const projectionOrder = vi.fn().mockReturnValue({ range: projectionRange });
    const projectionEq = vi.fn().mockReturnValue({ order: projectionOrder });
    const projectionSelect = vi.fn().mockReturnValue({ eq: projectionEq });

    const inventoryIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          catalog_item_id: 'cat-1',
          serial_number: 'SER-001',
          batch_lot_number: 'LOT-001',
          status: 'available',
          location_type: 'warehouse',
        },
      ],
      error: null,
    });
    const inventoryEq = vi.fn().mockReturnValue({ in: inventoryIn });
    const inventorySelect = vi.fn().mockReturnValue({ eq: inventoryEq });

    const catalogIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'cat-1',
          sku: 'UIM-MRO-000001',
          part_number: 'MRO-PN-70000001',
          title: 'MRO Item',
          category: 'rotable',
          unit_of_measure: 'EA',
        },
      ],
      error: null,
    });
    const catalogEq = vi.fn().mockReturnValue({ in: catalogIn });
    const catalogSelect = vi.fn().mockReturnValue({ eq: catalogEq });

    const profileIn = vi.fn().mockResolvedValue({
      data: [
        {
          catalog_item_id: 'cat-1',
          maintenance_category: 'rotable',
          ata_chapter_code: '71',
          ata_sub_chapter_code: '01',
          ata_section_code: '01',
          condition_code: 'SV',
          certification_status: 'valid',
          aog_priority: true,
        },
      ],
      error: null,
    });
    const profileEq = vi.fn().mockReturnValue({ in: profileIn });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

    const from = vi.fn((table: string) => {
      if (table === 'uim_inventory_projection_snapshots') return { select: projectionSelect };
      if (table === 'uim_inventory_items') return { select: inventorySelect };
      if (table === 'uim_catalog_items') return { select: catalogSelect };
      if (table === 'uim_mro_item_profiles') return { select: profileSelect };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = { method: 'GET', headers: {}, query: {}, body: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const first = (res.jsonBody as any)?.output?.snapshots?.[0];
    expect(first?.part_number).toBe('MRO-PN-70000001');
    expect(first?.maintenance_category).toBe('rotable');
    expect(first?.aog_priority).toBe(true);
  });
});

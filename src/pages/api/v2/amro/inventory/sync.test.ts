import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './sync';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
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

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown } {
  const res: any = {
    setHeader: vi.fn(),
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

describe('/api/v2/amro/inventory/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AMRO_UIM_SYNC_V2_ENABLED = 'true';
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-amro-uim-sync', tenantId: '', franchiseId: '' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'db', validatedAt: '2026-04-06' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns status counters for AMRO and UIM inventory domains', async () => {
    const countResult = (count: number) => ({ count, error: null });
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValueOnce(countResult(12)),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = { method: 'GET', query: { interface: 'status' }, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-uim-sync-status');
  });

  it('syncs AMRO catalog and stock rows into UIM structures', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'catalog-1' }, error: null }),
        })),
      })),
    });

    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'parts_inventory') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'part-row-1',
                      part_number: 'PN-1001',
                      description: 'Hydraulic Pump',
                      category: 'hydraulics',
                      unit_of_measure: 'pcs',
                      quantity_on_hand: 8,
                      quantity_reserved: 2,
                      warehouse_location: 'WH-A1',
                      supplier_name: 'Aero Supplier',
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === 'uim_catalog_items') return { upsert };
        if (table === 'uim_inventory_items') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        // amro_uim_inventory_sync_events dropped by ADR-0013 Step 66.
        // The route no longer inserts here — audit is via correlation logs.
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-catalog-and-stock' },
      headers: {},
      body: { max_rows: 50 },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.synced_catalog_items).toBeGreaterThanOrEqual(1);
  });
});

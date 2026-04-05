import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './kpis';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { resolveUimAccess } from '../_shared';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-analytics-kpis' })),
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

describe('/api/v2/uim/analytics/kpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('returns KPI aggregate output', async () => {
    const projectionBuilder: any = {};
    projectionBuilder.select = vi.fn(() => projectionBuilder);
    projectionBuilder.eq = vi.fn(() => projectionBuilder);
    projectionBuilder.limit = vi.fn().mockResolvedValue({
      data: [
        {
          projected_available_quantity: 8,
          projected_reserved_quantity: 2,
          projected_consumed_quantity: 5,
          replay_version: 101,
        },
        {
          projected_available_quantity: 3,
          projected_reserved_quantity: 1,
          projected_consumed_quantity: 2,
          replay_version: 105,
        },
      ],
      error: null,
    });

    const inventoryBuilder: any = {};
    inventoryBuilder.select = vi.fn(() => inventoryBuilder);
    inventoryBuilder.eq = vi.fn(() => inventoryBuilder);
    inventoryBuilder.limit = vi.fn().mockResolvedValue({
      data: [{ status: 'available' }, { status: 'in_transit' }, { status: 'in_transit' }],
      error: null,
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'uim_inventory_projection_snapshots') return projectionBuilder;
        if (table === 'uim_inventory_items') return inventoryBuilder;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      headers: {},
      query: { low_stock_threshold: '4' },
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.low_stock_threshold).toBe(4);
    expect((res.jsonBody as any)?.output?.kpis?.available_quantity).toBe(11);
    expect((res.jsonBody as any)?.output?.kpis?.in_transit_items).toBe(2);
    expect((res.jsonBody as any)?.output?.snapshot?.replay_version).toBe(105);
  });
});

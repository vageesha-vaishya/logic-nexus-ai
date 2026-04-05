import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './reconciliation';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { resolveUimAccess } from '../_shared';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { getUimEtlTelemetrySummary } from '@/modules/uim/analytics/etlScheduler';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-analytics-reconciliation' })),
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

vi.mock('@/modules/uim/analytics/etlScheduler', async () => {
  const actual = await vi.importActual<object>('@/modules/uim/analytics/etlScheduler');
  return {
    ...actual,
    getUimEtlTelemetrySummary: vi.fn(),
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

describe('/api/v2/uim/analytics/reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
    vi.mocked(getUimEtlTelemetrySummary).mockReturnValue({
      total_runs: 4,
      completed_runs: 2,
      failed_runs: 0,
      retry_scheduled_runs: 0,
      retry_events: 0,
      average_duration_ms: 120,
      success_rate: 1,
      latest_completed_at: '2026-04-05T00:00:00.000Z',
      last_error: null,
    });
  });

  it('returns readiness checks and status payload', async () => {
    const projectionBuilder: any = {};
    projectionBuilder.select = vi.fn(() => projectionBuilder);
    projectionBuilder.eq = vi.fn(() => projectionBuilder);
    projectionBuilder.limit = vi.fn().mockResolvedValue({
      data: [
        {
          projected_available_quantity: 8,
          projected_reserved_quantity: 2,
          projected_consumed_quantity: 5,
          replay_version: 5,
        },
      ],
      error: null,
    });

    const inventoryBuilder: any = {};
    inventoryBuilder.select = vi.fn(() => inventoryBuilder);
    inventoryBuilder.eq = vi.fn(() => inventoryBuilder);
    inventoryBuilder.limit = vi.fn().mockResolvedValue({
      data: [{ status: 'available' }],
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
      query: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.readiness?.checks?.length).toBe(5);
    expect((res.jsonBody as any)?.output?.readiness?.status).toBe('ready');
    expect((res.jsonBody as any)?.output?.snapshot?.etl_failed_runs).toBe(0);
  });
});

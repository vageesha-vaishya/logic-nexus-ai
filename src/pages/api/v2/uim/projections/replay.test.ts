import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './replay';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { resolveUimAccess } from '../_shared';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-replay' })),
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

describe('/api/v2/uim/projections/replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('replays ledger and upserts snapshots', async () => {
    const ledgerLimit = vi.fn().mockResolvedValue({
      data: [
        { id: 'l-1', inventory_item_id: 'item-1', transaction_type: 'RECEIVE', quantity_changed: 10, created_at: '2026-01-01T00:00:00Z' },
        { id: 'l-2', inventory_item_id: 'item-1', transaction_type: 'RESERVE', quantity_changed: 4, created_at: '2026-01-01T01:00:00Z' },
      ],
      error: null,
    });
    const ledgerOrder2 = vi.fn().mockReturnValue({ limit: ledgerLimit });
    const ledgerOrder1 = vi.fn().mockReturnValue({ order: ledgerOrder2 });
    const ledgerEq = vi.fn().mockReturnValue({ order: ledgerOrder1 });
    const ledgerSelect = vi.fn().mockReturnValue({ eq: ledgerEq });

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === 'uim_inventory_ledger') return { select: ledgerSelect };
      if (table === 'uim_inventory_projection_snapshots') return { upsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = { method: 'POST', headers: {}, query: {}, body: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.updated_snapshots).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

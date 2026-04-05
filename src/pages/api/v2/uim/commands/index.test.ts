import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './index';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { resolveUimAccess } from '../_shared';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-cmd' })),
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

describe('/api/v2/uim/commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('applies RECEIVE command and returns applied output', async () => {
    const commandMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'cmd-1', command_type: 'RECEIVE', command_status: 'accepted', command_payload: {} },
      error: null,
    });
    const commandLimit = vi.fn().mockReturnValue({ maybeSingle: commandMaybeSingle });
    const commandSelect = vi.fn().mockReturnValue({ limit: commandLimit });
    const commandInsert = vi.fn().mockReturnValue({ select: commandSelect });
    const commandUpdateEq2 = vi.fn().mockResolvedValue({ error: null });
    const commandUpdateEq1 = vi.fn().mockReturnValue({ eq: commandUpdateEq2 });
    const commandUpdate = vi.fn().mockReturnValue({ eq: commandUpdateEq1 });

    const itemMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'item-1', catalog_item_id: 'cat-1', quantity: 5, status: 'available' },
      error: null,
    });
    const itemLimit = vi.fn().mockReturnValue({ maybeSingle: itemMaybeSingle });
    const itemSelect = vi.fn().mockReturnValue({ limit: itemLimit });
    const itemInsert = vi.fn().mockReturnValue({ select: itemSelect });

    const ledgerInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string) => {
      if (table === 'uim_inventory_commands') return { insert: commandInsert, update: commandUpdate, select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) }) };
      if (table === 'uim_inventory_items') return { insert: itemInsert };
      if (table === 'uim_inventory_ledger') return { insert: ledgerInsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        command_type: 'RECEIVE',
        command_payload: {
          catalog_item_id: 'cat-1',
          quantity: 5,
        },
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.command_status).toBe('applied');
    expect(ledgerInsert).toHaveBeenCalledTimes(1);
  });

  it('returns 405 for unsupported method', async () => {
    const req: ApiRequest = {
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

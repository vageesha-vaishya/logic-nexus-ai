import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './graphql';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { resolveUimAccess } from './_shared';

vi.mock('../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-graphql' })),
    enforceHttps: vi.fn(),
    enforceRateLimit: vi.fn(),
    handlePreflight: vi.fn(() => false),
  };
});

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('./_shared', async () => {
  const actual = await vi.importActual<object>('./_shared');
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

describe('/api/v2/uim/graphql', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('returns uimHealth field', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({} as any);
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: { query: 'query { uimHealth { status apiVersion schemaPath } }' },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.uimHealth?.status).toBe('ok');
  });

  it('returns projection items field', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [{ inventory_item_id: 'item-1', projected_available_quantity: 5 }],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        query: 'query($limit:Int,$offset:Int){ uimProjectionItems(limit:$limit, offset:$offset){ inventory_item_id } }',
        variables: { limit: 10, offset: 0 },
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray((res.jsonBody as any)?.data?.uimProjectionItems)).toBe(true);
  });
});

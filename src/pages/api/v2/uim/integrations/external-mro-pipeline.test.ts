import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './external-mro-pipeline';
import { resolveUimAccess } from '../_shared';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-external-mro-pipeline' })),
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

describe('/api/v2/uim/integrations/external-mro-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('supports reserve workflow and returns integration job metadata', async () => {
    let jobCounter = 0;
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'uim_amro_sync_jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: vi.fn(() => {
              jobCounter += 1;
              return {
                select: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: `job-${jobCounter}` }, error: null }),
                  })),
                })),
              };
            }),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === 'uim_catalog_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'catalog-1' }, error: null }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'uim_inventory_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inv-1', quantity: 5 }, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'uim_inventory_reservations') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'res-1', reservation_token: 'token-1' },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === 'uim_inventory_ledger') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'uim_amro_sync_audit') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        action: 'reserve',
        part_number: 'MRO-PN-70000001',
        quantity: 1,
        maintenance_order_id: 'MO-1',
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.action).toBe('reserve');
    expect((res.jsonBody as any)?.output?.integration_job?.id).toBe('job-1');
  });
});

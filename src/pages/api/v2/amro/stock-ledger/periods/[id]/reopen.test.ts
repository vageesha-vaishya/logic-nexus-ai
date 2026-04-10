import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../../_utils/types';
import handler from './reopen';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../../_utils/http';
import { getSupabaseAdminClient } from '../../../../../_utils/supabaseAdmin';

vi.mock('../../../../../_utils/http', () => ({
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

vi.mock('../../../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn((res, error) => {
    console.error('sendErrorResponse called with:', error instanceof Error ? error.message : error);
  }),
}));

vi.mock('../../../../../_utils/supabaseAdmin', () => ({
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

describe('/api/v2/amro/stock-ledger/periods/[id]/reopen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-stock-ledger-period-reopen' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['inventory.admin'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns 405 for non-POST methods', async () => {
    const req: ApiRequest = { method: 'GET', query: { id: 'p1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 when id is missing', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when approval_id is missing', async () => {
    const req: ApiRequest = { method: 'POST', query: { id: 'p1' }, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('approval_id is required');
  });

  it('returns 400 when no approved request exists', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_stock_approval_queue') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: { id: 'p1' },
      headers: {},
      body: { approval_id: 'a1' },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('reopens a closed period with approved request', async () => {
    const approvalMock = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'a1', request_type: 'period_reopen', request_status: 'approved', tenant_id: 'tenant-1' },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    };
    const periodMock = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'p1',
                      period_code: '2024-01',
                      close_status: 'reopened',
                      reopened_at: '2024-03-01T00:00:00Z',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    };
    const supabase: any = {
      from: vi.fn((table: string) => {
        return table === 'amro_stock_approval_queue' ? approvalMock : periodMock;
      }),
    };
    (getSupabaseAdminClient as any).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: { id: 'p1' },
      headers: {},
      body: { approval_id: 'a1' },
    };
    const res = createResponse();
    await handler(req, res);
    if (res.statusCode !== 200) {
      console.log('Reopen test error:', JSON.stringify(res.jsonBody));
    }
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-period-reopen');
    expect((res.jsonBody as any)?.output.record.close_status).toBe('reopened');
  });
});

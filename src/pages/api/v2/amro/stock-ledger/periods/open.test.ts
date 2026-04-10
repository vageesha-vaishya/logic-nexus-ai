import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import handler from './open';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';

vi.mock('../../../../_utils/http', () => ({
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

vi.mock('../../../../_utils/supabaseAdmin', () => ({
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

describe('/api/v2/amro/stock-ledger/periods/open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-stock-ledger-period-open' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['inventory.admin'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns 405 for non-POST methods', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 when required fields are missing', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('required');
  });

  it('creates a new open period', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'p1',
                  period_code: '2024-03',
                  period_start: '2024-03-01',
                  period_end: '2024-03-31',
                  close_status: 'open',
                  valuation_method: 'weighted_average',
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };
    (getSupabaseAdminClient as any).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        period_code: '2024-03',
        period_start: '2024-03-01',
        period_end: '2024-03-31',
        valuation_method: 'weighted_average',
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-period-open');
    expect((res.jsonBody as any)?.output.record.period_code).toBe('2024-03');
  });

  it('returns 409 for duplicate period code', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
              }),
            })),
          })),
        })),
      })),
    };
    (getSupabaseAdminClient as any).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        period_code: '2024-01',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
  });
});

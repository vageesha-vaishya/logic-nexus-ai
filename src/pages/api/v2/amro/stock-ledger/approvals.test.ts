import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './approvals';
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

describe('/api/v2/amro/stock-ledger/approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-stock-ledger-approvals' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['inventory.admin'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns 405 for non-GET/POST methods', async () => {
    const req: ApiRequest = { method: 'DELETE', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns approval records on GET', async () => {
    const queryBuilder: any = {
      eq: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      then: (resolve: (value: unknown) => void) => resolve({
        data: [
          { id: 'a1', request_type: 'adjustment', request_status: 'pending' },
          { id: 'a2', request_type: 'period_reopen', request_status: 'approved' },
        ],
        error: null,
        count: 2,
      }),
    };
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => queryBuilder),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: { status: 'all' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-approvals-list');
    expect((res.jsonBody as any)?.output.total).toBe(2);
  });

  it('returns 400 for invalid request_type on POST', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: { request_type: 'invalid' } };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('creates an approval request on POST', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'a1',
                  request_type: 'adjustment',
                  request_status: 'pending',
                  created_at: '2024-02-01T00:00:00Z',
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: { request_type: 'adjustment', reason: 'Inventory correction' },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-approvals-create');
  });
});

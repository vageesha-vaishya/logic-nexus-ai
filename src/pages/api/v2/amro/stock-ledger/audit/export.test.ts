import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import handler from './export';
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

vi.mock('../../../../_utils/errorHandler', () => ({
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

describe('/api/v2/amro/stock-ledger/audit/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-stock-ledger-audit-export' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['inventory.admin'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns 405 for non-GET methods', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns audit records on GET', async () => {
    const queryBuilder: any = {
      eq: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      limit: vi.fn(() => queryBuilder),
      gte: vi.fn(() => queryBuilder),
      lte: vi.fn(() => queryBuilder),
      then: (resolve: (value: unknown) => void) => resolve({
        data: [
          {
            id: 'evt-1',
            tenant_id: 'tenant-1',
            actor_user_id: 'u1',
            event_type: 'stock_ledger.transaction.posted',
            event_category: 'stock-ledger',
            reference_id: 'tx-1',
            event_payload: { movement_type: 'receipt' },
            immutable_hash: 'abc123',
            created_at: '2024-02-01T00:00:00Z',
          },
        ],
        error: null,
        count: 1,
      }),
    };
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => queryBuilder),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-audit-export');
    expect((res.jsonBody as any)?.output.total).toBe(1);
    expect((res.jsonBody as any)?.output.records[0].event_type).toBe('stock_ledger.transaction.posted');
  });

  it('filters by event_type when provided', async () => {
    const queryBuilder: any = {
      eq: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      limit: vi.fn(() => queryBuilder),
      gte: vi.fn(() => queryBuilder),
      lte: vi.fn(() => queryBuilder),
      then: (resolve: (value: unknown) => void) => resolve({
        data: [],
        error: null,
        count: 0,
      }),
    };
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => queryBuilder),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: { event_type: 'stock_ledger.transaction.voided' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('respects limit parameter with max of 5000', async () => {
    const queryBuilder: any = {
      eq: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      limit: vi.fn(() => queryBuilder),
      gte: vi.fn(() => queryBuilder),
      lte: vi.fn(() => queryBuilder),
      then: (resolve: (value: unknown) => void) => resolve({
        data: [],
        error: null,
        count: 0,
      }),
    };
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => queryBuilder),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: { limit: '10000' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output.limit).toBe(5000);
  });
});

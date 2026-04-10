import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './batch';
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

describe('/api/v2/amro/stock-ledger/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-stock-ledger-batch' } as any);
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

  it('returns 400 when entries array is missing', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('entries array is required');
  });

  it('returns 400 when entries exceed 100', async () => {
    const entries = Array.from({ length: 101 }, (_, i) => ({ part_inventory_id: `part-${i}`, movement_type: 'receipt', quantity_delta: 1 }));
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: { entries } };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('Batch size cannot exceed 100');
  });

  it('creates batch entries successfully', async () => {
    const supabase: any = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: { id: 'tx-1', quantity_delta: 5 }, error: null })
        .mockResolvedValueOnce({ data: { id: 'tx-2', quantity_delta: -2 }, error: null }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        entries: [
          { part_inventory_id: 'part-1', movement_type: 'receipt', quantity_delta: 5 },
          { part_inventory_id: 'part-2', movement_type: 'issue', quantity_delta: -2 },
        ],
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-batch-create');
    expect((res.jsonBody as any)?.output.created_count).toBe(2);
    expect((res.jsonBody as any)?.output.rejected_count).toBe(0);
  });

  it('handles partial failures in batch', async () => {
    const supabase: any = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: { id: 'tx-1', quantity_delta: 5 }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Insufficient stock', code: 'P0001' } }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        entries: [
          { part_inventory_id: 'part-1', movement_type: 'receipt', quantity_delta: 5 },
          { part_inventory_id: 'part-2', movement_type: 'issue', quantity_delta: -100 },
        ],
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.output.created_count).toBe(1);
    expect((res.jsonBody as any)?.output.rejected_count).toBe(1);
    expect((res.jsonBody as any)?.output.rejected[0].reason).toContain('Insufficient stock');
  });
});

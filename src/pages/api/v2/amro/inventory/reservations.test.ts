import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './reservations';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { sendErrorResponse } from '../../../_utils/errorHandler';

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

describe('/api/v2/amro/inventory/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-res-test' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_INVENTORY_V2_ENABLED = 'true';
  });

  it('returns 404 when v2 is disabled', async () => {
    process.env.AMRO_INVENTORY_V2_ENABLED = 'false';
    const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 405 for PUT method', async () => {
    const req = { method: 'PUT', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  describe('GET /list reservations', () => {
    it('returns active reservations for tenant', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'res-1',
              inventory_id: 'inv-1',
              work_order_id: 'wp-1',
              task_id: null,
              reserved_quantity: 5,
              status: 'active',
              reserved_by: 'u1',
              expires_at: null,
              fulfilled_at: null,
              created_at: '2026-04-01T00:00:00Z',
              updated_at: '2026-04-01T00:00:00Z',
              parts_inventory: {
                part_number: 'PN-001',
                serial_number: 'SN-001',
                description: 'Test Part',
                warehouse_location: 'WH-A',
              },
            },
          ],
          error: null,
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

      const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.version).toBe('v2');
      expect(body.interface).toBe('list-reservations');
      expect(body.output.count).toBe(1);
      expect(body.output.items[0].part_number).toBe('PN-001');
      expect(body.output.items[0].reserved_quantity).toBe(5);
    });

    it('filters by work_order_id', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

      const req = {
        method: 'GET',
        query: { work_order_id: 'wp-123' },
        headers: {},
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('work_order_id', 'wp-123');
    });
  });

  describe('POST /create reservation', () => {
    it('creates reservation and updates inventory', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'inv-1', part_number: 'PN-001', quantity_on_hand: 50, quantity_reserved: 10 },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'res-new' },
            error: null,
          }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          work_order_id: 'wp-1',
          line_items: [{ inventory_id: 'inv-1', quantity: 5 }],
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.total_requested).toBe(1);
      expect(body.output.succeeded).toBe(1);
      expect(body.output.failed).toBe(0);
      expect(body.output.reservations[0].status).toBe('active');
    });

    it('rejects reservation when insufficient stock', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'inv-1', part_number: 'PN-002', quantity_on_hand: 5, quantity_reserved: 5 },
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          work_order_id: 'wp-1',
          line_items: [{ inventory_id: 'inv-1', quantity: 10 }],
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      const body = res.jsonBody as any;
      expect(body.output.failed).toBe(1);
      expect(body.output.reservations[0].status).toBe('rejected');
      expect(body.output.reservations[0].error).toContain('Insufficient stock');
    });

    it('fails gracefully when inventory not found', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          line_items: [{ inventory_id: 'inv-nonexistent', quantity: 1 }],
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      const body = res.jsonBody as any;
      expect(body.output.failed).toBe(1);
      expect(body.output.reservations[0].error).toContain('not found');
    });
  });

  describe('DELETE /release reservation', () => {
    it('releases active reservation and decrements inventory', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'res-1', inventory_id: 'inv-1', reserved_quantity: 5, status: 'active', tenant_id: 'tenant-1' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { quantity_reserved: 10 },
            error: null,
          }),
        update: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'DELETE',
        query: { reservation_id: 'res-1' },
        headers: {},
        body: {},
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.reservation_id).toBe('res-1');
      expect(body.output.status).toBe('released');
      expect(body.output.released_quantity).toBe(5);
    });

    it('rejects release of already released reservation', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'res-1', inventory_id: 'inv-1', reserved_quantity: 5, status: 'released', tenant_id: 'tenant-1' },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'DELETE',
        query: { reservation_id: 'res-1' },
        headers: {},
        body: {},
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });

    it('returns error when reservation not found', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        update: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'DELETE',
        query: { reservation_id: 'res-nonexistent' },
        headers: {},
        body: {},
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });
});

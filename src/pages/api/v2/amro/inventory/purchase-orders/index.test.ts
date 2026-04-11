import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import indexHandler from './index';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { sendErrorResponse } from '../../../../_utils/errorHandler';

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
      return { json: (body: unknown) => { res.jsonBody = body; } };
    }),
  };
  return res;
}

describe('/api/v2/amro/inventory/purchase-orders/index (list/create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-po-list' } as any);
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
    await indexHandler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 405 for DELETE on index', async () => {
    const req = { method: 'DELETE', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await indexHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  describe('GET /list POs', () => {
    it('returns POs with summary', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'po-1',
              po_number: 'PO-20260411-ABC123',
              supplier_id: 'sup-1',
              status: 'draft',
              order_date: '2026-04-11',
              expected_delivery_date: '2026-04-25',
              actual_delivery_date: null,
              total_amount: 1500,
              currency: 'USD',
              notes: 'Emergency PO',
              created_by: 'u1',
              created_at: '2026-04-11T00:00:00Z',
              updated_at: '2026-04-11T00:00:00Z',
              suppliers: { supplier_name: 'Supplier X' },
              amro_purchase_order_items: [{ id: 'li-1', quantity_ordered: 10, quantity_received: 0, unit_price: 150 }],
            },
          ],
          error: null,
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(mockChain) } as any);

      const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.summary.total).toBe(1);
      expect(body.output.summary.draft).toBe(1);
      expect(body.output.items[0].po_number).toBe('PO-20260411-ABC123');
      expect(body.output.items[0].supplier_name).toBe('Supplier X');
      expect(body.output.items[0].total_amount).toBe(1500);
    });

    it('filters by status', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(mockChain) } as any);

      const req = { method: 'GET', query: { status: 'draft' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'draft');
    });
  });

  describe('POST /create PO', () => {
    it('creates PO with line items', async () => {
      const partsData = { id: 'inv-1', part_number: 'PN-001', supplier_name: 'Supplier X', warehouse_location: 'WH-A' };
      const poData = { id: 'po-new' };

      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: poData, error: null }),
        insert: vi.fn().mockReturnThis(),
      };
      // parts query
      const partsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      partsChain.eq.mockResolvedValue({ data: [partsData], error: null });

      // items insert
      const itemsChain: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      const supabase = (table: string) => {
        if (table === 'parts_inventory') return partsChain;
        if (table === 'amro_purchase_orders') return mockChain;
        if (table === 'amro_purchase_order_items') return itemsChain;
        return mockChain;
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: supabase } as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          supplier_id: 'sup-1',
          expected_delivery_date: '2026-04-25',
          notes: 'Urgent restock',
          line_items: [{ part_inventory_id: 'inv-1', quantity_ordered: 20, unit_price: 50 }],
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(201);
      const body = res.jsonBody as any;
      expect(body.output.po_number).toMatch(/^PO-/);
      expect(body.output.status).toBe('draft');
      expect(body.output.total_amount).toBe(1000); // 20 * 50
      expect(body.output.line_items_count).toBe(1);
    });

    it('rejects creation with missing parts', async () => {
      const partsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      partsChain.eq.mockResolvedValue({ data: [], error: null });

      const supabase = (table: string) => {
        if (table === 'parts_inventory') return partsChain;
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis() };
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: supabase } as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          supplier_id: 'sup-1',
          line_items: [{ part_inventory_id: 'inv-missing', quantity_ordered: 10, unit_price: 10 }],
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });

    it('rejects creation without line_items', async () => {
      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: { supplier_id: 'sup-1' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });
});

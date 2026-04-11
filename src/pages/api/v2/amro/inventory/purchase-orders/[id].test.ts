import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import idHandler from './[id]';
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

describe('/api/v2/amro/inventory/purchase-orders/[id] (get/patch/delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-po-id' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_INVENTORY_V2_ENABLED = 'true';
  });

  it('returns 405 for POST', async () => {
    const req = { method: 'POST', query: { id: 'po-1' }, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await idHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  describe('GET single PO', () => {
    it('returns PO with line items', async () => {
      const liItems = [
        {
          id: 'li-1',
          part_inventory_id: 'inv-1',
          quantity_ordered: 10,
          quantity_received: 0,
          unit_price: 150,
          line_total: 1500,
          notes: null,
          parts_inventory: { part_number: 'PN-001', serial_number: null, description: 'Test Part', warehouse_location: 'WH-A' },
        },
      ];
      const poChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'po-1',
            po_number: 'PO-20260411-ABC',
            supplier_id: 'sup-1',
            status: 'draft',
            order_date: '2026-04-11',
            expected_delivery_date: '2026-04-25',
            actual_delivery_date: null,
            total_amount: 1500,
            currency: 'USD',
            notes: 'Test PO',
            metadata: {},
            created_by: 'u1',
            created_at: '2026-04-11T00:00:00Z',
            updated_at: '2026-04-11T00:00:00Z',
            suppliers: { supplier_name: 'Supplier X' },
          },
          error: null,
        }),
      };
      const liChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      // Second eq() returns a thenable so the await resolves to { data, error }
      liChain.eq.mockImplementation(function(this: any) {
        const result = { data: liItems, error: null };
        (this as any).then = (fn: (v: any) => any) => fn(result);
        return this;
      });

      const supabase = (table: string) => {
        if (table === 'amro_purchase_orders') return poChain;
        return liChain;
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: supabase } as any);

      const req = { method: 'GET', query: { id: 'po-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      const sendErrCalls = vi.mocked(sendErrorResponse).mock.calls;
      if (sendErrCalls.length > 0) throw new Error(`API error: ${String(sendErrCalls[0][1])}`);
      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body?.output?.purchase_order?.po_number).toBe('PO-20260411-ABC');
      expect(body.output.purchase_order.supplier_name).toBe('Supplier X');
      expect(body.output.line_items).toHaveLength(1);
      expect(body.output.line_items[0].part_number).toBe('PN-001');
      expect(body.output.line_items[0].line_total).toBe(1500);
    });

    it('returns error when PO not found', async () => {
      const poChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => poChain } as any);

      const req = { method: 'GET', query: { id: 'po-missing' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });

  describe('PATCH update PO', () => {
    it('submits draft PO', async () => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'po-1', status: 'draft', created_at: '2026-04-11' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'po-1', po_number: 'PO-TEST', status: 'submitted', actual_delivery_date: null },
            error: null,
          }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => mockChain } as any);

      const req = {
        method: 'PATCH',
        query: { id: 'po-1' },
        headers: {},
        body: { status: 'submitted' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.status).toBe('submitted');
    });

    it('transitions acknowledged to shipped', async () => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'po-1', status: 'acknowledged', created_at: '2026-04-11' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'po-1', po_number: 'PO-TEST', status: 'shipped', actual_delivery_date: null },
            error: null,
          }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => mockChain } as any);

      const req = {
        method: 'PATCH',
        query: { id: 'po-1' },
        headers: {},
        body: { status: 'shipped' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.status).toBe('shipped');
    });

    it('rejects invalid status transition', async () => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'po-1', status: 'received', created_at: '2026-04-11' },
          error: null,
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => mockChain } as any);

      const req = {
        method: 'PATCH',
        query: { id: 'po-1' },
        headers: {},
        body: { status: 'submitted' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });

    it('cancels draft PO', async () => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'po-1', status: 'draft', created_at: '2026-04-11' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'po-1', po_number: 'PO-TEST', status: 'cancelled', actual_delivery_date: null },
            error: null,
          }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => mockChain } as any);

      const req = {
        method: 'PATCH',
        query: { id: 'po-1' },
        headers: {},
        body: { status: 'cancelled' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.status).toBe('cancelled');
    });
  });

  describe('DELETE PO', () => {
    it('deletes draft PO', async () => {
      const deleteResult = { error: null };
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'po-1', status: 'draft' }, error: null }),
      };
      (mockChain as any).then = (onFulfilled: (v: any) => any) => onFulfilled(deleteResult);
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => mockChain } as any);

      const req = { method: 'DELETE', query: { id: 'po-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.deleted).toBe(true);
    });

    it('rejects deletion of received PO', async () => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'po-1', status: 'received' }, error: null }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => mockChain } as any);

      const req = { method: 'DELETE', query: { id: 'po-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });
});

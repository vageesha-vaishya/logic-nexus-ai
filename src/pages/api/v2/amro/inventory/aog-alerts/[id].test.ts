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

describe('/api/v2/amro/inventory/aog-alerts/[id] (get/patch/delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-aog-id' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_INVENTORY_V2_ENABLED = 'true';
  });

  it('returns 405 for POST', async () => {
    const req = { method: 'POST', query: { id: 'aog-1' }, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await idHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  describe('GET single alert', () => {
    it('returns alert details with part info', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'aog-1',
            aircraft_id: 'ac-1',
            part_inventory_id: 'inv-1',
            severity: 'critical',
            status: 'open',
            shortage_quantity: 10,
            required_quantity: 15,
            required_by: '2026-04-20T00:00:00Z',
            escalation_level: 0,
            resolved_at: null,
            resolution_notes: null,
            notified_users: [],
            metadata: {},
            created_by: 'u1',
            created_at: '2026-04-10T00:00:00Z',
            updated_at: '2026-04-10T00:00:00Z',
            parts_inventory: { part_number: 'PN-001', serial_number: 'SN-001', description: 'Critical Part', warehouse_location: 'WH-A' },
          },
          error: null,
        }),
      };
      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = { method: 'GET', query: { id: 'aog-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.item.part_number).toBe('PN-001');
      expect(body.output.item.severity).toBe('critical');
      expect(body.output.item.shortage_quantity).toBe(10);
    });

    it('returns error when alert not found', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = { method: 'GET', query: { id: 'aog-missing' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });

  describe('PATCH update alert', () => {
    it('escalates open alert', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'aog-1', status: 'open', escalation_level: 0, metadata: {} },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };
      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      // Second call (update.select.single) returns updated data
      mockChain.single
        .mockResolvedValueOnce({
          data: { id: 'aog-1', status: 'open', escalation_level: 0, metadata: {} },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'aog-1', status: 'escalated', escalation_level: 1, resolved_at: null, resolution_notes: null },
          error: null,
        });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'PATCH',
        query: { id: 'aog-1' },
        headers: {},
        body: { status: 'escalated' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.status).toBe('escalated');
      expect(body.output.escalation_level).toBe(1);
    });

    it('resolves alert with notes', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'aog-1', status: 'open', escalation_level: 0, metadata: {} },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'aog-1', status: 'resolved', escalation_level: 0, resolved_at: '2026-04-11T00:00:00Z', resolution_notes: 'Parts received via emergency PO' },
            error: null,
          }),
        update: vi.fn().mockReturnThis(),
      };
      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'PATCH',
        query: { id: 'aog-1' },
        headers: {},
        body: { status: 'resolved', resolution_notes: 'Parts received via emergency PO' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.status).toBe('resolved');
      expect(body.output.resolution_notes).toBe('Parts received via emergency PO');
    });

    it('cancels alert', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'aog-1', status: 'open', escalation_level: 0, metadata: {} },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'aog-1', status: 'cancelled', escalation_level: 0, resolved_at: null, resolution_notes: null },
            error: null,
          }),
        update: vi.fn().mockReturnThis(),
      };
      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'PATCH',
        query: { id: 'aog-1' },
        headers: {},
        body: { status: 'cancelled' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.status).toBe('cancelled');
    });

    it('rejects invalid status transition', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'aog-1', status: 'resolved', escalation_level: 0, metadata: {} },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };
      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'PATCH',
        query: { id: 'aog-1' },
        headers: {},
        body: { status: 'escalated' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });

  describe('DELETE alert', () => {
    it('deletes alert', async () => {
      const deleteResult = { error: null };
      const mockChain: any = {
        delete: vi.fn(),
        eq: vi.fn(),
      };
      mockChain.delete.mockReturnValue(mockChain);
      mockChain.eq.mockReturnValue(mockChain);
      // Make the chain thenable — when awaited, return the result
      (mockChain as any).then = (onFulfilled: (v: any) => any) => onFulfilled(deleteResult);

      const supabaseInstance = {
        from: vi.fn().mockReturnValue(mockChain),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = { method: 'DELETE', query: { id: 'aog-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.alert_id).toBe('aog-1');
      expect(body.output.deleted).toBe(true);
    });
  });
});

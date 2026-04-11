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

describe('/api/v2/amro/inventory/aog-alerts/index (list/create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-aog-list' } as any);
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

  describe('GET /list AOG alerts', () => {
    it('returns alerts with summary', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
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
          ],
          error: null,
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

      const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.version).toBe('v2');
      expect(body.interface).toBe('list-aog-alerts');
      expect(body.output.summary.total).toBe(1);
      expect(body.output.summary.open).toBe(1);
      expect(body.output.summary.critical).toBe(1);
      expect(body.output.items[0].part_number).toBe('PN-001');
      expect(body.output.items[0].shortage_quantity).toBe(10);
    });

    it('filters by severity', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

      const req = { method: 'GET', query: { severity: 'critical' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('severity', 'critical');
    });

    it('filters by status', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

      const req = { method: 'GET', query: { status: 'open' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'open');
    });
  });

  describe('POST /create AOG alert', () => {
    it('creates alert and computes shortage', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { id: 'inv-1', part_number: 'PN-001', quantity_on_hand: 5, quantity_reserved: 0 },
            error: null,
          })
          .mockResolvedValueOnce({ data: { id: 'aog-new' }, error: null }),
        insert: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          part_inventory_id: 'inv-1',
          required_quantity: 20,
          severity: 'critical',
          required_by: '2026-04-20T00:00:00Z',
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(res.statusCode).toBe(201);
      const body = res.jsonBody as any;
      expect(body.output.alert_id).toBe('aog-new');
      expect(body.output.shortage_quantity).toBe(15); // required 20 - available 5
      expect(body.output.required_quantity).toBe(20);
      expect(body.output.severity).toBe('critical');
    });

    it('rejects creation when no shortage exists', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'inv-1', part_number: 'PN-001', quantity_on_hand: 100, quantity_reserved: 0 },
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: { part_inventory_id: 'inv-1', required_quantity: 10 },
      } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });

    it('rejects creation when inventory not found', async () => {
      const supabaseInstance = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        insert: vi.fn().mockReturnThis(),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseInstance as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: { part_inventory_id: 'inv-missing', required_quantity: 10 },
      } as unknown as ApiRequest;
      const res = createResponse();
      await indexHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });
});

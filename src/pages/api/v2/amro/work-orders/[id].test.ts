import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import idHandler from './[id]';
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
      return { json: (body: unknown) => { res.jsonBody = body; } };
    }),
  };
  return res;
}

const mockWorkPackage = {
  id: 'wp-1',
  tenant_id: 'tenant-1',
  franchise_id: 'fr-1',
  aircraft_id: 'ac-1',
  work_order_number: 'WP-20260411-ABC',
  title: '500hr Inspection',
  description: 'Scheduled inspection',
  work_type: null,
  maintenance_type: 'inspection',
  priority: 2,
  source: 'manual',
  planned_start_date: '2026-04-20',
  planned_end_date: '2026-04-25',
  actual_start_date: null,
  actual_end_date: null,
  estimated_labor_hours: 40,
  estimated_cost: 15000,
  actual_labor_hours: null,
  actual_cost: null,
  status: 'scheduled',
  assigned_to: 'tech-1',
  supervisor_id: 'sup-1',
  reference_documents: null,
  notes: null,
  external_reference: null,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

describe('/api/v2/amro/work-orders/[id] (get/patch/delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-wo-id' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_WORK_ORDERS_V2_ENABLED = 'true';
  });

  it('returns 405 for POST', async () => {
    const req = { method: 'POST', query: { id: 'wp-1' }, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await idHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  describe('GET single work order', () => {
    it('returns 404 when not found', async () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => chain } as any);

      const req = { method: 'GET', query: { id: 'wp-missing' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when DB query fails', async () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection timeout' } }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => chain } as any);

      const req = { method: 'GET', query: { id: 'wp-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH update', () => {
    it('rejects update when no valid fields provided', async () => {
      const req = {
        method: 'PATCH',
        query: { id: 'wp-1' },
        headers: {},
        body: { invalid_field: 'value' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it('rejects deletion of completed work order', async () => {
      const completedWp = { ...mockWorkPackage, status: 'completed' };
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: completedWp, error: null }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => chain } as any);

      const req = { method: 'DELETE', query: { id: 'wp-1' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });

    it('returns 404 when deleting non-existent work order', async () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => chain } as any);

      const req = { method: 'DELETE', query: { id: 'wp-missing' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await idHandler(req, res);

      expect(res.statusCode).toBe(404);
    });
  });
});

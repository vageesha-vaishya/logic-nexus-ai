import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './index';
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

describe('/api/v2/amro/work-orders/index (list/create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-wo-list' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_WORK_ORDERS_V2_ENABLED = 'true';
  });

  it('returns 404 when disabled', async () => {
    process.env.AMRO_WORK_ORDERS_V2_ENABLED = 'false';
    const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 405 for DELETE', async () => {
    const req = { method: 'DELETE', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  describe('GET /list work orders', () => {
    it('returns work orders from database', async () => {
      const listChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'wp-1',
              tenant_id: 'tenant-1',
              franchise_id: 'fr-1',
              aircraft_id: 'ac-1',
              work_package_number: 'WP-20260411-ABC',
              work_order_number: 'WP-20260411-ABC',
              title: '500hr Inspection',
              description: null,
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
            },
          ],
          error: null,
          count: 1,
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => listChain } as any);

      const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as any;
      expect(body.output.records).toHaveLength(1);
      expect(body.output.records[0].work_order_number).toBe('WP-20260411-ABC');
      expect(body.output.total).toBe(1);
      expect(body.output.page).toBe(1);
    });

    it('filters by status', async () => {
      const listChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: () => listChain } as any);

      const req = { method: 'GET', query: { status: 'scheduled' }, headers: {} } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(listChain.eq).toHaveBeenCalledWith('status', 'scheduled');
    });
  });

  describe('POST /create work order', () => {
    it('creates work order in database', async () => {
      const titleLookupChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'ttl-1',
            title: 'Starter Work Package',
            wp_title: 'STARTER',
            franchise_id: null,
          },
          error: null,
        }),
      };
      const aircraftLookupChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            registration: 'VT-DCN',
            tail_number: 'VT-DCN',
          },
          error: null,
        }),
      };
      const sequenceLookupChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: [{ work_package_number: 'WP-VT-DCN-2026-0004-HOTSEC' }],
          error: null,
        }),
      };
      const insertChain: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'wp-new',
            tenant_id: 'tenant-1',
            franchise_id: 'fr-1',
            aircraft_id: 'ac-1',
            work_package_number: 'WP-VT-DCN-2026-0005-STARTER',
            title: 'Starter Work Package',
            description: null,
            work_type: null,
            maintenance_type: 'overhaul',
            priority: 1,
            source: 'manual',
            planned_start_date: '2026-05-01',
            planned_end_date: '2026-05-15',
            actual_start_date: null,
            actual_end_date: null,
            estimated_labor_hours: 120,
            estimated_cost: 50000,
            actual_labor_hours: null,
            actual_cost: null,
            status: 'planning',
            assigned_to: null,
            supervisor_id: null,
            reference_documents: null,
            notes: 'Urgent',
            external_reference: null,
            created_at: '2026-04-11T00:00:00Z',
            updated_at: '2026-04-11T00:00:00Z',
            work_order_template_id: 'tpl-1',
            work_order_title_id: 'ttl-1',
          },
          error: null,
        }),
      };
      const templateLookupChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'tpl-1',
            tasks_json: [
              {
                sequence_order: 1,
                title: 'Template Task 1',
                task_category: 'general',
              },
            ],
            franchise_id: null,
          },
          error: null,
        }),
      };
      const tasksCountChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn(),
      };
      tasksCountChain.eq
        .mockReturnValueOnce(tasksCountChain)
        .mockReturnValueOnce(Promise.resolve({ count: 0, error: null }));
      const tasksInsertChain: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      let workPackagesCallCount = 0;
      vi.mocked(getSupabaseAdminClient).mockReturnValue({
        from: (table: string) => {
          if (table === 'work_packages_title') return titleLookupChain;
          if (table === 'aircraft') return aircraftLookupChain;
          if (table === 'work_order_templates') return templateLookupChain;
          if (table === 'tasks') {
            // first tasks call = duplicate guard (select), second call = insert
            return (tasksCountChain.select.mock.calls.length === 0) ? tasksCountChain : tasksInsertChain;
          }
          if (table === 'work_orders') {
            workPackagesCallCount += 1;
            return workPackagesCallCount === 1 ? sequenceLookupChain : insertChain;
          }
          return insertChain;
        },
      } as any);

      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: {
          work_order_title_id: 'ttl-1',
          maintenance_type: 'overhaul',
          priority: 1,
          notes: 'Urgent',
          aircraft_id: 'ac-1',
          work_order_template_id: 'tpl-1',
          planned_start_date: '2026-05-01',
          planned_end_date: '2026-05-15',
          estimated_labor_hours: 120,
          estimated_cost: 50000,
        },
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(201);
      const body = res.jsonBody as any;
      expect(body.output.id).toBe('wp-new');
      expect(body.output.work_order_number).toBe('WP-VT-DCN-2026-0005-STARTER');
      expect(body.output.status).toBe('planning');
      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        work_order_template_id: 'tpl-1',
        work_order_title_id: 'ttl-1',
      }));
    });

    it('rejects creation without title', async () => {
      const req = {
        method: 'POST',
        query: {},
        headers: {},
        body: { maintenance_type: 'line' },
      } as unknown as ApiRequest;
      const res = createResponse();
      await handler(req, res);

      expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
    });
  });
});

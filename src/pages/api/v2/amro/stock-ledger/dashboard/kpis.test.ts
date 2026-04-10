import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import handler from './kpis';
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

describe('/api/v2/amro/stock-ledger/dashboard/kpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-stock-ledger-kpis' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns dashboard KPI payload', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_stock_approval_queue') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
              })),
            })),
          };
        }
        if (table === 'amro_stock_reconciliation_runs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-1', run_status: 'completed' }, error: null }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'amro_stock_ledger_current_balance') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [{ inventory_value: 100 }, { inventory_value: 25 }], error: null }),
            })),
          };
        }
        if (table === 'tenant_profile') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    emergency_contact_info: {
                      stock_ledger_reconciliation_policy: {
                        enabled: true,
                        frequency_hours: 24,
                        variance_threshold: 0.5,
                        approval_sla_hours: 12,
                        notify_channels: ['in_app'],
                      },
                    },
                  },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === 'amro_stock_period_closes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [{ id: 'period-1', period_start: new Date(Date.now() - (36 * 60 * 60 * 1000)).toISOString() }],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === 'amro_stock_reconciliation_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gt: vi.fn().mockResolvedValue({ count: 2, error: null }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-dashboard-kpis');
    expect((res.jsonBody as any)?.output?.pending_approvals).toBe(3);
    expect((res.jsonBody as any)?.output?.total_inventory_value).toBe(125);
    expect((res.jsonBody as any)?.output?.unresolved_variance_items).toBe(2);
    expect((res.jsonBody as any)?.output?.pending_approval_sla_breaches).toBe(0);
  });
});

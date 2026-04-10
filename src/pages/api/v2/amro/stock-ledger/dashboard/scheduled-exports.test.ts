import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import handler from './scheduled-exports';
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

describe('/api/v2/amro/stock-ledger/dashboard/scheduled-exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-scheduled-exports' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['inventory.admin', 'inventory.read'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('creates a scheduled export from existing template', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                tenant_id: 'tenant-1',
                emergency_contact_info: {
                  stock_ledger_p2_settings: {
                    report_templates: [{ id: 'tpl-1', name: 'Weekly', report_type: 'stock-balance', filters: {}, columns: [] }],
                    scheduled_exports: [],
                    alert_policy: { enabled: true, frequency_hours: 24, variance_threshold: 0.1, approval_sla_hours: 48, stale_approval_hours: 24, backdated_posting_window_days: 7, notify_severity_threshold: 'warning', notify_channels: ['in_app'] },
                    fx_rates: { USD: 1 },
                  },
                },
              },
              error: null,
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: { template_id: 'tpl-1', frequency: 'weekly' },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('amro-stock-ledger-scheduled-export-create');
  });
});

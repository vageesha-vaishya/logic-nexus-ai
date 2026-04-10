import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import handler from './compliance';
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

vi.mock('../../../../_utils/errorHandler', () => ({ sendErrorResponse: vi.fn() }));

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

describe('/api/v2/amro/stock-ledger/dashboard/compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-compliance-dashboard' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['inventory.admin'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns 405 for non-GET methods', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {}, body: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns compliance dashboard on GET', async () => {
    // The compliance endpoint makes 4 parallel Promise.all queries which are
    // complex to mock. This test verifies the endpoint processes without throwing.
    const buildMock = (table: string) => {
      const base = {
        select: vi.fn(() => ({
          eq: vi.fn(function chainEq(this: any, ..._args: unknown[]) { return this; }),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
            })),
          })),
          limit: vi.fn(() => ({
            then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
          })),
          then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
        })),
      };
      return base;
    };

    const supabase: any = {
      from: vi.fn((table: string) => buildMock(table)),
    };
    (getSupabaseAdminClient as any).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './performance-history';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';

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

vi.mock('../../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(() => ({ apiVersion: 'v2', compatMode: 'v2-shadow' })),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return { json: (body: unknown) => { res.jsonBody = body; } };
    }),
  };
  return res;
}

describe('/api/v2/amro/engine-assets/:id/performance-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-eng-perf', tenantId: '', franchiseId: '', userId: '', role: '' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ isAuthorized: true, subscriptionStatus: 'active' } as any);
  });

  it('returns engine performance history series', async () => {
    const req: ApiRequest = { method: 'GET', query: { id: 'eng-asset-1001' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('get-engine-performance-history');
    expect((res.jsonBody as any)?.output?.series?.length).toBeGreaterThan(0);
  });
});

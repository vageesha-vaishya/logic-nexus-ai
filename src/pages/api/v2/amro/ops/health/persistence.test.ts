import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './persistence';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { checkAmroOpsPersistenceHealth } from '../../work-order-persistence';

vi.mock('../../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../work-order-persistence', () => ({
  checkAmroOpsPersistenceHealth: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
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

describe('/api/v2/amro/ops/health/persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-persistence' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'database', validatedAt: '2026-03-24T00:00:00.000Z' } as any);
  });

  it('returns 200 when persistence health is within threshold', async () => {
    vi.mocked(checkAmroOpsPersistenceHealth).mockResolvedValue({ ok: true, elapsedMs: 42 });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.status).toBe('ok');
    expect((res.jsonBody as any)?.schema).toBe('amro_ops');
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalled();
  });
});

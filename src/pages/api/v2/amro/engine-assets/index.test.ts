import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './index';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

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

vi.mock('../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
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

describe('/api/v2/amro/engine-assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-eng-assets',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
    } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({
      isAuthorized: true,
      subscriptionStatus: 'active',
      source: 'database',
      validatedAt: '2026-04-02T00:00:00.000Z',
    } as any);
  });

  it('lists engine assets and configuration entries', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('list-engine-assets');
    expect((res.jsonBody as any)?.output?.assets?.length).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output?.configuration_entries?.length).toBeGreaterThan(0);
  });

  it('rejects unsupported methods', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});

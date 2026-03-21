import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './route-inventory';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { generateGatewayRouteInventory } from '../../_utils/route-inventory';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

vi.mock('../../_utils/route-inventory', () => ({
  generateGatewayRouteInventory: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, any> } {
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
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v1/gateway/route-inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-gateway-route-inventory',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v1', compatMode: 'v1-pass' });
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(generateGatewayRouteInventory).mockReturnValue({
      generatedAt: '2026-03-21T00:00:00.000Z',
      featureFlag: { key: 'ROUTE_INVENTORY_DASHBOARD_V1', enabled: true },
      featureFlagPlatform: {
        version: 4,
        checksum: 'checksum-4',
        updatedAt: '2026-03-21T00:00:00.000Z',
        globalKillSwitch: false,
        modules: [],
      },
      gateway: {
        globalRevertToLegacy: false,
        facadeEnabled: true,
        v2PrimaryEnabled: false,
        v2ShadowEnabled: true,
        transitionTelemetry: {
          records: [],
          totalEvents: 0,
          rollbackEvents: 0,
        },
      },
      web: { appRoutes: ['/dashboard/migration-baseline'], menuRoutes: ['/dashboard/migration-baseline'] },
      api: { routes: ['/api/v1/gateway/route-inventory'] },
      counts: { appRoutes: 1, menuRoutes: 1, apiRoutes: 1 },
    });
  });

  it('returns route inventory payload for GET requests', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req, 'tenant-1');
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[GatewayFacade] route decision',
      expect.objectContaining({ route: '/api/v1/gateway/route-inventory', compatMode: 'v1-pass' })
    );
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.version).toBe('v1');
    expect((res.jsonBody as any)?.correlationId).toBe('corr-gateway-route-inventory');
    expect((res.jsonBody as any)?.data?.counts?.apiRoutes).toBe(1);
  });

  it('returns 405 for unsupported methods', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(['GET']);
    expect((res.jsonBody as any)?.error).toContain('Method POST Not Allowed');
  });

  it('delegates failures to shared error handler', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    vi.mocked(generateGatewayRouteInventory).mockImplementation(() => {
      throw new Error('inventory read failure');
    });

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-gateway-route-inventory'
    );
  });
});

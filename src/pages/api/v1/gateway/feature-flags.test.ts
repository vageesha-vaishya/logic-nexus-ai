import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './feature-flags';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  getGatewayFeatureFlagConfigSnapshot,
  resolveGatewayFeatureFlag,
  updateGatewayFeatureFlagConfig,
} from '../../_utils/gateway-feature-flags';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
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

vi.mock('../../_utils/gateway-feature-flags', () => ({
  getGatewayFeatureFlagConfigSnapshot: vi.fn(),
  resolveGatewayFeatureFlag: vi.fn(),
  updateGatewayFeatureFlagConfig: vi.fn(),
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

describe('/api/v1/gateway/feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-gateway-feature-flags',
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
    vi.mocked(getGatewayFeatureFlagConfigSnapshot).mockReturnValue({
      version: 3,
      checksum: 'checksum-3',
      globalKillSwitch: false,
      updatedAt: '2026-03-21T00:00:00.000Z',
      modules: {},
    } as any);
    vi.mocked(resolveGatewayFeatureFlag).mockReturnValue({
      moduleKey: 'gateway.route-inventory',
      enabled: true,
      reason: 'enabled',
      configVersion: 3,
      checksum: 'checksum-3',
      cohortMatched: true,
      rolloutBucket: 3,
      rolloutPercent: 100,
    } as any);
  });

  it('returns flag platform snapshot and rollout decisions on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'PATCH', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.config?.version).toBe(3);
    expect((res.jsonBody as any)?.data?.rollout?.routeInventory?.enabled).toBe(true);
  });

  it('applies version-pinned update on PATCH without redeploy', async () => {
    vi.mocked(updateGatewayFeatureFlagConfig).mockReturnValue({
      version: 4,
      checksum: 'checksum-4',
      globalKillSwitch: false,
      updatedAt: '2026-03-21T01:00:00.000Z',
      modules: {},
    } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        expectedVersion: 3,
        expectedChecksum: 'checksum-3',
        nextVersion: 4,
        modules: {
          'crm.leads-v2': {
            enabled: true,
            rolloutPercent: 25,
            tenantCohorts: ['tenant-1'],
          },
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(updateGatewayFeatureFlagConfig).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 3,
      expectedChecksum: 'checksum-3',
      nextVersion: 4,
    }));
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[GatewayFeatureFlags] config updated',
      expect.objectContaining({ updatedVersion: 4 })
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getGatewayFeatureFlagConfigSnapshot).mockImplementation(() => {
      throw new Error('flag store unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-gateway-feature-flags'
    );
  });
});

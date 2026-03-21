import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './projection-cache-control';
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
import { resolveGatewayFeatureFlag } from '../../_utils/gateway-feature-flags';
import {
  evaluateProjectionRead,
  getProjectionCachingStatus,
  getProjectionRollbackProfile,
  invalidateProjectionCache,
  listCacheInvalidationContracts,
  listProjectionPipelines,
  listStalenessBudgets,
  putProjectionCache,
  setProjectionRollbackProfile,
  upsertCacheInvalidationContract,
  upsertProjectionPipelineState,
  upsertStalenessBudget,
} from '../../_utils/projection-caching-strategy';

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
  resolveGatewayFeatureFlag: vi.fn(),
}));

vi.mock('../../_utils/projection-caching-strategy', () => ({
  evaluateProjectionRead: vi.fn(),
  getProjectionCachingStatus: vi.fn(),
  getProjectionRollbackProfile: vi.fn(),
  invalidateProjectionCache: vi.fn(),
  listCacheInvalidationContracts: vi.fn(),
  listProjectionPipelines: vi.fn(),
  listStalenessBudgets: vi.fn(),
  putProjectionCache: vi.fn(),
  setProjectionRollbackProfile: vi.fn(),
  upsertCacheInvalidationContract: vi.fn(),
  upsertProjectionPipelineState: vi.fn(),
  upsertStalenessBudget: vi.fn(),
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

describe('/api/v1/gateway/projection-cache-control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-projection-cache',
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
    vi.mocked(resolveGatewayFeatureFlag).mockReturnValue({
      moduleKey: 'gateway.projection-caching',
      enabled: true,
      reason: 'enabled',
      configVersion: 8,
      checksum: 'checksum-8',
      cohortMatched: true,
      rolloutBucket: 12,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getProjectionCachingStatus).mockReturnValue({ projectionLagWithinSlo: true, readLatencyWithinSlo: true } as any);
    vi.mocked(listProjectionPipelines).mockReturnValue([] as any);
    vi.mocked(listStalenessBudgets).mockReturnValue([] as any);
    vi.mocked(listCacheInvalidationContracts).mockReturnValue([] as any);
    vi.mocked(getProjectionRollbackProfile).mockReturnValue({ disableStaleProjections: true } as any);
    vi.mocked(evaluateProjectionRead).mockReturnValue({ mode: 'projection_cache' } as any);
    vi.mocked(putProjectionCache).mockReturnValue({ cacheKey: 'cache-1' } as any);
    vi.mocked(invalidateProjectionCache).mockReturnValue({ invalidated: 2, eventMatched: true } as any);
  });

  it('returns projection status on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.status?.projectionLagWithinSlo).toBe(true);
  });

  it('evaluates read probe on POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        readProbe: {
          moduleKey: 'module-crm',
          projectionKey: 'pipeline-board',
          keyPrefix: 'tenant',
          entityKey: 'tenant-1',
        },
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(evaluateProjectionRead).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('updates governance on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        pipelineUpsert: { moduleKey: 'module-crm', projectionKey: 'pipeline-board', lagMs: 1200 },
        budgetUpsert: { moduleKey: 'module-crm', projectionKey: 'pipeline-board', maxLagMs: 5000, maxReadLatencyMs: 250 },
        rollbackProfile: { disableStaleProjections: true },
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(upsertProjectionPipelineState).toHaveBeenCalled();
    expect(upsertStalenessBudget).toHaveBeenCalled();
    expect(setProjectionRollbackProfile).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[ProjectionCacheControl] projection governance updated',
      expect.any(Object)
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getProjectionCachingStatus).mockImplementation(() => {
      throw new Error('projection failure');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-projection-cache');
  });
});

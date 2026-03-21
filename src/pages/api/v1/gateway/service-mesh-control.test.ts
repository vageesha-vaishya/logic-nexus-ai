import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './service-mesh-control';
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
  evaluateMeshTrafficControl,
  getMeshCoverageSummary,
  getServiceMeshProfile,
  listNamespaceOnboardingStates,
  listServiceMeshProfiles,
  setNamespaceOnboardingState,
  upsertServiceMeshProfile,
} from '../../_utils/service-mesh-discovery';

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

vi.mock('../../_utils/service-mesh-discovery', () => ({
  evaluateMeshTrafficControl: vi.fn(),
  getMeshCoverageSummary: vi.fn(),
  getServiceMeshProfile: vi.fn(),
  listNamespaceOnboardingStates: vi.fn(),
  listServiceMeshProfiles: vi.fn(),
  setNamespaceOnboardingState: vi.fn(),
  upsertServiceMeshProfile: vi.fn(),
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

describe('/api/v1/gateway/service-mesh-control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-mesh-control',
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
      moduleKey: 'gateway.service-mesh-discovery',
      enabled: true,
      reason: 'enabled',
      configVersion: 7,
      checksum: 'checksum-7',
      cohortMatched: true,
      rolloutBucket: 1,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getMeshCoverageSummary).mockReturnValue({
      totalServices: 4,
      meshControlledServices: 4,
      coveragePercent: 100,
      namespaceCount: 1,
      fullyOnboarded: true,
      allTrafficUnderMeshControl: true,
    } as any);
    vi.mocked(listServiceMeshProfiles).mockReturnValue([] as any);
    vi.mocked(listNamespaceOnboardingStates).mockReturnValue([] as any);
    vi.mocked(getServiceMeshProfile).mockReturnValue(null);
    vi.mocked(evaluateMeshTrafficControl).mockReturnValue({
      controlledByMesh: true,
      reason: 'mesh_controlled',
    } as any);
  });

  it('returns mesh summary on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.summary?.allTrafficUnderMeshControl).toBe(true);
  });

  it('evaluates traffic probe on POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: { trafficProbe: { callerService: 'module-crm', targetService: 'module-quotation' } },
    };
    const res = createResponse();

    await handler(req, res);

    expect(evaluateMeshTrafficControl).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.decision?.reason).toBe('mesh_controlled');
  });

  it('updates service and namespace controls on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        serviceProfile: { serviceName: 'module-crm', meshMode: 'bypass' },
        namespaceOnboarding: { namespace: 'tenant-core', stage: 'progressive', onboardedPercent: 70 },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(upsertServiceMeshProfile).toHaveBeenCalled();
    expect(setNamespaceOnboardingState).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[ServiceMeshControl] mesh configuration updated',
      expect.any(Object)
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getMeshCoverageSummary).mockImplementation(() => {
      throw new Error('mesh unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-mesh-control'
    );
  });
});

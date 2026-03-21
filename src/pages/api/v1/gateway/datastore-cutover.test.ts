import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './datastore-cutover';
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
  createDatastoreReplayArtifact,
  enforceModuleWriteBoundary,
  evaluateControlledReadPath,
  getDatastoreCutoverStatus,
  getDatastoreFallbackProfile,
  listCompatibilityViews,
  listDatastoreBoundaries,
  listReplayArtifacts,
  listWritePathPolicies,
  registerCompatibilityView,
  setDatastoreFallbackProfile,
  upsertModuleDatastoreBoundary,
  hardenModuleWritePath,
} from '../../_utils/module-datastore-cutover';

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

vi.mock('../../_utils/module-datastore-cutover', () => ({
  createDatastoreReplayArtifact: vi.fn(),
  enforceModuleWriteBoundary: vi.fn(),
  evaluateControlledReadPath: vi.fn(),
  getDatastoreCutoverStatus: vi.fn(),
  getDatastoreFallbackProfile: vi.fn(),
  listCompatibilityViews: vi.fn(),
  listDatastoreBoundaries: vi.fn(),
  listReplayArtifacts: vi.fn(),
  listWritePathPolicies: vi.fn(),
  registerCompatibilityView: vi.fn(),
  setDatastoreFallbackProfile: vi.fn(),
  upsertModuleDatastoreBoundary: vi.fn(),
  hardenModuleWritePath: vi.fn(),
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

describe('/api/v1/gateway/datastore-cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-datastore-cutover',
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
      moduleKey: 'gateway.datastore-cutover',
      enabled: true,
      reason: 'enabled',
      configVersion: 8,
      checksum: 'checksum-8',
      cohortMatched: true,
      rolloutBucket: 5,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getDatastoreCutoverStatus).mockReturnValue({
      writeBoundaryEnforced: true,
      modulesFullyHardened: 4,
      totalModules: 4,
    } as any);
    vi.mocked(listDatastoreBoundaries).mockReturnValue([] as any);
    vi.mocked(listWritePathPolicies).mockReturnValue([] as any);
    vi.mocked(listCompatibilityViews).mockReturnValue([] as any);
    vi.mocked(getDatastoreFallbackProfile).mockReturnValue({ enabled: false } as any);
    vi.mocked(listReplayArtifacts).mockReturnValue([] as any);
    vi.mocked(enforceModuleWriteBoundary).mockReturnValue({ allowed: true } as any);
    vi.mocked(evaluateControlledReadPath).mockReturnValue({ mode: 'authoritative', replayRequired: false } as any);
    vi.mocked(createDatastoreReplayArtifact).mockReturnValue({ replayId: 'replay-1' } as any);
  });

  it('returns status details on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.status?.writeBoundaryEnforced).toBe(true);
  });

  it('returns write boundary decision on POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: { writeProbe: { moduleKey: 'module-crm', tableName: 'crm_leads', actor: 'module-crm-service' } },
    };
    const res = createResponse();
    await handler(req, res);
    expect(enforceModuleWriteBoundary).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('applies governance updates on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        boundaryUpsert: { moduleKey: 'module-crm', schemaName: 'crm' },
        writePolicy: { moduleKey: 'module-crm', hardened: true },
        fallbackProfile: { enabled: true, reason: 'rollback' },
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(upsertModuleDatastoreBoundary).toHaveBeenCalled();
    expect(hardenModuleWritePath).toHaveBeenCalled();
    expect(setDatastoreFallbackProfile).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[DatastoreCutover] cutover governance updated',
      expect.any(Object)
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getDatastoreCutoverStatus).mockImplementation(() => {
      throw new Error('datastore failure');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-datastore-cutover');
  });
});

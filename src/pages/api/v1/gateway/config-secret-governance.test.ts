import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './config-secret-governance';
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
  createSignedLocalConfigSnapshot,
  detectConfigDrift,
  getConfigSecretGovernanceStatus,
  getDynamicConfigBundle,
  issueSecretLease,
  listDynamicConfigBundles,
  listSecretLeases,
  listSecretMetadata,
  rotateSecretVersion,
  setSecretAccessPolicy,
  upsertDynamicConfigBundle,
  verifySignedLocalConfigSnapshot,
} from '../../_utils/config-secret-governance';

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

vi.mock('../../_utils/config-secret-governance', () => ({
  createSignedLocalConfigSnapshot: vi.fn(),
  detectConfigDrift: vi.fn(),
  getConfigSecretGovernanceStatus: vi.fn(),
  getDynamicConfigBundle: vi.fn(),
  issueSecretLease: vi.fn(),
  listDynamicConfigBundles: vi.fn(),
  listSecretLeases: vi.fn(),
  listSecretMetadata: vi.fn(),
  rotateSecretVersion: vi.fn(),
  setSecretAccessPolicy: vi.fn(),
  upsertDynamicConfigBundle: vi.fn(),
  verifySignedLocalConfigSnapshot: vi.fn(),
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

describe('/api/v1/gateway/config-secret-governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-config-governance',
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
      moduleKey: 'gateway.config-secret-governance',
      enabled: true,
      reason: 'enabled',
      configVersion: 7,
      checksum: 'checksum-7',
      cohortMatched: true,
      rolloutBucket: 2,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getConfigSecretGovernanceStatus).mockReturnValue({
      bundleCount: 2,
      secretCount: 2,
      activeLeaseCount: 1,
      hardcodedSecretsDetected: false,
      localConfigDriftDetected: false,
    } as any);
    vi.mocked(listDynamicConfigBundles).mockReturnValue([] as any);
    vi.mocked(listSecretMetadata).mockReturnValue([] as any);
    vi.mocked(listSecretLeases).mockReturnValue([] as any);
    vi.mocked(createSignedLocalConfigSnapshot).mockReturnValue({ generatedAt: '2026-03-21T00:00:00.000Z', bundles: [], signature: 'sig' } as any);
    vi.mocked(getDynamicConfigBundle).mockReturnValue(null);
    vi.mocked(issueSecretLease).mockReturnValue({ leaseId: 'lease-1', leaseToken: 'abc...' } as any);
    vi.mocked(upsertDynamicConfigBundle).mockReturnValue({ bundleKey: 'gateway-runtime', version: 2 } as any);
    vi.mocked(verifySignedLocalConfigSnapshot).mockReturnValue(true);
    vi.mocked(detectConfigDrift).mockReturnValue({ driftDetected: false, missingBundles: [], changedBundles: [] } as any);
  });

  it('returns governance summary on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.status?.secretCount).toBe(2);
  });

  it('issues secret lease on POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        leaseIssue: {
          secretKey: 'jwt-signing-key',
          serviceName: 'platform-identity-access',
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(issueSecretLease).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.lease?.leaseId).toBe('lease-1');
  });

  it('rotates secret and policy on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        secretRotate: {
          secretKey: 'jwt-signing-key',
          nextKeyId: 'jwt-key-v2',
          overlapWindowSeconds: 1200,
        },
        accessPolicy: {
          secretKey: 'jwt-signing-key',
          allowedServices: ['platform-identity-access', 'gateway'],
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(rotateSecretVersion).toHaveBeenCalled();
    expect(setSecretAccessPolicy).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[ConfigSecretGovernance] secret governance updated',
      expect.any(Object)
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getConfigSecretGovernanceStatus).mockImplementation(() => {
      throw new Error('governance unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-config-governance'
    );
  });
});

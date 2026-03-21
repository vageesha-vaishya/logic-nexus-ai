import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './identity-policy';
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
  evaluateCentralPolicyDecision,
  getCentralPolicyRules,
  getPolicyAuditRecords,
  getPolicyBypassProfile,
  getPolicyCentralizationStatus,
  getPolicyRolloutState,
  introspectServiceToken,
  propagateMtlsIdentity,
  replaceCentralPolicyRules,
  setPolicyBypassProfile,
  setPolicyRolloutState,
} from '../../_utils/identity-policy-centralization';

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

vi.mock('../../_utils/identity-policy-centralization', () => ({
  evaluateCentralPolicyDecision: vi.fn(),
  getCentralPolicyRules: vi.fn(),
  getPolicyAuditRecords: vi.fn(),
  getPolicyBypassProfile: vi.fn(),
  getPolicyCentralizationStatus: vi.fn(),
  getPolicyRolloutState: vi.fn(),
  introspectServiceToken: vi.fn(),
  propagateMtlsIdentity: vi.fn(),
  replaceCentralPolicyRules: vi.fn(),
  setPolicyBypassProfile: vi.fn(),
  setPolicyRolloutState: vi.fn(),
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

describe('/api/v1/gateway/identity-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-identity-policy',
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
      moduleKey: 'gateway.identity-policy-centralization',
      enabled: true,
      reason: 'enabled',
      configVersion: 6,
      checksum: 'checksum-6',
      cohortMatched: true,
      rolloutBucket: 1,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getPolicyCentralizationStatus).mockReturnValue({
      centralPolicyFullyEnforced: false,
      ruleCount: 4,
      rollout: { stage: 'canary', canaryPercent: 10 },
      bypassProfile: { enabled: false },
    } as any);
    vi.mocked(getPolicyRolloutState).mockReturnValue({
      stage: 'canary',
      canaryPercent: 10,
      automaticRollback: true,
      lastPromotedAt: '2026-03-21T00:00:00.000Z',
    } as any);
    vi.mocked(getPolicyBypassProfile).mockReturnValue({
      enabled: false,
      reason: '',
      strictAuditLogging: true,
      expiresAt: null,
      updatedAt: '2026-03-21T00:00:00.000Z',
    } as any);
    vi.mocked(getCentralPolicyRules).mockReturnValue([
      { callerService: 'module-crm', targetService: 'module-quotation', action: 'publish', resource: 'crm.opportunity.converted', requireTenantMatch: true },
    ] as any);
    vi.mocked(getPolicyAuditRecords).mockReturnValue([] as any);
    vi.mocked(introspectServiceToken).mockReturnValue({ active: true } as any);
    vi.mocked(propagateMtlsIdentity).mockReturnValue({ serviceName: 'module-crm' } as any);
    vi.mocked(evaluateCentralPolicyDecision).mockReturnValue({
      authorized: true,
      reason: 'policy_allowed',
      enforcedByCentralPolicy: true,
      decisionToken: 'decision-1',
    } as any);
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
    expect((res.jsonBody as any)?.data?.status?.ruleCount).toBe(4);
  });

  it('evaluates central policy decision on POST decision', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        decision: {
          callerService: 'module-crm',
          targetService: 'module-quotation',
          action: 'publish',
          resource: 'crm.opportunity.converted',
          token: 'token',
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(evaluateCentralPolicyDecision).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[IdentityPolicyCentralization] policy decision issued',
      expect.objectContaining({ authorized: true })
    );
    expect(res.statusCode).toBe(200);
  });

  it('updates rollout and bypass profile on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        rolloutState: { stage: 'progressive', canaryPercent: 60 },
        bypassProfile: { enabled: true, reason: 'maintenance', strictAuditLogging: true },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(setPolicyRolloutState).toHaveBeenCalled();
    expect(setPolicyBypassProfile).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getPolicyCentralizationStatus).mockImplementation(() => {
      throw new Error('policy unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-identity-policy'
    );
  });
});

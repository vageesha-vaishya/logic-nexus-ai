import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './autoscaling-cost-control';
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
  evaluateAutoscalingDecision,
  evaluateBudgetAlert,
  getAutoscalingCostControlStatus,
  getAutoscalingRollbackProfile,
  listBudgetAlertPolicies,
  listModuleHpaPolicies,
  listQuotaPolicies,
  recordModuleSpend,
  setAutoscalingRollbackProfile,
  upsertBudgetAlertPolicy,
  upsertModuleHpaPolicy,
  upsertQuotaPolicy,
} from '../../_utils/autoscaling-cost-controls';

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

vi.mock('../../_utils/autoscaling-cost-controls', () => ({
  evaluateAutoscalingDecision: vi.fn(),
  evaluateBudgetAlert: vi.fn(),
  getAutoscalingCostControlStatus: vi.fn(),
  getAutoscalingRollbackProfile: vi.fn(),
  listBudgetAlertPolicies: vi.fn(),
  listModuleHpaPolicies: vi.fn(),
  listQuotaPolicies: vi.fn(),
  recordModuleSpend: vi.fn(),
  setAutoscalingRollbackProfile: vi.fn(),
  upsertBudgetAlertPolicy: vi.fn(),
  upsertModuleHpaPolicy: vi.fn(),
  upsertQuotaPolicy: vi.fn(),
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

describe('/api/v1/gateway/autoscaling-cost-control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-autoscaling-cost',
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
      moduleKey: 'gateway.autoscaling-cost-controls',
      enabled: true,
      reason: 'enabled',
      configVersion: 8,
      checksum: 'checksum-8',
      cohortMatched: true,
      rolloutBucket: 20,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getAutoscalingCostControlStatus).mockReturnValue({
      stableScalingUnderLoad: true,
      boundedCloudSpendVariance: true,
    } as any);
    vi.mocked(listModuleHpaPolicies).mockReturnValue([] as any);
    vi.mocked(listBudgetAlertPolicies).mockReturnValue([] as any);
    vi.mocked(listQuotaPolicies).mockReturnValue([] as any);
    vi.mocked(getAutoscalingRollbackProfile).mockReturnValue({ enabled: false } as any);
    vi.mocked(recordModuleSpend).mockReturnValue({ moduleKey: 'module-crm', amountUsd: 100 } as any);
    vi.mocked(evaluateAutoscalingDecision).mockReturnValue({ desiredReplicas: 4 } as any);
    vi.mocked(evaluateBudgetAlert).mockReturnValue({ alertLevel: 'warning' } as any);
  });

  it('returns autoscaling status on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.status?.stableScalingUnderLoad).toBe(true);
  });

  it('evaluates scaling probe on POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        scalingProbe: {
          moduleKey: 'module-crm',
          currentReplicas: 3,
          currentRps: 300,
          cpuUtilizationPercent: 85,
          memoryUtilizationPercent: 82,
        },
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(evaluateAutoscalingDecision).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('updates scaling governance on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: {},
      headers: {},
      body: {
        hpaPolicy: { moduleKey: 'module-crm', minReplicas: 2, maxReplicas: 10 },
        quotaPolicy: { moduleKey: 'module-crm', maxRps: 500 },
        rollbackProfile: { enabled: true, reason: 'controlled rollback' },
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(upsertModuleHpaPolicy).toHaveBeenCalled();
    expect(upsertQuotaPolicy).toHaveBeenCalled();
    expect(setAutoscalingRollbackProfile).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[AutoscalingCostControl] scaling governance updated',
      expect.any(Object)
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getAutoscalingCostControlStatus).mockImplementation(() => {
      throw new Error('autoscaling failure');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-autoscaling-cost');
  });
});

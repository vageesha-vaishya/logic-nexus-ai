import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './reconciliation-report';
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
  buildReconciliationReport,
  getDualRunShadowMode,
  getReconciliationArtifacts,
  setDualRunShadowMode,
} from '../../_utils/dual-run-reconciliation';

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

vi.mock('../../_utils/dual-run-reconciliation', () => ({
  buildReconciliationReport: vi.fn(),
  getDualRunShadowMode: vi.fn(),
  getReconciliationArtifacts: vi.fn(),
  setDualRunShadowMode: vi.fn(),
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

describe('/api/v1/gateway/reconciliation-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-reconciliation',
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
      moduleKey: 'gateway.dual-run-reconciliation',
      enabled: true,
      reason: 'enabled',
      configVersion: 5,
      checksum: 'checksum-5',
      cohortMatched: true,
      rolloutBucket: 3,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getDualRunShadowMode).mockReturnValue({
      moduleKey: 'module-crm',
      shadowReadsEnabled: true,
      shadowWritesEnabled: true,
      updatedAt: '2026-03-21T00:00:00.000Z',
    } as any);
    vi.mocked(getReconciliationArtifacts).mockReturnValue([] as any);
    vi.mocked(setDualRunShadowMode).mockReturnValue({
      moduleKey: 'module-crm',
      shadowReadsEnabled: false,
      shadowWritesEnabled: false,
      updatedAt: '2026-03-21T00:00:00.000Z',
    } as any);
    vi.mocked(buildReconciliationReport).mockReturnValue({
      runId: 'run-1',
      moduleKey: 'module-crm',
      entityKey: 'crm.lead',
      thresholdPercent: 0.5,
      totalPrimaryRecords: 10,
      totalShadowRecords: 10,
      comparedRecords: 10,
      mismatchRecords: 0,
      diffRatePercent: 0,
      withinThreshold: true,
      generatedAt: '2026-03-21T00:00:00.000Z',
      mismatches: [],
      canonicalRule: {
        trimStrings: true,
        normalizeEmailCase: true,
        sortArrays: true,
        numberPrecision: 6,
      },
    } as any);
  });

  it('returns current dual-run mode and artifacts on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: { moduleKey: 'module-crm' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.mode?.moduleKey).toBe('module-crm');
  });

  it('generates deterministic reconciliation report on POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { moduleKey: 'module-crm' },
      headers: {},
      body: {
        moduleKey: 'module-crm',
        entityKey: 'crm.lead',
        primaryRecords: [{ id: 'lead-1' }],
        shadowRecords: [{ id: 'lead-1' }],
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(buildReconciliationReport).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[DualRunReconciliation] report generated',
      expect.objectContaining({ moduleKey: 'module-crm' })
    );
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.report?.runId).toBe('run-1');
  });

  it('terminates shadow mode while preserving artifacts on PATCH', async () => {
    vi.mocked(getReconciliationArtifacts).mockReturnValue([{ runId: 'run-1' }] as any);
    const req: ApiRequest = {
      method: 'PATCH',
      query: { moduleKey: 'module-crm' },
      headers: {},
      body: {
        moduleKey: 'module-crm',
        shadowMode: {
          shadowReadsEnabled: false,
          shadowWritesEnabled: false,
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(setDualRunShadowMode).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.artifacts?.length).toBe(1);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getDualRunShadowMode).mockImplementation(() => {
      throw new Error('dual run unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: { moduleKey: 'module-crm' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-reconciliation'
    );
  });
});

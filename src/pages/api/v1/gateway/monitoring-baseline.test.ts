import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './monitoring-baseline';
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
import { generateMonitoringBaselinePayload } from '../../_utils/monitoring-baseline';
import { resolveGatewayFeatureFlag } from '../../_utils/gateway-feature-flags';

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

vi.mock('../../_utils/monitoring-baseline', () => ({
  generateMonitoringBaselinePayload: vi.fn(),
}));

vi.mock('../../_utils/gateway-feature-flags', () => ({
  resolveGatewayFeatureFlag: vi.fn(),
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

describe('/api/v1/gateway/monitoring-baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-monitoring-baseline',
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
      moduleKey: 'gateway.monitoring-baseline',
      enabled: true,
      reason: 'enabled',
      configVersion: 4,
      checksum: 'checksum-4',
      cohortMatched: true,
      rolloutBucket: 8,
      rolloutPercent: 100,
    } as any);
    vi.mocked(generateMonitoringBaselinePayload).mockReturnValue({
      generatedAt: '2026-03-21T00:00:00.000Z',
      featureFlag: {
        key: 'MIGRATION_BASELINE_SLO_V1',
        enabled: true,
        configVersion: 4,
        configChecksum: 'checksum-4',
      },
      goldenSignals: {
        latency: { p95Ms: 450, p99Ms: 900, objectiveMs: 450 },
        errorRate: { value: 0.008, objective: 0.01, errorBudgetRemainingPercent: 20 },
        throughputRpm: 1600,
        availabilityPercent: 99.95,
        series: [],
      },
      businessKpis: [],
      alerts: {
        legacyChannelsParallel: true,
        noisyAlertMitigation: {
          burnRateWindows: ['5m', '30m'],
          activeWindow: '30m',
        },
        policies: [],
      },
    } as any);
  });

  it('returns baseline with p95 p99 and error budget signals', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'OPTIONS'] });
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.goldenSignals?.latency?.p95Ms).toBe(450);
    expect((res.jsonBody as any)?.data?.goldenSignals?.latency?.p99Ms).toBe(900);
    expect((res.jsonBody as any)?.data?.goldenSignals?.errorRate?.errorBudgetRemainingPercent).toBe(20);
  });

  it('returns rollout-controlled 404 when cohort is not enabled', async () => {
    vi.mocked(resolveGatewayFeatureFlag).mockReturnValue({
      moduleKey: 'gateway.monitoring-baseline',
      enabled: false,
      reason: 'cohort_excluded',
      configVersion: 4,
      checksum: 'checksum-4',
      cohortMatched: false,
      rolloutBucket: 87,
      rolloutPercent: 25,
    } as any);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.rollout?.reason).toBe('cohort_excluded');
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(generateMonitoringBaselinePayload).mockImplementation(() => {
      throw new Error('monitoring unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-monitoring-baseline'
    );
    expect(logApiEvent).toHaveBeenCalledWith(
      'error',
      '[GatewayMonitoringBaseline] failed',
      expect.objectContaining({ correlationId: 'corr-monitoring-baseline' })
    );
  });
});

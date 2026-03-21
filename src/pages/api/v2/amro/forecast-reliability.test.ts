import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './forecast-reliability';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
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

describe('/api/v2/amro/forecast-reliability', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-forecast-reliability-v2',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
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
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({
      isAuthorized: true,
      subscriptionStatus: 'active',
      graceUntil: null,
      source: 'database',
      validatedAt: '2026-03-20T00:00:00.000Z',
    } as any);
  });

  it('returns 404 when forecast-reliability v2 is disabled', async () => {
    process.env.AMRO_FORECAST_RELIABILITY_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'POST', query: { interface: 'score-maintenance-risk' }, body: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(enforceAmroDomainAccess).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('scores maintenance risk and flags feature completeness context', async () => {
    process.env.AMRO_FORECAST_RELIABILITY_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'score-maintenance-risk' },
      body: {
        asset_id: 'aircraft-100',
        telemetry_features: [{ key: 'vibration', value: 0.81 }, { key: 'temperature', value: 77 }],
        defect_history: [{ code: 'D-1' }, { code: 'D-2' }],
        environment_context: { severity: 'severe' },
        required_feature_count: 4,
        feature_completeness_threshold: 0.6,
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAmroDomainAccess).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.risk_score).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output?.confidence_score).toBeLessThanOrEqual(1);
  });

  it('generates interventions within compliance and capacity constraints', async () => {
    process.env.AMRO_FORECAST_RELIABILITY_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'generate-intervention-recommendations' },
      body: {
        risk_score: 84,
        policy_rules: {
          compliance_blocked_actions: ['grounding-inspection'],
        },
        resource_constraints: {
          available_capacity: 2,
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.interventions?.length).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output?.rationale).toContain('compliance and capacity');
  });

  it('rejects outcome capture when metric schema violates feedback policy', async () => {
    process.env.AMRO_FORECAST_RELIABILITY_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'capture-recommendation-outcome' },
      body: {
        recommendation_id: 'rec-100',
        operator_action: 'accepted',
        outcome_at: '2026-03-20T12:00:00.000Z',
        outcome_metrics: [{ key: 'unexpected_metric', value: 11 }],
        feedback_policy: {
          window_start: '2026-03-20T00:00:00.000Z',
          window_end: '2026-03-21T00:00:00.000Z',
          allowed_metric_keys: ['downtime_hours', 'repeat_defect_rate'],
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-forecast-reliability-v2',
      { apiVersion: 'v2' },
    );
  });
});

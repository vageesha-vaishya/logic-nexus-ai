import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './health';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
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

describe('/api/v2/amro/health', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-health',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
  });

  it('returns AMRO health envelope and contract counts', async () => {
    process.env.AMRO_HEALTH_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('health');
    expect((res.jsonBody as any)?.checks?.contracts?.restEndpointCount).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.checks?.gaReadiness?.milestone).toBe('M10');
    expect((res.jsonBody as any)?.checks?.gaReadiness?.readyForGa).toBe(false);
    expect((res.jsonBody as any)?.checks?.performance?.slo_alerting?.api_gateway?.availability_target_percent).toBe(99.95);
    expect((res.jsonBody as any)?.checks?.performance?.capacity_planning?.target_concurrent_work_packages_per_region).toBe(25000);
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('preserves tenant and franchise isolation scope in service boundaries', async () => {
    process.env.AMRO_HEALTH_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.serviceBoundaries?.scopedAccess?.tenant_id).toBe('public');
    expect((res.jsonBody as any)?.serviceBoundaries?.scopedAccess?.franchise_id).toBeNull();
    expect((res.jsonBody as any)?.serviceBoundaries?.capability).toBe('work-packages');
  });

  it('reports GA readiness when M10 evidence checks are satisfied', async () => {
    process.env.AMRO_HEALTH_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED = 'true';
    process.env.AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED = 'true';
    process.env.AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED = 'true';
    process.env.AMRO_SEQ_PREREQ_TEST_PLAN_READY = 'true';
    process.env.AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY = 'true';
    process.env.AMRO_SEQ_M1_STATUS = 'completed';
    process.env.AMRO_SEQ_M2_STATUS = 'completed';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    process.env.AMRO_SEQ_M4_STATUS = 'completed';
    process.env.AMRO_SEQ_M5_STATUS = 'completed';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
    process.env.AMRO_SEQ_M9_STATUS = 'completed';
    process.env.AMRO_SEQ_M10_STATUS = 'completed';
    process.env.AMRO_SEQ_M10_P95_P99_SLO_TARGETS_MET = 'true';
    process.env.AMRO_SEQ_M10_MULTI_REGION_FAILOVER_PASS = 'true';
    process.env.AMRO_SEQ_M10_DR_REHEARSAL_EVIDENCE_PASS = 'true';
    process.env.AMRO_SEQ_M10_ROLLBACK_REHEARSAL_PASS = 'true';
    process.env.AMRO_SEQ_M10_RUNBOOK_EVIDENCE_APPROVED = 'true';
    process.env.AMRO_SEQ_M10_SECURITY_REGRESSION_ZERO_CRITICAL = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.checks?.gaReadiness?.status).toBe('completed');
    expect((res.jsonBody as any)?.checks?.gaReadiness?.readyForGa).toBe(true);
    expect((res.jsonBody as any)?.checks?.gaReadiness?.missingCriteria).toEqual([]);
  });

  it('marks SLO alerting states when observed metrics exceed thresholds', async () => {
    process.env.AMRO_HEALTH_V2_ENABLED = 'true';
    process.env.AMRO_SLO_API_GATEWAY_AVAILABILITY = '99.10';
    process.env.AMRO_SLO_API_GATEWAY_5XX_RATE_PERCENT = '1.6';
    process.env.AMRO_SLO_WORKFLOW_AVAILABILITY = '99.20';
    process.env.AMRO_SLO_WORKFLOW_TRANSITION_FAILURE_PERCENT = '0.8';
    process.env.AMRO_SLO_COMPLIANCE_AVAILABILITY = '99.80';
    process.env.AMRO_SLO_COMPLIANCE_TIMEOUT_PERCENT = '0.4';
    process.env.AMRO_SLO_MOBILE_SYNC_AVAILABILITY = '99.70';
    process.env.AMRO_SLO_MOBILE_SYNC_BACKLOG_MINUTES = '16';
    process.env.AMRO_CAPACITY_CONCURRENT_WORK_PACKAGES_PER_REGION = '31000';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.checks?.performance?.slo_alerting?.api_gateway?.availability_status).toBe('alert');
    expect((res.jsonBody as any)?.checks?.performance?.slo_alerting?.api_gateway?.error_rate_status).toBe('alert');
    expect((res.jsonBody as any)?.checks?.performance?.slo_alerting?.workflow_orchestration?.transition_failure_status).toBe('alert');
    expect((res.jsonBody as any)?.checks?.performance?.slo_alerting?.compliance_gate_engine?.evaluation_timeout_status).toBe('alert');
    expect((res.jsonBody as any)?.checks?.performance?.slo_alerting?.mobile_sync_service?.sync_backlog_age_status).toBe('alert');
    expect((res.jsonBody as any)?.checks?.performance?.capacity_planning?.status).toBe('capacity_risk');
  });

  it('returns 404 when endpoint is disabled', async () => {
    process.env.AMRO_HEALTH_V2_ENABLED = 'false';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toContain('disabled');
  });

  it('handles unsupported methods', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect((res.jsonBody as any)?.error).toContain('Method POST Not Allowed');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});

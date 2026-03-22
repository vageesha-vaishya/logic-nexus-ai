import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './replan';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
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
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import {
  applyCompatibilityResponseHeaders,
  resolveGatewayCompatibility,
} from '../../../_utils/compatibility-facade';

vi.mock('../../../_utils/http', () => ({
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

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
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

describe('/api/v2/amro/schedules/replan', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.AMRO_SCHEDULES_V2_ENABLED = 'true';
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED = 'true';
    process.env.AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED = 'true';
    process.env.AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED = 'true';
    process.env.AMRO_SEQ_PREREQ_TEST_PLAN_READY = 'true';
    process.env.AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY = 'true';
    process.env.AMRO_SEQ_M1_STATUS = 'completed';
    process.env.AMRO_SEQ_M2_STATUS = 'completed';
    process.env.AMRO_SEQ_M3_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M4_STATUS = 'not-started';
    process.env.AMRO_SEQ_M5_STATUS = 'not-started';
    process.env.AMRO_SEQ_M6_STATUS = 'not-started';
    process.env.AMRO_SEQ_M7_STATUS = 'not-started';
    process.env.AMRO_SEQ_M8_STATUS = 'not-started';
    process.env.AMRO_SEQ_M9_STATUS = 'not-started';
    process.env.AMRO_SEQ_M10_STATUS = 'not-started';
    process.env.AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED = 'true';
    process.env.AMRO_SEQ_M1_RLS_ENABLED = 'true';
    process.env.AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100 = 'true';
    process.env.AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY = 'true';
    process.env.AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100 = 'true';
    process.env.AMRO_SEQ_M3_CAPACITY_VALIDATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M3_REPLAN_SIMULATION_TESTS_100 = 'true';
    process.env.AMRO_SEQ_M3_SCHEDULING_P95_TARGET_MET = 'true';
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-replan',
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
      role: 'planner',
      permissions: ['dashboards.view', 'reports.manage'],
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
      validatedAt: '2026-03-21T00:00:00.000Z',
    } as any);
  });

  it('runs replan simulation with active constraints for API-AMRO-005', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'run-replan-simulation' },
      headers: {},
      body: {
        disrupted_slots: [{ station_code: 'station-a', slot_start: '2026-03-22T01:00:00.000Z' }],
        priority_rules: { critical_first: true },
        planning_horizon: '72h',
        active_constraints: [{ id: 'hangar-capacity' }, { id: 'night-curfew' }],
        tenant_calendar_id: 'tenant-1:calendar-main',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalledWith(['dashboards.view', 'reports.manage'], ['dashboards.manage', 'reports.manage']);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('run-replan-simulation');
    expect((res.jsonBody as any)?.output?.replan_options?.length).toBeGreaterThan(0);
  });

  it('rejects replan simulation when constraints are missing', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'run-replan-simulation' },
      headers: {},
      body: {
        disrupted_slots: [{ station_code: 'station-a', slot_start: '2026-03-22T01:00:00.000Z' }],
        priority_rules: { critical_first: true },
        planning_horizon: '72h',
        active_constraints: [],
        tenant_calendar_id: 'tenant-1:calendar-main',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-replan',
      { apiVersion: 'v2' }
    );
  });

  it('rejects replan simulation when tenant calendar is out of scope', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'run-replan-simulation' },
      headers: {},
      body: {
        disrupted_slots: [{ station_code: 'station-a', slot_start: '2026-03-22T01:00:00.000Z' }],
        priority_rules: { critical_first: true },
        planning_horizon: '72h',
        active_constraints: [{ id: 'hangar-capacity' }],
        tenant_calendar_id: 'tenant-2:calendar-main',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-replan',
      { apiVersion: 'v2' }
    );
  });

  it('confirms replan with planner role and replannable states', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'confirm-replan' },
      headers: {},
      body: {
        selected_option_id: 'tenant-1-fr-1-replan-opt-1',
        approver_id: 'planner-1',
        reason: 'weather disruption',
        affected_work_packages: [
          { work_package_id: 'wp-001', current_state: 'planning' },
          { work_package_id: 'wp-002', current_state: 'scheduled' },
        ],
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('confirm-replan');
    expect((res.jsonBody as any)?.output?.affected_work_packages?.length).toBe(2);
  });

  it('rejects replan confirmation for non-approver role', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-2',
      role: 'technician',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'confirm-replan' },
      headers: {},
      body: {
        selected_option_id: 'tenant-1-fr-1-replan-opt-2',
        approver_id: 'tech-1',
        reason: 'manual override',
        affected_work_packages: [{ work_package_id: 'wp-001', current_state: 'planning' }],
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-replan',
      { apiVersion: 'v2' }
    );
  });

  it('returns schedule optimization recommendations with bounded confidence ranking', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'generate-schedule-optimization-recommendations' },
      headers: {},
      body: {
        schedule_date: '2026-03-22',
        station_code: 'station-a',
        demand_pressure: 0.78,
        disruption_risk: 0.56,
        recommendation_count: 4,
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('generate-schedule-optimization-recommendations');
    expect((res.jsonBody as any)?.output?.recommendations?.length).toBe(4);
    expect((res.jsonBody as any)?.output?.recommendations?.[0]?.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

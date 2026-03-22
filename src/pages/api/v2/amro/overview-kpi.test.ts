import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './overview-kpi';
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
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

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

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
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

describe('/api/v2/amro/overview-kpi', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
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
    process.env.AMRO_SEQ_M9_STATUS = 'in-progress';
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
    process.env.AMRO_SEQ_M4_STEP_ORDER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M4_EVIDENCE_CHECKSUM_100 = 'true';
    process.env.AMRO_SEQ_M4_OFFLINE_SYNC_TESTS_100 = 'true';
    process.env.AMRO_SEQ_M4_MOBILE_CRITICAL_FLOWS_PASS = 'true';
    process.env.AMRO_SEQ_M5_NEGATIVE_PATH_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M5_SERIALIZED_UNIQUENESS_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M5_SHORTAGE_TO_PROCUREMENT_E2E_SCOPE_SAFE = 'true';
    process.env.AMRO_SEQ_M6_GATE_EVALUATION_BLOCKER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_CERT_AUTHORITY_VALIDITY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_ZERO_UNRESOLVED_BLOCKER_RULE_PASS = 'true';
    process.env.AMRO_SEQ_M6_DOSSIER_GENERATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_ADAPTER_CONTRACT_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_IDEMPOTENCY_REPLAY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_DLQ_REPLAY_CLOSURE_100 = 'true';
    process.env.AMRO_SEQ_M8_KPI_CORRECTNESS_BASELINE_PASS = 'true';
    process.env.AMRO_SEQ_M8_RECOMMENDATION_CONTRACT_EXPLAINABILITY_PASS = 'true';
    process.env.AMRO_SEQ_M8_LOW_CONFIDENCE_POLICY_TESTS_PASS = 'true';
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-overview-kpi',
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
    const tableRows: Record<string, unknown[]> = {
      work_package_master: [
        {
          id: 'wp-1',
          title: 'A Check WP',
          status: 'in_progress',
          planner_id: 'planner-1',
          engineer_id: 'engineer-1',
          due_at: '2026-03-22T05:00:00.000Z',
          progress_pct: 52,
          tenant_id: 'tenant-1',
        },
      ],
      materials_inventory: [
        {
          id: 'mat-1',
          part_number: 'PART-001',
          station_id: 'station-a',
          available_qty: 1,
          reserved_qty: 4,
          tenant_id: 'tenant-1',
        },
      ],
      compliance_gates: [
        {
          id: 'gate-1',
          gate_name: 'AD Closeout',
          status: 'failed',
          due_at: '2026-03-23T00:00:00.000Z',
          owner_id: 'inspector-1',
          tenant_id: 'tenant-1',
        },
      ],
      integration_logs: [
        {
          id: 'int-1',
          integration_id: 'sap-pm',
          status: 'failed',
          direction: 'outbound',
          last_attempt_at: '2026-03-21T09:00:00.000Z',
          error_message: 'Timeout',
          tenant_id: 'tenant-1',
        },
      ],
      forecast_recommendations: [
        {
          id: 'fc-1',
          recommendation: 'Pull inspection forward by 12 hours',
          confidence_pct: 94,
          risk_score: 88,
          reason: 'Anomaly cluster increased',
          work_package_id: 'wp-1',
          tenant_id: 'tenant-1',
        },
      ],
      task_execution_status: [
        {
          id: 'task-1',
          status: 'completed',
          technician_id: 'tech-1',
          completed_on_mobile: true,
          productivity_score: 93,
          completed_at: '2026-03-21T10:00:00.000Z',
          tenant_id: 'tenant-1',
        },
      ],
      scheduling_board_data: [
        {
          id: 'slot-1',
          station_id: 'station-a',
          slot_start_at: '2026-03-23T10:00:00.000Z',
          slot_end_at: '2026-03-23T12:00:00.000Z',
          resource_name: 'Line Team 1',
          utilization_pct: 82,
          tenant_id: 'tenant-1',
        },
      ],
      certification_records: [
        {
          id: 'cert-1',
          work_package_id: 'wp-1',
          authority: 'FAA',
          status: 'pending',
          submitted_at: '2026-03-21T11:00:00.000Z',
          tenant_id: 'tenant-1',
        },
      ],
      audit_trails: [
        {
          id: 'audit-1',
          action: 'gate-evaluation',
          actor: 'inspector-1',
          created_at: '2026-03-21T12:00:00.000Z',
          outcome: 'failed',
          tenant_id: 'tenant-1',
        },
      ],
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((tableName: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(async () => ({
              data: tableRows[tableName] || [],
              error: null,
            })),
          })),
        })),
      })),
    } as any);
  });

  it('returns dashboard payload for load-kpi-dashboard interface', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        station_ids: 'station-a,station-b',
        fleet_ids: 'fleet-a',
        regulator_profile: 'FAA',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect((res.jsonBody as any)?.interface).toBe('load-kpi-dashboard');
    expect((res.jsonBody as any)?.output?.kpi_cards?.length).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.input?.station_ids).toEqual(['tenant-1:station-a', 'tenant-1:station-b']);
    expect((res.jsonBody as any)?.input?.fleet_ids).toEqual(['tenant-1:fleet-a']);
    expect((res.jsonBody as any)?.output).toHaveProperty('executive_summary');
    expect((res.jsonBody as any)?.output).toHaveProperty('work_package_overview');
    expect((res.jsonBody as any)?.output).toHaveProperty('materials_reservation_alerts');
    expect((res.jsonBody as any)?.output).toHaveProperty('compliance_gate_status');
    expect((res.jsonBody as any)?.output).toHaveProperty('integration_monitor');
    expect((res.jsonBody as any)?.output).toHaveProperty('risk_heatmap');
    expect((res.jsonBody as any)?.output).toHaveProperty('trend_lines');
    expect((res.jsonBody as any)?.output).toHaveProperty('anomaly_flags');
  });

  it('returns freshness warning when dashboard cache exceeds stale threshold', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        cache_age_seconds: '1200',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.freshness_warning).toContain('Data may be stale');
  });

  it('rejects non allow-listed metric key for trends interface', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-operational-trends',
        metric_key: 'unsupported_metric',
        window: '30d',
        compare_window: '30d',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-overview-kpi',
      { apiVersion: 'v2' }
    );
  });

  it('returns trends payload for allow-listed metric and valid compare window', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-operational-trends',
        metric_key: 'schedule_adherence',
        window: '7d',
        compare_window: '30d',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('load-operational-trends');
    expect((res.jsonBody as any)?.output?.time_series?.length).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output).toHaveProperty('variance');
    expect((res.jsonBody as any)?.output).toHaveProperty('task_execution_monitor');
    expect((res.jsonBody as any)?.output).toHaveProperty('scheduling_board_snapshot');
    expect((res.jsonBody as any)?.output).toHaveProperty('certification_decision_queue');
    expect((res.jsonBody as any)?.output).toHaveProperty('audit_timeline');
    expect((res.jsonBody as any)?.output).toHaveProperty('forecast_recommendation_hub');
  });

  it('rejects compare window beyond policy maximum', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    process.env.AMRO_KPI_COMPARE_WINDOW_MAX_DAYS = '30';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-operational-trends',
        metric_key: 'schedule_adherence',
        window: '7d',
        compare_window: '90d',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-overview-kpi',
      { apiVersion: 'v2' }
    );
  });

  it('enforces analytics export privilege for export interface', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    vi.mocked(enforceAnyPermission).mockImplementation(() => {
      throw new Error('Forbidden');
    });
    const req: ApiRequest = {
      method: 'POST',
      query: {
        interface: 'export-kpi-snapshot',
      },
      body: {
        format: 'csv',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        selected_widgets: ['kpi_cards'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-overview-kpi',
      { apiVersion: 'v2' }
    );
  });

  it('returns export payload and policy cap metadata', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    process.env.AMRO_KPI_EXPORT_MAX_ROWS = '2000';
    const req: ApiRequest = {
      method: 'POST',
      query: {
        interface: 'export-kpi-snapshot',
      },
      body: {
        format: 'pdf',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        selected_widgets: ['kpi_cards', 'risk_heatmap', 'trend_lines'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('export-kpi-snapshot');
    expect((res.jsonBody as any)?.output?.export_job_id).toContain('tenant-1-kpi-export');
    expect((res.jsonBody as any)?.policy?.row_cap).toBe(2000);
    expect((res.jsonBody as any)?.policy?.row_cap_applied).toBe(true);
  });

  it('rejects export when selected_widgets is empty', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: {
        interface: 'export-kpi-snapshot',
      },
      body: {
        format: 'pdf',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        selected_widgets: [],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-overview-kpi',
      { apiVersion: 'v2' }
    );
  });

  it('blocks M9 export interface when M8 is not completed', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M8_STATUS = 'in-progress';
    const req: ApiRequest = {
      method: 'POST',
      query: {
        interface: 'export-kpi-snapshot',
      },
      body: {
        format: 'pdf',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        selected_widgets: ['kpi_cards'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-overview-kpi',
      { apiVersion: 'v2' }
    );
  });
});

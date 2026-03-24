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
  logApiEvent,
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

type QueryInvocationState = {
  eqCalls: Array<{ column: string; value: unknown }>;
  neqCalls: Array<{ column: string; value: unknown }>;
  orderCalls: Array<{ column: string; options?: { ascending: boolean } }>;
};

function createSupabaseFromMock(
  resolver: (tableName: string, state: QueryInvocationState) => Promise<{ data: unknown[] | null; error: unknown }> | { data: unknown[] | null; error: unknown }
) {
  return vi.fn((tableName: string) => {
    const state: QueryInvocationState = {
      eqCalls: [],
      neqCalls: [],
      orderCalls: [],
    };
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn((column: string, value: unknown) => {
        state.eqCalls.push({ column, value });
        return chain;
      }),
      neq: vi.fn((column: string, value: unknown) => {
        state.neqCalls.push({ column, value });
        return chain;
      }),
      order: vi.fn((column: string, options?: { ascending: boolean }) => {
        state.orderCalls.push({ column, options });
        return chain;
      }),
      limit: vi.fn(async () => resolver(tableName, state)),
    };
    return chain;
  });
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
    vi.mocked(logApiEvent).mockImplementation(() => undefined);
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
      from: createSupabaseFromMock(async (tableName) => ({
        data: tableRows[tableName] || [],
        error: null,
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

  it('applies dashboard pagination metadata for work package overview rows', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-23T00:00:00.000Z',
        page: '2',
        page_size: '1',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.input?.page).toBe(2);
    expect((res.jsonBody as any)?.input?.page_size).toBe(1);
    expect((res.jsonBody as any)?.output?.pagination?.page).toBe(2);
    expect((res.jsonBody as any)?.output?.pagination?.page_size).toBe(1);
    expect((res.jsonBody as any)?.output?.pagination?.total_rows).toBeGreaterThanOrEqual(1);
  });

  it('uses latest seeded overview snapshot values when operational tables are empty', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const snapshotRows: Record<string, unknown[]> = {
      amro_overview_kpi_snapshots: [
        {
          id: 'snap-1',
          tenant_id: 'tenant-1',
          franchise_id: 'fr-1',
          persona: 'management',
          date_range_start: '2026-03-01',
          date_range_end: '2026-03-21',
          snapshot_at: '2026-03-21T00:00:00.000Z',
          open_work_packages: 38,
          in_progress_tasks: 246,
          deferred_items: 12,
          compliance_alerts: 19,
          sla_breach_count: 7,
          risk_heatmap: {
            station_blr: { medium: 6, high: 3 },
            station_hyd: { medium: 4, high: 1 },
          },
          trend_lines: [{ metric: 'task_completion', points: [{ date: '2026-03-20', value: 77.4 }] }],
          anomaly_alerts: [{ metric: 'engine_vibration', count: 2 }],
          aog_count: 3,
        },
      ],
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: createSupabaseFromMock(async (tableName) => ({
        data: snapshotRows[tableName] || [],
        error: null,
      })),
    } as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-23T00:00:00.000Z',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.executive_summary?.active_work_packages).toBe(38);
    expect((res.jsonBody as any)?.output?.executive_summary?.overdue_tasks).toBe(7);
    expect((res.jsonBody as any)?.output?.risk_heatmap?.cells?.[0]?.station).toContain('tenant-1:station_blr');
    expect((res.jsonBody as any)?.output?.trend_lines?.[0]?.metric_key).toBe('task_completion');
    expect((res.jsonBody as any)?.output?.trend_lines?.[0]?.points?.[0]?.value).toBe(77.4);
    expect((res.jsonBody as any)?.output?.anomaly_flags?.[0]?.metric_key).toBe('engine_vibration');
    expect((res.jsonBody as any)?.output?.kpi_cards?.some((card: any) => card.key === 'aog_count' && card.value === 3)).toBe(true);
    expect((res.jsonBody as any)?.output?.snapshot_metadata?.snapshot_id).toBe('snap-1');
  });

  it('logs overview dashboard data issues when source tables fail', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: createSupabaseFromMock(async () => ({
        data: null,
        error: {
          code: 'XX000',
          message: 'database connectivity failure',
        },
      })),
    } as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-23T00:00:00.000Z',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.data_issues?.length).toBeGreaterThan(0);
    expect(logApiEvent).toHaveBeenCalledWith(
      'warn',
      'AMRO overview KPI data issues detected',
      expect.objectContaining({
        correlationId: 'corr-amro-overview-kpi',
        tenantId: 'tenant-1',
        interface: 'load-kpi-dashboard',
      }),
    );
  });

  it('applies planner persona scoping for dashboard interface', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'planner-1',
      role: 'user',
      permissions: ['dashboards.view'],
    } as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.role_scope?.persona).toBe('planner');
    expect((res.jsonBody as any)?.output?.role_scope?.planner_id).toBe('planner-1');
    expect((res.jsonBody as any)?.output?.integration_monitor?.recent_failures).toEqual([]);
    expect((res.jsonBody as any)?.output?.anomaly_flags).toEqual([]);
  });

  it('applies non-UUID tenant fallback in development when tenant filter fails', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-dev',
      tenantId: 'tenant-dev-local',
      franchiseId: 'fr-1',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: createSupabaseFromMock(async (tableName, state) => {
        if (tableName === 'work_package_master' || tableName === 'work_packages') {
          const hasTenantFilter = state.eqCalls.some((call) => call.column === 'tenant_id');
          if (hasTenantFilter) {
            return {
              data: null,
              error: {
                code: '22P02',
                message: 'invalid input syntax for type uuid: "tenant-dev-local"',
              },
            };
          }
          return {
            data: [
              {
                id: 'wp-dev-1',
                title: 'Dev Tenant Work Package',
                status: 'in_progress',
                assigned_to: 'user-dev',
                due_at: '2026-03-23T10:00:00.000Z',
                tenant_id: 'tenant-dev-local',
              },
            ],
            error: null,
          };
        }
        return {
          data: [],
          error: null,
        };
      }),
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-24T00:00:00.000Z',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const scopeTenantId = (res.jsonBody as any)?.scope?.tenantId || (res.jsonBody as any)?.scope?.tenant_id;
    expect(scopeTenantId).toBe('tenant-dev-local');
    expect((res.jsonBody as any)?.output?.work_package_overview?.[0]?.work_package_id).toBe('wp-dev-1');
    expect((res.jsonBody as any)?.output?.data_issues).toContain(
      'work_package_master: tenant scope fallback applied for non-UUID tenant_id in development'
    );
  });

  it('uses fallback AMRO tables when overview aliases are missing from schema cache', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const fallbackRows: Record<string, unknown[]> = {
      work_packages: [
        {
          id: 'wp-9',
          work_package_number: 'WP-009',
          status: 'in_progress',
          due_at: '2026-03-20T05:00:00.000Z',
          planned_end: '2026-03-22T05:00:00.000Z',
          tenant_id: 'tenant-1',
        },
      ],
      parts_inventory: [
        {
          id: 'inv-1',
          part_number: 'PART-ALPHA',
          station_id: 'station-a',
          quantity_available: 1,
          quantity_required: 3,
          tenant_id: 'tenant-1',
        },
      ],
      compliance_records: [
        {
          id: 'cr-1',
          gate_name: 'ETOPS',
          compliance_status: 'failed',
          due_at: '2026-03-25T00:00:00.000Z',
          owner_id: 'inspector-1',
          tenant_id: 'tenant-1',
        },
      ],
      integration_jobs: [
        {
          id: 'ij-1',
          integration_id: 'sap-pm',
          status: 'failed',
          direction: 'outbound',
          last_attempt_at: '2026-03-21T09:00:00.000Z',
          error_message: 'Timeout',
          tenant_id: 'tenant-1',
        },
      ],
      forecast_outputs: [
        {
          id: 'fo-1',
          recommendation: 'Re-sequence inspections',
          confidence_pct: 91,
          risk_score: 75,
          reason: 'Utilization drift',
          work_package_id: 'wp-9',
          tenant_id: 'tenant-1',
        },
      ],
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: createSupabaseFromMock(async (tableName) => {
        if (['work_package_master', 'materials_inventory', 'compliance_gates', 'integration_logs', 'forecast_recommendations'].includes(tableName)) {
          return {
            data: null,
            error: {
              code: 'PGRST205',
              message: `Could not find the table 'public.${tableName}' in the schema cache`,
            },
          };
        }
        return {
          data: fallbackRows[tableName] || [],
          error: null,
        };
      }),
    } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-kpi-dashboard',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.data_issues).toEqual([]);
    expect((res.jsonBody as any)?.output?.work_package_overview?.[0]?.work_package_id).toBe('wp-9');
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

  it('returns trend pagination metadata for certification queue and audit timeline', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        interface: 'load-operational-trends',
        metric_key: 'schedule_adherence',
        window: '30d',
        compare_window: '30d',
        page: '1',
        page_size: '1',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.pagination?.page).toBe(1);
    expect((res.jsonBody as any)?.output?.pagination?.page_size).toBe(1);
    expect((res.jsonBody as any)?.output?.pagination?.audit_timeline_total_rows).toBeGreaterThanOrEqual(1);
    expect((res.jsonBody as any)?.output?.pagination?.certification_queue_total_rows).toBeGreaterThanOrEqual(1);
  });

  it('redacts trend actor details for planner persona', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'planner-1',
      role: 'user',
      permissions: ['dashboards.view'],
    } as any);
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
    expect((res.jsonBody as any)?.output?.role_scope?.persona).toBe('planner');
    expect((res.jsonBody as any)?.output?.audit_timeline?.[0]?.actor).toBe('restricted');
  });

  it('uses fallback operational tables when trend aliases are missing from schema cache', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const fallbackRows: Record<string, unknown[]> = {
      tasks: [
        {
          id: 'task-88',
          status: 'completed',
          assignee_id: 'tech-1',
          completed_at: '2026-03-21T10:00:00.000Z',
          completed_on_mobile: true,
          productivity_score: 90,
          tenant_id: 'tenant-1',
        },
      ],
      schedules: [
        {
          id: 'sched-1',
          station: 'station-a',
          scheduled_start_at: '2030-03-23T10:00:00.000Z',
          scheduled_end_at: '2030-03-23T12:00:00.000Z',
          resource_name: 'Line Team 1',
          utilization_pct: 82,
          tenant_id: 'tenant-1',
        },
      ],
      certification_actions: [
        {
          id: 'cert-a',
          work_package_id: 'wp-1',
          authority: 'FAA',
          certification_status: 'pending',
          submitted_at: '2026-03-21T11:00:00.000Z',
          tenant_id: 'tenant-1',
        },
      ],
      maintenance_events: [
        {
          id: 'evt-1',
          event_type: 'gate-evaluation',
          performed_by: 'inspector-1',
          occurred_at: '2026-03-21T12:00:00.000Z',
          result_status: 'failed',
          tenant_id: 'tenant-1',
        },
      ],
      forecast_outputs: [
        {
          id: 'fo-2',
          recommendation: 'Advance A-check',
          confidence_pct: 87,
          risk_score: 70,
          reason: 'Lead-time risk',
          work_package_id: 'wp-1',
          tenant_id: 'tenant-1',
        },
      ],
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: createSupabaseFromMock(async (tableName) => {
        if (['task_execution_status', 'scheduling_board_data', 'certification_records', 'audit_trails', 'forecast_recommendations'].includes(tableName)) {
          return {
            data: null,
            error: {
              code: 'PGRST205',
              message: `Could not find the table 'public.${tableName}' in the schema cache`,
            },
          };
        }
        return {
          data: fallbackRows[tableName] || [],
          error: null,
        };
      }),
    } as any);

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
    expect((res.jsonBody as any)?.output?.data_issues).toEqual([]);
    expect((res.jsonBody as any)?.output?.task_execution_monitor?.completed_tasks).toBeGreaterThan(0);
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

  it('accepts xlsx export format for overview snapshot', async () => {
    process.env.AMRO_OVERVIEW_KPI_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: {
        interface: 'export-kpi-snapshot',
      },
      body: {
        format: 'xlsx',
        date_range: '2026-03-01T00:00:00.000Z:2026-03-21T00:00:00.000Z',
        selected_widgets: ['kpi_cards'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('export-kpi-snapshot');
    expect((res.jsonBody as any)?.output?.download_url).toContain('.xlsx');
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

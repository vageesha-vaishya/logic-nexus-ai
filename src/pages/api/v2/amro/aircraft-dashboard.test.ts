import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './aircraft-dashboard';
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
import { resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { buildAmroServiceBoundaryEnvelope } from './anti-corruption-adapter';

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

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('./anti-corruption-adapter', () => ({
  buildAmroServiceBoundaryEnvelope: vi.fn(() => ({ capability: 'work-packages' })),
  createAmroIsolationScope: vi.fn(() => ({ tenantId: 'tenant-1', franchiseId: 'fr-1' })),
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
      };
    }),
  };
  return res;
}

function createQueryChain(rows: Array<Record<string, unknown>>) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  };
  return chain;
}

function createErrorQueryChain(message = 'query failed') {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (_resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(typeof reject === 'function' ? reject(new Error(message)) : undefined),
  };
  return chain;
}

function createQueryChainWithErrorPayload(message = 'payload error') {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: { message } })),
  };
  return chain;
}

describe('/api/v2/amro/aircraft-dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-aircraft-dashboard', tenantId: '', franchiseId: '' } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ compatMode: 'v2-shadow' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['view_amro_dashboard', 'approve_work_orders'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'database', validatedAt: '2026-03-27T00:00:00.000Z' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(buildAmroServiceBoundaryEnvelope).mockReturnValue({ capability: 'work-packages' } as any);
  });

  it('returns dashboard payload with KPI and trend data', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'aircraft') {
          return createQueryChain([
            {
              id: 'ac-1',
              tenant_id: 'tenant-1',
              franchise_id: 'fr-1',
              model_id: 'model-a320',
              aircraft_model: 'A320-200-157',
              assemblymodels: '3fd79fc0-58f1-4f24-9ca0-5f0e45f410d7',
              registration: 'A6-ABC',
              status: 'active',
              defect_count: 1,
              current_flight_hours: 120.5,
              current_cycles: 430,
              updated_at: '2026-03-27T10:00:00.000Z',
            },
          ]);
        }
        if (table === 'work_packages') {
          return createQueryChain([
            { id: 'wp-1', aircraft_id: 'ac-1', work_package_number: 'WP-001', title: 'A-Check', status: 'open', priority: 'high', due_at: '2026-04-01T00:00:00.000Z', compliance_state: 'ready', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-1', aircraft_id: 'ac-1', flight_date: '2026-03-27', flight_number: 'LNX100', departure_airport: 'DXB', arrival_airport: 'DOH', flight_hours: 2.1, flight_cycles: 1, pilot_name: 'Pilot 1', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'df-1', aircraft_id: 'ac-1', event_type: 'defect', title: 'Hydraulic leak', severity: 'high', status: 'open', due_at: '2026-03-29T00:00:00.000Z', reported_at: '2026-03-27T09:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'asset_health_signals') {
          return createQueryChain([
            { id: 'sg-1', aircraft_id: 'ac-1', severity: 'critical', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'aircraft_leads') {
          return createQueryChain([
            { id: 'lead-1', aircraft_id: 'ac-1', title: 'A-check upsell', status: 'open', priority: 'high', compliance_state: 'at_risk', maintenance_due_at: '2026-03-31T00:00:00.000Z', aircraft_type: 'A320', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { aircraft_id: 'ac-1', trend_days: '7', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.kpis?.open_work_packages).toBe(1);
    expect((res.jsonBody as any)?.output?.aircraft_status?.[0]?.model_id).toBe('model-a320');
    expect((res.jsonBody as any)?.output?.aircraft_status?.[0]?.aircraft_model).toBe('A320-200-157');
    expect((res.jsonBody as any)?.output?.aircraft_status?.[0]?.assembly_models).toBe('3fd79fc0-58f1-4f24-9ca0-5f0e45f410d7');
    expect((res.jsonBody as any)?.output?.kpis?.aircraft_leads_total).toBe(1);
    expect((res.jsonBody as any)?.output?.kpis?.aircraft_leads_at_risk).toBe(1);
    expect((res.jsonBody as any)?.output?.aircraft_leads?.[0]?.title).toBe('A-check upsell');
    expect((res.jsonBody as any)?.output?.performance_metrics?.flight_hours_trend?.length).toBe(7);
    expect((res.jsonBody as any)?.output?.engine_module).toBeNull();
    expect((res.jsonBody as any)?.output?.components_module).toBeNull();
    expect(Array.isArray((res.jsonBody as any)?.output?.alerts)).toBe(true);
    expect((res.jsonBody as any)?.output?.metadata?.cache).toBe('miss');
    expect((res.jsonBody as any)?.output?.metadata?.resilience).toBeTruthy();
    expect((res.jsonBody as any)?.output?.manager_summary?.fleet_size).toBe(1);
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
  });

  it('returns cached payload on repeated request', async () => {
    const supabaseMock = {
      from: vi.fn(() => createQueryChain([])),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { aircraft_id: 'ac-1', trend_days: '7', due_within_days: '30' },
      headers: {},
    };
    const firstRes = createResponse();
    const secondRes = createResponse();

    await handler(req, firstRes);
    await handler(req, secondRes);

    expect(firstRes.statusCode).toBe(200);
    expect(secondRes.statusCode).toBe(200);
    expect((secondRes.jsonBody as any)?.output?.metadata?.cache).toBe('hit');
  });

  it('returns technician scoped payload without manager summary fields', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-tech',
      role: 'technician',
      permissions: [],
    } as any);
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'work_packages') {
          return createQueryChain([
            { id: 'wp-2', aircraft_id: 'ac-2', work_package_number: 'WP-002', title: 'B-Check', status: 'scheduled', priority: 'medium', due_at: '2026-04-02T00:00:00.000Z', compliance_state: 'pending', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-2', aircraft_id: 'ac-2', flight_date: '2026-03-27', flight_number: 'LNX200', departure_airport: 'DOH', arrival_airport: 'DXB', flight_hours: 1.5, flight_cycles: 1, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'aircraft_leads') {
          return createQueryChain([
            { id: 'lead-2', aircraft_id: 'ac-2', title: 'Cabin retrofit', status: 'new', priority: 'medium', compliance_state: 'monitoring', maintenance_due_at: '2026-04-03T00:00:00.000Z', aircraft_type: 'B737', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { trend_days: '7', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.manager_summary).toBeNull();
    expect((res.jsonBody as any)?.output?.maintenance_schedule?.[0]?.title).toBeUndefined();
    expect((res.jsonBody as any)?.output?.aircraft_leads?.[0]?.aircraft_type).toBeUndefined();
    expect((res.jsonBody as any)?.output?.engine_module).toBeNull();
    expect((res.jsonBody as any)?.output?.components_module).toBeNull();
  });

  it('returns module scoped output for engine module requests', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'aircraft') {
          return createQueryChain([
            {
              id: 'ac-4',
              registration: 'A6-ENG',
              status: 'active',
              defect_count: 2,
              current_flight_hours: 2111,
              current_cycles: 880,
              engine_install_history: [{ engine_serial_number: 'ENG-4L', engine_position: 'L', installed_at: '2026-01-12' }],
              thrust_rating_change_log: [{ engine_serial_number: 'ENG-4L', rated_thrust: 27500, derate_mode: 'CLB1', effective_from: '2026-02-01' }],
              on_wing_lifecycle_records: [{ engine_serial_number: 'ENG-4L', event_type: 'on_wing_start', event_at: '2026-01-12' }],
              updated_at: '2026-03-27T10:00:00.000Z',
            },
          ]);
        }
        if (table === 'work_packages') {
          return createQueryChain([
            { id: 'wp-4', aircraft_id: 'ac-4', work_package_number: 'WP-004', title: 'Engine borescope', status: 'open', priority: 'high', due_at: '2026-04-08T00:00:00.000Z', compliance_state: 'pending', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-4', aircraft_id: 'ac-4', flight_date: '2026-03-27', flight_hours: 2.4, flight_cycles: 1, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'df-4', aircraft_id: 'ac-4', event_type: 'defect', title: 'Oil delta trend', severity: 'high', status: 'open', due_at: '2026-03-30T00:00:00.000Z', reported_at: '2026-03-27T09:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'asset_health_signals') {
          return createQueryChain([
            { id: 'sg-4', aircraft_id: 'ac-4', signal_type: 'vibration', value: 0.7, severity: 'high', recorded_at: '2026-03-27T10:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { aircraft_id: 'ac-4', module: 'engine', trend_days: '7', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.engine_module).toBeTruthy();
    expect((res.jsonBody as any)?.output?.components_module).toBeNull();
    expect((res.jsonBody as any)?.output?.engine_module?.lifecycle_management?.length).toBeGreaterThanOrEqual(0);
    expect((res.jsonBody as any)?.output?.engine_module?.maintenance_schedule?.length).toBeGreaterThanOrEqual(0);
    expect((res.jsonBody as any)?.output?.engine_module?.work_orders?.totals).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.work_orders?.digital_signature_workflow).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.work_orders?.parts_tracking?.length).toBeGreaterThanOrEqual(1);
    expect((res.jsonBody as any)?.output?.engine_module?.compliance_tracking).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.compliance_tracking?.regulatory_profiles?.faa).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.compliance_tracking?.standards).toContain('ATA Spec 2200');
    expect((res.jsonBody as any)?.output?.engine_module?.performance_analytics).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.performance_analytics?.failure_prediction).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.maintenance_planning?.resource_allocation?.length).toBeGreaterThanOrEqual(1);
    expect((res.jsonBody as any)?.output?.engine_module?.maintenance_planning?.scheduled_windows?.[0]?.scheduled_start_at).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.maintenance_planning?.resolution_actions).toBeDefined();
    expect((res.jsonBody as any)?.output?.engine_module?.component_monitoring?.anomaly_detection).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.component_monitoring?.anomaly_detection?.algorithm).toBe('z_score_trend_v2');
    expect((res.jsonBody as any)?.output?.engine_module?.integration_capabilities?.length).toBeGreaterThanOrEqual(1);
    expect((res.jsonBody as any)?.output?.engine_module?.integration_resilience).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.integration_resilience?.retry_policy?.attempts).toBeGreaterThanOrEqual(1);
    expect((res.jsonBody as any)?.output?.engine_module?.standards_alignment?.s1000d).toBe('supported');
    expect((res.jsonBody as any)?.output?.engine_module?.validation).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.validation?.rbac_enforced).toBe(true);
    expect((res.jsonBody as any)?.output?.engine_module?.validation?.validation_layers?.schema_validation).toBeTruthy();
    expect((res.jsonBody as any)?.output?.engine_module?.serialized_engine_tracking?.[0]?.engine_serial_number).toBe('ENG-4L');
    expect((res.jsonBody as any)?.output?.engine_module?.thrust_rating_management?.[0]?.rated_thrust).toBe(27500);
    expect((res.jsonBody as any)?.output?.engine_module?.on_wing_lifecycle?.[0]?.event_type).toBe('on_wing_start');
  });

  it('enforces due window guardrails for engine module scheduling', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: { module: 'engine', due_within_days: '365' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('due_within_days');
  });

  it('falls back to maintenance events for aircraft leads when aircraft_leads table is empty', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'aircraft_leads') {
          return createQueryChain([]);
        }
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'lead-fallback-1', aircraft_id: 'ac-3', event_type: 'lead', title: 'Legacy conversion lead', status: 'open', severity: 'high', due_at: '2026-04-05T00:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'def-2', aircraft_id: 'ac-3', event_type: 'defect', title: 'Brake issue', status: 'open', severity: 'high', due_at: '2026-03-29T00:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.metadata?.sources?.aircraft_leads).toBe('maintenance_events');
    expect((res.jsonBody as any)?.output?.aircraft_leads).toHaveLength(1);
    expect((res.jsonBody as any)?.output?.aircraft_leads?.[0]?.title).toBe('Legacy conversion lead');
  });

  it('rejects unsupported methods with 405', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(['GET']);
  });

  it('clamps trend_days query values to supported range', async () => {
    const supabaseMock = {
      from: vi.fn(() => createQueryChain([])),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { trend_days: '999', due_within_days: '10' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.filters?.trend_days).toBe(90);
  });

  it('returns engineer scoped payload with manager summary hidden', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-eng',
      role: 'engineer',
      permissions: ['view_amro_dashboard'],
    } as any);
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'df-eng-1', aircraft_id: 'ac-eng-1', event_type: 'defect', title: 'Thermal drift', severity: 'medium', status: 'open', due_at: '2026-04-02T00:00:00.000Z', reported_at: '2026-03-27T09:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-eng-1', aircraft_id: 'ac-eng-1', flight_date: '2026-03-27', flight_hours: 1.7, flight_cycles: 1, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'aircraft') {
          return createQueryChain([
            { id: 'ac-eng-1', registration: 'A6-ENG1', status: 'active', defect_count: 1, current_flight_hours: 500, current_cycles: 190, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { module: 'all', trend_days: '14', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.manager_summary).toBeNull();
    expect((res.jsonBody as any)?.output?.engine_module).toBeTruthy();
    expect((res.jsonBody as any)?.output?.components_module).toBeTruthy();
  });

  it('handles cache maintenance after high request volume', async () => {
    const supabaseMock = {
      from: vi.fn(() => createQueryChain([])),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);
    let finalResponse: ReturnType<typeof createResponse> | null = null;
    for (let index = 0; index < 510; index += 1) {
      const req: ApiRequest = {
        method: 'GET',
        query: { module: 'all', trend_days: '7', due_within_days: '30', search: `cache-seed-${index}` },
        headers: {},
      };
      finalResponse = createResponse();
      await handler(req, finalResponse);
    }
    expect(finalResponse?.statusCode).toBe(200);
    expect((finalResponse?.jsonBody as any)?.output?.metadata?.cache).toBe('miss');
  });

  it('falls back to secondary source tables and enforces aircraft/search filters', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-tech-fallback',
      role: 'technician',
      permissions: ['view_amro_dashboard'],
    } as any);
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'aircraft') {
          return createQueryChain([
            { id: 'ac-filter', registration: 'A6-FILTER', status: 'active', defect_count: 0, current_flight_hours: 60, current_cycles: 22, updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'ac-other', registration: 'A6-OTHER', status: 'active', defect_count: 2, current_flight_hours: 99, current_cycles: 44, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'work_packages') {
          return createErrorQueryChain('work_packages missing');
        }
        if (table === 'work_package_master') {
          return createQueryChain([
            { id: 'wp-fallback-1', aircraft_id: 'ac-filter', work_package_number: 'WP-FB-001', title: 'Borescope inspection', status: 'open', priority: 'high', due_at: '2026-04-05T00:00:00.000Z', compliance_state: 'pending', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-fallback-1', aircraft_id: 'ac-filter', flight_date: '2026-03-27', flight_number: 'LNX500', departure_airport: 'DXB', arrival_airport: 'BAH', flight_hours: 1.3, flight_cycles: 1, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'df-fallback-open', aircraft_id: 'ac-filter', event_type: 'defect', title: 'Oil pressure variance', severity: 'high', status: 'open', due_at: '2026-03-30T00:00:00.000Z', reported_at: '2026-03-27T09:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'df-fallback-closed', aircraft_id: 'ac-filter', event_type: 'defect', title: 'Resolved noise', severity: 'low', status: 'closed', due_at: '2026-03-28T00:00:00.000Z', reported_at: '2026-03-27T08:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'lead-filter-1', aircraft_id: 'ac-filter', event_type: 'lead', title: 'Engine retrofit lead', status: 'open', priority: 'medium', compliance_state: 'at_risk', maintenance_due_at: '2026-04-08T00:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z', data: { title: 'Engine retrofit lead' } },
          ]);
        }
        if (table === 'asset_health_signals') {
          return createErrorQueryChain('signals unavailable');
        }
        if (table === 'forecast_outputs') {
          return createQueryChain([
            { id: 'sg-fallback-1', aircraft_id: 'ac-filter', signal_type: 'vibration', value: 1.1, severity: 'high', recorded_at: '2026-03-27T10:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'aircraft_leads') {
          return createQueryChain([
            { id: 'lead-direct-1', aircraft_id: 'ac-filter', title: 'Engine retrofit lead', status: 'open', priority: 'high', compliance_state: 'at_risk', maintenance_due_at: '2026-04-08T00:00:00.000Z', aircraft_type: 'A320', updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'lead-direct-2', aircraft_id: 'ac-other', title: 'Unrelated lead', status: 'open', priority: 'low', compliance_state: 'monitoring', maintenance_due_at: '2026-04-10T00:00:00.000Z', aircraft_type: 'A320', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { module: 'engine', aircraft_id: 'ac-filter', trend_days: '14', due_within_days: '30', search: 'retrofit' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.metadata?.sources?.maintenance).toBe('work_package_master');
    expect((res.jsonBody as any)?.output?.metadata?.sources?.iot_signals).toBe('forecast_outputs');
    expect((res.jsonBody as any)?.output?.aircraft_leads?.length).toBe(1);
    expect((res.jsonBody as any)?.output?.aircraft_leads?.[0]?.title).toContain('Engine retrofit');
    expect((res.jsonBody as any)?.output?.engine_module).toBeTruthy();
  });

  it('maps resolved defects for technician outputs and applies aircraft lead filtering', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-tech-defect',
      role: 'technician',
      permissions: ['view_amro_dashboard'],
    } as any);
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'aircraft') {
          return createQueryChain([
            { id: 'ac-tech-1', registration: 'A6-T1', status: 'active', defect_count: 1, current_flight_hours: 200, current_cycles: 90, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'work_packages') {
          return createQueryChain([
            { id: 'wp-tech-1', aircraft_id: 'ac-tech-1', work_package_number: 'WP-T-001', title: 'Line maintenance', status: 'scheduled', priority: 'medium', due_at: '2026-04-09T00:00:00.000Z', compliance_state: 'pending', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-tech-1', aircraft_id: 'ac-tech-1', flight_date: '2026-03-27', flight_number: 'LNX611', departure_airport: 'DXB', arrival_airport: 'KWI', flight_hours: 2.2, flight_cycles: 1, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'df-tech-open', aircraft_id: 'ac-tech-1', event_type: 'defect', title: 'Fuel imbalance', severity: 'high', status: 'open', due_at: '2026-03-30T00:00:00.000Z', reported_at: '2026-03-27T09:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'df-tech-closed', aircraft_id: 'ac-tech-1', event_type: 'defect', title: 'Panel vibration', severity: 'medium', status: 'closed', due_at: '2026-03-29T00:00:00.000Z', reported_at: '2026-03-27T08:30:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'aircraft_leads') {
          return createQueryChain([
            { id: 'lead-tech-1', aircraft_id: 'ac-tech-1', title: 'APU retrofit', status: 'open', priority: 'high', compliance_state: 'at_risk', maintenance_due_at: '2026-04-11T00:00:00.000Z', aircraft_type: 'A321', updated_at: '2026-03-27T10:00:00.000Z' },
            { id: 'lead-tech-2', aircraft_id: 'ac-tech-2', title: 'Seat reconfiguration', status: 'open', priority: 'low', compliance_state: 'monitoring', maintenance_due_at: '2026-04-12T00:00:00.000Z', aircraft_type: 'A321', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'asset_health_signals') {
          return createQueryChain([
            { id: 'sg-tech-1', aircraft_id: 'ac-tech-1', signal_type: 'temperature', value: 0.8, severity: 'medium', recorded_at: '2026-03-27T10:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { module: 'engine', aircraft_id: 'ac-tech-1', trend_days: '14', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.defect_tracking?.length).toBe(2);
    expect((res.jsonBody as any)?.output?.performance_metrics?.defect_trend?.length).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output?.aircraft_leads?.length).toBe(1);
  });

  it('returns empty sources when all candidate table reads return payload errors', async () => {
    const supabaseMock = {
      from: vi.fn(() => createQueryChainWithErrorPayload('database row policy denied')),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { module: 'all', trend_days: '14', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.metadata?.sources?.aircraft).toBe('none');
    expect((res.jsonBody as any)?.output?.metadata?.sources?.maintenance).toBe('none');
    expect((res.jsonBody as any)?.output?.metadata?.sources?.iot_signals).toBe('none');
  });

  it('returns error responses when authentication throws unexpectedly', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('auth runtime failure'));
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect((res.jsonBody as any)?.correlationId).toBe('corr-aircraft-dashboard');
  });

  it('responds within sub-second budget for engine module critical operations', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'aircraft') {
          return createQueryChain([
            { id: 'ac-perf-1', registration: 'A6-PERF', status: 'active', defect_count: 1, current_flight_hours: 1200, current_cycles: 430, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'work_packages') {
          return createQueryChain([
            { id: 'wp-perf-1', aircraft_id: 'ac-perf-1', work_package_number: 'WP-PERF-001', title: 'Engine health review', status: 'open', priority: 'high', due_at: '2026-04-01T00:00:00.000Z', compliance_state: 'pending', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'flight_logs') {
          return createQueryChain([
            { id: 'fl-perf-1', aircraft_id: 'ac-perf-1', flight_date: '2026-03-27', flight_number: 'LNX900', departure_airport: 'DXB', arrival_airport: 'RUH', flight_hours: 2.8, flight_cycles: 1, updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'maintenance_events') {
          return createQueryChain([
            { id: 'df-perf-1', aircraft_id: 'ac-perf-1', event_type: 'defect', title: 'Engine thermal spike', severity: 'high', status: 'open', due_at: '2026-03-30T00:00:00.000Z', reported_at: '2026-03-27T09:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        if (table === 'asset_health_signals') {
          return createQueryChain([
            { id: 'sg-perf-1', aircraft_id: 'ac-perf-1', signal_type: 'vibration', value: 1.2, severity: 'high', recorded_at: '2026-03-27T10:00:00.000Z', updated_at: '2026-03-27T10:00:00.000Z' },
          ]);
        }
        return createQueryChain([]);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as any);
    const req: ApiRequest = {
      method: 'GET',
      query: { module: 'engine', aircraft_id: 'ac-perf-1', trend_days: '14', due_within_days: '30' },
      headers: {},
    };
    const res = createResponse();
    const startedAt = Date.now();

    await handler(req, res);

    const elapsedMs = Date.now() - startedAt;
    expect(res.statusCode).toBe(200);
    expect(elapsedMs).toBeLessThan(1000);
  });
});

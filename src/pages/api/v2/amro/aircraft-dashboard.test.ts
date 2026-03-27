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
            { id: 'ac-1', registration: 'A6-ABC', status: 'active', defect_count: 1, current_flight_hours: 120.5, current_cycles: 430, updated_at: '2026-03-27T10:00:00.000Z' },
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
    expect((res.jsonBody as any)?.output?.kpis?.aircraft_leads_total).toBe(1);
    expect((res.jsonBody as any)?.output?.kpis?.aircraft_leads_at_risk).toBe(1);
    expect((res.jsonBody as any)?.output?.aircraft_leads?.[0]?.title).toBe('A-check upsell');
    expect((res.jsonBody as any)?.output?.performance_metrics?.flight_hours_trend?.length).toBe(7);
    expect((res.jsonBody as any)?.output?.metadata?.cache).toBe('miss');
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
});

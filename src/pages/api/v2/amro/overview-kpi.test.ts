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

describe('/api/v2/amro/overview-kpi', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
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
});

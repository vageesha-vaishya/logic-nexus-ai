import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './module-catalog';
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

describe('/api/v2/amro/module-catalog', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-module-catalog',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
  });

  it('returns module catalog rows for AMRO section 15.1', async () => {
    process.env.AMRO_MODULE_CATALOG_V2_ENABLED = 'true';
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
    expect((res.jsonBody as any)?.mode).toBe('module-catalog');
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.totalModules).toBe(9);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[0]?.module).toBe('Overview and KPI Intelligence');
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[0]).toEqual({
      module: 'Overview and KPI Intelligence',
      primaryUsers: ['Management', 'planner', 'compliance lead'],
      primaryInputs: ['Work package states', 'telemetry', 'SLA targets', 'compliance events'],
      primaryOutputs: ['KPI cards', 'risk heatmaps', 'trend lines', 'anomalies'],
      coreDependencies: ['Event stream', 'analytics cache', 'forecast engine'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[8]).toEqual({
      module: 'Forecast and Reliability',
      primaryUsers: ['Planner', 'management'],
      primaryInputs: ['Telemetry features', 'historical defects', 'environmental context'],
      primaryOutputs: ['Risk scores', 'suggested interventions', 'confidence/explainability'],
      coreDependencies: ['ML pipeline', 'feature store'],
    });
    expect((res.jsonBody as any)?.domainAccess?.subscriptionStatus).toBe('public');
    expect((res.jsonBody as any)?.serviceBoundaries?.scopedAccess?.tenant_id).toBe('public');
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './migration-plan';
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

describe('/api/v2/amro/migration-plan', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-migration-plan',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
  });

  it('returns migration dependency map with validation report', async () => {
    process.env.AMRO_MIGRATION_PLAN_V2_ENABLED = 'true';
    process.env.AMRO_MIGRATION_ROLLOUT_PHASE = 'regional-cohorts';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        capability: 'compliance-gates',
        replayCompared: '10000',
        replayMatched: '9999',
        complianceCompared: '10000',
        complianceMatched: '10000',
        switchbackSeconds: '280',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('migration-plan');
    expect((res.jsonBody as any)?.data?.migration?.dependencyOrder?.length).toBe(6);
    expect((res.jsonBody as any)?.data?.migration?.externalAdapters?.length).toBe(3);
    expect((res.jsonBody as any)?.data?.migration?.rollout?.phase).toBe('regional-cohorts');
    expect((res.jsonBody as any)?.data?.migration?.successCriteria?.validation?.overallPassed).toBe(true);
    expect((res.jsonBody as any)?.domainAccess?.subscriptionStatus).toBe('public');
    expect((res.jsonBody as any)?.serviceBoundaries?.scopedAccess?.tenant_id).toBe('public');
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('rejects invalid validation query values', async () => {
    process.env.AMRO_MIGRATION_PLAN_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: { replayCompared: '-1' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './phase-plan';
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

describe('/api/v2/amro/phase-plan', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-phase-plan',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
  });

  it('returns AMRO phase-wise implementation matrix and progress summary', async () => {
    process.env.AMRO_PHASE_PLAN_V2_ENABLED = 'true';
    process.env.AMRO_PHASE_P0_STATUS = 'completed';
    process.env.AMRO_PHASE_P1_STATUS = 'in-progress';
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
    expect((res.jsonBody as any)?.mode).toBe('phase-plan');
    expect((res.jsonBody as any)?.data?.phasePlan?.rows?.length).toBe(5);
    expect((res.jsonBody as any)?.data?.phasePlan?.summary?.completedPhases).toBe(1);
    expect((res.jsonBody as any)?.data?.sequentialImplementation?.strictOrder).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']);
    expect((res.jsonBody as any)?.data?.sequentialImplementation?.milestones?.length).toBe(10);
    expect((res.jsonBody as any)?.data?.developmentBlueprint?.deliverySequence?.length).toBe(7);
    expect((res.jsonBody as any)?.data?.developmentBlueprint?.moduleCompletionChecklist?.summary?.totalChecks).toBe(7);
    expect((res.jsonBody as any)?.data?.architectureDecisionPriorities?.priorityRoadmap?.length).toBe(6);
    expect((res.jsonBody as any)?.data?.architectureDecisionPriorities?.finalImplementationGuidance?.summary?.totalGuidanceChecks).toBe(5);
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

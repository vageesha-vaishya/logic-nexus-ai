import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './[id]';
import transitionHandler from './[id]/transitions';
import collectionHandler from '../work-packages';
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

describe('/api/v2/amro/work-packages/[id] + transitions', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED = 'true';
    process.env.AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED = 'true';
    process.env.AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED = 'true';
    process.env.AMRO_SEQ_PREREQ_TEST_PLAN_READY = 'true';
    process.env.AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY = 'true';
    process.env.AMRO_SEQ_M1_STATUS = 'completed';
    process.env.AMRO_SEQ_M2_STATUS = 'completed';
    process.env.AMRO_SEQ_M3_STATUS = 'not-started';
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
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-detail',
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
      validatedAt: '2026-03-20T00:00:00.000Z',
    } as any);
  });

  it('returns work package detail for API-AMRO-002 GET', async () => {
    const req: ApiRequest = { method: 'GET', query: { id: 'wp-100' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalledWith(['dashboards.view', 'reports.manage'], ['dashboards.view']);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('detail-work-package');
    expect((res.jsonBody as any)?.data?.work_package?.id).toBe('wp-100');
  });

  it('updates work package for API-AMRO-002 PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'wp-101' },
      headers: {},
      body: {
        current_status: 'planning',
        status: 'scheduled',
        title: 'Adjusted Package',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('update-work-package');
    expect((res.jsonBody as any)?.data?.to_status).toBe('scheduled');
  });

  it('deletes work package for API-AMRO-002 DELETE', async () => {
    const req: ApiRequest = { method: 'DELETE', query: { id: 'wp-delete-1' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('delete-work-package');
    expect((res.jsonBody as any)?.data?.deleted).toBe(true);
    expect((res.jsonBody as any)?.data?.work_package_id).toBe('wp-delete-1');
  });

  it('blocks invalid transition path in API-AMRO-003 endpoint', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { id: 'wp-202' },
      headers: {},
      body: {
        current_status: 'planning',
        target_status: 'completed',
        reason_code: 'invalid-jump',
        actor_signature: 'sig-001',
      },
    };
    const res = createResponse();

    await transitionHandler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-detail',
      { apiVersion: 'v2' }
    );
  });

  it('blocks transition when reason code is missing in API-AMRO-003 endpoint', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { id: 'wp-204' },
      headers: {},
      body: {
        current_status: 'planning',
        target_status: 'scheduled',
        actor_signature: 'sig-204',
      },
    };
    const res = createResponse();

    await transitionHandler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-detail',
      { apiVersion: 'v2' }
    );
  });

  it('transitions work package for API-AMRO-003 POST', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { id: 'wp-303' },
      headers: {},
      body: {
        current_status: 'planning',
        target_status: 'scheduled',
        reason_code: 'resource-ready',
        actor_signature: 'sig-777',
      },
    };
    const res = createResponse();

    await transitionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('transition-work-package');
    expect((res.jsonBody as any)?.output?.to_status).toBe('scheduled');
    expect((res.jsonBody as any)?.output?.work_package_id).toBe('wp-303');
  });

  it('passes create to transition flow for API-AMRO-001 and API-AMRO-003', async () => {
    const createReq: ApiRequest = {
      method: 'POST',
      query: { interface: 'create-work-package' },
      body: {
        aircraft_id: 'ac-900',
        maintenance_type: 'line',
        planned_window: '2026-03-21T00:00:00.000Z|2026-03-21T06:00:00.000Z',
        station: 'station-a',
        priority: 'high',
        scope_items: ['inspection'],
      },
      headers: {},
    };
    const createRes = createResponse();
    await collectionHandler(createReq, createRes);

    expect(createRes.statusCode).toBe(200);
    const createdWorkPackageId = String((createRes.jsonBody as any)?.output?.work_package_id || '');
    expect(createdWorkPackageId).toContain('tenant-1-fr-1-wp-');

    const transitionReq: ApiRequest = {
      method: 'POST',
      query: { id: createdWorkPackageId },
      headers: {},
      body: {
        current_status: 'planning',
        target_status: 'scheduled',
        reason_code: 'resource-ready',
        actor_signature: 'sig-900',
      },
    };
    const transitionRes = createResponse();
    await transitionHandler(transitionReq, transitionRes);

    expect(transitionRes.statusCode).toBe(200);
    expect((transitionRes.jsonBody as any)?.output?.work_package_id).toBe(createdWorkPackageId);
    expect((transitionRes.jsonBody as any)?.output?.from_status).toBe('planning');
    expect((transitionRes.jsonBody as any)?.output?.to_status).toBe('scheduled');
  });
});

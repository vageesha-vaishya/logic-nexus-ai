import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './work-packages';
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
import {
  applyCompatibilityResponseHeaders,
  resolveGatewayCompatibility,
} from '../../_utils/compatibility-facade';
import { resetAmroAuditLedgerStore } from './audit-ledger';
import {
  persistCloneTemplateWorkPackage,
  persistCreateWorkPackage,
  persistTransitionWorkPackage,
} from './work-package-persistence';
import { assertTemplateRegistryAccess } from './template-registry-client';

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

vi.mock('./work-package-persistence', () => ({
  persistCreateWorkPackage: vi.fn(),
  persistTransitionWorkPackage: vi.fn(),
  persistCloneTemplateWorkPackage: vi.fn(),
}));

vi.mock('./template-registry-client', () => ({
  TemplateNotAccessibleException: class TemplateNotAccessibleException extends Error {
    readonly statusCode = 403;
  },
  assertTemplateRegistryAccess: vi.fn(),
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

describe('/api/v2/amro/work-packages', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
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
    process.env.AMRO_SEQ_M4_STEP_ORDER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M4_EVIDENCE_CHECKSUM_100 = 'true';
    process.env.AMRO_SEQ_M4_OFFLINE_SYNC_TESTS_100 = 'true';
    process.env.AMRO_SEQ_M4_MOBILE_CRITICAL_FLOWS_PASS = 'true';
    process.env.AMRO_SEQ_M5_NEGATIVE_PATH_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M5_SERIALIZED_UNIQUENESS_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M5_SHORTAGE_TO_PROCUREMENT_E2E_SCOPE_SAFE = 'true';
    vi.clearAllMocks();
    resetAmroAuditLedgerStore();
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-v2',
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
      permissions: ['dashboards.view'],
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
    vi.mocked(persistCreateWorkPackage).mockResolvedValue({
      work_package_id: 'tenant-1-fr-1-wp-100',
      status: 'planning',
      version: 1,
      created_at: '2026-03-21T00:00:00.000Z',
      created_by: 'user-1',
      updated_at: '2026-03-21T00:00:00.000Z',
      updated_by: 'user-1',
    } as any);
    vi.mocked(persistTransitionWorkPackage).mockResolvedValue({
      work_package_id: 'wp-001',
      status: 'completed',
      version: 2,
      created_at: '2026-03-21T00:00:00.000Z',
      created_by: 'user-1',
      updated_at: '2026-03-21T00:05:00.000Z',
      updated_by: 'user-1',
    } as any);
    vi.mocked(assertTemplateRegistryAccess).mockResolvedValue({
      id: 'tenant-1:template-001',
      name: 'Template 001',
      version: '1.0.0',
      lifecycleState: 'ACTIVE',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: null,
      permissions: ['READ', 'INSTANTIATE'],
    } as any);
    vi.mocked(persistCloneTemplateWorkPackage).mockResolvedValue({
      work_package_id: 'tenant-1-fr-1-wp-clone-100',
      status: 'planning',
      version: 1,
      created_at: '2026-03-21T00:00:00.000Z',
      created_by: 'user-1',
      updated_at: '2026-03-21T00:00:00.000Z',
      updated_by: 'user-1',
      inherited_tasks_count: 14,
    } as any);
  });

  it('returns 404 when v2 endpoint feature flag is disabled', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'false';

    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(enforceAmroDomainAccess).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 404 when tenant is outside endpoint rollout cohort', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_V2_CANARY_TENANTS = 'tenant-canary';

    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toContain('rollout cohort');
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(false);
    expect((res.jsonBody as any)?.endpointRollout?.tenantInCanary).toBe(false);
  });

  it('returns dual-run response when feature and dual-run flags are enabled', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_WORK_PACKAGES_DUAL_RUN = 'true';

    const req: ApiRequest = { method: 'GET', query: {}, headers: { 'x-api-version': 'v2' } };
    const res = createResponse();
    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAmroDomainAccess).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('dual-run');
    expect((res.jsonBody as any)?.reconciliation?.deltaCount).toBe(0);
    expect((res.jsonBody as any)?.domainAccess?.subscriptionStatus).toBe('active');
    expect((res.jsonBody as any)?.serviceBoundaries?.services?.map((item: any) => item.service)).toEqual(
      expect.arrayContaining(['amro-work-order-service', 'amro-scheduling-service', 'amro-materials-service'])
    );
    expect((res.jsonBody as any)?.serviceBoundaries?.dataOwnership?.mandatoryIsolationFields).toEqual(
      ['tenant_id', 'franchise_id', 'domain_id', 'version']
    );
    expect((res.jsonBody as any)?.data?.workPackages?.[0]?.domainId).toBe('amro');
    expect((res.jsonBody as any)?.data?.workPackages?.[0]?.version).toBe('v2');
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedger?.recordId).toBeTruthy();
    expect((res.jsonBody as any)?.auditLedger?.chainHash).toBeTruthy();
  });

  it('returns legacy fallback payload when fallback flag is enabled', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_WORK_PACKAGES_DUAL_RUN = 'true';
    process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED = 'true';

    const req: ApiRequest = { method: 'GET', query: {}, headers: { 'x-api-version': 'v2' } };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('legacy-fallback');
    expect((res.jsonBody as any)?.fallback?.legacyMode).toBe(true);
    expect((res.jsonBody as any)?.data?.workPackages?.[0]?.id).toContain('legacy-');
    expect((res.jsonBody as any)?.auditLedger?.recordId).toBeTruthy();
  });

  it('skips audit append when tenant is outside canary allowlist', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_WORK_PACKAGES_DUAL_RUN = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS = 'tenant-canary';

    const req: ApiRequest = { method: 'GET', query: {}, headers: { 'x-api-version': 'v2' } };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedger).toBeNull();
  });

  it('skips audit append when franchise is outside canary allowlist', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_WORK_PACKAGES_DUAL_RUN = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_FRANCHISES = 'fr-canary';

    const req: ApiRequest = { method: 'GET', query: {}, headers: { 'x-api-version': 'v2' } };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedgerCutover?.franchiseInCanary).toBe(false);
    expect((res.jsonBody as any)?.auditLedger).toBeNull();
  });

  it('delegates AMRO authorization failures to error handler', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(enforceAmroDomainAccess).mockRejectedValue(new Error('Forbidden: AMRO access requires active AMRO domain subscription'));

    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('creates work package with 15.2.2 create interface contract', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'create-work-package' },
      body: {
        aircraft_id: 'ac-001',
        maintenance_type: 'line',
        planned_window: '2026-03-21T00:00:00.000Z|2026-03-23T00:00:00.000Z',
        station: 'station-a',
        priority: 'high',
        scope_items: ['inspection', 'lubrication'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('create-work-package');
    expect((res.jsonBody as any)?.output?.status).toBe('planning');
    expect((res.jsonBody as any)?.input?.station).toBe('tenant-1:station-a');
    expect((res.jsonBody as any)?.output?.created_by).toBe('user-1');
    expect((res.jsonBody as any)?.output?.version).toBe(1);
  });

  it('saves work package view with filters', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'save-work-package-view' },
      body: {
        view_name: 'Blocked View',
        filters: {
          status: 'blocked',
          search: 'wp',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('save-work-package-view');
    expect((res.jsonBody as any)?.output?.filters?.status).toBe('blocked');
    expect((res.jsonBody as any)?.output?.saved_view_id).toContain('tenant-1-fr-1-view-');
  });

  it('applies list filters and saved views in read response', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        status: 'blocked',
        search: 'legacy',
        saved_view: 'blocked-items',
      },
      headers: { 'x-api-version': 'v2' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.filters?.status).toBe('blocked');
    expect(Array.isArray((res.jsonBody as any)?.savedViews)).toBe(true);
  });

  it('returns API-AMRO-001 response contract fields for list query', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        status: 'blocked',
        station: 'tenant-1:station-1',
        aircraft_id: 'tenant-1:aircraft-1',
        due_before: '2026-03-30T00:00:00.000Z',
        page: '1',
        page_size: '10',
        sort: 'planned_end:asc',
      },
      headers: { 'x-api-version': 'v2' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray((res.jsonBody as any)?.items)).toBe(true);
    expect((res.jsonBody as any)?.pagination?.page).toBe(1);
    expect((res.jsonBody as any)?.kpi_snapshot).toBeTruthy();
    expect((res.jsonBody as any)?.applied_filters?.station).toBe('tenant-1:station-1');
    expect((res.jsonBody as any)?.api_guardrails?.p95_target_ms).toBe(300);
  });

  it('returns AMRO_FILTER_VALIDATION_FAILED for invalid list filters', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {
        page: '0',
      },
      headers: { 'x-api-version': 'v2' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.code).toBe('AMRO_FILTER_VALIDATION_FAILED');
  });

  it('delegates transition role-policy rejection from persistence layer', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'inspector',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    vi.mocked(persistTransitionWorkPackage).mockRejectedValueOnce(new Error('transition is not allowed for role'));
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'transition-work-package' },
      body: {
        work_package_id: 'wp-001',
        current_status: 'in_progress',
        target_status: 'completed',
        reason_code: 'ops-close',
        actor_signature: 'sig-123',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('rejects transition when target status is invalid', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'transition-work-package' },
      body: {
        work_package_id: 'wp-invalid-status-001',
        current_status: 'planning',
        target_status: 'archived',
        reason_code: 'invalid-status-test',
        actor_signature: 'sig-invalid-status-001',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
    expect(persistTransitionWorkPackage).not.toHaveBeenCalled();
  });

  it('rejects transition when policy matrix denies current to target status', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'planner',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'transition-work-package' },
      body: {
        work_package_id: 'wp-policy-001',
        current_status: 'planning',
        target_status: 'completed',
        reason_code: 'policy-deny-test',
        actor_signature: 'sig-policy-001',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
    expect(persistTransitionWorkPackage).not.toHaveBeenCalled();
  });

  it('publishes lifecycle closure event when transition reaches completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'inspector',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'transition-work-package' },
      body: {
        work_package_id: 'wp-closure-001',
        current_status: 'in_progress',
        target_status: 'completed',
        reason_code: 'all-gates-passed',
        actor_signature: 'sig-closure-001',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('transition-work-package');
    expect((res.jsonBody as any)?.output?.published_events?.[0]?.event_type).toBe('amro.work_package.lifecycle.closed.v1');
    expect((res.jsonBody as any)?.closure?.lifecycle_event_published).toBe(true);
    expect((res.jsonBody as any)?.output?.commit_decision?.successful).toBe(true);
    expect(persistTransitionWorkPackage).toHaveBeenCalledWith(expect.objectContaining({
      actorRole: 'inspector',
      gateName: 'work-package-transition',
      transitionId: expect.any(String),
      workflowInputPayload: expect.objectContaining({
        work_package_id: 'wp-closure-001',
        current_status: 'in_progress',
        target_status: 'completed',
        actor_signature: '***',
      }),
      workflowUserContext: expect.objectContaining({
        tenant_id: 'tenant-1',
        franchise_id: 'fr-1',
        user_id: 'user-1',
        role: 'inspector',
      }),
    }));
  });

  it('returns conflict when optimistic lock check fails on transition', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'inspector',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    vi.mocked(persistTransitionWorkPackage).mockRejectedValueOnce(new Error('optimistic_lock_conflict'));
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'transition-work-package' },
      body: {
        work_package_id: 'wp-closure-rollback-001',
        current_status: 'in_progress',
        target_status: 'completed',
        reason_code: 'all-gates-passed',
        actor_signature: 'sig-closure-rollback-001',
        expected_version: 3,
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect((res.jsonBody as any)?.interface).toBe('transition-work-package');
    expect((res.jsonBody as any)?.error?.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  it('clones template using registry-backed template access checks', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'clone-template' },
      body: {
        template_id: 'tenant-1:template-001',
        aircraft_id: 'ac-002',
        override_fields: { priority: 'critical' },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('clone-template');
    expect((res.jsonBody as any)?.output?.new_work_package_id).toBe('tenant-1-fr-1-wp-clone-100');
    expect((res.jsonBody as any)?.output?.inherited_tasks_count).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output?.template?.version).toBe('1.0.0');
  });

  it('rejects clone-template when registry denies active template access', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(assertTemplateRegistryAccess).mockRejectedValueOnce(new Error('template lifecycle state is not active'));
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'clone-template' },
      body: {
        template_id: 'tenant-1:template-stale',
        aircraft_id: 'ac-003',
        override_fields: { priority: 'high' },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
    expect(persistCloneTemplateWorkPackage).not.toHaveBeenCalled();
  });

  it('assigns maintenance slot when overlap, capacity, and qualification rules pass', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'assign-maintenance-slot' },
      body: {
        work_package_id: 'wp-001',
        station_code: 'station-a',
        slot_start: '2026-03-22T01:00:00.000Z',
        slot_end: '2026-03-22T03:00:00.000Z',
        station_capacity: 3,
        existing_slots: [
          {
            slot_start: '2026-03-22T03:00:00.000Z',
            slot_end: '2026-03-22T04:00:00.000Z',
          },
        ],
        assigned_team: [
          { member_id: 'tech-1', qualifications: ['station-a', 'station-b'] },
          { member_id: 'tech-2', qualifications: ['station-a'] },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('assign-maintenance-slot');
    expect((res.jsonBody as any)?.output?.assignment_status).toBe('assigned');
    expect((res.jsonBody as any)?.output?.conflict_flags).toEqual([]);
  });

  it('runs replan simulation only with active constraints and tenant calendar', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'run-replan-simulation' },
      body: {
        disrupted_slots: [{ station_code: 'station-a', slot_start: '2026-03-22T01:00:00.000Z' }],
        priority_rules: { critical_first: true },
        planning_horizon: '72h',
        active_constraints: [{ id: 'hangar-capacity' }],
        tenant_calendar_id: 'tenant-1:calendar-main',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('run-replan-simulation');
    expect((res.jsonBody as any)?.output?.replan_options?.length).toBeGreaterThan(0);
    expect((res.jsonBody as any)?.output?.recommended_option?.option_id).toContain('replan-opt');
  });

  it('blocks M3 scheduling interfaces until M2 is completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M1_STATUS = 'completed';
    process.env.AMRO_SEQ_M2_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M3_STATUS = 'in-progress';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'assign-maintenance-slot' },
      body: {
        work_package_id: 'wp-001',
        station_code: 'station-a',
        slot_start: '2026-03-22T01:00:00.000Z',
        slot_end: '2026-03-22T03:00:00.000Z',
        station_capacity: 2,
        existing_slots: [],
        assigned_team: [{ member_id: 'tech-1', qualifications: ['station-a'] }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('confirms replan only when affected packages are re-plannable', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'planner',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'confirm-replan' },
      body: {
        selected_option_id: 'tenant-1-fr-1-replan-opt-1',
        approver_id: 'planner-1',
        reason: 'weather disruption',
        affected_work_packages: [
          { work_package_id: 'wp-001', current_state: 'planning' },
          { work_package_id: 'wp-002', current_state: 'scheduled' },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('confirm-replan');
    expect((res.jsonBody as any)?.output?.affected_work_packages?.length).toBe(2);
  });

  it('reserves parts with positive quantities and unique serialized lines', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'reserve-parts' },
      body: {
        work_package_id: 'wp-001',
        demand_lines: [
          { part_number: 'PN-001', quantity: 2, serial: 'SER-1' },
          { part_number: 'PN-002', quantity: 1, serial: 'SER-2' },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('reserve-parts');
    expect((res.jsonBody as any)?.output?.reservation_status).toBe('reserved');
    expect((res.jsonBody as any)?.output?.reservations?.length).toBe(2);
  });

  it('rejects reserve-parts when serialized lines are duplicated within tenant scope', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'reserve-parts' },
      body: {
        work_package_id: 'wp-001',
        demand_lines: [
          { part_number: 'PN-001', quantity: 1, serial: 'SER-1' },
          { part_number: 'PN-002', quantity: 1, serial: 'SER-1' },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('rejects reserve-parts when work package scope does not match tenant scope', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'reserve-parts' },
      body: {
        work_package_id: 'tenant-999:wp-001',
        demand_lines: [{ part_number: 'PN-001', quantity: 1, serial: 'SER-1' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('blocks M5 materials interfaces when M4 is not completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    process.env.AMRO_SEQ_M4_STATUS = 'in-progress';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'reserve-parts' },
      body: {
        work_package_id: 'wp-001',
        demand_lines: [{ part_number: 'PN-001', quantity: 1, serial: 'SER-1' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('rejects substitute shortage action without approved compatibility mapping', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'process-shortage-response' },
      body: {
        shortage_id: 'short-001',
        action: 'substitute',
        supplier_ref: 'supp-001',
        compatibility_mapping_approved: false,
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('processes shortage escalation and returns tenant-scoped procurement trigger', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'process-shortage-response' },
      body: {
        shortage_id: 'short-001',
        action: 'escalate',
        supplier_ref: 'supp-001',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('process-shortage-response');
    expect((res.jsonBody as any)?.output?.shortage_status).toBe('escalated');
    expect((res.jsonBody as any)?.output?.procurement_trigger_id).toContain('tenant-1-short-001-proc-');
    expect((res.jsonBody as any)?.output?.procurement_trigger?.tenant_id).toBe('tenant-1');
    expect((res.jsonBody as any)?.output?.procurement_trigger?.franchise_id).toBe('fr-1');
  });

  it('rejects shortage response when explicit scope context mismatches tenant scope', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'process-shortage-response' },
      body: {
        shortage_id: 'short-001',
        action: 'escalate',
        supplier_ref: 'supp-001',
        scope: {
          tenant_id: 'tenant-999',
          franchise_id: 'fr-1',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('syncs supplier ETA only from trusted adapters with valid datetime', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-supplier-eta' },
      body: {
        supplier_event_id: 'event-1001',
        part_number: 'PN-001',
        eta: '2026-03-25T11:00:00.000Z',
        quantity_confirmed: 5,
        supplier_source: 'maximo',
        impacted_work_packages: ['wp-001', 'wp-002'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('sync-supplier-eta');
    expect((res.jsonBody as any)?.output?.updated_eta).toBe('2026-03-25T11:00:00.000Z');
    expect((res.jsonBody as any)?.output?.impacted_work_packages).toEqual(['wp-001', 'wp-002']);
  });

  it('rejects supplier ETA sync from untrusted adapter', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-supplier-eta' },
      body: {
        supplier_event_id: 'event-1001',
        part_number: 'PN-001',
        eta: '2026-03-25T11:00:00.000Z',
        quantity_confirmed: 5,
        supplier_source: 'unknown-adapter',
        impacted_work_packages: ['wp-001'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('applies rotable/LLP traceability controls for serialized component', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'completed';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'trace-rotable-llp' },
      body: {
        component_id: 'comp-001',
        part_number: 'PN-LLP-001',
        serial_number: 'SER-LLP-001',
        rotable_status: 'serviceable',
        llp_remaining_cycles: 420,
        traceability_action: 'verify',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('trace-rotable-llp');
    expect((res.jsonBody as any)?.output?.traceability_status).toBe('verified');
    expect((res.jsonBody as any)?.output?.llp_control?.within_threshold).toBe(true);
  });

  it('runs inventory optimization hooks when M8 is completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
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
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'run-inventory-optimization' },
      body: {
        work_package_id: 'wp-001',
        forecast_signal_ids: ['sig-1', 'sig-2'],
        optimization_window: 'P14D',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('run-inventory-optimization');
    expect((res.jsonBody as any)?.output?.forecast_signal_count).toBe(2);
    expect((res.jsonBody as any)?.output?.optimization_run_id).toContain('tenant-1-wp-001-inventory-opt-');
  });

  it('blocks inventory optimization hooks when M7 is not completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M6_GATE_EVALUATION_BLOCKER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_CERT_AUTHORITY_VALIDITY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_ZERO_UNRESOLVED_BLOCKER_RULE_PASS = 'true';
    process.env.AMRO_SEQ_M6_DOSSIER_GENERATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M8_KPI_CORRECTNESS_BASELINE_PASS = 'true';
    process.env.AMRO_SEQ_M8_RECOMMENDATION_CONTRACT_EXPLAINABILITY_PASS = 'true';
    process.env.AMRO_SEQ_M8_LOW_CONFIDENCE_POLICY_TESTS_PASS = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'run-inventory-optimization' },
      body: {
        work_package_id: 'wp-001',
        forecast_signal_ids: ['sig-1'],
        optimization_window: 'P7D',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('syncs supplier ASN with ERP procurement when M7 is completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M6_GATE_EVALUATION_BLOCKER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_CERT_AUTHORITY_VALIDITY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_ZERO_UNRESOLVED_BLOCKER_RULE_PASS = 'true';
    process.env.AMRO_SEQ_M6_DOSSIER_GENERATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_ADAPTER_CONTRACT_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_IDEMPOTENCY_REPLAY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_DLQ_REPLAY_CLOSURE_100 = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-supplier-asn-erp' },
      body: {
        asn_event_id: 'asn-001',
        procurement_source: 'sap-pm',
        po_number: 'PO-1001',
        line_items: [
          { part_number: 'PN-001', qty: 2 },
          { part_number: 'PN-002', qty: 1 },
        ],
        impacted_work_packages: ['wp-001'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('sync-supplier-asn-erp');
    expect((res.jsonBody as any)?.output?.sync_status).toBe('applied');
    expect((res.jsonBody as any)?.output?.impacted_work_packages).toEqual(['wp-001']);
  });

  it('creates intelligent plan with idempotency key, scope context, and decision trace', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
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
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'intelligent-plan' },
      body: {
        aircraft_id: 'ac-007',
        source_profile: 'hybrid',
        planned_window: '2026-03-28T00:00:00.000Z|2026-03-29T00:00:00.000Z',
        candidate_scope_items: ['ad-check', 'defect-123'],
        optimization_objectives: ['minimize_ground_time', 'protect_flight_commitments'],
        scope_context: {
          tenant_id: 'tenant-1',
          franchise_id: 'fr-1',
          domain_id: 'amro',
          role: 'planner',
        },
      },
      headers: { 'idempotency-key': 'idem-intelligent-plan-1' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('intelligent-plan');
    expect((res.jsonBody as any)?.input?.idempotency_key).toBe('idem-intelligent-plan-1');
    expect((res.jsonBody as any)?.output?.decision_trace_id).toContain('decision-corr-amro-v2');
  });

  it('runs resource optimization with required scope context and idempotency key', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
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
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'optimize-resources' },
      body: {
        work_package_id: 'wp-001',
        resources_snapshot: [{ resource_id: 'team-a', available: true }],
        optimization_objectives: ['maximize_staff_utilization'],
        scope_context: {
          tenant_id: 'tenant-1',
          franchise_id: 'fr-1',
          domain_id: 'amro',
          role: 'planner',
        },
      },
      headers: { 'idempotency-key': 'idem-resource-opt-1' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('optimize-resources');
    expect((res.jsonBody as any)?.output?.optimization_run_id).toContain('tenant-1-wp-001-resource-opt-');
    expect((res.jsonBody as any)?.output?.recommendations?.length).toBeGreaterThan(0);
  });

  it('blocks intelligent planning interfaces until M7 is completed', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
    process.env.AMRO_SEQ_M6_GATE_EVALUATION_BLOCKER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_CERT_AUTHORITY_VALIDITY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_ZERO_UNRESOLVED_BLOCKER_RULE_PASS = 'true';
    process.env.AMRO_SEQ_M6_DOSSIER_GENERATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M8_KPI_CORRECTNESS_BASELINE_PASS = 'true';
    process.env.AMRO_SEQ_M8_RECOMMENDATION_CONTRACT_EXPLAINABILITY_PASS = 'true';
    process.env.AMRO_SEQ_M8_LOW_CONFIDENCE_POLICY_TESTS_PASS = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'intelligent-plan' },
      body: {
        aircraft_id: 'ac-007',
        planned_window: '2026-03-28T00:00:00.000Z|2026-03-29T00:00:00.000Z',
        candidate_scope_items: ['defect-123'],
      },
      headers: { 'idempotency-key': 'idem-intelligent-plan-blocked' },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-v2',
      { apiVersion: 'v2' }
    );
  });

  it('returns readiness, compliance gates, and optimization board query contracts', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    const readinessReq: ApiRequest = {
      method: 'GET',
      query: { interface: 'readiness', work_package_id: 'wp-001' },
      headers: { 'x-api-version': 'v2' },
    };
    const readinessRes = createResponse();
    await handler(readinessReq, readinessRes);
    expect(readinessRes.statusCode).toBe(200);
    expect((readinessRes.jsonBody as any)?.interface).toBe('readiness');

    const gatesReq: ApiRequest = {
      method: 'GET',
      query: { interface: 'compliance-gates', work_package_id: 'wp-001' },
      headers: { 'x-api-version': 'v2' },
    };
    const gatesRes = createResponse();
    await handler(gatesReq, gatesRes);
    expect(gatesRes.statusCode).toBe(200);
    expect((gatesRes.jsonBody as any)?.output?.blocking_gate_count).toBe(0);

    const boardReq: ApiRequest = {
      method: 'GET',
      query: { interface: 'optimization-board' },
      headers: { 'x-api-version': 'v2' },
    };
    const boardRes = createResponse();
    await handler(boardReq, boardRes);
    expect(boardRes.statusCode).toBe(200);
    expect((boardRes.jsonBody as any)?.interface).toBe('optimization-board');
    expect(Array.isArray((boardRes.jsonBody as any)?.output?.queue)).toBe(true);
  });
});

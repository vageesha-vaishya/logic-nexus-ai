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
  });

  it('blocks transition when policy matrix disallows target status for current role', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'technician',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'transition-work-package' },
      body: {
        work_package_id: 'wp-001',
        current_status: 'planning',
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

  it('clones template only when template is active and tenant-visible', async () => {
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
    expect((res.jsonBody as any)?.output?.new_work_package_id).toContain('tenant-1-fr-1-wp-clone-');
    expect((res.jsonBody as any)?.output?.inherited_tasks_count).toBeGreaterThan(0);
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

  it('rejects substitute shortage action without approved compatibility mapping', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
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

  it('syncs supplier ETA only from trusted adapters with valid datetime', async () => {
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
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
});

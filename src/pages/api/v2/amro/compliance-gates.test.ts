import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './compliance-gates';
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

describe('/api/v2/amro/compliance-gates', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    resetAmroAuditLedgerStore();
    vi.clearAllMocks();
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-compliance-v2',
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

  it('returns 404 when compliance-gates v2 is disabled', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(enforceAmroDomainAccess).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 404 when compliance franchise is outside endpoint rollout cohort', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    process.env.AMRO_V2_CANARY_FRANCHISES = 'fr-canary';
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toContain('rollout cohort');
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(false);
    expect((res.jsonBody as any)?.endpointRollout?.franchiseInCanary).toBe(false);
  });

  it('returns filtered dual-run compliance payload', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    process.env.AMRO_COMPLIANCE_GATES_DUAL_RUN = 'true';
    const req: ApiRequest = { method: 'GET', query: { decision: 'approved' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAmroDomainAccess).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('dual-run');
    expect((res.jsonBody as any)?.filters?.decision).toBe('approved');
    expect((res.jsonBody as any)?.data?.complianceGates?.length).toBe(1);
    expect((res.jsonBody as any)?.serviceBoundaries?.services?.map((item: any) => item.service)).toEqual(
      expect.arrayContaining(['amro-compliance-service', 'amro-audit-ledger-service'])
    );
    expect((res.jsonBody as any)?.data?.complianceGates?.[0]?.domainId).toBe('amro');
    expect((res.jsonBody as any)?.data?.complianceGates?.[0]?.version).toBe('v2');
    expect((res.jsonBody as any)?.reconciliation?.deltaCount).toBe(0);
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedger?.eventType).toBe('amro.audit.recorded.v1');
    expect((res.jsonBody as any)?.auditLedger?.recordId).toBeTruthy();
  });

  it('returns legacy fallback compliance payload when fallback flag is enabled', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    process.env.AMRO_COMPLIANCE_GATES_DUAL_RUN = 'true';
    process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED = 'true';
    const req: ApiRequest = { method: 'GET', query: { decision: 'approved' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('legacy-fallback');
    expect((res.jsonBody as any)?.fallback?.legacyMode).toBe(true);
    expect((res.jsonBody as any)?.data?.complianceGates?.[0]?.gateId).toContain('legacy-');
    expect((res.jsonBody as any)?.auditLedger?.eventType).toBe('amro.audit.recorded.v1');
  });

  it('skips compliance audit append when tenant is outside canary allowlist', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    process.env.AMRO_COMPLIANCE_GATES_DUAL_RUN = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS = 'tenant-canary';
    const req: ApiRequest = { method: 'GET', query: { decision: 'approved' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedger).toBeNull();
  });

  it('skips compliance audit append when capability is outside canary allowlist', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    process.env.AMRO_COMPLIANCE_GATES_DUAL_RUN = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_CAPABILITIES = 'tasks';
    const req: ApiRequest = { method: 'GET', query: { decision: 'approved' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedgerCutover?.capabilityInCanary).toBe(false);
    expect((res.jsonBody as any)?.auditLedger).toBeNull();
  });

  it('delegates invalid filter failure to v2 error handler', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    const req: ApiRequest = { method: 'GET', query: { decision: 'invalid' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-compliance-v2',
      { apiVersion: 'v2' }
    );
  });

  it('evaluates compliance gate with policy snapshot and decision evidence', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'evaluate-compliance-gate' },
      body: {
        context: { type: 'task', id: 'task-001' },
        regulator_profile: 'FAA',
        required_obligations: [
          { obligation_id: 'obl-1', fulfilled: true },
          { obligation_id: 'obl-2', fulfilled: false, reason: 'pending inspector signoff' },
        ],
        policy_version_snapshot: 'policy-v2026.03.21',
        decision_evidence: 'evidence-hash-001',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('evaluate-compliance-gate');
    expect((res.jsonBody as any)?.output?.decision).toBe('fail');
    expect((res.jsonBody as any)?.output?.blockers?.length).toBe(1);
  });

  it('registers exception request only for allowed roles', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'inspector',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'register-exception-request' },
      body: {
        work_package_id: 'wp-001',
        obligation_id: 'obl-100',
        justification: 'Manual review required due to deferred component replacement',
        requested_by: 'inspector-01',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('register-exception-request');
    expect((res.jsonBody as any)?.output?.review_status).toBe('pending_review');
    expect((res.jsonBody as any)?.output?.exception_id).toContain('exception');
  });

  it('generates compliance dossier only when mandatory artifacts are present', async () => {
    process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'generate-compliance-dossier' },
      body: {
        work_package_id: 'wp-002',
        profile: 'EASA',
        include_artifacts: ['release_certificate', 'task_cards', 'signature_log'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('generate-compliance-dossier');
    expect((res.jsonBody as any)?.output?.dossier_status).toBe('finalized');
    expect((res.jsonBody as any)?.output?.artifact_manifest?.length).toBe(3);
  });
});

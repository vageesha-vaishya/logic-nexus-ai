import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './certification';
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

describe('/api/v2/amro/certification', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    resetAmroAuditLedgerStore();
    vi.clearAllMocks();
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
    process.env.AMRO_SEQ_M6_STATUS = 'in-progress';
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
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-certification-v2',
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

  it('returns 404 when certification v2 is disabled', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'POST', query: { interface: 'validate-certifying-authority' }, body: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(enforceAmroDomainAccess).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('validates certifying authority when scope and validity are satisfied', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'validate-certifying-authority' },
      body: {
        actor_id: 'certifier-01',
        aircraft_scope: ['A320'],
        maintenance_scope: ['line'],
        timestamp: '2026-03-20T10:00:00.000Z',
        authority: {
          valid_from: '2026-03-01T00:00:00.000Z',
          valid_to: '2026-04-01T00:00:00.000Z',
          aircraft_scope: ['A320'],
          maintenance_scope: ['line', 'base'],
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAmroDomainAccess).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('validate-certifying-authority');
    expect((res.jsonBody as any)?.output?.authority_status).toBe('valid');
    expect((res.jsonBody as any)?.output?.validation_result).toBe('valid');
  });

  it('returns invalid authority output when certifier is out of scope', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'validate-certifying-authority' },
      body: {
        actor_id: 'certifier-01',
        aircraft_scope: ['B777'],
        maintenance_scope: ['line'],
        timestamp: '2026-03-20T10:00:00.000Z',
        authority: {
          valid_from: '2026-03-01T00:00:00.000Z',
          valid_to: '2026-04-01T00:00:00.000Z',
          aircraft_scope: ['A320'],
          maintenance_scope: ['line', 'base'],
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.authority_status).toBe('invalid');
    expect((res.jsonBody as any)?.output?.validation_result).toBe('invalid');
    expect((res.jsonBody as any)?.output?.restriction_reason).toBe('Expired or out-of-scope authority always invalid');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('submits approval decision when mandatory signatures are present', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'submit-certification-decision' },
      body: {
        work_order_id: 'wp-100',
        decision: 'approve',
        unresolved_blockers: ['none'],
        compliance_gate: {
          decision: 'pass',
          evaluation_id: 'comp-eval-001',
        },
        signatures: [
          { signer_id: 'cert-a', signer_credential_id: 'cred-a', signed_at: '2026-03-20T10:05:00.000Z', mandatory: true, signature: 'sig-a' },
          { signer_id: 'cert-b', signer_credential_id: 'cred-b', signed_at: '2026-03-20T10:06:00.000Z', mandatory: true, signature: 'sig-b' },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.action_status).toBe('approved');
    expect((res.jsonBody as any)?.output?.blockers).toEqual([]);
    expect((res.jsonBody as any)?.output?.non_repudiation?.signature_bundle_hash).toBeTruthy();
    expect((res.jsonBody as any)?.output?.compliance_gate?.decision).toBe('pass');
    expect((res.jsonBody as any)?.output?.transactional_commit?.commit_successful).toBe(true);
    expect((res.jsonBody as any)?.output?.release_artifact_storage?.storage_status).toBe('stored');
    expect((res.jsonBody as any)?.output?.security_critical_flow?.signed_release_artifact_storage).toBe('stored');
    expect((res.jsonBody as any)?.output?.actor_attribution?.actor_id).toBe('user-1');
  });

  it('rejects approval when compliance gate evaluator is not pass', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'submit-certification-decision' },
      body: {
        work_order_id: 'wp-100',
        decision: 'approve',
        unresolved_blockers: ['none'],
        compliance_gate: {
          decision: 'fail',
          evaluation_id: 'comp-eval-002',
        },
        signatures: [
          { signer_id: 'cert-a', mandatory: true, signature: 'sig-a' },
          { signer_id: 'cert-b', mandatory: true, signature: 'sig-b' },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-certification-v2',
      { apiVersion: 'v2' },
    );
  });

  it('rejects approval decision when unresolved blockers remain', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'submit-certification-decision' },
      body: {
        work_order_id: 'wp-100',
        decision: 'approve',
        unresolved_blockers: ['open-ad-2026-001'],
        compliance_gate: {
          decision: 'pass',
          evaluation_id: 'comp-eval-003',
        },
        signatures: [
          { signer_id: 'cert-a', mandatory: true, signature: 'sig-a' },
          { signer_id: 'cert-b', mandatory: true, signature: 'sig-b' },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-certification-v2',
      { apiVersion: 'v2' },
    );
  });

  it('rejects escalation when target is outside authority chain', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'escalate-blocked-certification' },
      body: {
        work_order_id: 'wp-100',
        block_reason: 'unresolved_ad',
        escalation_target: 'chief-certifier',
        authority_chain: ['duty-manager', 'hangar-supervisor'],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-certification-v2',
      { apiVersion: 'v2' },
    );
  });

  it('runs expiry warning and suspension automation', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'automate-expiry-suspension' },
      body: {
        timestamp: '2026-03-20T10:00:00.000Z',
        warning_window_days: 30,
        qualifications: [
          {
            id: 'qual-active',
            valid_to: '2026-05-01T00:00:00.000Z',
            can_certify_release: true,
            status: 'active',
          },
          {
            id: 'qual-suspended',
            valid_to: '2026-03-01T00:00:00.000Z',
            can_certify_release: true,
            status: 'active',
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.summary?.evaluated_count).toBe(2);
    expect((res.jsonBody as any)?.output?.summary?.suspension_count).toBe(1);
  });

  it('loads competency analytics dashboard', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M6_GATE_EVALUATION_BLOCKER_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_CERT_AUTHORITY_VALIDITY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M6_ZERO_UNRESOLVED_BLOCKER_RULE_PASS = 'true';
    process.env.AMRO_SEQ_M6_DOSSIER_GENERATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_ADAPTER_CONTRACT_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_IDEMPOTENCY_REPLAY_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M7_DLQ_REPLAY_CLOSURE_100 = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'load-competency-analytics-dashboard' },
      body: {
        qualifications: [
          {
            id: 'qual-1',
            authority_level: 'supervisor',
            valid_to: '2026-06-01T00:00:00.000Z',
            can_certify_release: true,
          },
          {
            id: 'qual-2',
            authority_level: 'technician',
            valid_to: '2026-03-01T00:00:00.000Z',
            can_certify_release: false,
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.kpi_cards?.total_qualified_staff).toBe(2);
    expect((res.jsonBody as any)?.output?.kpi_cards?.suspended_certifiers).toBe(1);
  });

  it('loads authority-specific certification template for FAA', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'load-authority-certification-template' },
      body: {
        authority_profile: 'FAA',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.template?.template_id).toBe('tmpl-faa-cert-release-v1');
    expect((res.jsonBody as any)?.output?.template?.authority_profile).toBe('FAA');
  });

  it('blocks M6 certification interfaces when M5 is not completed', async () => {
    process.env.AMRO_CERTIFICATION_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M5_STATUS = 'in-progress';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'submit-certification-decision' },
      body: {
        work_order_id: 'wp-100',
        decision: 'approve',
        unresolved_blockers: ['none'],
        signatures: [{ signer_id: 'cert-a', mandatory: true, signature: 'sig-a' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-certification-v2',
      { apiVersion: 'v2' },
    );
  });
});

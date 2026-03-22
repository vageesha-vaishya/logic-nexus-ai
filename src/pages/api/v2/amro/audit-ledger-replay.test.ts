import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './audit-ledger-replay';
import { appendAmroAuditLedgerRecord, resetAmroAuditLedgerStore } from './audit-ledger';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
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

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
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

describe('/api/v2/amro/audit-ledger-replay', () => {
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
    process.env.AMRO_SEQ_M6_STATUS = 'completed';
    process.env.AMRO_SEQ_M7_STATUS = 'completed';
    process.env.AMRO_SEQ_M8_STATUS = 'completed';
    process.env.AMRO_SEQ_M9_STATUS = 'in-progress';
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
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-audit-replay-v2',
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

  it('returns replay records for tenant scope', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:approved',
      correlationId: 'corr-seeded',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'seed-hash',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-1',
      context: { seeded: true },
    });

    const req: ApiRequest = { method: 'GET', query: { capability: 'compliance-gates', limit: '10' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('replay');
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(true);
    expect((res.jsonBody as any)?.data?.records?.length).toBe(1);
    expect((res.jsonBody as any)?.data?.records?.[0]?.correlationId).toBe('corr-seeded');
    expect((res.jsonBody as any)?.data?.replay_assertions).toEqual({
      deterministic_timeline: true,
      hash_chain_valid: true,
    });
    expect((res.jsonBody as any)?.data?.replay_timeline?.event_count).toBe(1);
    expect((res.jsonBody as any)?.data?.replay_timeline?.timeline_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns deterministic replay timeline ordering metadata', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:first',
      correlationId: 'corr-seeded-1',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'seed-hash-1',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-1',
      context: { seeded: true },
    });
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:second',
      correlationId: 'corr-seeded-2',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'seed-hash-2',
      migrationBatchId: 'batch-2',
      replayCheckpoint: 'checkpoint-2',
      context: { seeded: true },
    });

    const req: ApiRequest = { method: 'GET', query: { capability: 'compliance-gates', limit: '10' }, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.replay_timeline?.ordering).toBe('created_at:asc,record_id:asc');
    expect((res.jsonBody as any)?.data?.replay_timeline?.event_count).toBe(2);
    expect((res.jsonBody as any)?.data?.replay_timeline?.events?.[0]?.sequence).toBe(1);
    expect((res.jsonBody as any)?.data?.replay_timeline?.events?.[1]?.sequence).toBe(2);
    expect((res.jsonBody as any)?.data?.replay_timeline?.events?.[0]?.created_at <= (res.jsonBody as any)?.data?.replay_timeline?.events?.[1]?.created_at).toBe(true);
  });

  it('returns 404 when replay endpoint is outside rollout cohort', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    process.env.AMRO_V2_CANARY_TENANTS = 'tenant-canary';
    const req: ApiRequest = { method: 'GET', query: { capability: 'compliance-gates', limit: '10' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toContain('rollout cohort');
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(false);
    expect((res.jsonBody as any)?.endpointRollout?.tenantInCanary).toBe(false);
  });

  it('returns empty replay when tenant is outside cutover canary', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS = 'tenant-canary';
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:approved',
      correlationId: 'corr-seeded',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'seed-hash',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-1',
      context: { seeded: true },
    });

    const req: ApiRequest = { method: 'GET', query: { capability: 'compliance-gates', limit: '10' }, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.data?.records).toEqual([]);
  });

  it('returns empty replay when capability is outside cutover canary', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_CAPABILITIES = 'tasks';
    appendAmroAuditLedgerRecord({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
      eventType: 'amro.audit.recorded.v1',
      entityType: 'compliance-gate',
      entityId: 'decision:approved',
      correlationId: 'corr-seeded',
      action: 'dual-run.read',
      compatMode: 'v2-shadow',
      sourceHash: 'seed-hash',
      migrationBatchId: 'batch-1',
      replayCheckpoint: 'checkpoint-1',
      context: { seeded: true },
    });

    const req: ApiRequest = { method: 'GET', query: { capability: 'compliance-gates', limit: '10' }, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedgerCutover?.capabilityInCanary).toBe(false);
    expect((res.jsonBody as any)?.data?.records).toEqual([]);
  });

  it('delegates invalid capability to v2 error handler', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    const req: ApiRequest = { method: 'GET', query: { capability: 'invalid' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-audit-replay-v2',
      { apiVersion: 'v2' }
    );
  });

  it('blocks replay endpoint when M8 is not completed', async () => {
    process.env.AMRO_AUDIT_LEDGER_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M8_STATUS = 'in-progress';
    const req: ApiRequest = { method: 'GET', query: { capability: 'compliance-gates', limit: '10' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-audit-replay-v2',
      { apiVersion: 'v2' }
    );
  });
});

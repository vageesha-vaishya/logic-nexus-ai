import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import handler from './tasks';
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
  sanitizeQueryId,
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
  sanitizeQueryId: vi.fn(),
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

function buildOfflineEventHash(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash('sha256').update(stable).digest('base64url');
}

function buildSignedMediaRef(name: string): string {
  const exp = Math.floor(Date.now() / 1000) + 600;
  return `https://evidence.logic-nexus.ai/amro/${name}?sig=test-signature&exp=${exp}`;
}

describe('/api/v2/amro/tasks', () => {
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
    process.env.AMRO_SEQ_M4_STATUS = 'in-progress';
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
    vi.clearAllMocks();
    resetAmroAuditLedgerStore();
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-tasks-v2',
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
    vi.mocked(sanitizeQueryId).mockReturnValue('');
  });

  it('returns 404 when AMRO tasks v2 is disabled', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(enforceAmroDomainAccess).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 404 when task capability is outside endpoint rollout cohort', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    process.env.AMRO_V2_CANARY_CAPABILITIES = 'work-packages';
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toContain('rollout cohort');
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(false);
    expect((res.jsonBody as any)?.endpointRollout?.capabilityInCanary).toBe(false);
  });

  it('returns filtered dual-run tasks payload', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    process.env.AMRO_TASKS_DUAL_RUN = 'true';
    vi.mocked(sanitizeQueryId).mockReturnValue('WP-001');
    const req: ApiRequest = { method: 'GET', query: { workPackageId: 'WP-001' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAmroDomainAccess).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(sanitizeQueryId).toHaveBeenCalledWith('WP-001', 'workPackageId');
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('dual-run');
    expect((res.jsonBody as any)?.filters?.workPackageId).toBe('WP-001');
    expect((res.jsonBody as any)?.data?.tasks?.length).toBe(2);
    expect((res.jsonBody as any)?.serviceBoundaries?.services?.map((item: any) => item.service)).toEqual(
      expect.arrayContaining(['amro-work-order-service', 'amro-scheduling-service', 'amro-materials-service'])
    );
    expect((res.jsonBody as any)?.data?.tasks?.[0]?.domainId).toBe('amro');
    expect((res.jsonBody as any)?.data?.tasks?.[0]?.version).toBe('v2');
    expect((res.jsonBody as any)?.reconciliation?.deltaCount).toBe(0);
    expect((res.jsonBody as any)?.endpointRollout?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(true);
    expect((res.jsonBody as any)?.auditLedger?.recordId).toBeTruthy();
    expect((res.jsonBody as any)?.auditLedger?.chainHash).toBeTruthy();
  });

  it('returns legacy fallback tasks payload when fallback flag is enabled', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    process.env.AMRO_TASKS_DUAL_RUN = 'true';
    process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED = 'true';
    vi.mocked(sanitizeQueryId).mockReturnValue('WP-001');
    const req: ApiRequest = { method: 'GET', query: { workPackageId: 'WP-001' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('legacy-fallback');
    expect((res.jsonBody as any)?.fallback?.legacyMode).toBe(true);
    expect((res.jsonBody as any)?.data?.tasks?.[0]?.id).toContain('legacy-');
    expect((res.jsonBody as any)?.auditLedger?.recordId).toBeTruthy();
  });

  it('skips audit append when tenant is outside canary allowlist', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    process.env.AMRO_TASKS_DUAL_RUN = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS = 'tenant-canary';
    vi.mocked(sanitizeQueryId).mockReturnValue('WP-001');
    const req: ApiRequest = { method: 'GET', query: { workPackageId: 'WP-001' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedger).toBeNull();
  });

  it('skips audit append when capability is outside canary allowlist', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    process.env.AMRO_TASKS_DUAL_RUN = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_CAPABILITIES = 'work-packages';
    vi.mocked(sanitizeQueryId).mockReturnValue('WP-001');
    const req: ApiRequest = { method: 'GET', query: { workPackageId: 'WP-001' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.auditLedgerCutover?.enabled).toBe(false);
    expect((res.jsonBody as any)?.auditLedgerCutover?.capabilityInCanary).toBe(false);
    expect((res.jsonBody as any)?.auditLedger).toBeNull();
  });

  it('delegates AMRO authorization failures to v2 error handler', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    vi.mocked(enforceAmroDomainAccess).mockRejectedValue(new Error('Forbidden: AMRO access requires active AMRO domain subscription'));
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-tasks-v2',
      { apiVersion: 'v2' }
    );
  });

  it('updates task step and returns event hash for 15.2.3 contract', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'update-task-step' },
      body: {
        task_id: 'task-001',
        step_id: 'step-01',
        action: 'complete',
        performed_at: '2026-03-21T09:30:00.000Z',
        device_id: 'device-77',
        expected_step_index: 1,
        actual_step_index: 1,
        current_step_status: 'in_progress',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('update-task-step');
    expect((res.jsonBody as any)?.output?.step_status).toBe('completed');
    expect((res.jsonBody as any)?.output?.event_hash).toBeTruthy();
  });

  it('rejects task step update when step order policy is violated', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'update-task-step' },
      body: {
        task_id: 'task-001',
        step_id: 'step-02',
        action: 'start',
        performed_at: '2026-03-21T09:30:00.000Z',
        device_id: 'device-77',
        expected_step_index: 1,
        actual_step_index: 2,
        current_step_status: 'planned',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-tasks-v2',
      { apiVersion: 'v2' }
    );
  });

  it('uploads evidence when checksum, media size, and MIME policies pass', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'upload-evidence' },
      body: {
        task_id: 'task-001',
        evidence_type: 'photo',
        media_ref: buildSignedMediaRef('photo-001.jpg'),
        checksum: 'abc123def456ghi789',
        metadata: {
          media_size_bytes: 1024 * 1024,
          mime_type: 'image/jpeg',
          kms_key_id: 'kms://amro/tenant-1/evidence',
          encrypted_signature_artifact_ref: 'kms://amro/tenant-1/signature-artifacts/photo-001',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('upload-evidence');
    expect((res.jsonBody as any)?.output?.integrity_status).toBe('verified');
  });

  it('rejects evidence upload when checksum is missing', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'upload-evidence' },
      body: {
        task_id: 'task-001',
        evidence_type: 'photo',
        media_ref: buildSignedMediaRef('photo-001.jpg'),
        checksum: '',
        metadata: {
          media_size_bytes: 1024 * 1024,
          mime_type: 'image/jpeg',
          kms_key_id: 'kms://amro/tenant-1/evidence',
          encrypted_signature_artifact_ref: 'kms://amro/tenant-1/signature-artifacts/photo-001',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-tasks-v2',
      { apiVersion: 'v2' }
    );
  });

  it('queues offline task action for mobile execution path', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'save-offline-task-action' },
      body: {
        task_id: 'task-001',
        step_id: 'step-01',
        action: 'start',
        expected_step_index: 1,
        actual_step_index: 1,
        local_revision: 2,
        server_version: 2,
        sequence_number: 2,
        performed_at: '2026-03-21T09:29:55.000Z',
        device_signature: 'device-sig-001',
        queued_at: '2026-03-21T09:30:00.000Z',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('save-offline-task-action');
    expect((res.jsonBody as any)?.output?.queue_status).toBe('queued');
    expect((res.jsonBody as any)?.output?.conflict_strategy).toBe('deterministic-merge');
    expect((res.jsonBody as any)?.output?.queue_encryption).toBe('aes-256-gcm');
    expect((res.jsonBody as any)?.output?.signature_status).toBe('verified');
  });

  it('merges offline queue when server revision has no conflicts', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const eventHash = buildOfflineEventHash({
      eventType: 'update-task-step',
      taskId: 'task-001',
      localRevision: 5,
      serverRevision: 5,
      performedAt: '2026-03-21T09:30:00.000Z',
      sequenceNumber: 5,
      action: 'complete',
      stepId: 'step-01',
      evidenceType: '',
      signerId: '',
    });
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-offline-queue' },
      body: {
        queue_entries: [
          {
            event_type: 'update-task-step',
            task_id: 'task-001',
            step_id: 'step-01',
            action: 'complete',
            current_step_status: 'in_progress',
            local_revision: 5,
            server_revision: 5,
            sequence_number: 5,
            performed_at: '2026-03-21T09:30:00.000Z',
            event_hash: eventHash,
            encrypted_payload_ref: 'enc://tenant-1/task-001/5/mockhash',
            device_signature: 'device-sig-001',
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('sync-offline-queue');
    expect((res.jsonBody as any)?.output?.sync_status).toBe('merged');
    expect((res.jsonBody as any)?.output?.conflict_count).toBe(0);
    expect((res.jsonBody as any)?.output?.merged_count).toBe(1);
    expect((res.jsonBody as any)?.output?.sync_metrics?.queue_event_count).toBe(1);
    expect((res.jsonBody as any)?.output?.sync_metrics?.benchmark_status).toBe('target_met');
    expect(typeof (res.jsonBody as any)?.output?.sync_metrics?.normalized_ms_per_100_events).toBe('number');
  });

  it('returns conflict payload when offline queue has stale client revision', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const eventHash = buildOfflineEventHash({
      eventType: 'update-task-step',
      taskId: 'task-001',
      localRevision: 3,
      serverRevision: 5,
      performedAt: '2026-03-21T09:30:00.000Z',
      sequenceNumber: 3,
      action: 'complete',
      stepId: 'step-01',
      evidenceType: '',
      signerId: '',
    });
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-offline-queue' },
      body: {
        queue_entries: [
          {
            event_type: 'update-task-step',
            task_id: 'task-001',
            step_id: 'step-01',
            action: 'complete',
            current_step_status: 'in_progress',
            local_revision: 3,
            server_revision: 5,
            sequence_number: 3,
            performed_at: '2026-03-21T09:30:00.000Z',
            event_hash: eventHash,
            encrypted_payload_ref: 'enc://tenant-1/task-001/3/mockhash',
            device_signature: 'device-sig-001',
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.sync_status).toBe('conflict');
    expect((res.jsonBody as any)?.output?.conflict_count).toBe(1);
    expect((res.jsonBody as any)?.output?.conflicts?.[0]?.resolution).toBe('manual-review-required');
  });

  it('applies exponential backoff and dead-letter handling when canonical persistence fails', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const eventHash = buildOfflineEventHash({
      eventType: 'upload-evidence',
      taskId: 'task-001',
      localRevision: 7,
      serverRevision: 7,
      performedAt: '2026-03-21T09:32:00.000Z',
      sequenceNumber: 7,
      action: '',
      stepId: '',
      evidenceType: 'photo',
      signerId: '',
    });
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-offline-queue' },
      body: {
        auth_token_active: false,
        refresh_token_available: true,
        storage_write_successful: false,
        retry_attempt: 5,
        max_retry_threshold: 5,
        client_acknowledged: false,
        queue_entries: [
          {
            event_type: 'upload-evidence',
            task_id: 'task-001',
            evidence_type: 'photo',
            media_ref: buildSignedMediaRef('photo-007.jpg'),
            checksum: 'abc123def456ghi007',
            metadata: {
              media_size_bytes: 2048,
              mime_type: 'image/jpeg',
              kms_key_id: 'kms://amro/tenant-1/evidence',
              encrypted_signature_artifact_ref: 'kms://amro/tenant-1/signature-artifacts/photo-007',
            },
            local_revision: 7,
            server_revision: 7,
            sequence_number: 7,
            performed_at: '2026-03-21T09:32:00.000Z',
            event_hash: eventHash,
            encrypted_payload_ref: 'enc://tenant-1/task-001/7/mockhash',
            device_signature: 'device-sig-001',
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.auth?.token_status).toBe('refreshed');
    expect((res.jsonBody as any)?.output?.canonical_persistence?.status).toBe('dead-lettered');
    expect((res.jsonBody as any)?.output?.canonical_persistence?.dead_lettered).toBe(true);
    expect((res.jsonBody as any)?.output?.canonical_state_update?.status).toBe('dead-lettered');
    expect((res.jsonBody as any)?.output?.acknowledgment?.all_events_acknowledged).toBe(false);
    expect((res.jsonBody as any)?.output?.acknowledgment?.retry_action).toBe('retry-sync');
    expect((res.jsonBody as any)?.output?.sync_metrics?.benchmark_status).toBe('target_met');
    expect((res.jsonBody as any)?.output?.sync_metrics?.alert_required).toBe(false);
  });

  it('rejects offline queue when hash chain ordering is invalid', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const firstHash = buildOfflineEventHash({
      eventType: 'update-task-step',
      taskId: 'task-001',
      localRevision: 5,
      serverRevision: 5,
      performedAt: '2026-03-21T09:30:00.000Z',
      sequenceNumber: 5,
      action: 'start',
      stepId: 'step-01',
      evidenceType: '',
      signerId: '',
    });
    const secondHash = buildOfflineEventHash({
      eventType: 'upload-evidence',
      taskId: 'task-001',
      localRevision: 6,
      serverRevision: 5,
      performedAt: '2026-03-21T09:31:00.000Z',
      sequenceNumber: 6,
      action: '',
      stepId: '',
      evidenceType: 'photo',
      signerId: '',
    });
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'sync-offline-queue' },
      body: {
        queue_entries: [
          {
            event_type: 'update-task-step',
            task_id: 'task-001',
            step_id: 'step-01',
            action: 'start',
            current_step_status: 'not_started',
            local_revision: 5,
            server_revision: 5,
            sequence_number: 5,
            performed_at: '2026-03-21T09:30:00.000Z',
            event_hash: firstHash,
            encrypted_payload_ref: 'enc://tenant-1/task-001/5/first',
            device_signature: 'device-sig-001',
          },
          {
            event_type: 'upload-evidence',
            task_id: 'task-001',
            evidence_type: 'photo',
            media_ref: buildSignedMediaRef('photo-001.jpg'),
            checksum: 'abc123def456ghi789',
            metadata: {
              media_size_bytes: 2048,
              mime_type: 'image/jpeg',
              kms_key_id: 'kms://amro/tenant-1/evidence',
              encrypted_signature_artifact_ref: 'kms://amro/tenant-1/signature-artifacts/photo-001',
            },
            local_revision: 6,
            server_revision: 5,
            sequence_number: 6,
            previous_event_hash: 'mismatched-chain-hash',
            performed_at: '2026-03-21T09:31:00.000Z',
            event_hash: secondHash,
            encrypted_payload_ref: 'enc://tenant-1/task-001/6/second',
            device_signature: 'device-sig-001',
          },
        ],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-tasks-v2',
      { apiVersion: 'v2' }
    );
  });

  it('submits signature only when qualification and privilege are valid at action time', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'submit-signature' },
      body: {
        task_id: 'task-001',
        signer_id: 'signer-001',
        method: 'digital_cert',
        signature_payload: 'signed-payload',
        action_time: '2026-03-21T09:30:00.000Z',
        qualification: {
          valid_from: '2026-01-01T00:00:00.000Z',
          valid_to: '2026-12-31T23:59:59.000Z',
          privileges: ['task_signature.submit'],
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('submit-signature');
    expect((res.jsonBody as any)?.output?.non_repudiation_status).toBe('verified');
  });

  it('blocks M4 task execution interfaces until M3 is completed', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M3_STATUS = 'in-progress';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'upload-evidence' },
      body: {
        task_id: 'task-001',
        evidence_type: 'photo',
        media_ref: buildSignedMediaRef('photo-001.jpg'),
        checksum: 'abc123def456ghi789',
        metadata: {
          media_size_bytes: 1024,
          mime_type: 'image/jpeg',
          kms_key_id: 'kms://amro/tenant-1/evidence',
          encrypted_signature_artifact_ref: 'kms://amro/tenant-1/signature-artifacts/photo-001',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-tasks-v2',
      { apiVersion: 'v2' }
    );
  });

  it('allows technician role to execute mobile critical task flow without manage permissions', async () => {
    process.env.AMRO_TASKS_V2_ENABLED = 'true';
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'tech-1',
      role: 'technician',
      permissions: ['dashboards.view'],
    } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'update-task-step' },
      body: {
        task_id: 'task-001',
        step_id: 'step-01',
        action: 'start',
        performed_at: '2026-03-21T09:30:00.000Z',
        device_id: 'device-77',
        expected_step_index: 1,
        actual_step_index: 1,
        current_step_status: 'planned',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.step_status).toBe('in_progress');
    expect(enforceAnyPermission).not.toHaveBeenCalled();
  });
});

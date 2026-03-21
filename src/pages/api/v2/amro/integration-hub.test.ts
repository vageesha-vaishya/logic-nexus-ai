import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './integration-hub';
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

describe('/api/v2/amro/integration-hub', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
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
    process.env.AMRO_SEQ_M7_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M8_STATUS = 'not-started';
    process.env.AMRO_SEQ_M9_STATUS = 'not-started';
    process.env.AMRO_SEQ_M10_STATUS = 'not-started';
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-integration-hub-v2',
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

  it('returns 404 when integration-hub v2 is disabled', async () => {
    process.env.AMRO_INTEGRATION_HUB_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'POST', query: { interface: 'ingest-partner-payload' }, body: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(enforceAmroDomainAccess).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('ingests allow-listed partner payload with idempotency for mutating events', async () => {
    process.env.AMRO_INTEGRATION_HUB_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'ingest-partner-payload' },
      body: {
        source_system: 'sap-pm',
        adapter_version: '2.4.1',
        event_type: 'task_update',
        payload: { task_id: 'task-1' },
        idempotency_key: 'idem-123',
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
    expect((res.jsonBody as any)?.output?.parse_status).toBe('parsed');
  });

  it('replays only failed or quarantined jobs', async () => {
    process.env.AMRO_INTEGRATION_HUB_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'replay-failed-integration-job' },
      body: {
        job_id: 'job-100',
        replay_reason: 'adapter_timeout',
        requested_by: 'ops-user',
        job_status: 'failed',
        retry_count: 2,
        dead_letter_count: 4,
        replayed_count: 3,
        closed_count: 3,
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.replay_status).toBe('queued');
    expect((res.jsonBody as any)?.output?.retry_count).toBe(3);
    expect((res.jsonBody as any)?.output?.replay_metrics).toEqual({
      dead_letter_count: 4,
      replayed_count: 3,
      closed_count: 3,
      closure_rate_percent: 100,
      replay_closure_status: 'closed',
    });
  });

  it('rejects callback publish when schema mapping mismatches partner version', async () => {
    process.env.AMRO_INTEGRATION_HUB_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'publish-outbound-callback' },
      body: {
        target_partner: 'sap-pm',
        event_type: 'amro.task.completed.v1',
        payload_ref: 'payload-abc',
        mapping_contract: {
          schema_version: 'v1.2',
          partner_schema_version: 'v1.3',
        },
        attempt_log: [{ attempt: 1, status: 'queued' }],
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-integration-hub-v2',
      { apiVersion: 'v2' },
    );
  });

  it('blocks M7 interfaces when M6 is not completed', async () => {
    process.env.AMRO_INTEGRATION_HUB_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_M6_STATUS = 'in-progress';
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'ingest-partner-payload' },
      body: {
        source_system: 'sap-pm',
        adapter_version: '2.4.1',
        event_type: 'task_update',
        payload: { task_id: 'task-1' },
        idempotency_key: 'idem-123',
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-integration-hub-v2',
      { apiVersion: 'v2' },
    );
  });
});

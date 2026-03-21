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
});

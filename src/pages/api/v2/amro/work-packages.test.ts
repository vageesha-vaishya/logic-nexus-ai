import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './work-packages';
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
import { resetAmroAuditLedgerStore } from './audit-ledger';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
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
});

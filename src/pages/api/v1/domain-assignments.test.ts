import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './domain-assignments';
import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { DomainAssignmentService } from '@/services/domain/DomainAssignmentService';

vi.mock('../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
  sanitizeQueryId: vi.fn(),
}));

vi.mock('../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));

type MockResponse = ApiResponse & {
  statusCode?: number;
  jsonBody?: unknown;
  headers: Record<string, string | string[]>;
};

function createResponse(): MockResponse {
  const res: MockResponse = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (data: unknown) => {
          res.jsonBody = data;
        },
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v1/domain-assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-domain',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'platform_admin',
      permissions: ['domains.assign', 'domains.revoke', 'domains.audit.view'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: null,
      franchiseId: null,
      isPlatformAdmin: true,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(sanitizeQueryId).mockImplementation((value: unknown) => String(value || ''));
  });

  it('returns assignment audit history on GET', async () => {
    const listAuditHistory = vi
      .spyOn(DomainAssignmentService.prototype, 'listAuditHistory')
      .mockResolvedValue([{ id: 'a1', action: 'DOMAIN_ASSIGN' }] as any);

    const req: ApiRequest = { method: 'GET', query: { limit: '20' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(listAuditHistory).toHaveBeenCalledWith({
      tenantId: undefined,
      domainId: undefined,
      batchId: undefined,
      limit: 20,
    });
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(expect.objectContaining({ version: 'v1', data: [{ id: 'a1', action: 'DOMAIN_ASSIGN' }] }));
  });

  it('bulk assigns tenants on POST', async () => {
    const assignTenants = vi.spyOn(DomainAssignmentService.prototype, 'assignTenants').mockResolvedValue({
      batchId: 'batch-1',
      domainId: 'domain-1',
      attempted: 2,
      assigned: 2,
      reactivated: 0,
      skipped: 0,
    });

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: { domainId: 'domain-1', tenantIds: ['tenant-1', 'tenant-2'], batchId: 'batch-1' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(assignTenants).toHaveBeenCalledWith({
      tenantIds: ['tenant-1', 'tenant-2'],
      domainId: 'domain-1',
      actorUserId: 'user-1',
      batchId: 'batch-1',
    });
    expect(res.statusCode).toBe(200);
    expect(logApiEvent).toHaveBeenCalled();
  });

  it('bulk revokes tenants on DELETE', async () => {
    const revokeTenants = vi.spyOn(DomainAssignmentService.prototype, 'revokeTenants').mockResolvedValue({
      batchId: 'batch-2',
      domainId: 'domain-1',
      attempted: 1,
      revoked: 1,
      skipped: 0,
    });

    const req: ApiRequest = {
      method: 'DELETE',
      query: {},
      body: { domainId: 'domain-1', tenantIds: ['tenant-1'], batchId: 'batch-2' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(revokeTenants).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('returns 405 for unsupported methods', async () => {
    const req: ApiRequest = { method: 'PATCH', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.headers.Allow).toEqual(['GET', 'POST', 'DELETE']);
    expect(res.statusCode).toBe(405);
  });

  it('delegates errors to sendErrorResponse', async () => {
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: null,
      franchiseId: null,
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-domain');
  });
});

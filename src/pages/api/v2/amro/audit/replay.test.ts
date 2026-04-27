import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './replay';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import { replayAmroAuditLedgerRecords } from '../audit-ledger';

vi.mock('../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

vi.mock('../audit-ledger', async () => {
  const actual = await vi.importActual('../audit-ledger');
  return {
    ...(actual as Record<string, unknown>),
    replayAmroAuditLedgerRecords: vi.fn(),
  };
});

describe('/api/v2/amro/audit/replay', () => {
  function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-replay',
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

  it('returns API-AMRO-014 response shape with timeline and hash validation', async () => {
    vi.mocked(replayAmroAuditLedgerRecords).mockReturnValue([
      {
        recordId: 'rec-2',
        tenantId: 'tenant-1',
        franchiseId: 'fr-1',
        domainId: 'amro',
        version: 'v2',
        capability: 'work-orders',
        eventType: 'amro.work_order.transitioned.v1',
        entityType: 'work-order',
        entityId: 'tenant-1:wp-1',
        correlationId: 'corr-a',
        action: 'transition',
        compatMode: 'v2-shadow',
        context: {},
        sourceHash: 'hash-2',
        migrationBatchId: null,
        replayCheckpoint: null,
        previousHash: 'chain-1',
        chainHash: 'chain-2',
        createdAt: '2026-03-20T02:00:00.000Z',
      },
      {
        recordId: 'rec-1',
        tenantId: 'tenant-1',
        franchiseId: 'fr-1',
        domainId: 'amro',
        version: 'v2',
        capability: 'work-orders',
        eventType: 'amro.work_order.created.v1',
        entityType: 'work-order',
        entityId: 'tenant-1:wp-1',
        correlationId: 'corr-b',
        action: 'create',
        compatMode: 'v2-shadow',
        context: {},
        sourceHash: 'hash-1',
        migrationBatchId: null,
        replayCheckpoint: null,
        previousHash: null,
        chainHash: 'chain-1',
        createdAt: '2026-03-20T01:00:00.000Z',
      },
    ] as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {
        entity_id: 'tenant-1:wp-1',
        from: '2026-03-20T00:00:00.000Z',
        to: '2026-03-21T00:00:00.000Z',
        event_types: ['amro.work_order.created.v1', 'amro.work_order.transitioned.v1'],
        include_signatures: 'true',
        format: 'json',
      },
      headers: {},
      body: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.timeline?.length).toBe(2);
    expect((res.jsonBody as any)?.hash_validation_status).toBe('valid');
    expect((res.jsonBody as any)?.export_ref).toBeNull();
  });

  it('returns AMRO_AUDIT_RANGE_TOO_LARGE for oversized date window', async () => {
    vi.mocked(replayAmroAuditLedgerRecords).mockReturnValue([] as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-03-20T00:00:00.000Z',
        format: 'json',
      },
      headers: {},
      body: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(413);
    expect((res.jsonBody as any)?.code).toBe('AMRO_AUDIT_RANGE_TOO_LARGE');
  });

  it('returns AMRO_EXPORT_UNAVAILABLE for csv when export is disabled', async () => {
    vi.mocked(replayAmroAuditLedgerRecords).mockReturnValue([] as any);
    const req: ApiRequest = {
      method: 'GET',
      query: {
        from: '2026-03-20T00:00:00.000Z',
        to: '2026-03-20T12:00:00.000Z',
        format: 'csv',
      },
      headers: {},
      body: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect((res.jsonBody as any)?.code).toBe('AMRO_EXPORT_UNAVAILABLE');
  });
});

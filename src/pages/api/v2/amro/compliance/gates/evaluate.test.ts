import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './evaluate';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

vi.mock('../../../../_utils/http', () => ({
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

vi.mock('../../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

describe('/api/v2/amro/compliance/gates/evaluate', () => {
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
      correlationId: 'corr-amro-evaluate',
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
      permissions: ['dashboards.manage', 'reports.manage'],
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

  it('returns API-AMRO-011 contract fields for valid evaluation request', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: {
        entity_type: 'work_package',
        entity_id: 'tenant-1:wp-1',
        regulator_profile: 'FAA',
        evaluation_context: {
          station: 'tenant-1:station-a',
          aircraft_scope: ['A320'],
          qualification: 'A',
          blockers: [],
          warnings: [],
        },
      },
      headers: {
        'idempotency-key': 'idem-evaluate-001',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.decision).toBe('pass');
    expect((res.jsonBody as any)?.policy_version).toBe('faa-policy-v2.4');
    expect((res.jsonBody as any)?.decision_trace_id).toBeTruthy();
  });

  it('returns AMRO_POLICY_NOT_FOUND when regulator profile is unsupported', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: {
        entity_type: 'task',
        entity_id: 'tenant-1:task-9',
        regulator_profile: 'DGCA',
        evaluation_context: {
          station: 'tenant-1:station-a',
          aircraft_scope: ['A320'],
          qualification: 'A',
        },
      },
      headers: {
        'idempotency-key': 'idem-evaluate-002',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.code).toBe('AMRO_POLICY_NOT_FOUND');
  });

  it('returns AMRO_EVALUATION_CONTEXT_INVALID when context is malformed', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: {
        entity_type: 'work_package',
        entity_id: 'tenant-1:wp-2',
        regulator_profile: 'FAA',
        evaluation_context: {
          station: 'tenant-1:station-a',
          aircraft_scope: [],
          qualification: 'A',
        },
      },
      headers: {
        'idempotency-key': 'idem-evaluate-003',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.code).toBe('AMRO_EVALUATION_CONTEXT_INVALID');
  });

  it('returns idempotency error when Idempotency-Key header is missing', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: {
        entity_type: 'work_package',
        entity_id: 'tenant-1:wp-3',
        regulator_profile: 'FAA',
        evaluation_context: {
          station: 'tenant-1:station-a',
          aircraft_scope: ['A320'],
          qualification: 'A',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.code).toBe('AMRO_IDEMPOTENCY_KEY_REQUIRED');
  });
});

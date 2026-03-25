import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './flight-logs';
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
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

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

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): {
  statusCode: number;
  jsonBody: unknown;
  headers: Record<string, string | string[]>;
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} & ApiResponse {
  const res = {
    statusCode: 200,
    jsonBody: undefined as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
        end: () => undefined,
      };
    }),
  };
  return res as typeof res & ApiResponse;
}

describe('flight-logs v2 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-1' } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['edit_aircraft_records'],
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
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { flight_log_id: 'fl-1' },
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any);
  });

  it('records a flight log and returns 201', async () => {
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        aircraft_id: 'ac-1',
        flight_date: '2026-03-20',
        departure_airport: 'DEL',
        arrival_airport: 'CCU',
        flight_hours: 2.3,
        block_hours: 2.8,
        flight_cycles: 1,
        regulatory_authority: 'DGCA',
      },
    };
    const res = createResponse() as any;

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.output?.flight_log?.flight_log_id).toBe('fl-1');
    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalled();
    expect(enforceRateLimit).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(resolveAndApplyAccessContext).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('routes validation errors through error handler', async () => {
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        aircraft_id: 'ac-1',
        flight_date: '2026-03-20',
        departure_airport: 'DEL',
        arrival_airport: 'DEL',
        flight_hours: 0,
        block_hours: 0,
        flight_cycles: 0,
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalled();
  });
});

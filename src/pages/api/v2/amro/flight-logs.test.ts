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
  let rpcMock: ReturnType<typeof vi.fn>;
  let aircraftMaybeSingleMock: ReturnType<typeof vi.fn>;
  let flightLogUpdateEqTenantMock: ReturnType<typeof vi.fn>;

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
    rpcMock = vi.fn().mockResolvedValue({
      data: { flight_log_id: 'fl-1' },
      error: null,
    });
    aircraftMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: 'ac-1', franchise_id: 'fr-1', tail_number: 'TN-VT-ACG', registration: 'VT-ACG' },
      error: null,
    });
    flightLogUpdateEqTenantMock = vi.fn().mockResolvedValue({ error: null });
    const flightLogUpdateEqIdMock = vi.fn().mockReturnValue({ eq: flightLogUpdateEqTenantMock });
    const fromMock = vi.fn((table: string) => {
      if (table === 'aircraft') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: aircraftMaybeSingleMock,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'flight_logs') {
        return {
          update: vi.fn().mockReturnValue({
            eq: flightLogUpdateEqIdMock,
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    } as any);
  });

  it('records a flight log and returns 201', async () => {
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        aircraft_id: 'TN-VT-ACG',
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
    expect(rpcMock).toHaveBeenCalledWith(
      'amro_record_flight_log',
      expect.objectContaining({
        p_aircraft_id: 'ac-1',
      }),
    );
    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalled();
    expect(enforceRateLimit).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(resolveAndApplyAccessContext).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('returns 404 when aircraft cannot be resolved in tenant scope', async () => {
    aircraftMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    aircraftMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    aircraftMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        aircraft_id: 'TN-VT-ACG',
        flight_date: '2026-03-20',
        departure_airport: 'DEL',
        arrival_airport: 'CCU',
        flight_hours: 2.3,
        block_hours: 2.8,
        flight_cycles: 1,
      },
    };
    const res = createResponse() as any;

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.error).toContain('not found');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns 403 when aircraft is outside franchise scope', async () => {
    aircraftMaybeSingleMock.mockResolvedValueOnce({
      data: { id: 'ac-1', franchise_id: 'fr-2', tail_number: 'TN-VT-ACG', registration: 'VT-ACG' },
      error: null,
    });
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        aircraft_id: 'TN-VT-ACG',
        flight_date: '2026-03-20',
        departure_airport: 'DEL',
        arrival_airport: 'CCU',
        flight_hours: 2.3,
        block_hours: 2.8,
        flight_cycles: 1,
      },
    };
    const res = createResponse() as any;

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect((res.jsonBody as any)?.error).toContain('Forbidden');
    expect(rpcMock).not.toHaveBeenCalled();
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

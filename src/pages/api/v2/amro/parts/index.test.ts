import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './index';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { sendErrorResponse } from '../../../_utils/errorHandler';

vi.mock('../../../_utils/http', () => ({
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

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown } {
  const res: any = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
      };
    }),
  };
  return res;
}

describe('/api/v2/amro/parts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-parts-index' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = 'true';
  });

  it('returns paginated parts records', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'parts_inventory') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn().mockResolvedValue({
                    data: [{
                      id: 'inv-1',
                      part_number: 'AMRO-PN-0001',
                      status: 'available',
                      quantity_on_hand: 10,
                      quantity_reserved: 2,
                      warehouse_location: 'WH-A-001',
                    }],
                    error: null,
                    count: 1,
                  }),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-parts-list');
    expect((res.jsonBody as any)?.output?.records?.length).toBe(1);
  });

  it('supports filtered search query path', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(() => ({
                or: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'GET',
      query: { search: 'PN' },
      headers: {},
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('creates a part record and emits workflow triggers', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'parts_inventory') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inv-new',
                      part_number: 'AMRO-PN-0002',
                      status: 'unserviceable',
                      lifecycle_status: 'needs_repair',
                      quantity_on_hand: 2,
                      quantity_reserved: 0,
                      warehouse_location: 'WH-B-001',
                      reorder_level: 5,
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === 'amro_parts_mro_workflow_events') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        part_number: 'AMRO-PN-0002',
        serial_number: 'SN-0002',
        status: 'unserviceable',
        lifecycle_status: 'needs_repair',
        quantity_on_hand: 2,
        quantity_reserved: 0,
        reorder_level: 5,
        warehouse_location: 'WH-B-001',
        criticality: 'critical',
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('amro-parts-create');
    expect(Array.isArray((res.jsonBody as any)?.output?.workflow_events)).toBe(true);
  });

  it('returns validation error for malformed part payload', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        part_number: 'bad part',
        status: 'invalid',
        quantity_on_hand: -1,
        quantity_reserved: 3,
        warehouse_location: '',
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toBe('Validation failed');
  });

  it('returns 405 for unsupported method', async () => {
    const req: ApiRequest = { method: 'PUT', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 404 when feature flag is disabled', async () => {
    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('accepts feature flags "1" and "on"', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = '1';
    let req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    let res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);

    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = 'on';
    req = { method: 'GET', query: {}, headers: {} };
    res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('handles null franchise and missing permissions array', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u2', role: 'tenant_admin' } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);

    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('treats non-object body as empty payload for POST validation', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as any);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: 'not-an-object' as any,
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('short-circuits on preflight requests', async () => {
    vi.mocked(handlePreflight).mockReturnValue(true);
    const req: ApiRequest = { method: 'OPTIONS', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('delegates to error handler on supabase query error', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'db exploded' },
                count: 0,
              }),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalled();
  });

  it('delegates to error handler on authentication failure', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('auth failed'));
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalled();
  });
});

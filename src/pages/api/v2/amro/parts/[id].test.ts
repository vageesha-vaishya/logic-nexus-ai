import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './[id]';
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

describe('/api/v2/amro/parts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-parts-id' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = 'true';
  });

  it('returns part detail for GET', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'parts_inventory') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'inv-1',
                        tenant_id: 'tenant-1',
                        franchise_id: 'fr-1',
                        part_number: 'AMRO-PN-1',
                        status: 'available',
                        quantity_on_hand: 9,
                        quantity_reserved: 1,
                        warehouse_location: 'WH-A-001',
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-parts-detail');
  });

  it('updates part and emits workflow + audit records for PATCH', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'parts_inventory') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'inv-1',
                        tenant_id: 'tenant-1',
                        franchise_id: 'fr-1',
                        part_number: 'AMRO-PN-1',
                        status: 'available',
                        lifecycle_status: 'serviceable',
                        quantity_on_hand: 9,
                        quantity_reserved: 1,
                        reorder_level: 10,
                        warehouse_location: 'WH-A-001',
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: 'inv-1',
                          part_number: 'AMRO-PN-1',
                          status: 'unserviceable',
                          lifecycle_status: 'needs_repair',
                          quantity_on_hand: 8,
                          quantity_reserved: 1,
                          warehouse_location: 'WH-A-001',
                        },
                        error: null,
                      }),
                    })),
                  })),
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
      method: 'PATCH',
      query: { id: 'inv-1' },
      headers: {},
      body: { status: 'unserviceable', lifecycle_status: 'needs_repair', quantity_on_hand: 8 },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-parts-update');
  });

  it('deletes part record for DELETE', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'parts_inventory') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'inv-1',
                        tenant_id: 'tenant-1',
                        franchise_id: 'fr-1',
                        part_number: 'AMRO-PN-1',
                        status: 'available',
                        quantity_on_hand: 9,
                        quantity_reserved: 1,
                        warehouse_location: 'WH-A-001',
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = { method: 'DELETE', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-parts-delete');
  });

  it('returns 400 when id is missing', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when record is not found', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: { id: 'missing' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when feature flag is disabled', async () => {
    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = 'false';
    const req: ApiRequest = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('accepts feature flags "1" and "on"', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    tenant_id: 'tenant-1',
                    franchise_id: 'fr-1',
                    part_number: 'AMRO-PN-1',
                    status: 'available',
                    quantity_on_hand: 9,
                    quantity_reserved: 1,
                    warehouse_location: 'WH-A-001',
                  },
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = '1';
    let req: ApiRequest = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    let res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);

    process.env.AMRO_PARTS_REALTIME_V2_ENABLED = 'on';
    req = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('returns 405 for unsupported method', async () => {
    const req: ApiRequest = { method: 'POST', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 403 for franchise mismatch', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    tenant_id: 'tenant-1',
                    franchise_id: 'other-franchise',
                    part_number: 'AMRO-PN-1',
                    status: 'available',
                    quantity_on_hand: 9,
                    quantity_reserved: 1,
                    warehouse_location: 'WH-A-001',
                  },
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 for PATCH validation errors', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    tenant_id: 'tenant-1',
                    franchise_id: 'fr-1',
                    part_number: 'AMRO-PN-1',
                    status: 'available',
                    lifecycle_status: 'serviceable',
                    quantity_on_hand: 9,
                    quantity_reserved: 1,
                    warehouse_location: 'WH-A-001',
                  },
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'inv-1' },
      headers: {},
      body: { quantity_reserved: 99 },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toBe('Validation failed');
  });

  it('handles non-object PATCH body via fallback object parser', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_parts_mro_workflow_events') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        if (table !== 'parts_inventory') throw new Error(`Unexpected table ${table}`);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inv-1',
                      tenant_id: 'tenant-1',
                      franchise_id: 'fr-1',
                      part_number: 'AMRO-PN-1',
                      status: 'available',
                      lifecycle_status: 'serviceable',
                      quantity_on_hand: 9,
                      quantity_reserved: 1,
                      warehouse_location: 'WH-A-001',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'inv-1',
                        part_number: 'AMRO-PN-1',
                        status: 'available',
                        lifecycle_status: 'serviceable',
                        quantity_on_hand: 9,
                        quantity_reserved: 1,
                        warehouse_location: 'WH-A-001',
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        };
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'inv-1' },
      headers: {},
      body: 'bad-body' as any,
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('delegates to error handler for delete/update Supabase failures', async () => {
    const deleteFailSupabase: any = {
      from: vi.fn((table: string) => {
        if (table !== 'parts_inventory') throw new Error(`Unexpected table ${table}`);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inv-1',
                      tenant_id: 'tenant-1',
                      franchise_id: 'fr-1',
                      part_number: 'AMRO-PN-1',
                      status: 'available',
                      quantity_on_hand: 9,
                      quantity_reserved: 1,
                      warehouse_location: 'WH-A-001',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: { message: 'delete fail' } }),
            })),
          })),
        };
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(deleteFailSupabase);
    let req: ApiRequest = { method: 'DELETE', query: { id: 'inv-1' }, headers: {} };
    let res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalled();

    const updateFailSupabase: any = {
      from: vi.fn((table: string) => {
        if (table !== 'parts_inventory') throw new Error(`Unexpected table ${table}`);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inv-1',
                      tenant_id: 'tenant-1',
                      franchise_id: 'fr-1',
                      part_number: 'AMRO-PN-1',
                      status: 'available',
                      lifecycle_status: 'serviceable',
                      quantity_on_hand: 9,
                      quantity_reserved: 1,
                      warehouse_location: 'WH-A-001',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'update fail' },
                    }),
                  })),
                })),
              })),
            })),
          })),
        };
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(updateFailSupabase);
    req = { method: 'PATCH', query: { id: 'inv-1' }, headers: {}, body: { quantity_on_hand: 8 } };
    res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalled();
  });

  it('short-circuits on preflight requests', async () => {
    vi.mocked(handlePreflight).mockReturnValue(true);
    const req: ApiRequest = { method: 'OPTIONS', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('delegates to error handler on query failure', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'db read failed' },
                }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);
    const req: ApiRequest = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalled();
  });

  it('delegates to error handler on auth failure', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('auth failed'));
    const req: ApiRequest = { method: 'GET', query: { id: 'inv-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(sendErrorResponse).toHaveBeenCalled();
  });
});

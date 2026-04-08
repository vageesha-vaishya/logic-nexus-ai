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

describe('/api/v2/amro/item-master/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-item-master-id' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_ITEM_MASTER_V2_ENABLED = 'true';
  });

  it('returns detail record for GET', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_item_master') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'item-1',
                        tenant_id: 'tenant-1',
                        franchise_id: 'fr-1',
                        part_number: 'AMRO-ITEM-001',
                        status: 'active',
                        lifecycle_status: 'serviceable',
                        unit_of_measure: 'EA',
                        base_unit_of_measure: 'EA',
                        uom_conversion_factor: 1,
                        currency: 'USD',
                        is_active: true,
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'amro_item_cross_references') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === 'amro_item_uom_conversions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
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

    const req: ApiRequest = { method: 'GET', query: { id: 'item-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-item-master-detail');
  });

  it('updates record for PATCH', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_item_master') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'item-1',
                        tenant_id: 'tenant-1',
                        franchise_id: 'fr-1',
                        part_number: 'AMRO-ITEM-001',
                        status: 'active',
                        lifecycle_status: 'serviceable',
                        unit_of_measure: 'EA',
                        base_unit_of_measure: 'EA',
                        uom_conversion_factor: 1,
                        currency: 'USD',
                        is_active: true,
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
                          id: 'item-1',
                          part_number: 'AMRO-ITEM-001',
                          status: 'inactive',
                          lifecycle_status: 'retired',
                          unit_of_measure: 'EA',
                          base_unit_of_measure: 'EA',
                          uom_conversion_factor: 1,
                          currency: 'USD',
                          is_active: false,
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
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'item-1' },
      headers: {},
      body: { status: 'inactive', lifecycle_status: 'retired', is_active: false },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-item-master-update');
  });
});

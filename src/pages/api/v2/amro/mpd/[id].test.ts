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

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; textBody?: string } {
  const res: any = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
        end: (text?: string) => {
          res.textBody = text;
        },
      };
    }),
  };
  return res;
}

function mockMpdRecord() {
  return {
    id: 'mpd-1',
    tt_sequence: 1,
    code_form_no: 'MPD-001',
    ata_code: '32',
    reference_amp: 'AMP-32',
    description: 'Landing gear lubrication',
    category_code: 'LUB',
    estimated_man_hours: 1.5,
    revision_status: 'A',
    interval_hours: 300,
    interval_cycles: null,
    interval_months: null,
    is_mandatory: true,
    assembly_models: null,
    task_template_detail_json: [],
    task_template_scope_json: [],
    tenant_id: 'tenant-1',
    franchise_id: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
  };
}

describe('/api/v2/amro/mpd/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-mpd-id' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null, isPlatformAdmin: false } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_MPD_V2_ENABLED = 'true';
  });

  it('returns MPD detail for GET', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockMpdRecord(),
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = { method: 'GET', query: { id: 'mpd-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-mpd-detail');
  });

  it('updates MPD record for PATCH', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockMpdRecord(),
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
                      ...mockMpdRecord(),
                      description: 'Updated description',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'mpd-1' },
      headers: {},
      body: { description: 'Updated description' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-mpd-update');
    expect((res.jsonBody as any)?.output?.record?.description).toBe('Updated description');
  });

  it('deletes MPD record for DELETE', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockMpdRecord(),
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
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = { method: 'DELETE', query: { id: 'mpd-1' }, headers: {} };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-mpd-delete');
    expect((res.jsonBody as any)?.output?.deleted).toBe(true);
  });
});

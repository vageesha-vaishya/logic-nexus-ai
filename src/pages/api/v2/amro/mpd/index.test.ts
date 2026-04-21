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

describe('/api/v2/amro/mpd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-mpd-index' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null, isPlatformAdmin: false } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_MPD_V2_ENABLED = 'true';
  });

  it('returns paginated MPD list for GET', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({
                data: [{
                  id: 'mpd-1',
                  tt_sequence: 1,
                  code_form_no: 'MPD-001',
                  ata_code: '21',
                  reference_amp: 'AMP-21',
                  description: 'Bleed air inspection',
                  category_code: 'INSP',
                  estimated_man_hours: 4,
                  is_mandatory: true,
                  task_template_detail_json: [],
                  task_template_scope_json: [],
                  tenant_id: 'tenant-1',
                  franchise_id: null,
                  created_at: '2026-04-21T00:00:00.000Z',
                  updated_at: '2026-04-21T00:00:00.000Z',
                }],
                error: null,
                count: 1,
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

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-mpd-list');
    expect((res.jsonBody as any)?.output?.records?.[0]?.mpd_code).toBe('MPD-001');
  });

  it('creates MPD record for POST', async () => {
    const supabase: any = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'mpd-2',
                  tt_sequence: 2,
                  code_form_no: 'MPD-002',
                  ata_code: '25',
                  reference_amp: 'AMP-25',
                  description: 'Cabin oxygen check',
                  category_code: 'CHK',
                  estimated_man_hours: 2.5,
                  is_mandatory: true,
                  task_template_detail_json: [],
                  task_template_scope_json: [],
                  tenant_id: 'tenant-1',
                  franchise_id: null,
                  created_at: '2026-04-21T00:00:00.000Z',
                  updated_at: '2026-04-21T00:00:00.000Z',
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        ata_code: '25',
        description: 'Cabin oxygen check',
        reference_amp: 'AMP-25',
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('amro-mpd-create');
    expect((res.jsonBody as any)?.output?.record?.ata_code).toBe('25');
  });
});

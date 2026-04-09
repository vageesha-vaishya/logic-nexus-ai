import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './task-template-options';
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

vi.mock('../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

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
          return body;
        },
      };
    }),
  };
  return res;
}

function createSupabaseClientMock(options?: { assemblyModelsMissing?: boolean }) {
  const buildResponse = (modelColumn: string) => {
    if (options?.assemblyModelsMissing && modelColumn === 'assembly_models') {
      return { data: null, error: { message: 'column task_templates.assembly_models does not exist' } };
    }
    return {
      data: [
        {
          id: 'tt-001',
          tt_sequence: 'TT-001',
          code_form_no: 'CF-1',
          ata_code: '05-20',
          reference_amp: 'AMP-1',
          description: 'Inspection',
          category_code: 'INS',
          estimated_man_hours: 2,
          is_mandatory: true,
          task_template_detail_json: { steps: 1 },
          tenant_id: 'tenant-1',
          franchise_id: 'fr-1',
        },
      ],
      error: null,
    };
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((columnName: string) => ({
          order: vi.fn(() => {
            const response = buildResponse(columnName);
            const chain: any = {
              eq: vi.fn(() => chain),
              or: vi.fn(async () => response),
              then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(response)),
            };
            return chain;
          }),
        })),
      })),
    })),
  };
}

describe('/api/v2/amro/work-package-templates/task-template-options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-task-options' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['view_amro_dashboard'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({} as any);
  });

  it('returns task templates filtered by tenant and aircraft model', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock() as any);
    const req = {
      method: 'GET',
      query: { tenant_id: 'tenant-1', aircraft_model_id: 'amodel-1' },
      headers: {},
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.total).toBe(1);
    expect((res.jsonBody as any)?.output?.records?.[0]?.tt_sequence).toBe('TT-001');
    expect(res.headers['Cache-Control']).toBe('private, max-age=60');
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalled();
  });

  it('falls back to model_id when assembly_models column does not exist', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock({ assemblyModelsMissing: true }) as any);
    const req = {
      method: 'GET',
      query: { tenant_id: 'tenant-1', aircraft_model_id: 'amodel-1' },
      headers: {},
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records?.[0]?.id).toBe('tt-001');
  });
});

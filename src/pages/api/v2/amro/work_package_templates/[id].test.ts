import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './[id]';
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
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

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

vi.mock('../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
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

function createSupabaseClientMock(options?: {
  templateExists?: boolean;
  taskTemplateRows?: Array<Record<string, unknown>>;
  rpcError?: string;
  rpcData?: Record<string, unknown>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'work_package_templates') {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({
            data: options?.templateExists === false ? null : { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
            error: null,
          })),
        };
        return chain;
      }
      if (table === 'task_templates') {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          in: vi.fn(async () => ({
            data: options?.taskTemplateRows ?? [{ id: '11111111-1111-4111-8111-111111111111' }],
            error: null,
          })),
        };
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn(async () => {
      if (options?.rpcError) {
        return { data: null, error: { message: options.rpcError } };
      }
      return {
        data: options?.rpcData ?? { record: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' }, updated_relationships: [] },
        error: null,
      };
    }),
  };
}

describe('/api/v2/amro/work_package_templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-wpt-update',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000001',
      role: 'tenant_admin',
      permissions: ['edit_aircraft_records'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      tenantId: '157b8d12-c115-446e-a4dc-d12077751fe2',
      franchiseId: 'e4c0f3cb-a9e3-4e5e-911d-f34820326b9b',
    } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({} as any);
  });

  it('updates template via atomic RPC and returns 200', async () => {
    const supabase = createSupabaseClientMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: {
        task_templates: [{ task_template_id: '11111111-1111-4111-8111-111111111111', sequence_order: 1, metadata: { source: 'ui' } }],
      },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.record?.id).toBe('210210d3-7ebc-4cfe-b6c9-bd873afbdb30');
    expect((supabase.rpc as any).mock.calls[0][0]).toBe('amro_update_work_package_template_atomic');
    expect((supabase.rpc as any).mock.calls[0][1]?.p_payload?.tasks_json?.[0]?.sequence_order).toBe(1);
    expect((supabase.rpc as any).mock.calls[0][1]?.p_payload?.task_templates).toBeUndefined();
  });

  it('returns 400 when task_templates payload is invalid', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock() as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: { task_templates: 'invalid' },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('task_templates must be an array');
  });

  it('returns 404 when template does not exist', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock({ templateExists: false }) as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: { task_templates: [] },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when a task template id is missing in task_templates table', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock({ taskTemplateRows: [] }) as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: { task_templates: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }] },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toContain('task_template_id not found');
  });

  it('returns 500 and rollback message when atomic transaction fails', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock({ rpcError: 'insert failed: constraint violation' }) as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: { task_templates: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }] },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect((res.jsonBody as any)?.error).toContain('rolled back');
  });

  it('returns 500 for concurrent update transaction conflict', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock({ rpcError: 'could not serialize access due to concurrent update' }) as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: { task_templates: [{ task_template_id: '11111111-1111-4111-8111-111111111111' }] },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect((res.jsonBody as any)?.error).toContain('concurrent update');
  });

  it('applies compatibility headers hook and security middleware', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(createSupabaseClientMock() as any);
    const req = {
      method: 'PATCH',
      query: { id: '210210d3-7ebc-4cfe-b6c9-bd873afbdb30' },
      headers: {},
      body: { task_templates: [] },
    } as unknown as ApiRequest;
    const res = createResponse();

    await handler(req, res);

    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
  });
});

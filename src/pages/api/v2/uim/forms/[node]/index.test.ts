import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './index';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  buildApiContext,
  handlePreflight,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { resolveUimFormAccess } from '../_shared';

vi.mock('../../../../_utils/http', () => ({
  applyCors: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
}));

vi.mock('../../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../_shared', async () => {
  const actual = await vi.importActual<object>('../_shared');
  return {
    ...actual,
    resolveUimFormAccess: vi.fn(),
  };
});

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
      };
    }),
  };
  return res;
}

describe('/api/v2/uim/forms/[node]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-uim-forms-node',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
    } as any);
    vi.mocked(resolveUimFormAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('creates a form record on POST', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'UIM' }, created_at: 'now', updated_at: 'now' },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ limit });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { node: 'overview' },
      headers: {},
      body: { module_name: 'UIM' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('lists form records on GET', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [{ id: 'rec-1', node_key: 'overview' }],
      error: null,
      count: 1,
    });
    const order = vi.fn().mockReturnValue({ range });
    const isDeleted = vi.fn().mockReturnValue({ order });
    const eqNode = vi.fn().mockReturnValue({ is: isDeleted });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqNode });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'overview', limit: '10', offset: '0' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records?.length).toBe(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown node', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'unknown' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.code).toBe('UIM_FORM_NODE_NOT_FOUND');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns storage-not-ready code when table does not exist', async () => {
    const range = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation "uim_form_records" does not exist' },
      count: 0,
    });
    const order = vi.fn().mockReturnValue({ range });
    const isDeleted = vi.fn().mockReturnValue({ order });
    const eqNode = vi.fn().mockReturnValue({ is: isDeleted });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqNode });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'overview' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect((res.jsonBody as any)?.code).toBe('UIM_FORM_STORAGE_NOT_READY');
  });
});

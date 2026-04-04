import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './[id]';
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

describe('/api/v2/uim/forms/[node]/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-uim-forms-node-id',
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

  it('updates a form record on PATCH', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'Old' } },
      error: null,
    });
    const existingLimit = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle });
    const existingIs = vi.fn().mockReturnValue({ limit: existingLimit });
    const existingEqId = vi.fn().mockReturnValue({ is: existingIs });
    const existingEqNode = vi.fn().mockReturnValue({ eq: existingEqId });
    const existingEqTenant = vi.fn().mockReturnValue({ eq: existingEqNode });
    const existingSelect = vi.fn().mockReturnValue({ eq: existingEqTenant });

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'New' } },
      error: null,
    });
    const updateLimit = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqId = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqNode = vi.fn().mockReturnValue({ eq: updateEqId });
    const updateEqTenant = vi.fn().mockReturnValue({ eq: updateEqNode });
    const update = vi.fn().mockReturnValue({ eq: updateEqTenant });

    const from = vi.fn().mockReturnValue({ select: existingSelect, update });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { node: 'overview', id: 'rec-1' },
      headers: {},
      body: { module_name: 'New' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('soft deletes a form record on DELETE', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'Old' } },
      error: null,
    });
    const existingLimit = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle });
    const existingIs = vi.fn().mockReturnValue({ limit: existingLimit });
    const existingEqId = vi.fn().mockReturnValue({ is: existingIs });
    const existingEqNode = vi.fn().mockReturnValue({ eq: existingEqId });
    const existingEqTenant = vi.fn().mockReturnValue({ eq: existingEqNode });
    const existingSelect = vi.fn().mockReturnValue({ eq: existingEqTenant });

    const deleteEqId = vi.fn().mockResolvedValue({ error: null });
    const deleteEqNode = vi.fn().mockReturnValue({ eq: deleteEqId });
    const deleteEqTenant = vi.fn().mockReturnValue({ eq: deleteEqNode });
    const update = vi.fn().mockReturnValue({ eq: deleteEqTenant });

    const from = vi.fn().mockReturnValue({ select: existingSelect, update });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'DELETE',
      query: { node: 'overview', id: 'rec-1' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});

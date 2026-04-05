import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './qa-signoff';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { resolveUimAccess } from '../_shared';
import { resetUimQaSignoffStore } from '@/modules/uim/analytics/reconciliationSignoffStore';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-analytics-qa-signoff' })),
    enforceHttps: vi.fn(),
    enforceRateLimit: vi.fn(),
    handlePreflight: vi.fn(() => false),
  };
});

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../_shared', async () => {
  const actual = await vi.importActual<object>('../_shared');
  return {
    ...actual,
    resolveUimAccess: vi.fn(),
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

describe('/api/v2/uim/analytics/qa-signoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUimQaSignoffStore();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('creates and returns QA sign-off records', async () => {
    const postReq: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        signed_off_by: 'qa.lead@example.com',
        signed_off_role: 'qa_lead',
        reconciliation_verified: true,
        latency_target_met: true,
        data_dictionary_published: true,
        bi_cube_deployed: true,
        notes: 'Phase 4 QA sign-off',
      },
    };
    const postRes = createResponse();
    await handler(postReq, postRes);
    expect(postRes.statusCode).toBe(200);
    expect((postRes.jsonBody as any)?.output?.signoff?.signoff_status).toBe('signed_off');

    const getReq: ApiRequest = {
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const getRes = createResponse();
    await handler(getReq, getRes);
    expect(getRes.statusCode).toBe(200);
    expect((getRes.jsonBody as any)?.output?.records?.length).toBe(1);
    expect((getRes.jsonBody as any)?.output?.latest?.signed_off_by).toBe('qa.lead@example.com');
  });
});

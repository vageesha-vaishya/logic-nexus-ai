import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './rest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { resolveUimAccess } from '../_shared';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-rest-hardening' })),
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

describe('/api/v2/uim/integrations/rest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('returns rest hardening audit summary', async () => {
    const req: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        interface: 'rest-hardening-audit',
        expected_p95_ms: 300,
        observed_p95_ms: 240,
        expected_availability_percent: 99.9,
        observed_availability_percent: 99.95,
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.sla?.error_budget_status).toBe('within_budget');
  });
});

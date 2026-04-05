import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './webhooks';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { resolveUimAccess } from './_shared';

vi.mock('../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-webhooks' })),
    enforceHttps: vi.fn(),
    enforceRateLimit: vi.fn(),
    handlePreflight: vi.fn(() => false),
  };
});

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('./_shared', async () => {
  const actual = await vi.importActual<object>('./_shared');
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

describe('/api/v2/uim/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('registers adapter and dispatches subscribed event', async () => {
    const registerReq: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        action: 'register-adapter',
        adapter_id: 'adapter-1',
        provider: 'amro',
        target_url: 'https://example.com/hook',
        secret_ref: 'vault://uim/adapter-1',
        subscribed_events: ['uim.command.applied.v1'],
      },
    };
    const registerRes = createResponse();
    await handler(registerReq, registerRes);
    expect(registerRes.statusCode).toBe(200);

    const dispatchReq: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        action: 'dispatch-event',
        adapter_id: 'adapter-1',
        event_type: 'uim.command.applied.v1',
        payload: { command_id: 'cmd-1' },
      },
    };
    const dispatchRes = createResponse();
    await handler(dispatchReq, dispatchRes);
    expect(dispatchRes.statusCode).toBe(200);
    expect((dispatchRes.jsonBody as any)?.output?.status).toBe('queued');
  });
});

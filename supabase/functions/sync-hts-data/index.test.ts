import { beforeEach, describe, expect, it, vi } from 'vitest';

type EdgeHandler = (req: Request, logger: any, supabaseAdmin: any) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireServiceRoleOrAdminMock = vi.fn();

vi.mock('../_shared/logger.ts', () => ({
  serveWithLogger: (handler: EdgeHandler) => {
    capturedHandler = handler;
  },
}));

vi.mock('../_shared/cors.ts', () => ({
  getCorsHeaders: () => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }),
}));

vi.mock('../_shared/auth.ts', () => ({
  requireServiceRoleOrAdmin: requireServiceRoleOrAdminMock,
}));

const loggerMock = () => ({
  info: vi.fn(async () => undefined),
  error: vi.fn(async () => undefined),
});

describe('sync-hts-data authorization', () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireServiceRoleOrAdminMock.mockReset();
    vi.resetModules();
    await import('./index.ts');
  });

  it('returns auth error from shared policy', async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: false,
      status: 403,
      error: 'Forbidden: platform_admin role required',
      user: null,
      isServiceRole: false,
    });

    const res = await handler(
      new Request('https://example.com/sync-hts-data', { method: 'POST' }),
      loggerMock(),
      {},
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toContain('platform_admin');
  });

  it('allows authorized GET health check', async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: true,
      status: 200,
      error: null,
      user: { id: 'user-1', email: 'admin@example.com' },
      isServiceRole: false,
    });

    const res = await handler(
      new Request('https://example.com/sync-hts-data', { method: 'GET' }),
      loggerMock(),
      {},
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('online');
  });
});

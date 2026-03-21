import { beforeEach, describe, expect, it, vi } from 'vitest';

type EdgeHandler = (req: Request, logger: any, supabaseAdmin: any) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
let envState: Record<string, string | undefined> = {};

vi.mock('../_shared/logger.ts', () => ({
  Logger: class {},
  serveWithLogger: (handler: EdgeHandler) => {
    capturedHandler = handler;
  },
}));

(globalThis as any).Deno = {
  env: {
    get: vi.fn((key: string) => envState[key]),
  },
};

const createSupabaseAdminMock = () => {
  const createUser = vi.fn(async () => ({
    data: { user: { id: 'user-seeded-1' } },
    error: null,
  }));

  const updateUserById = vi.fn(async () => ({ error: null }));
  const listUsers = vi.fn(async () => ({ data: { users: [] }, error: null }));

  const profilesApi = {
    upsert: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => ({
      ilike: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
  };

  const userRolesApi = {
    upsert: vi.fn(async () => ({ error: null })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  };

  const from = vi.fn((table: string) => {
    if (table === 'profiles') return profilesApi;
    if (table === 'user_roles') return userRolesApi;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    auth: {
      admin: {
        createUser,
        updateUserById,
        listUsers,
      },
    },
    from,
  };
};

const loggerMock = () => ({
  info: vi.fn(async () => undefined),
  error: vi.fn(async () => undefined),
});

describe('seed-platform-admin edge authorization', () => {
  beforeEach(async () => {
    capturedHandler = null;
    envState = {
      NODE_ENV: 'production',
      ENVIRONMENT: 'production',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key-1',
      SEED_PLATFORM_ADMIN_BOOTSTRAP_KEY: 'bootstrap-key-1',
      SEED_PLATFORM_ADMIN_ENABLED: 'false',
    };
    vi.clearAllMocks();
    vi.resetModules();
    await import('./index.ts');
  });

  it('rejects non-POST requests', async () => {
    const handler = capturedHandler as EdgeHandler;
    const res = await handler(new Request('https://example.com/seed', { method: 'GET' }), loggerMock(), createSupabaseAdminMock());
    const body = await res.json();
    expect(res.status).toBe(405);
    expect(body.error).toContain('Method not allowed');
  });

  it('rejects unauthorized bootstrap requests', async () => {
    const handler = capturedHandler as EdgeHandler;
    const req = new Request('https://example.com/seed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'StrongPass#123' }),
    });
    const res = await handler(req, loggerMock(), createSupabaseAdminMock());
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toContain('bootstrap authorization required');
  });

  it('rejects production requests when seed enablement flag is off', async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabaseAdmin = createSupabaseAdminMock();
    const req = new Request('https://example.com/seed', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer service-key-1',
        'x-bootstrap-key': 'bootstrap-key-1',
      },
      body: JSON.stringify({ email: 'Admin@Example.com', password: 'StrongPass#123' }),
    });
    const res = await handler(req, loggerMock(), supabaseAdmin);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toContain('bootstrap authorization required');
  });

  it('rejects production requests with bootstrap key only', async () => {
    const handler = capturedHandler as EdgeHandler;
    envState.SEED_PLATFORM_ADMIN_ENABLED = 'true';
    const req = new Request('https://example.com/seed', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bootstrap-key': 'bootstrap-key-1',
      },
      body: JSON.stringify({ email: 'admin@example.com', password: 'StrongPass#123' }),
    });
    const res = await handler(req, loggerMock(), createSupabaseAdminMock());
    expect(res.status).toBe(403);
  });

  it('allows production requests with service role and seed enablement', async () => {
    const handler = capturedHandler as EdgeHandler;
    envState.SEED_PLATFORM_ADMIN_ENABLED = 'true';
    const supabaseAdmin = createSupabaseAdminMock();
    const req = new Request('https://example.com/seed', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer service-key-1',
      },
      body: JSON.stringify({ email: 'Admin@Example.com', password: 'StrongPass#123' }),
    });
    const res = await handler(req, loggerMock(), supabaseAdmin);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        password: 'StrongPass#123',
      }),
    );
  });
});

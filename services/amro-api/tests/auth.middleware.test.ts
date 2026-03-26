import type { NextFunction, Request, Response } from 'express';

const mockGetUser = jest.fn();
const mockRoleLookup = jest.fn();
const mockFranchiseLookup = jest.fn();
const mockProfileLookup = jest.fn();
const mockPreferenceLookup = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: jest.fn((table: string) => {
      if (table === 'user_roles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(async () => mockRoleLookup()),
        };
      }
      if (table === 'franchises') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => mockFranchiseLookup()),
        };
      }
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => mockProfileLookup()),
        };
      }
      if (table === 'user_preferences') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => mockPreferenceLookup()),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    }),
  })),
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    mockRoleLookup.mockReturnValue({ data: [], error: null });
    mockFranchiseLookup.mockReturnValue({ data: [], error: null });
    mockProfileLookup.mockReturnValue({ data: null, error: null });
    mockPreferenceLookup.mockReturnValue({ data: null, error: null });
  });

  function createResponse(): Response {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
  }

  function createRequest(
    headers: Record<string, string> = {},
    query: Record<string, unknown> = {},
  ): Request {
    return {
      headers,
      query,
      header: (name: string) => {
        const key = name.toLowerCase();
        return headers[key] || headers[name] || undefined;
      },
    } as unknown as Request;
  }

  it('returns 401 for missing token', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MISSING_TOKEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });
    const req = createRequest({ authorization: 'Bearer bad-token' });
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts lowercase bearer authorization scheme', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'u@example.com', app_metadata: {}, user_metadata: {} } },
      error: null,
    });
    mockRoleLookup.mockReturnValueOnce({
      data: [{ role: 'tenant_admin', tenant_id: 'tenant-1', franchise_id: null }],
      error: null,
    });
    const req = createRequest({ authorization: 'bearer ok-token' });
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('ok-token');
    expect((req as any).tenantId).toBe('tenant-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses query access_token when authorization scheme is unsupported', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'u@example.com', app_metadata: {}, user_metadata: {} } },
      error: null,
    });
    mockRoleLookup.mockReturnValueOnce({
      data: [{ role: 'tenant_admin', tenant_id: 'tenant-1', franchise_id: null }],
      error: null,
    });
    const req = createRequest(
      { authorization: 'Basic ZGVtbzpkZW1v' },
      { access_token: 'query-token' },
    );
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('query-token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when user has no tenant assignment', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', app_metadata: {}, user_metadata: {} } },
      error: null,
    });
    const req = createRequest({ authorization: 'Bearer ok-token' });
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_TENANT_ASSIGNMENT' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('sets context and calls next for valid token', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'u@example.com', app_metadata: {}, user_metadata: {} } },
      error: null,
    });
    mockRoleLookup.mockReturnValueOnce({
      data: [{ role: 'tenant_admin', tenant_id: 'tenant-1', franchise_id: null }],
      error: null,
    });
    const req = createRequest({ authorization: 'Bearer ok-token' });
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect((req as any).tenantId).toBe('tenant-1');
    expect((req as any).userId).toBe('user-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues with metadata tenant when user_roles lookup table is unavailable', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { tenant_id: 'tenant-meta' },
          user_metadata: {},
        },
      },
      error: null,
    });
    mockRoleLookup.mockReturnValueOnce({
      data: null,
      error: { code: '42P01', message: 'relation "user_roles" does not exist' },
    });
    const req = createRequest({ authorization: 'Bearer ok-token' });
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect((req as any).tenantId).toBe('tenant-meta');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('returns 500 when middleware throws', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockRejectedValueOnce(new Error('network'));
    const req = createRequest({ authorization: 'Bearer ok-token' });
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_ERROR' }));
  });
});

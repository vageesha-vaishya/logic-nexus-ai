import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockRoleLookup = vi.fn();
const mockFranchiseLookup = vi.fn();
const mockProfileLookup = vi.fn();
const mockPreferenceLookup = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn((table: string) => {
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => mockRoleLookup()),
        };
      }
      if (table === 'franchises') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn(async () => mockFranchiseLookup()),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => mockProfileLookup()),
        };
      }
      if (table === 'user_preferences') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => mockPreferenceLookup()),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }),
  })),
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    mockRoleLookup.mockReturnValue({ data: [], error: null });
    mockFranchiseLookup.mockReturnValue({ data: [], error: null });
    mockProfileLookup.mockReturnValue({ data: null, error: null });
    mockPreferenceLookup.mockReturnValue({ data: null, error: null });
  });

  function createResponse(): Response {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
  }

  it('returns 401 for missing token', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    const req = { headers: {}, query: {} } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MISSING_TOKEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });
    const req = { headers: { authorization: 'Bearer bad-token' }, query: {} } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user has no tenant assignment', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', app_metadata: {}, user_metadata: {} } },
      error: null,
    });
    const req = { headers: { authorization: 'Bearer ok-token' }, query: {} } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

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
    const req = { headers: { authorization: 'Bearer ok-token' }, query: {} } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req as any, res, next);

    expect((req as any).tenantId).toBe('tenant-1');
    expect((req as any).userId).toBe('user-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when middleware throws', async () => {
    const { authMiddleware } = await import('../src/middleware/auth.middleware');
    mockGetUser.mockRejectedValueOnce(new Error('network'));
    const req = { headers: { authorization: 'Bearer ok-token' }, query: {} } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_ERROR' }));
  });
});

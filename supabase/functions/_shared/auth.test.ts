
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireAuth } from './auth.ts';

// Mock Deno global
const originalDeno = (globalThis as any).Deno;
(globalThis as any).Deno = {
  env: {
    get: vi.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'test-anon-key';
      return undefined;
    }),
  },
};

// Mock supabase-js
const mockGetUser = vi.fn();
const mockGetClaims = vi.fn();
const mockCreateClient = vi.fn((...args: any[]) => ({
  auth: {
    getUser: mockGetUser,
    getClaims: mockGetClaims,
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-123', email: 'test@example.com' } }, error: null });
  });

  afterEach(() => {
    // (globalThis as any).Deno = originalDeno; // Restore if needed, but we're in a test file
  });

  it('should return user when token is valid', async () => {
    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const result = await requireAuth(req);

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      { global: { headers: { Authorization: 'Bearer valid-token' } } }
    );
    expect(mockGetClaims).toHaveBeenCalledWith('valid-token');
    expect(result.user).toEqual(expect.objectContaining({ id: 'user-123' }));
    expect(result.error).toBeNull();
  });

  it('should fallback to getUser when getClaims fails', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { message: 'Claims validation failed' } });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-fallback', email: 'fallback@example.com' } }, error: null });

    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const result = await requireAuth(req);

    expect(mockGetClaims).toHaveBeenCalledWith('invalid-token');
    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    expect(result.user).toEqual(expect.objectContaining({ id: 'user-fallback' }));
    expect(result.error).toBeNull();
  });

  it('should return error when getClaims and getUser both fail', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { message: 'Claims validation failed' } });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });

    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const result = await requireAuth(req);

    expect(result.user).toBeNull();
    expect(result.error).toBe('Invalid token');
  });

  it('should handle missing Authorization header', async () => {
    const req = new Request('https://api.example.com');
    const result = await requireAuth(req);

    expect(result.user).toBeNull();
    expect(result.error).toBe('Missing Authorization header');
  });

  it('should reject non-bearer authorization format', async () => {
    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'invalid-token' },
    });

    const result = await requireAuth(req);
    expect(result.user).toBeNull();
    expect(result.error).toBe('Invalid Authorization header format');
  });

  it('should use SUPABASE_PUBLISHABLE_KEY when SUPABASE_ANON_KEY is missing', async () => {
    (globalThis as any).Deno.env.get = vi.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return undefined;
      if (key === 'SUPABASE_PUBLISHABLE_KEY') return 'test-publishable-key';
      return undefined;
    });
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-abc' } }, error: null });

    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const result = await requireAuth(req);
    expect(result.error).toBeNull();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-publishable-key',
      { global: { headers: { Authorization: 'Bearer valid-token' } } }
    );
  });
});

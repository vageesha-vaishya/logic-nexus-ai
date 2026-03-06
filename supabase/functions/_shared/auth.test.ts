
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
const mockCreateClient = vi.fn((...args: any[]) => ({
  auth: {
    getUser: mockGetUser,
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // (globalThis as any).Deno = originalDeno; // Restore if needed, but we're in a test file
  });

  it('should return user when token is valid', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const result = await requireAuth(req);

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      { global: { headers: { Authorization: 'Bearer valid-token' } } }
    );
    expect(mockGetUser).toHaveBeenCalledWith('valid-token');
    expect(result.user).toEqual(expect.objectContaining({ id: 'user-123' }));
    expect(result.error).toBeNull();
  });

  it('should return error when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });

    const req = new Request('https://api.example.com', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const result = await requireAuth(req);

    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    expect(result.user).toBeNull();
    expect(result.error).toBe('Invalid token');
  });

  it('should handle missing Authorization header', async () => {
    const req = new Request('https://api.example.com');
    const result = await requireAuth(req);

    expect(result.user).toBeNull();
    expect(result.error).toBe('Missing Authorization header');
  });

  it('should use SUPABASE_PUBLISHABLE_KEY when SUPABASE_ANON_KEY is missing', async () => {
    (globalThis as any).Deno.env.get = vi.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return undefined;
      if (key === 'SUPABASE_PUBLISHABLE_KEY') return 'test-publishable-key';
      return undefined;
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-abc' } }, error: null });

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

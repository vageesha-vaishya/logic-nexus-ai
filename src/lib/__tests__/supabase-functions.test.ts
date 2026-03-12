import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invokeAnonymous, invokeFunction } from '../supabase-functions';
import { supabase } from '@/integrations/supabase/client';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

describe('invokeFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: 'existing-token' } },
      error: null,
    });
    (supabase.auth.refreshSession as any).mockResolvedValue({
      data: { session: { access_token: 'refreshed-token' } },
      error: null,
    });
  });

  it('should return data on successful first attempt', async () => {
    const mockData = { success: true };
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: mockData, error: null });

    const result = await invokeFunction('test-func', { body: { foo: 'bar' } });

    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    const invokeCall = (supabase.functions.invoke as any).mock.calls[0];
    expect(invokeCall[0]).toBe('test-func');
    expect(invokeCall[1]).toMatchObject({
      body: { foo: 'bar' },
      headers: { Authorization: 'Bearer existing-token' },
      method: 'POST',
    });
    expect(invokeCall[1].body.trace_id).toBeTruthy();
    expect(invokeCall[1].body.idempotency_key).toBeTruthy();
  });

  it('should retry on 401 error and succeed if refresh works', async () => {
    const error401 = { context: { status: 401 }, message: 'Unauthorized' };
    const mockData = { success: true };

    // First call fails with 401
    (supabase.functions.invoke as any)
      .mockResolvedValueOnce({ data: null, error: error401 })
      // Second call succeeds
      .mockResolvedValueOnce({ data: mockData, error: null });

    // Refresh succeeds
    (supabase.auth.refreshSession as any).mockResolvedValueOnce({
      data: { session: { access_token: 'new-token' } },
      error: null,
    });

    const result = await invokeFunction('test-func');

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    
    // Check second call arguments
    const secondCallArgs = (supabase.functions.invoke as any).mock.calls[1];
    expect(secondCallArgs[0]).toBe('test-func');
    expect(secondCallArgs[1].headers).toMatchObject({
      Authorization: 'Bearer new-token',
    });
    expect(secondCallArgs[1].headers.apikey).toBeTruthy();
    
    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
  });

  it('should return session expired error if refresh fails', async () => {
    const error401 = { context: { status: 401 }, message: 'Unauthorized' };

    // First call fails with 401
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: error401 });

    // Refresh fails
    (supabase.auth.refreshSession as any).mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Refresh failed' },
    });

    const result = await invokeFunction('test-func');

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(result.data).toBeNull();
    expect((result.error as any)?.status).toBe(401);
    expect(String((result.error as any)?.message || '')).toMatch(/no active Supabase user session/i);
  });

  it('should remove manual Authorization header to prevent stale tokens', async () => {
    const mockData = { success: true };
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: mockData, error: null });

    const options = { 
      headers: { 
        'Authorization': 'Bearer old-token',
        'Content-Type': 'application/json'
      },
      body: { foo: 'bar' }
    };

    await invokeFunction('test-func', options);

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    const callArgs = (supabase.functions.invoke as any).mock.calls[0];
    const calledOptions = callArgs[1];
    
    expect(calledOptions.headers['Authorization']).toBe('Bearer existing-token');
    expect(calledOptions.headers['Content-Type']).toBe('application/json');
  });

  it('should return original error if not 401', async () => {
    const error500 = { context: { status: 500 }, message: 'Server Error' };

    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: error500 });

    const result = await invokeFunction('test-func');

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    expect(result.error).toEqual(error500);
  });

  it('should attach issues from JSON error responses', async () => {
    const error400: any = {
      context: {
        status: 400,
        bodyUsed: false,
        text: async () => JSON.stringify({ error: 'PDF pre-render validation failed', issues: ['Missing commodity'] }),
      },
      message: 'Bad Request',
    };

    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: error400 });

    const result = await invokeFunction('test-func');

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(String((result.error as any).message)).toMatch(/PDF pre-render validation failed/);
    expect(Array.isArray((result.error as any).issues)).toBe(true);
    expect((result.error as any).issues).toEqual(['Missing commodity']);
  });
});

describe('invokeAnonymous', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attach apikey and Authorization headers when invoking anonymously', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    } as any);

    await invokeAnonymous('public-func', { ping: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    const options = call[1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers.apikey).toBeTruthy();
    expect(headers.Authorization).toBeUndefined();
    fetchSpy.mockRestore();
  });
});

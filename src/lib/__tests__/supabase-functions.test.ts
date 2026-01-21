import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invokeFunction } from '../supabase-functions';
import { supabase } from '@/integrations/supabase/client';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      refreshSession: vi.fn(),
    },
  },
}));

describe('invokeFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data on successful first attempt', async () => {
    const mockData = { success: true };
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: mockData, error: null });

    const result = await invokeFunction('test-func', { body: { foo: 'bar' } });

    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('test-func', { 
      body: { foo: 'bar' },
      headers: {},
      method: 'POST'
    });
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
    expect(secondCallArgs[1].headers).toEqual({
      Authorization: 'Bearer new-token'
    });
    
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
    expect(result.error).toEqual(error401);
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
    
    expect(calledOptions.headers['Authorization']).toBeUndefined();
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
});

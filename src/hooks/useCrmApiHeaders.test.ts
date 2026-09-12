import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrmApiHeaders } from './useCrmApiHeaders';

const getSession = vi.fn();
let mockContext: { tenantId?: string; franchiseId?: string; userId?: string } = {
  tenantId: 'tenant-1',
  franchiseId: 'franchise-1',
  userId: 'user-1',
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { auth: { getSession } },
    context: mockContext,
  }),
}));

describe('useCrmApiHeaders', () => {
  it('builds headers from the session token and context', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    const { result } = renderHook(() => useCrmApiHeaders());

    const headers = await result.current();

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-123',
      'x-tenant-id': 'tenant-1',
      'x-franchise-id': 'franchise-1',
      'x-user-id': 'user-1',
    });
  });

  it('omits Authorization when there is no session token', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useCrmApiHeaders());

    const headers = await result.current();

    expect(headers.Authorization).toBeUndefined();
  });

  it('omits x-franchise-id when context has none', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    mockContext = { tenantId: 'tenant-1', userId: 'user-1' };
    const { result } = renderHook(() => useCrmApiHeaders());

    const headers = await result.current();

    expect(headers['x-franchise-id']).toBeUndefined();
    mockContext = { tenantId: 'tenant-1', franchiseId: 'franchise-1', userId: 'user-1' };
  });

  it('lets a per-call tenantId override win over context.tenantId', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    const { result } = renderHook(() => useCrmApiHeaders());

    const headers = await result.current({ tenantId: 'other-tenant' });

    expect(headers['x-tenant-id']).toBe('other-tenant');
  });

  it('lets a per-call franchiseId override win over context.franchiseId', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    const { result } = renderHook(() => useCrmApiHeaders());

    const headers = await result.current({ franchiseId: 'other-franchise' });

    expect(headers['x-franchise-id']).toBe('other-franchise');
  });
});

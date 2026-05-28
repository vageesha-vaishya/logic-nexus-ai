import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useCoreDomainAccess, useCoreModuleAccess } from './useCoreAccess';
import * as authHooks from './useAuth';
import * as membershipHooks from './useMemberships';
import { supabase } from '@/integrations/supabase/client';

vi.mock('./useAuth');
vi.mock('./useMemberships');

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: vi.fn(),
  },
}));

function wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const TENANT  = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-0000000000aa';

describe('useCoreDomainAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({ user: { id: USER_ID } } as any);
  });

  it('returns allowed=null without invoking the RPC when domainCode is empty', () => {
    const rpc = vi.fn();
    vi.mocked(supabase.schema).mockReturnValue({ rpc } as any);

    const { result } = renderHook(() => useCoreDomainAccess(''), { wrapper: wrap });

    expect(result.current.allowed).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('invokes core.user_has_domain_access with normalised code and returns boolean', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.mocked(supabase.schema).mockReturnValue({ rpc } as any);

    const { result } = renderHook(() => useCoreDomainAccess('  amro '), { wrapper: wrap });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(supabase.schema).toHaveBeenCalledWith('core');
    expect(rpc).toHaveBeenCalledWith('user_has_domain_access', {
      p_user_id:     USER_ID,
      p_domain_code: 'AMRO',
    });
    expect(result.current.allowed).toBe(true);
  });

  it('returns allowed=null when no user is signed in', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({ user: null } as any);
    const rpc = vi.fn();
    vi.mocked(supabase.schema).mockReturnValue({ rpc } as any);

    const { result } = renderHook(() => useCoreDomainAccess('AMRO'), { wrapper: wrap });

    expect(result.current.allowed).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('useCoreModuleAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(membershipHooks.useMemberships).mockReturnValue({
      activeMembership: { tenant_id: TENANT } as any,
      isLoading: false,
    } as any);
  });

  it('returns allowed=null without an active membership tenant', () => {
    vi.mocked(membershipHooks.useMemberships).mockReturnValue({
      activeMembership: null,
      isLoading: false,
    } as any);
    const rpc = vi.fn();
    vi.mocked(supabase.schema).mockReturnValue({ rpc } as any);

    const { result } = renderHook(() => useCoreModuleAccess('logistics'), { wrapper: wrap });

    expect(result.current.allowed).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('invokes core.has_module_access with tenant + code + action', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    vi.mocked(supabase.schema).mockReturnValue({ rpc } as any);

    const { result } = renderHook(() => useCoreModuleAccess('amro', 'write'), { wrapper: wrap });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpc).toHaveBeenCalledWith('has_module_access', {
      p_tenant_id:   TENANT,
      p_module_code: 'amro',
      p_action:      'write',
    });
    expect(result.current.allowed).toBe(false);
  });

  it('propagates RPC errors as thrown errors from useQuery', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } });
    vi.mocked(supabase.schema).mockReturnValue({ rpc } as any);

    const { result } = renderHook(() => useCoreModuleAccess('logistics'), { wrapper: wrap });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // On error react-query leaves data undefined → hook returns null.
    expect(result.current.allowed).toBeNull();
  });
});

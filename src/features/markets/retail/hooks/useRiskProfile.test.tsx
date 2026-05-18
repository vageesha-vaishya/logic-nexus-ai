import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { schema: vi.fn() },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, roles: [] }),
}));

import { supabase } from '@/integrations/supabase/client';
import { useRiskProfile, useUpsertRiskProfile } from './useRiskProfile';

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  experience_level: 'beginner' as const,
  risk_tag: 'conservative' as const,
  goals: [],
  behavioral_flags: {},
  quiz_answers: {},
  onboarding_complete: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function wireSchemaMock(opts: {
  maybeSingle?: { data: unknown; error: unknown };
  upsertSingle?: { data: unknown; error: unknown };
}) {
  const maybeSingle = vi.fn().mockResolvedValue(opts.maybeSingle ?? { data: null, error: null });
  const eq          = vi.fn().mockReturnValue({ maybeSingle });
  const select      = vi.fn().mockReturnValue({ eq });

  const upsertSingleFn = vi.fn().mockResolvedValue(opts.upsertSingle ?? { data: null, error: null });
  const upsertSelect   = vi.fn().mockReturnValue({ single: upsertSingleFn });
  const upsert         = vi.fn().mockReturnValue({ select: upsertSelect });

  const from = vi.fn().mockReturnValue({ select, upsert });
  (supabase.schema as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { maybeSingle, eq, select, from, upsert, upsertSingleFn };
}

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useRiskProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the profile row and exposes hasOnboarded', async () => {
    wireSchemaMock({ maybeSingle: { data: mockProfile, error: null } });

    const { result } = renderHook(() => useRiskProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.experience_level).toBe('beginner');
    expect(result.current.hasOnboarded).toBe(false);
  });

  it('returns null when no profile exists and hasOnboarded is false', async () => {
    wireSchemaMock({ maybeSingle: { data: null, error: null } });

    const { result } = renderHook(() => useRiskProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.hasOnboarded).toBe(false);
  });

  it('throws when supabase returns an error', async () => {
    wireSchemaMock({ maybeSingle: { data: null, error: { message: 'boom' } } });

    const { result } = renderHook(() => useRiskProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpsertRiskProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts and resolves to the saved row', async () => {
    const saved = { ...mockProfile, onboarding_complete: true };
    const mocks = wireSchemaMock({ upsertSingle: { data: saved, error: null } });

    const { result } = renderHook(() => useUpsertRiskProfile(), { wrapper: createWrapper() });

    const returned = await result.current.mutateAsync({
      experience_level: 'beginner',
      risk_tag: 'conservative',
      goals: [],
      onboarding_complete: true,
    });

    expect(returned).toEqual(saved);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', onboarding_complete: true }),
      { onConflict: 'user_id' },
    );
  });
});

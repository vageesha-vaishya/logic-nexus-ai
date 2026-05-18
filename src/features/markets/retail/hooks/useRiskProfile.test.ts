import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/utils';

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  experience_level: 'beginner',
  risk_tag: 'conservative',
  goals: [],
  behavioral_flags: {},
  quiz_answers: {},
  onboarding_complete: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'tok' }, roles: [] }),
}));

describe('useRiskProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the profile data and hasOnboarded=false', async () => {
    const { useRiskProfile } = await import('./useRiskProfile');
    const { result } = renderHook(() => useRiskProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.experience_level).toBe('beginner');
    expect(result.current.hasOnboarded).toBe(false);
  });
});

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-edu-1' }, roles: [] }),
}));

import { useInlineEducation } from './useInlineEducation';

const STORAGE_KEY = 'lnai_education_seen_user-edu-1';

describe('useInlineEducation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with nothing shown for a fresh user', () => {
    const { result } = renderHook(() => useInlineEducation());
    expect(result.current.hasBeenShown('high_conviction_signal')).toBe(false);
  });

  it('markShown persists across hook instances via localStorage', () => {
    const first = renderHook(() => useInlineEducation());
    act(() => first.result.current.markShown('first_sip'));

    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('first_sip');

    // Fresh mount reads from storage.
    const second = renderHook(() => useInlineEducation());
    expect(second.result.current.hasBeenShown('first_sip')).toBe(true);
  });

  it('markShown is idempotent', () => {
    const { result } = renderHook(() => useInlineEducation());
    act(() => {
      result.current.markShown('first_intraday');
      result.current.markShown('first_intraday');
      result.current.markShown('first_intraday');
    });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toEqual(['first_intraday']);
  });

  it('reset clears all seen ids for the current user', () => {
    const { result } = renderHook(() => useInlineEducation());
    act(() => {
      result.current.markShown('high_conviction_signal');
      result.current.markShown('first_sip');
    });
    expect(result.current.hasBeenShown('first_sip')).toBe(true);

    act(() => result.current.reset());
    expect(result.current.hasBeenShown('first_sip')).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('handles corrupt localStorage gracefully', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json');
    const { result } = renderHook(() => useInlineEducation());
    expect(result.current.hasBeenShown('first_sip')).toBe(false);
  });
});

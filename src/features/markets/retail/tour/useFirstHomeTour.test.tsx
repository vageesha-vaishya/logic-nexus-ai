import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useFirstHomeTour } from './useFirstHomeTour';

const mockProfile = vi.fn();
const mockMutate  = vi.fn();

vi.mock('../self-onboarding/useRetailProfile', () => ({
  useRetailProfile: () => mockProfile(),
  useUpsertRetailProfile: () => ({ mutate: mockMutate }),
}));

describe('useFirstHomeTour', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  it('does not run while the profile is loading', () => {
    mockProfile.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useFirstHomeTour());
    expect(result.current.shouldRun).toBe(false);
  });

  it('does not run if the profile row is missing', () => {
    mockProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useFirstHomeTour());
    expect(result.current.shouldRun).toBe(false);
  });

  it('runs when tour_completed is false', () => {
    mockProfile.mockReturnValue({
      data: { user_id: 'u1', tour_completed: false, disclosure_accepted_at: null, nominee: null, created_at: '', updated_at: '' },
      isLoading: false,
    });
    const { result } = renderHook(() => useFirstHomeTour());
    expect(result.current.shouldRun).toBe(true);
  });

  it('does not run after tour_completed flips to true', () => {
    mockProfile.mockReturnValue({
      data: { user_id: 'u1', tour_completed: true, disclosure_accepted_at: null, nominee: null, created_at: '', updated_at: '' },
      isLoading: false,
    });
    const { result } = renderHook(() => useFirstHomeTour());
    expect(result.current.shouldRun).toBe(false);
  });

  it('dismiss() upserts tour_completed=true', () => {
    mockProfile.mockReturnValue({
      data: { user_id: 'u1', tour_completed: false, disclosure_accepted_at: null, nominee: null, created_at: '', updated_at: '' },
      isLoading: false,
    });
    const { result } = renderHook(() => useFirstHomeTour());
    act(() => result.current.dismiss());
    expect(mockMutate).toHaveBeenCalledWith({ tour_completed: true });
  });
});

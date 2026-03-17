import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useCRMModuleNavigationState } from '../useCRMModuleNavigationState';

describe('useCRMModuleNavigationState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates with Azure Sky and pipeline defaults', async () => {
    const { result } = renderHook(() => useCRMModuleNavigationState('accounts'));

    expect(result.current.hydrated).toBe(true);
    expect(result.current.viewMode).toBe('pipeline');
    expect(result.current.theme).toBe('Azure Sky');
  });

  it('persists per-module state across remounts', async () => {
    const { result, unmount } = renderHook(() => useCRMModuleNavigationState('contacts'));

    act(() => {
      result.current.setViewMode('grid');
      result.current.setTheme('Azure Sky');
    });

    unmount();

    const { result: remounted } = renderHook(() => useCRMModuleNavigationState('contacts'));
    expect(remounted.current.viewMode).toBe('grid');
    expect(remounted.current.theme).toBe('Azure Sky');
  });

  it('isolates navigation state between modules', () => {
    const { result: accounts } = renderHook(() => useCRMModuleNavigationState('accounts'));
    const { result: opportunities } = renderHook(() => useCRMModuleNavigationState('opportunities'));

    act(() => {
      accounts.current.setViewMode('list');
      opportunities.current.setViewMode('card');
    });

    expect(accounts.current.viewMode).toBe('list');
    expect(opportunities.current.viewMode).toBe('card');
  });
});

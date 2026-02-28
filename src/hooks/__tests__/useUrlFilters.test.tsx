import { renderHook, act } from '@testing-library/react';
import { useUrlFilters } from '../useUrlFilters';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';

describe('useUrlFilters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  it('should initialize with default filters', () => {
    const { result } = renderHook(() => useUrlFilters({ status: 'all' }), { wrapper });
    expect(result.current.filters).toEqual({ status: 'all' });
  });

  it('should update filters', () => {
    const { result } = renderHook(() => useUrlFilters({ status: 'all' }), { wrapper });
    
    act(() => {
      result.current.setFilters({ status: 'draft' });
    });

    expect(result.current.filters).toEqual({ status: 'draft' });
  });

  it('should persist to localStorage if key provided', () => {
    const key = 'test-filters';
    const { result } = renderHook(() => useUrlFilters({ status: 'all' }, key), { wrapper });

    act(() => {
      result.current.setFilters({ status: 'draft' });
    });

    expect(localStorage.getItem(key)).toContain('"status":"draft"');
  });
});

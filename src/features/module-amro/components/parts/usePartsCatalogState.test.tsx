import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePartsCatalogState } from './usePartsCatalogState';

describe('usePartsCatalogState', () => {
  it('loads first page and supports loading more', async () => {
    const { result } = renderHook(() => usePartsCatalogState({
      totalRecords: 180,
      pageSize: 40,
      simulateLatencyMs: 1,
      seed: 11,
    }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.records.length).toBe(40);
    expect(result.current.page).toBe(1);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.records.length).toBe(80);
    expect(result.current.page).toBe(2);
  });

  it('resets pagination when query changes', async () => {
    const { result } = renderHook(() => usePartsCatalogState({
      totalRecords: 220,
      pageSize: 50,
      simulateLatencyMs: 1,
      seed: 13,
    }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.page).toBe(1);
    expect(result.current.records.length).toBe(50);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.records.length).toBe(100);

    act(() => {
      result.current.setQuery({ status: 'quarantined' });
    });

    expect(result.current.page).toBe(0);
    expect(result.current.records.length).toBe(0);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.records.every((row) => row.status === 'quarantined')).toBe(true);
    });
  });
});

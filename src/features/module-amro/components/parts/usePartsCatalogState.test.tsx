import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePartsCatalogState } from './usePartsCatalogState';
import { PartsApiError } from './livePartsCatalogApi';

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
    expect(result.current.dataSource).toBe('fallback');
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

  it('falls back to local catalog when API returns 401', async () => {
    const api = {
      listParts: vi.fn().mockRejectedValue(new PartsApiError('Unauthorized', 401, {
        failureCategory: 'permission',
        reasonCode: 'missing_permission_dashboards_view',
        remediation: 'Grant dashboards.view',
      })),
    };
    const { result } = renderHook(() => usePartsCatalogState({
      totalRecords: 60,
      pageSize: 20,
      simulateLatencyMs: 1,
      seed: 19,
      api,
    }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(api.listParts).toHaveBeenCalledTimes(1);
    expect(result.current.records.length).toBe(20);
    expect(result.current.error).toBeNull();
    expect(result.current.page).toBe(1);
    expect(result.current.dataSource).toBe('fallback');
    expect(result.current.fallbackAuthDiagnostics?.reasonCode).toBe('missing_permission_dashboards_view');
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ context: { tenantId: 'tenant-1' }, user: { id: 'user-1' } }),
}));

import { useFeatureFlags } from './useFeatureFlags';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useFeatureFlags', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('on a failed fetch, resolvedFlags stays empty so isEnabled falls back to the caller default (Bug B)', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useFeatureFlags(['some_flag_key']), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Before the fix: isEnabled('some_flag_key', true) would return false,
    // because the catch block put {some_flag_key: false} in resolvedFlags
    // (key present -> isEnabled never reaches the defaultValue branch).
    // After the fix: the catch returns {}, the key is absent, isEnabled
    // falls back to the caller's own default.
    expect(result.current.isEnabled('some_flag_key', true)).toBe(true);
    expect(result.current.isEnabled('some_flag_key', false)).toBe(false);
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useServiceTypes } from '../useServiceTypes';

describe('useServiceTypes', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  it('returns empty list when query errors or no data', async () => {
    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useServiceTypes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.serviceTypes).toEqual([]);
  });

  it('returns service types from database', async () => {
    const mockData = [
      { id: '1', code: 'ocean_fcl', name: 'Ocean FCL', mode_id: null },
      { id: '2', code: 'air_standard', name: 'Air Standard', mode_id: null },
    ];

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    }));

    vi.doMock('@/integrations/supabase/client', () => ({
      supabase: { from: fromMock },
    }));

    const { useServiceTypes: freshUseServiceTypes } = await import('../useServiceTypes');

    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => freshUseServiceTypes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.serviceTypes.map(s => s.code)).toEqual(['ocean_fcl', 'air_standard']);
    expect(fromMock).toHaveBeenCalledWith('service_types');
  });
});

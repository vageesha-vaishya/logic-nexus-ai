import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransportModes } from '../useTransportModes';

describe('useTransportModes', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  it('returns empty list when query errors or no data', async () => {
    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTransportModes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.modes).toEqual([]);
  });

  it('returns transport modes from database', async () => {
    const mockData = [
      { id: '1', code: 'ocean', name: 'Ocean Freight' },
      { id: '2', code: 'air', name: 'Air Freight' },
    ];

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    }));

    vi.doMock('@/integrations/supabase/client', () => ({
      supabase: { from: fromMock },
    }));

    const { useTransportModes: freshUseTransportModes } = await import('../useTransportModes');

    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => freshUseTransportModes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.modes.map(m => m.code)).toEqual(['ocean', 'air']);
    expect(fromMock).toHaveBeenCalledWith('transport_modes');
  });
});

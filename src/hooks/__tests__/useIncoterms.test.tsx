import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useIncoterms } from '../useIncoterms';

describe('useIncoterms', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  it('returns empty list when query errors or no data', async () => {
    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useIncoterms(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incoterms).toEqual([]);
  });

  it('returns incoterms from database', async () => {
    const mockData = [
      { id: '1', incoterm_code: 'FOB', incoterm_name: 'Free on Board', description: null },
      { id: '2', incoterm_code: 'CIF', incoterm_name: 'Cost, Insurance and Freight', description: null },
    ];

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    }));

    vi.doMock('@/integrations/supabase/client', () => ({
      supabase: { from: fromMock },
    }));

    const { useIncoterms: freshUseIncoterms } = await import('../useIncoterms');

    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => freshUseIncoterms(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incoterms.map(i => i.incoterm_code)).toEqual(['FOB', 'CIF']);
    expect(fromMock).toHaveBeenCalledWith('incoterms');
  });
});

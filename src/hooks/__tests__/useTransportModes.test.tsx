import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransportModes } from '../useTransportModes';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

describe('useTransportModes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

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

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTransportModes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.modes.map(m => m.code)).toEqual(['ocean', 'air']);
    expect(supabase.from).toHaveBeenCalledWith('transport_modes');
  });
});

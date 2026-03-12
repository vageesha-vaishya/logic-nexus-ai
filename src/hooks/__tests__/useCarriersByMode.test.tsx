import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useCarriersByMode } from '../useCarriersByMode';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

describe('useCarriersByMode', () => {
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

  const wrapper = ({ children, client }: { children: React.ReactNode; client: QueryClient }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  it('maps carriers by mode from mode column', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            carrier_name: 'Ocean Express',
            carrier_code: null,
            carrier_type: 'ocean',
            scac: 'OCEA',
            iata: null,
            mc_dot: null,
            mode: 'ocean',
            is_active: true,
          },
        ],
        error: null,
      }),
    });

    const client = createClient();
    const { result } = renderHook(() => useCarriersByMode(), {
      wrapper: ({ children }) => wrapper({ children, client }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getCarriersForMode('ocean')).toHaveLength(1);
  });

  it('maps carriers by fallback carrier_type when mode is null', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: '2',
            carrier_name: 'Sea Link',
            carrier_code: null,
            carrier_type: 'ocean',
            scac: 'SEAL',
            iata: null,
            mc_dot: null,
            mode: null,
            is_active: true,
          },
          {
            id: '3',
            carrier_name: 'Sky Cargo',
            carrier_code: null,
            carrier_type: 'air_cargo',
            scac: null,
            iata: 'SKY',
            mc_dot: null,
            mode: null,
            is_active: true,
          },
        ],
        error: null,
      }),
    });

    const client = createClient();
    const { result } = renderHook(() => useCarriersByMode(), {
      wrapper: ({ children }) => wrapper({ children, client }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getCarriersForMode('ocean').map(c => c.id)).toContain('2');
    expect(result.current.getCarriersForMode('air').map(c => c.id)).toContain('3');
  });
});

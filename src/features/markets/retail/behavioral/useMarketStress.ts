/**
 * useMarketStress — polls /v1/retail/behavioral/market-stress.
 *
 * Returns the same fields the worker emits plus derived booleans
 * (isHighStress / isMediumStress) so call sites stay concise.
 *
 * Token is read at request-time via supabase.auth.getSession() so a stale
 * React-state copy can't poison a fresh call (same pattern as useRetailSignals).
 */
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { marketsKeys } from '../../hooks/queryKeys';
import type { MarketStress } from './types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

export function useMarketStress() {
  const query = useQuery({
    queryKey: marketsKeys.retail.behavioral.stress(),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    queryFn: async (): Promise<MarketStress> => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/market-stress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`market-stress: ${resp.status}`);
      return (await resp.json()) as MarketStress;
    },
  });

  return {
    ...query,
    isHighStress:   query.data?.stress_level === 'high',
    isMediumStress: query.data?.stress_level === 'medium',
  };
}

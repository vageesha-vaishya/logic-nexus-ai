import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { MarketStress } from './types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

export function useMarketStress() {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: marketsKeys.retail.behavioral.stress(),
    enabled: Boolean(session?.access_token),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    queryFn: async (): Promise<MarketStress> => {
      const resp = await fetch(
        `${WORKER_URL}/v1/retail/behavioral/market-stress`,
        { headers: { Authorization: `Bearer ${session!.access_token}` } },
      );
      if (!resp.ok) throw new Error(`market-stress: ${resp.status}`);
      return resp.json();
    },
  });

  return {
    ...query,
    isHighStress:   query.data?.stress_level === 'high',
    isMediumStress: query.data?.stress_level === 'medium',
  };
}

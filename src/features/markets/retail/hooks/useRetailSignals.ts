import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RetailSignal } from '../types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

export interface RetailSignalFilters {
  assetClass?: string;
  horizon?: string;
  minConfidence?: number;
  limit?: number;
}

export function useRetailSignals(filters: RetailSignalFilters = {}) {
  const { session } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.signals(filters),
    enabled: Boolean(session?.access_token),
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<RetailSignal[]> => {
      const params = new URLSearchParams();
      if (filters.assetClass)    params.set('asset_class', filters.assetClass);
      if (filters.horizon)       params.set('horizon', filters.horizon);
      if (filters.minConfidence !== undefined) {
        params.set('min_confidence', String(filters.minConfidence));
      }
      if (filters.limit !== undefined) {
        params.set('limit', String(filters.limit));
      }

      const resp = await fetch(
        `${WORKER_URL}/v1/retail/signals?${params}`,
        { headers: { Authorization: `Bearer ${session!.access_token}` } },
      );
      if (!resp.ok) throw new Error(`retail signals ${resp.status}`);
      return resp.json();
    },
  });
}

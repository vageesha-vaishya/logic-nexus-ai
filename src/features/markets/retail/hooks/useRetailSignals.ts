/**
 * useRetailSignals — reads markets.signals directly from Supabase.
 *
 * Returns RetailSignal[] decorated with metadata.explanations (Task 5) so
 * the UI can switch reading levels based on the user's experience_level.
 *
 * Originally proxied through GET /v1/retail/signals on the FastAPI
 * markets-worker. That worker endpoint was a pure SELECT with no
 * compute (auth check + filter parsing + Supabase query), so we now
 * query Supabase directly. Same RLS, same response shape, same default
 * filters — and it works from any network (LTE, hotel Wi-Fi, prod)
 * without LAN routing to the laptop.
 *
 * Filters map 1:1 to the original worker params:
 *   assetClass    → asset_class (defaults to all six classes)
 *   horizon       → horizon
 *   minConfidence → confidence >= value (default 0.60)
 *   limit         → row limit (default 20)
 *
 * Only signals that are still live are returned — expires_at must be
 * non-NULL and >= now() (matches the Python; expired rows stay in the
 * table for backtesting but never surface in the UI).
 */
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RetailSignal } from '../types';

/** Worker vocabulary (matches _derive_asset_class in jobs/signal_generator.py). */
export type RetailAssetClass = 'equity' | 'mf' | 'fo' | 'fx' | 'bond' | 'commodity';
export type RetailHorizon    = 'intraday' | 'short_term' | 'medium_term' | 'long_term';

const ALL_ASSET_CLASSES: readonly RetailAssetClass[] = [
  'equity', 'mf', 'fo', 'fx', 'bond', 'commodity',
];

const DEFAULT_LIMIT          = 20;
const DEFAULT_MIN_CONFIDENCE = 0.60;

export interface RetailSignalFilters {
  assetClass?: RetailAssetClass;
  horizon?: RetailHorizon;
  minConfidence?: number;
  limit?: number;
}

export function useRetailSignals(filters: RetailSignalFilters = {}) {
  return useQuery({
    queryKey: marketsKeys.retail.signals(filters),
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<RetailSignal[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const assetClasses = filters.assetClass
        ? [filters.assetClass]
        : [...ALL_ASSET_CLASSES];
      const minConfidence = filters.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
      const limit         = filters.limit         ?? DEFAULT_LIMIT;

      let q = (supabase as any)
        .schema('markets')
        .from('signals')
        .select(
          'id, ts, instrument_id, signal_type, direction, confidence, ' +
          'rationale, price_at_signal, expires_at, metadata, horizon, ' +
          'asset_class, risk_params, score, ' +
          'instrument:instruments(symbol, exchange, instrument_type)',
        )
        .gte('confidence', minConfidence)
        .in('asset_class', assetClasses)
        // PostgREST accepts `now()` as a bind value for timestamp columns —
        // matches the Python (`.gte("expires_at", "now()")`). Server-side
        // evaluation avoids a client-clock dependency.
        .not('expires_at', 'is', null)
        .gte('expires_at', 'now()')
        .order('ts', { ascending: false })
        .limit(limit);

      if (filters.horizon) q = q.eq('horizon', filters.horizon);

      const { data, error } = await q;
      if (error) throw new Error(error.message ?? 'Failed to load signals');
      return (data ?? []) as RetailSignal[];
    },
  });
}

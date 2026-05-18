/**
 * useRetailSignals — fetches GET /v1/retail/signals from markets-worker.
 *
 * Returns RetailSignal[] decorated with metadata.explanations (Task 5) so
 * the UI can switch reading levels based on the user's experience_level.
 *
 * Filters map 1:1 to the worker's query params:
 *   assetClass    → asset_class
 *   horizon       → horizon
 *   minConfidence → min_confidence
 *   limit         → limit
 *
 * Token is read from the live Supabase session (not the useAuth snapshot)
 * to match the convention in useBacktests / usePortfolioAttribution — that
 * way an expired access_token in React state can't poison a fresh request.
 */
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RetailSignal } from '../types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

/** Worker vocabulary (matches _derive_asset_class in jobs/signal_generator.py). */
export type RetailAssetClass = 'equity' | 'mf' | 'fo' | 'fx' | 'bond' | 'commodity';
export type RetailHorizon    = 'intraday' | 'short_term' | 'medium_term' | 'long_term';

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
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (filters.assetClass)    params.set('asset_class',    filters.assetClass);
      if (filters.horizon)       params.set('horizon',        filters.horizon);
      if (filters.minConfidence !== undefined) params.set('min_confidence', String(filters.minConfidence));
      if (filters.limit !== undefined)         params.set('limit',          String(filters.limit));

      const url = `${WORKER_URL}/v1/retail/signals${params.size ? `?${params}` : ''}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        let detail = '';
        try {
          const body = await resp.json();
          // FastAPI 422 returns detail as an Array<{loc, msg, type}>; everything else
          // is usually a string. Format both shapes so the UI never shows [object Object].
          if (Array.isArray(body?.detail)) {
            detail = ' — ' + body.detail
              .map((d: { loc?: unknown[]; msg?: string }) => {
                const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '?';
                return `${field}: ${d.msg ?? 'invalid'}`;
              })
              .join('; ');
          } else if (typeof body?.detail === 'string') {
            detail = ` — ${body.detail}`;
          }
        } catch {
          // non-JSON body — ignore
        }
        throw new Error(`retail signals: ${resp.status}${detail}`);
      }
      return (await resp.json()) as RetailSignal[];
    },
  });
}

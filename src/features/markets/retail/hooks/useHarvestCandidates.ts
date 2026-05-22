/**
 * useHarvestCandidates — aggregates LTCG-eligible unrealized positions
 * across all of the authed user's portfolios for the given (or current)
 * Indian FY.
 *
 * Why we fan out client-side: the worker exposes `/v1/tax/{pid}/pnl` per
 * portfolio (returns `unrealized_positions`) but the user-level
 * `/v1/tax/user/pnl` returns only realized aggregates today. Rather than
 * widen the worker contract right now, we list the user's portfolios via
 * `markets-portfolios` edge fn and call the per-portfolio endpoint in
 * Promise.all inside one queryFn. Loading + error are unified.
 *
 * Migration path: when the worker grows `/v1/tax/user/harvest`, swap the
 * fan-out for a single fetch — the consumer card already only reads the
 * merged list.
 */

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Portfolio, PortfoliosListResponse } from "../../types";
import type { TaxPnLData } from "../../hooks/useTaxPnL";
import { marketsKeys } from "../../hooks/queryKeys";

import type { HarvestCandidate } from "../lib/harvest";
import { currentIndianFy } from "./useLtcgTracker";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

export interface HarvestCandidatesResult {
  fy:         string;
  candidates: HarvestCandidate[];
  /** True iff the user has at least one portfolio. Used by empty-state copy. */
  hasPortfolios: boolean;
}

export function useHarvestCandidates(fy?: string) {
  const resolvedFy = fy ?? currentIndianFy();

  return useQuery<HarvestCandidatesResult, Error>({
    queryKey:  marketsKeys.retail.harvest(resolvedFy),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      // 1. List the user's portfolios via the edge fn (RLS-scoped).
      const { data: listData, error: listErr } = await supabase.functions.invoke<PortfoliosListResponse>(
        "markets-portfolios",
        { method: "GET" },
      );
      if (listErr) throw new Error(listErr.message ?? "Failed to list portfolios");
      const portfolios: Portfolio[] = listData?.data ?? [];

      if (portfolios.length === 0) {
        return { fy: resolvedFy, candidates: [], hasPortfolios: false };
      }

      // 2. Fan out to per-portfolio tax PnL. We tolerate per-portfolio
      // failures: an empty portfolio (no transactions yet) sometimes
      // returns 4xx from the worker, and one bad fetch shouldn't blank
      // the whole card.
      const settled = await Promise.allSettled(
        portfolios.map(async (p): Promise<HarvestCandidate[]> => {
          const resp = await fetch(
            `${WORKER_URL}/v1/tax/${p.id}/pnl?fy=${encodeURIComponent(resolvedFy)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!resp.ok) return [];
          const json = (await resp.json()) as TaxPnLData;
          return (json.unrealized_positions ?? []).map((u) => ({
            ...u,
            portfolio_id: p.id,
          }));
        }),
      );

      const merged: HarvestCandidate[] = [];
      for (const r of settled) {
        if (r.status === "fulfilled") merged.push(...r.value);
      }

      return { fy: resolvedFy, candidates: merged, hasPortfolios: true };
    },
  });
}

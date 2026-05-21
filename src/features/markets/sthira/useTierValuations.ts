/**
 * useTierValuations — current value + invested + P&L per tier slot.
 *
 * The retail dashboard's three tier cards each need a "current value" rollup.
 * The data lives across two tables:
 *   - markets.portfolio_tiers (tier_number -> portfolio_id mapping)
 *   - markets.holdings (qty, avg_cost, metadata.last_price per instrument)
 *
 * `markets.holdings` doesn't have a `current_value` column; the latest broker
 * price gets stamped into `metadata.last_price` by `broker_sync.py`. We
 * compute `(last_price || avg_cost) × qty` so the display auto-flips from
 * "at-cost" to "mark-to-market" once the Groww adapter (PR 4-ish) starts
 * fetching real LTPs during sync. Until then, current == invested, which is
 * honest about what we know.
 *
 * Returns a record keyed by tier_number with totals already summed.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "@/features/markets/hooks/queryKeys";
import { usePortfolioTiers } from "@/features/markets/retail/hooks/usePortfolioTiers";

export interface TierValuation {
  tier_number:   1 | 2 | 3;
  portfolio_id:  string | null;
  current_value: number;
  invested:      number;
  pnl:           number;
  holding_count: number;
}

interface HoldingRow {
  portfolio_id: string | null;
  qty:          string | number;
  avg_cost:     string | number;
  metadata:     { last_price?: number | string | null } | null;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function useTierValuations() {
  const { user } = useAuth();
  const tiers = usePortfolioTiers();
  const portfolioIds = (tiers.data ?? [])
    .map((t) => t.portfolio_id)
    .filter((id): id is string => Boolean(id));

  const holdings = useQuery({
    queryKey: [...marketsKeys.all, "tier-holdings", portfolioIds],
    enabled: Boolean(user?.id) && portfolioIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<HoldingRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("holdings")
        .select("portfolio_id, qty, avg_cost, metadata")
        .in("portfolio_id", portfolioIds);
      if (error) throw error;
      return (data as HoldingRow[]) ?? [];
    },
  });

  const valuations: Record<1 | 2 | 3, TierValuation> = useMemo(() => {
    const empty = (n: 1 | 2 | 3): TierValuation => ({
      tier_number: n,
      portfolio_id: null,
      current_value: 0,
      invested: 0,
      pnl: 0,
      holding_count: 0,
    });
    const out: Record<1 | 2 | 3, TierValuation> = { 1: empty(1), 2: empty(2), 3: empty(3) };
    const rows = holdings.data ?? [];

    for (const tier of tiers.data ?? []) {
      const slot = out[tier.tier_number];
      slot.portfolio_id = tier.portfolio_id;
      if (!tier.portfolio_id) continue;

      const tierRows = rows.filter((r) => r.portfolio_id === tier.portfolio_id);
      for (const h of tierRows) {
        const qty       = num(h.qty);
        const avg       = num(h.avg_cost);
        const lastPrice = num(h.metadata?.last_price);
        const price     = lastPrice > 0 ? lastPrice : avg;
        slot.current_value += qty * price;
        slot.invested      += qty * avg;
        slot.holding_count += 1;
      }
      slot.pnl = slot.current_value - slot.invested;
    }
    return out;
  }, [holdings.data, tiers.data]);

  return {
    valuations,
    isLoading: tiers.isPending || holdings.isPending,
    refetch:   holdings.refetch,
  };
}

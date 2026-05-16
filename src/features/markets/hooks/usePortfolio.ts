/**
 * Markets — single portfolio query + holdings/NAV.
 * Reads markets.portfolios directly via supabase-js (.schema('markets'))
 * — RLS confirms owner_user_id = auth.uid().
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "./queryKeys";
import type { Portfolio, PortfolioHoldingsResult } from "../types";

// Triggers a server-side NAV refresh for one or all portfolios, then
// invalidates the portfolio list so the updated metadata appears immediately.
export function useRefreshNav() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (portfolioId?: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("markets-compute-nav", {
        method: "POST",
        body: portfolioId ? { portfolio_id: portfolioId } : {},
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.portfolios.all() });
    },
  });
}

export function usePortfolio(id: string | undefined) {
  return useQuery({
    queryKey: id ? marketsKeys.portfolios.detail(id) : marketsKeys.portfolios.all(),
    enabled: Boolean(id),
    queryFn: async (): Promise<Portfolio | null> => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("portfolios")
        .select(
          "id, name, description, mode, base_currency, is_active, metadata, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message ?? "Failed to load portfolio");
      return (data ?? null) as Portfolio | null;
    },
    staleTime: 60_000,
  });
}

/**
 * Loads holdings for a portfolio and computes NAV, today P&L, and since-inception %.
 * Two queries: holdings+instruments join, then latest price_history per instrument.
 */
export function usePortfolioHoldings(portfolioId: string | undefined) {
  return useQuery<PortfolioHoldingsResult>({
    queryKey: portfolioId
      ? [...marketsKeys.portfolios.detail(portfolioId), "holdings"]
      : ["markets", "holdings", "disabled"],
    enabled: Boolean(portfolioId),
    staleTime: 30_000,
    queryFn: async (): Promise<PortfolioHoldingsResult> => {
      // Two separate queries — avoids PostgREST embedded-resource ambiguity
      // in non-default schemas.
      const { data: holdings, error: holdingsErr } = await (supabase as any)
        .schema("markets")
        .from("holdings")
        .select("id, instrument_id, qty, avg_cost, realized_pnl, last_updated_at")
        .eq("portfolio_id", portfolioId);

      if (holdingsErr) throw new Error(holdingsErr.message);
      if (!holdings?.length) {
        return { holdings: [], nav: 0, todayPnl: 0, sinceInceptionPct: 0 };
      }

      const instrumentIds: string[] = holdings.map((h: any) => h.instrument_id);

      // Fetch instruments separately then merge client-side
      const { data: instruments } = await (supabase as any)
        .schema("markets")
        .from("instruments")
        .select("id, symbol, exchange, instrument_type, isin")
        .in("id", instrumentIds);

      const instrumentMap: Record<string, any> = {};
      for (const i of (instruments ?? []) as any[]) instrumentMap[i.id] = i;

      // Fetch the two most recent trading days of prices per instrument.
      // limit = instruments × 10 ensures we always capture at least 2 distinct
      // trading days even if the batch ingest ran unevenly across symbols.
      const priceRes = await (supabase as any)
        .schema("markets")
        .from("price_history")
        .select("instrument_id, close, ts")
        .in("instrument_id", instrumentIds)
        .order("ts", { ascending: false })
        .limit(instrumentIds.length * 10);

      // Build price map: latest close + previous-day close per instrument.
      // Compare calendar date strings (not close values) so flat-priced stocks
      // still get a valid prev_price for today's P&L calculation.
      const ltpMap:      Record<string, number> = {};
      const prevMap:     Record<string, number> = {};
      const latestDate:  Record<string, string> = {};

      for (const p of (priceRes.data ?? []) as any[]) {
        const id      = p.instrument_id;
        const dateStr = (p.ts as string).slice(0, 10);
        if (!(id in ltpMap)) {
          ltpMap[id]     = Number(p.close);
          latestDate[id] = dateStr;
        } else if (!(id in prevMap) && dateStr !== latestDate[id]) {
          prevMap[id] = Number(p.close);
        }
      }

      // Flatten into the shape the rest of the code expects
      const priceMap: Record<string, number[]> = {};
      for (const id of instrumentIds) {
        priceMap[id] = [ltpMap[id], prevMap[id]].filter((v): v is number => v !== undefined);
      }

      let nav = 0;
      let todayPnl = 0;
      // Separate accumulators: purchased (avg_cost > 0) vs bonus/free (avg_cost = 0)
      let purchasedCurrentValue = 0;  // current value of holdings we paid for
      let purchasedCostBasis    = 0;  // what we paid for those holdings
      let bonusCurrentValue     = 0;  // current value of bonus/free shares
      let totalRealizedPnl      = 0;

      const enriched = holdings.map((h: any) => {
        const pts = priceMap[h.instrument_id] ?? [];
        const lastPrice: number | null = pts[0] ?? null;
        const prevPrice: number | null = pts[1] ?? null;
        const qty  = Number(h.qty);
        const cost = Number(h.avg_cost);
        const mktVal = qty * (lastPrice ?? cost);

        nav      += mktVal;
        todayPnl += qty * ((lastPrice ?? 0) - (prevPrice ?? lastPrice ?? 0));
        totalRealizedPnl += Number(h.realized_pnl ?? 0);

        if (cost > 0) {
          // Only count holdings we actually paid for in the return metric
          purchasedCostBasis    += qty * cost;
          purchasedCurrentValue += qty * (lastPrice ?? cost);
        } else {
          bonusCurrentValue += qty * (lastPrice ?? 0);
        }

        return {
          ...h,
          qty,
          avg_cost: cost,
          instrument: instrumentMap[h.instrument_id] ?? null,
          last_price: lastPrice,
          prev_price: prevPrice,
        };
      });

      // sinceInceptionPct: return on PURCHASED positions only.
      // Bonus / gifted shares have avg_cost = 0 — they cannot contribute to a
      // meaningful % return (dividing by zero cost is undefined) so they are
      // excluded from the denominator. Their market value is still in NAV.
      const purchasedGain = (purchasedCurrentValue - purchasedCostBasis) + totalRealizedPnl;

      return {
        holdings: enriched,
        nav:            Math.round(nav * 100) / 100,
        todayPnl:       Math.round(todayPnl * 100) / 100,
        investedValue:  Math.round(purchasedCostBasis * 100) / 100,
        bonusValue:     Math.round(bonusCurrentValue * 100) / 100,
        sinceInceptionPct:
          purchasedCostBasis > 0
            ? Math.round((purchasedGain / purchasedCostBasis) * 10000) / 10000
            : 0,
      };
    },
  });
}

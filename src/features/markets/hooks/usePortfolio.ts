/**
 * Markets — single portfolio query + holdings/NAV.
 * Reads markets.portfolios directly via supabase-js (.schema('markets'))
 * — RLS confirms owner_user_id = auth.uid().
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "./queryKeys";
import type { Portfolio, PortfolioHoldingsResult } from "../types";

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

      const { data: prices } = await (supabase as any)
        .schema("markets")
        .from("price_history")
        .select("instrument_id, close, ts")
        .in("instrument_id", instrumentIds)
        .order("ts", { ascending: false })
        .limit(instrumentIds.length * 5);

      // Group prices per instrument, keep the two most recent closes.
      const priceMap: Record<string, number[]> = {};
      for (const p of (prices ?? []) as any[]) {
        if (!priceMap[p.instrument_id]) priceMap[p.instrument_id] = [];
        if (priceMap[p.instrument_id].length < 2) {
          priceMap[p.instrument_id].push(Number(p.close));
        }
      }

      let nav = 0;
      let todayPnl = 0;
      let costBasis = 0;

      const enriched = holdings.map((h: any) => {
        const pts = priceMap[h.instrument_id] ?? [];
        const lastPrice: number | null = pts[0] ?? null;
        const prevPrice: number | null = pts[1] ?? null;
        const qty = Number(h.qty);
        const cost = Number(h.avg_cost);
        nav += qty * (lastPrice ?? cost);
        todayPnl += qty * ((lastPrice ?? 0) - (prevPrice ?? lastPrice ?? 0));
        costBasis += qty * cost;
        return {
          ...h,
          qty,
          avg_cost: cost,
          instrument: instrumentMap[h.instrument_id] ?? null,
          last_price: lastPrice,
          prev_price: prevPrice,
        };
      });

      return {
        holdings: enriched,
        nav: Math.round(nav * 100) / 100,
        todayPnl: Math.round(todayPnl * 100) / 100,
        sinceInceptionPct:
          costBasis > 0
            ? Math.round(((nav - costBasis) / costBasis) * 10000) / 100
            : 0,
      };
    },
  });
}

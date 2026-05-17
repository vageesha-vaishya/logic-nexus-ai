/**
 * Trade Journal hooks.
 *
 * All queries and mutations for markets.trade_journal.
 * P&L and outcome are stored in DB; stats are derived client-side
 * from the full trade list for the current user.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TradeDirection = "buy" | "sell" | "short" | "cover";
export type TradeEmotion   = "confident" | "fearful" | "greedy" | "disciplined" | "impulsive" | "neutral";
export type TradeOutcome   = "win" | "loss" | "breakeven" | "open";

export interface TradeJournalEntry {
  id:            string;
  user_id:       string;
  portfolio_id:  string | null;
  instrument_id: string | null;
  symbol:        string;
  exchange:      string;
  direction:     TradeDirection;
  entry_date:    string;
  exit_date:     string | null;
  entry_price:   number;
  exit_price:    number | null;
  qty:           number;
  charges:       number;
  pnl:           number | null;
  pnl_pct:       number | null;
  rationale:     string | null;
  exit_reason:   string | null;
  tags:          string[];
  emotion:       TradeEmotion | null;
  outcome:       TradeOutcome | null;
  ai_tags:       string[];
  ai_insight:    string | null;
  created_at:    string;
  updated_at:    string;
}

export interface CreateTradeInput {
  symbol:        string;
  exchange?:     string;
  portfolio_id?: string | null;
  instrument_id?: string | null;
  direction:     TradeDirection;
  entry_date:    string;
  exit_date?:    string | null;
  entry_price:   number;
  exit_price?:   number | null;
  qty:           number;
  charges?:      number;
  rationale?:    string | null;
  exit_reason?:  string | null;
  tags?:         string[];
  emotion?:      TradeEmotion | null;
}

export interface UpdateTradeInput {
  id:            string;
  exit_date?:    string | null;
  exit_price?:   number | null;
  exit_reason?:  string | null;
  charges?:      number;
  tags?:         string[];
  emotion?:      TradeEmotion | null;
  rationale?:    string | null;
}

export interface TradeFilters {
  symbol?:      string;
  portfolioId?: string;
  outcome?:     TradeOutcome | "all";
  tags?:        string[];
}

export interface TradeStats {
  total_trades:  number;
  win_rate:      number;   // 0–1
  avg_pnl:       number;
  avg_pnl_pct:   number;
  best_trade:    TradeJournalEntry | null;
  worst_trade:   TradeJournalEntry | null;
  profit_factor: number;  // sum(wins) / abs(sum(losses))
  total_pnl:     number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computePnl(entry: CreateTradeInput): { pnl: number | null; pnl_pct: number | null; outcome: TradeOutcome } {
  const { exit_price, entry_price, qty, charges = 0, direction } = entry;
  if (exit_price == null || !exit_price) {
    return { pnl: null, pnl_pct: null, outcome: "open" };
  }
  const dirMult = direction === "sell" || direction === "short" ? -1 : 1;
  const gross   = (exit_price - entry_price) * qty * dirMult;
  const net     = gross - charges;
  const pnl     = Math.round(net * 100) / 100;
  const pnl_pct = entry_price > 0
    ? Math.round(((exit_price - entry_price) / entry_price) * dirMult * 10000) / 100
    : null;
  const outcome: TradeOutcome =
    pnl > 0.005 ? "win" : pnl < -0.005 ? "loss" : "breakeven";
  return { pnl, pnl_pct, outcome };
}

// ── Query ──────────────────────────────────────────────────────────────────────

export function useTrades(filters?: TradeFilters) {
  const { user } = useAuth();
  return useQuery<TradeJournalEntry[]>({
    queryKey: marketsKeys.journal.list({
      symbol:      filters?.symbol,
      portfolioId: filters?.portfolioId,
      outcome:     filters?.outcome,
      tags:        filters?.tags,
    }),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = supabase.schema("markets" as any).from("trade_journal" as any)
        .select("*")
        .order("entry_date", { ascending: false });

      if (filters?.symbol)      q = q.ilike("symbol", filters.symbol);
      if (filters?.portfolioId) q = q.eq("portfolio_id", filters.portfolioId);
      if (filters?.outcome && filters.outcome !== "all") q = q.eq("outcome", filters.outcome);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as TradeJournalEntry[];
    },
    staleTime: 30_000,
  });
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export function useTradeStats(): TradeStats {
  const { data: trades = [] } = useTrades();

  return useMemo<TradeStats>(() => {
    const closed = trades.filter((t) => t.outcome !== "open" && t.pnl != null);
    const wins   = closed.filter((t) => t.outcome === "win");
    const losses = closed.filter((t) => t.outcome === "loss");

    const win_rate   = closed.length > 0 ? wins.length / closed.length : 0;
    const total_pnl  = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const avg_pnl    = closed.length > 0 ? total_pnl / closed.length : 0;
    const avg_pnl_pct = closed.length > 0
      ? closed.reduce((s, t) => s + (t.pnl_pct ?? 0), 0) / closed.length
      : 0;

    const sum_wins   = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const sum_losses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const profit_factor = sum_losses > 0 ? sum_wins / sum_losses : sum_wins > 0 ? Infinity : 0;

    const best_trade  = closed.length > 0
      ? closed.reduce((b, t) => ((t.pnl ?? 0) > (b.pnl ?? 0) ? t : b), closed[0])
      : null;
    const worst_trade = closed.length > 0
      ? closed.reduce((w, t) => ((t.pnl ?? 0) < (w.pnl ?? 0) ? t : w), closed[0])
      : null;

    return {
      total_trades:  trades.length,
      win_rate:      Math.round(win_rate * 1000) / 1000,
      avg_pnl:       Math.round(avg_pnl * 100) / 100,
      avg_pnl_pct:   Math.round(avg_pnl_pct * 100) / 100,
      best_trade:    best_trade ?? null,
      worst_trade:   worst_trade ?? null,
      profit_factor: Math.round(profit_factor * 100) / 100,
      total_pnl:     Math.round(total_pnl * 100) / 100,
    };
  }, [trades]);
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useCreateTrade() {
  const queryClient = useQueryClient();
  const { user }    = useAuth();
  return useMutation<TradeJournalEntry, Error, CreateTradeInput>({
    mutationFn: async (input) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { pnl, pnl_pct, outcome } = computePnl(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.schema("markets" as any).from("trade_journal" as any)
        .insert({
          user_id:       user.id,
          symbol:        input.symbol.toUpperCase(),
          exchange:      input.exchange ?? "NSE",
          portfolio_id:  input.portfolio_id ?? null,
          instrument_id: input.instrument_id ?? null,
          direction:     input.direction,
          entry_date:    input.entry_date,
          exit_date:     input.exit_date ?? null,
          entry_price:   input.entry_price,
          exit_price:    input.exit_price ?? null,
          qty:           input.qty,
          charges:       input.charges ?? 0,
          pnl,
          pnl_pct,
          outcome,
          rationale:     input.rationale ?? null,
          exit_reason:   input.exit_reason ?? null,
          tags:          input.tags ?? [],
          emotion:       input.emotion ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as TradeJournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.journal.all() });
    },
  });
}

export function useUpdateTrade() {
  const queryClient = useQueryClient();
  return useMutation<TradeJournalEntry, Error, UpdateTradeInput>({
    mutationFn: async ({ id, ...rest }) => {
      // Recompute P&L if exit_price is being updated
      const updates: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

      if (rest.exit_price != null) {
        // Need the existing row to recompute correctly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await supabase.schema("markets" as any).from("trade_journal" as any)
          .select("entry_price, qty, charges, direction")
          .eq("id", id)
          .single();
        if (existing) {
          const { pnl, pnl_pct, outcome } = computePnl({
            ...(existing as { entry_price: number; qty: number; charges: number; direction: TradeDirection }),
            exit_price: rest.exit_price,
            entry_date: "",
            symbol:     "",
          });
          updates.pnl     = pnl;
          updates.pnl_pct = pnl_pct;
          updates.outcome = outcome;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.schema("markets" as any).from("trade_journal" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as TradeJournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.journal.all() });
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.schema("markets" as any).from("trade_journal" as any)
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.journal.all() });
    },
  });
}

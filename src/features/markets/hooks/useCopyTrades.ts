/**
 * Markets — Copy Trading hooks.
 *
 *   useCopyTrades(status?)       → list of copy trades
 *   useStartCopying()            → POST /v1/copy-trades
 *   useUpdateCopyTrade()         → PATCH /v1/copy-trades/:id
 *   useStopCopying()             → DELETE /v1/copy-trades/:id
 *   useCopyExecutions()          → GET /v1/copy-trades/executions
 *   useExecuteCopyTrade()        → POST /v1/copy-trades/:id/execute
 *   useTraderLeaderboard()       → GET /v1/copy-trades/leaderboard  (staleTime 10 min)
 *   usePortfolios()              → user's portfolios from markets.portfolios via Supabase
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface CopyTrade {
  id: string;
  trader_id: string;
  paper_portfolio_id: string;
  status: "active" | "paused" | "stopped";
  allocation_pct: number;
  created_at: string;
  trader_idea_count: number;
  execution_count: number;
}

export interface CopyExecution {
  id: string;
  copy_trade_id: string;
  idea_id?: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  amount: number;
  executed_at: string;
}

export interface TraderLeaderboard {
  user_id: string;
  idea_count: number;
  follower_count: number;
  avg_potential_return_pct: number;
}

export interface PaperPortfolio {
  id: string;
  name: string;
  portfolio_type: string;
}

// ─── Query key factory ────────────────────────────────────────────────────

const copyTradeKeys = {
  all: ["markets", "copy-trades"] as const,
  list: (status?: string) => [...copyTradeKeys.all, "list", status ?? "all"] as const,
  executions: () => [...copyTradeKeys.all, "executions"] as const,
  leaderboard: () => [...copyTradeKeys.all, "leaderboard"] as const,
  portfolios: (userId: string) => ["markets", "copy-portfolios", userId] as const,
};

// ─── Auth helper ──────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function workerFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      "Markets worker not reachable. Ensure VITE_MARKETS_WORKER_URL is set and the worker is running.",
    );
  }

  if (res.status === 204) return undefined as unknown as T;

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Worker error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── useCopyTrades ────────────────────────────────────────────────────────

export function useCopyTrades(status?: "active" | "paused" | "stopped") {
  return useQuery<CopyTrade[]>({
    queryKey: copyTradeKeys.list(status),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const params = status ? `?status=${status}` : "";
      return workerFetch<CopyTrade[]>(`/v1/copy-trades${params}`);
    },
  });
}

// ─── useStartCopying ─────────────────────────────────────────────────────

interface StartCopyingInput {
  trader_id: string;
  paper_portfolio_id: string;
  allocation_pct: number;
}

export function useStartCopying() {
  const queryClient = useQueryClient();

  return useMutation<CopyTrade, Error, StartCopyingInput>({
    mutationFn: (input) =>
      workerFetch<CopyTrade>("/v1/copy-trades", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: copyTradeKeys.all });
    },
  });
}

// ─── useUpdateCopyTrade ───────────────────────────────────────────────────

interface UpdateCopyTradeInput {
  id: string;
  status?: "active" | "paused" | "stopped";
  allocation_pct?: number;
}

export function useUpdateCopyTrade() {
  const queryClient = useQueryClient();

  return useMutation<CopyTrade, Error, UpdateCopyTradeInput>({
    mutationFn: ({ id, ...body }) =>
      workerFetch<CopyTrade>(`/v1/copy-trades/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: copyTradeKeys.all });
    },
  });
}

// ─── useStopCopying ───────────────────────────────────────────────────────

export function useStopCopying() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      workerFetch<void>(`/v1/copy-trades/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: copyTradeKeys.all });
    },
  });
}

// ─── useCopyExecutions ────────────────────────────────────────────────────

export function useCopyExecutions() {
  return useQuery<CopyExecution[]>({
    queryKey: copyTradeKeys.executions(),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    queryFn: () => workerFetch<CopyExecution[]>("/v1/copy-trades/executions"),
  });
}

// ─── useExecuteCopyTrade ──────────────────────────────────────────────────

interface ExecuteCopyTradeInput {
  id: string;
  idea_id: string;
  side: "BUY" | "SELL";
  quantity?: number;
}

interface ExecuteCopyTradeResult {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  amount: number;
  executed_at: string;
}

export function useExecuteCopyTrade() {
  const queryClient = useQueryClient();

  return useMutation<ExecuteCopyTradeResult, Error, ExecuteCopyTradeInput>({
    mutationFn: ({ id, ...body }) =>
      workerFetch<ExecuteCopyTradeResult>(`/v1/copy-trades/${id}/execute`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: copyTradeKeys.executions() });
      queryClient.invalidateQueries({ queryKey: copyTradeKeys.list() });
    },
  });
}

// ─── useTraderLeaderboard ─────────────────────────────────────────────────

export function useTraderLeaderboard() {
  return useQuery<TraderLeaderboard[]>({
    queryKey: copyTradeKeys.leaderboard(),
    staleTime: 10 * 60_000,   // 10 minutes
    gcTime: 30 * 60_000,
    queryFn: () => workerFetch<TraderLeaderboard[]>("/v1/copy-trades/leaderboard"),
  });
}

// ─── usePortfolios ────────────────────────────────────────────────────────
// Loads user's paper portfolios directly from Supabase markets schema.

export function usePortfolios() {
  const { user } = useAuth();

  return useQuery<PaperPortfolio[]>({
    queryKey: copyTradeKeys.portfolios(user?.id ?? ""),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("portfolios")
        .select("id, name, portfolio_type")
        .eq("user_id", user.id);
      if (error) throw new Error(error.message ?? "Failed to load portfolios");
      return (data ?? []) as PaperPortfolio[];
    },
  });
}

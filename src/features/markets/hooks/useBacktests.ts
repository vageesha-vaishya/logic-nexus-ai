/**
 * Markets — backtests hooks.
 *
 *   useBacktests(filters?)   → react-query list from markets.backtests
 *   useRunBacktest()         → mutation: POST /v1/jobs/backtest to Python worker
 *   usePollBacktest(jobId?)  → polls GET /v1/jobs/{jobId} while queued/running
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type { Backtest, BacktestStatus, RunBacktestInput } from "../types";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

function useActiveScope() {
  const { roles, user } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId:    active?.tenant_id    ?? null,
    franchiseId: active?.franchise_id ?? null,
    userId:      user?.id             ?? null,
  };
}

const ACTIVE_STATUSES: BacktestStatus[] = ["queued", "running"];

// ── List ──────────────────────────────────────────────────────────────────

export function useBacktests(filters?: { strategyId?: string | null }) {
  return useQuery({
    queryKey: marketsKeys.backtests.list(filters),
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<Backtest[]> => {
      let q = (supabase as any)
        .schema("markets")
        .from("backtests")
        .select(
          "id, strategy_id, status, progress, period_from, period_to, " +
          "initial_capital, commission_model, metrics, error, worker_job_id, " +
          "started_at, finished_at, params",
        )
        .order("started_at", { ascending: false })
        .limit(30);

      if (filters?.strategyId) {
        q = q.eq("strategy_id", filters.strategyId);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message ?? "Failed to load backtests");
      return (data ?? []) as Backtest[];
    },
    // Poll every 3 s if any backtest is queued or running
    refetchInterval: (query) => {
      const list = query.state.data as Backtest[] | undefined;
      const hasActive = list?.some((b) => ACTIVE_STATUSES.includes(b.status));
      return hasActive ? 3_000 : false;
    },
  });
}

// ── Run backtest ──────────────────────────────────────────────────────────

interface RunBacktestResult {
  backtest_id: string;
  job_id: string;
  status: string;
}

export function useRunBacktest() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<RunBacktestResult, Error, RunBacktestInput>({
    mutationFn: async (input) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      if (!tenantId || !franchiseId) throw new Error("Missing tenant/franchise context");

      let res: Response;
      try {
        res = await fetch(`${WORKER_URL}/v1/jobs/backtest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-tenant-id": tenantId,
            "x-franchise-id": franchiseId,
          },
          body: JSON.stringify({
            strategy_id:     input.strategy_id,
            period_from:     input.period_from,
            period_to:       input.period_to,
            initial_capital: input.initial_capital ?? 1_000_000,
          }),
        });
      } catch {
        throw new Error(
          "Markets worker not running. Start it with: uv run python -m markets_worker.worker",
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Worker error ${res.status}: ${text}`);
      }

      return res.json() as Promise<RunBacktestResult>;
    },
    onSuccess: () => {
      // Give the worker 2 s to write the DB row before invalidating
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: marketsKeys.backtests.all() });
      }, 2_000);
    },
  });
}

// ── Poll a single job ─────────────────────────────────────────────────────

interface PollJobResult {
  job_id: string;
  backtest_id: string;
  status: BacktestStatus;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
}

export function usePollBacktest(jobId?: string | null) {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<PollJobResult | null>({
    queryKey: ["markets", "jobs", "poll", jobId ?? ""],
    enabled: Boolean(jobId),
    staleTime: 0,
    gcTime: 60_000,
    queryFn: async (): Promise<PollJobResult | null> => {
      if (!jobId) return null;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      let res: Response;
      try {
        res = await fetch(`${WORKER_URL}/v1/jobs/${jobId}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-tenant-id": tenantId ?? "",
            "x-franchise-id": franchiseId ?? "",
          },
        });
      } catch {
        throw new Error(
          "Markets worker not running. Start it with: uv run python -m markets_worker.worker",
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Worker error ${res.status}: ${text}`);
      }

      return res.json() as Promise<PollJobResult>;
    },
    refetchInterval: (query) => {
      const result = query.state.data as PollJobResult | null | undefined;
      if (!result) return false;
      return ACTIVE_STATUSES.includes(result.status) ? 3_000 : false;
    },
  });
}

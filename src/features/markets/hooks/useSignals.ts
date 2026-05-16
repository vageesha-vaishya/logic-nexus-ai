/**
 * Markets — signals hooks.
 *
 *   useSignals(filters?)          → react-query list from markets.signals
 *   useRunPortfolioSignals()      → mutation: POST /v1/jobs/signals/portfolio
 *                                    to the Python worker (markets-worker)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type { Signal } from "../types";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

function useActiveScope() {
  const { roles } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId:    active?.tenant_id    ?? null,
    franchiseId: active?.franchise_id ?? null,
  };
}

// ── List ──────────────────────────────────────────────────────────────────

export function useSignals(filters?: { portfolioId?: string | null; limit?: number }) {
  const limit = filters?.limit ?? 50;

  return useQuery({
    queryKey: marketsKeys.signals.list(filters),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<Signal[]> => {
      let q = (supabase as any)
        .schema("markets")
        .from("signals")
        .select(
          "id, ts, instrument_id, strategy_id, portfolio_id, signal_type, direction, " +
          "confidence, score, rationale, price_at_signal, generated_by, expires_at, metadata, " +
          "instrument:instruments(symbol, exchange, instrument_type)",
        )
        .order("ts", { ascending: false })
        .limit(limit);

      if (filters?.portfolioId) {
        q = q.eq("portfolio_id", filters.portfolioId);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message ?? "Failed to load signals");
      return (data ?? []) as Signal[];
    },
  });
}

// ── Run signals for a portfolio ───────────────────────────────────────────

interface RunSignalsInput {
  portfolioId: string;
}

interface RunSignalsResult {
  job_id: string;
  portfolio_id: string;
  status: string;
}

export function useRunPortfolioSignals() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<RunSignalsResult, Error, RunSignalsInput>({
    mutationFn: async ({ portfolioId }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      if (!tenantId || !franchiseId) throw new Error("Missing tenant/franchise context");

      const res = await fetch(`${WORKER_URL}/v1/jobs/signals/portfolio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-tenant-id": tenantId,
          "x-franchise-id": franchiseId,
        },
        body: JSON.stringify({ portfolio_id: portfolioId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Worker error ${res.status}: ${text}`);
      }

      return res.json() as Promise<RunSignalsResult>;
    },
    onSuccess: () => {
      // Invalidate after a short delay so the RQ job has time to complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: marketsKeys.signals.all() });
      }, 4000);
    },
  });
}

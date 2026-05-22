/**
 * useDiagnostic — Phase 1 Addendum T19.
 *
 * Calls the `markets-portfolio-diagnostic` edge function. The function
 * is idempotent per (user, UTC date): a same-day refresh returns the
 * cached row rather than re-billing the LLM. We use a long staleTime
 * because the diagnostic is meant to be a daily artifact, not intraday.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "../../hooks/queryKeys";

export type DiagnosticActionType =
  | "rebalance"
  | "view_harvest"
  | "view_stress_test"
  | "view_portfolio";

export interface DiagnosticSuggestedAction {
  type:    DiagnosticActionType;
  tier?:   "foundation" | "core" | "satellite";
  symbol?: string;
  reason:  string;
}

export interface DiagnosticPayload {
  headline:          string;
  findings:          string[];
  suggested_actions: DiagnosticSuggestedAction[];
  metrics: {
    concentration_score: number | null;
    tier_skew_score:     number | null;
    drawdown_score:      number | null;
    beta_score:          number | null;
    top1_symbol:         string | null;
    top1_weight_pct:     number | null;
    top3_weight_pct:     number | null;
  };
}

export interface DiagnosticRow {
  id:            string;
  generated_at:  string;
  payload:       DiagnosticPayload;
  source:        "llm" | "fallback" | "error";
  llm_model:     string | null;
  llm_provider:  string | null;
}

export function useDiagnostic() {
  return useQuery<DiagnosticRow | null, Error>({
    queryKey: marketsKeys.retail.diagnostic(),
    staleTime: 30 * 60_000, // 30 min — daily diagnostic; don't refetch on every focus
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke<{ data: DiagnosticRow | null }>(
        "markets-portfolio-diagnostic",
        { method: "POST" },
      );
      if (error) throw new Error(error.message ?? "diagnostic fetch failed");
      return data?.data ?? null;
    },
  });
}

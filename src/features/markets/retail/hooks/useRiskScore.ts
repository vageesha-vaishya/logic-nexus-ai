import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "../../hooks/queryKeys";

export interface RiskScoreComponents {
  concentration_score: number;
  tier_skew_score:     number;
  drawdown_score:      number;
  beta_score:          number;
  weights: {
    concentration: number;
    tier_skew:     number;
    drawdown:      number;
    beta:          number;
  };
  note?: string;
}

export interface RiskScoreSnapshot {
  score:        number;
  target_score: number;
  components:   RiskScoreComponents;
  computed_at:  string | null;
}

export interface RiskScoreResponse {
  current: RiskScoreSnapshot;
  history: Array<Omit<RiskScoreSnapshot, "components"> & { components: RiskScoreComponents }>;
}

/**
 * Dynamic risk score (Phase 1 Addendum T17).
 *
 * Invokes the `retail-risk-score` Supabase Edge Function (read + compute +
 * persist). Originally a fetch against the FastAPI markets-worker via
 * VITE_MARKETS_WORKER_URL, but that required the device to share a LAN with
 * the laptop — Sthira on LTE couldn't load this card. The edge function
 * lives on the public Supabase URL and works from any network. Maths and
 * response shape are identical (see supabase/functions/retail-risk-score/).
 *
 * 5-minute staleTime because every call appends to portfolio_risk_history,
 * and the inputs don't change intraday — over-fetching just inflates the
 * sparkline. Gated on a live session so we don't 401-spam the login path.
 */
export function useRiskScore() {
  return useQuery<RiskScoreResponse, Error>({
    queryKey: marketsKeys.retail.riskScore(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke<RiskScoreResponse>(
        "retail-risk-score",
        { method: "GET" },
      );

      if (error) {
        // FunctionsHttpError exposes the underlying Response on .context so
        // callers can still tell 412 = onboarding-not-complete apart from a
        // generic failure. We surface the server `detail` when available.
        const ctxResp = (error as { context?: Response }).context;
        let detail = "";
        let status = 0;
        if (ctxResp) {
          status = ctxResp.status;
          try {
            const body = await ctxResp.clone().json();
            if (typeof body?.detail === "string") detail = ` — ${body.detail}`;
          } catch {
            // non-JSON body — ignore
          }
        }
        throw new Error(`risk-score: ${status || error.message}${detail}`);
      }
      if (!data) throw new Error("risk-score: empty response");
      return data;
    },
  });
}

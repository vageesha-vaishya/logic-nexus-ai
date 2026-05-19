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

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

/**
 * Dynamic risk score (Phase 1 Addendum T17).
 *
 * GETs the markets-worker's compute-and-persist endpoint. We deliberately
 * use a 5-minute staleTime: the inputs (tier values, drawdown) don't change
 * intraday, and every call appends to portfolio_risk_history — over-fetching
 * would just inflate the sparkline with noise.
 *
 * Skips when there's no live Supabase session (the worker requires a user
 * JWT) so we don't spam 401s on the public login path.
 */
export function useRiskScore() {
  return useQuery<RiskScoreResponse, Error>({
    queryKey: marketsKeys.retail.riskScore(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${WORKER_URL}/v1/retail/risk-score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        // 412 = onboarding not yet complete — let the caller decide whether
        // to render a hint or just hide the card.
        let detail = "";
        try {
          const body = await resp.json();
          if (typeof body?.detail === "string") detail = ` — ${body.detail}`;
        } catch {
          // non-JSON body — ignore
        }
        throw new Error(`risk-score: ${resp.status}${detail}`);
      }
      return (await resp.json()) as RiskScoreResponse;
    },
  });
}

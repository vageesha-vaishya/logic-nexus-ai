import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "../../hooks/queryKeys";

export interface StressTestLoser {
  symbol:     string;
  qty:        number;
  value_pre:  number;
  value_post: number;
  loss_inr:   number;
  loss_pct:   number;
}

export interface StressTestScenario {
  code:                 string;
  label:                string;
  window:               string;
  description:          string;
  portfolio_value_post: number;
  loss_inr:             number;
  loss_pct:             number;
  top3_losers:          StressTestLoser[];
}

export interface StressTestResponse {
  as_of:           string;
  portfolio_value: number;
  holdings_count:  number;
  scenarios:       StressTestScenario[];
}

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

/**
 * Phase 1 addendum T18 — historical stress test.
 *
 * Fetches `/v1/retail/stress-test` and gates on a live Supabase session so
 * the public landing path doesn't fire 401s. The worker aggregates across
 * all user portfolios; the response is small (3 scenarios × top-3 losers)
 * so we don't paginate.
 *
 * `enabled` defaults to false so the request only fires when the consumer
 * (e.g. a sheet) actually opens — there's no point burning a worker call
 * when the user hasn't expressed interest.
 */
export function useStressTest(enabled: boolean = true) {
  return useQuery<StressTestResponse, Error>({
    queryKey:  marketsKeys.retail.stressTest(),
    staleTime: 10 * 60_000, // scenarios + holdings change rarely intraday
    enabled,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const resp = await fetch(`${WORKER_URL}/v1/retail/stress-test`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Stress test fetch failed: ${resp.status}`);
      return resp.json();
    },
  });
}

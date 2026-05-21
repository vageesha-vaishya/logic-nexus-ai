import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "../../hooks/queryKeys";

export interface HoldingsNewsItem {
  id:              string;
  ts:              string;
  source:          string | null;
  title:           string;
  sentiment_score: number | null;
  raw_url:         string | null;
}

export interface HoldingsNewsBucket {
  symbol: string;
  value:  number;
  news:   HoldingsNewsItem[];
}

export interface HoldingsNewsResponse {
  as_of:          string;
  lookback_hours: number;
  holdings:       HoldingsNewsBucket[];
}

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

/**
 * Phase 1 addendum T20 — holdings-aware market commentary (raw headlines).
 *
 * Fetches /v1/retail/holdings-news and groups headlines by the user's
 * top-3 holdings. LLM summarization is a follow-up that lands when worker
 * LLM keys are unblocked; v1 displays headlines verbatim.
 *
 * 15-min staleTime — news is timely but not minute-by-minute critical for
 * retail users; over-fetching costs both worker time and bandwidth on the
 * mobile build.
 */
export function useHoldingsNews() {
  return useQuery<HoldingsNewsResponse, Error>({
    queryKey:  marketsKeys.retail.holdingsNews(),
    staleTime: 15 * 60_000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const resp = await fetch(`${WORKER_URL}/v1/retail/holdings-news`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Holdings news fetch failed: ${resp.status}`);
      return resp.json();
    },
  });
}

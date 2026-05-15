/**
 * Markets — news events hook.
 *
 * Reads markets.news_events directly via supabase-js (the `markets` schema
 * is exposed via PostgREST; news_events is reference data with an
 * "authenticated SELECT, USING (true)" RLS policy).
 *
 * Per ADR-025: server state in react-query; no direct supabase-js in
 * components. This hook is the only consumer of the supabase client for
 * news in the markets domain.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "./queryKeys";
import type { NewsEvent } from "../types";

interface UseNewsEventsOptions {
  /** Filter to news mentioning this NSE/BSE symbol (matches instruments[]). */
  instrument?: string;
  /** Max rows; default 20. Server enforces with .limit(). */
  limit?: number;
  /** Refresh interval in ms. Default 60_000 (1 min). Use 0 to disable. */
  refetchIntervalMs?: number;
}

export function useNewsEvents({
  instrument,
  limit = 20,
  refetchIntervalMs = 60_000,
}: UseNewsEventsOptions = {}) {
  return useQuery({
    queryKey: marketsKeys.news.list({ instrument, limit }),
    queryFn: async (): Promise<NewsEvent[]> => {
      let query = (supabase as any)
        .schema("markets")
        .from("news_events")
        .select(
          "id, ts, source, title, body, instruments, sentiment_score, raw_url, metadata, created_at",
        )
        .order("ts", { ascending: false })
        .limit(limit);

      if (instrument) {
        // instruments is a text[] column — Postgres contains operator @>
        query = query.contains("instruments", [instrument]);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message ?? "Failed to load news");
      return (data ?? []) as NewsEvent[];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: refetchIntervalMs > 0 ? refetchIntervalMs : false,
  });
}

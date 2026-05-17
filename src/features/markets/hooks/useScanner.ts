/**
 * Markets — Market Scanner hook.
 *
 * GET /v1/scanner?exchange=NSE&filters=...&match=any|all
 *   Fetches all NSE instruments whose signals match the requested technical
 *   filters. Results are cached on the worker for 5 minutes; the client
 *   refetches every 60s during market hours, 300s otherwise.
 */

import { useQuery } from "@tanstack/react-query";
import { marketsKeys } from "./queryKeys";
import { isMarketOpen } from "../utils/market-hours";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScanFilter =
  | "rsi_oversold"
  | "rsi_overbought"
  | "macd_bullish"
  | "macd_bearish"
  | "supertrend_buy"
  | "supertrend_sell"
  | "strong_buy"
  | "strong_sell"
  | "near_52w_high"
  | "near_52w_low";

export interface ScanResult {
  symbol:              string;
  exchange:            string;
  instrument_type:     string;
  direction:           "buy" | "sell" | "neutral";
  score:               number;
  confidence:          number;
  rationale:           string;
  ltp:                 number | null;
  change_pct:          number | null;
  rsi:                 number | null;
  macd_crossover:      string | null;
  supertrend:          string | null;
  signal_age_minutes:  number;
  matched_filters:     string[];
}

export interface ScannerResponse {
  filters:        string[];
  match:          "any" | "all";
  results:        ScanResult[];
  total_scanned:  number;
  total_matched:  number;
  as_of:          string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScanner(
  filters: ScanFilter[],
  match: "any" | "all" = "any",
  exchange = "NSE",
) {
  const refetchInterval = isMarketOpen() ? 60_000 : 300_000;

  return useQuery<ScannerResponse, Error>({
    queryKey: marketsKeys.signals.scanner(filters, match, exchange),
    staleTime: 60_000,
    refetchInterval,
    enabled: filters.length > 0,
    queryFn: async (): Promise<ScannerResponse> => {
      const params = new URLSearchParams({
        exchange,
        filters: filters.join(","),
        match,
        limit:   "200",
      });
      let res: Response;
      try {
        res = await fetch(`${WORKER_URL}/v1/signals/scanner?${params.toString()}`);
      } catch {
        throw new Error(
          "Markets worker not reachable. Start it with: uv run python -m markets_worker.worker",
        );
      }
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Scanner error ${res.status}: ${text}`);
      }
      return res.json() as Promise<ScannerResponse>;
    },
  });
}

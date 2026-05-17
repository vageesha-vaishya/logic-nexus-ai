/**
 * useChartData — fetches OHLCV + MA data for TradingChart.
 *
 * Endpoint: GET /v1/chart/{symbol}?exchange=…&interval=…&lookback=…&ma=…
 *
 * staleTime:
 *   intraday  (1m/5m/15m/1h) → 60 s
 *   daily+    (1d/1w)        → 5 min
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Local HTTP helpers (mirrors useFno.ts) ─────────────────────────────────────

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

function useActiveScope() {
  const { roles } = useAuth();
  const scoped = roles.find(r => Boolean(r.tenant_id) && Boolean(r.franchise_id))
               ?? roles.find(r => Boolean(r.tenant_id))
               ?? roles[0];
  return { tenantId: scoped?.tenant_id ?? null, franchiseId: scoped?.franchise_id ?? null };
}

async function workerFetch(
  method: string,
  path: string,
  token: string,
  tenantId: string,
  franchiseId: string,
  body?: object,
): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type":   "application/json",
      "Authorization":  `Bearer ${token}`,
      "x-tenant-id":    tenantId,
      "x-franchise-id": franchiseId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail ?? json?.error ?? `Worker ${res.status}`);
  return json;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OHLCVBar {
  /** "YYYY-MM-DD" for daily/weekly, UNIX timestamp (seconds) for intraday */
  time:   string | number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface MALine {
  time:  string | number;
  value: number;
}

export interface ChartPoint {
  time:  string | number;
  value: number;
}

export interface SuperTrendPoint {
  time:      string | number;
  value:     number;
  direction: "up" | "down";
}

export interface ChartData {
  symbol:     string;
  exchange:   string;
  interval:   string;
  bars:       OHLCVBar[];
  ma:         Record<string, MALine[]>;  // e.g. { "20": [...], "50": [...], "200": [...] }
  count:      number;
  bollinger?: { upper: ChartPoint[]; middle: ChartPoint[]; lower: ChartPoint[] };
  vwap?:      ChartPoint[];
  supertrend?: SuperTrendPoint[];
}

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

const INTRADAY: ChartInterval[] = ["1m", "5m", "15m", "1h"];

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseChartDataOptions {
  indicators?: string;  // e.g. "bb,vwap,supertrend" or "ha"
}

export function useChartData(
  symbol:   string | null,
  exchange: string = "NSE",
  interval: ChartInterval = "1d",
  lookback: number = 365,
  ma:       string = "",         // e.g. "20,50,200"
  options:  UseChartDataOptions = {},
): UseQueryResult<ChartData> {
  const { tenantId, franchiseId } = useActiveScope();

  const staleTime = INTRADAY.includes(interval) ? 60_000 : 5 * 60_000;

  return useQuery<ChartData>({
    queryKey: marketsKeys.chart.data(symbol!, exchange, interval, lookback),
    enabled:  Boolean(symbol),
    staleTime,
    queryFn: async () => {
      const token = await getToken();

      const params = new URLSearchParams({
        exchange,
        interval,
        lookback: String(lookback),
      });
      if (ma) params.set("ma", ma);
      if (options.indicators) params.set("indicators", options.indicators);

      const data = await workerFetch(
        "GET",
        `/v1/chart/${encodeURIComponent(symbol!)}?${params.toString()}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as ChartData;

      return data;
    },
  });
}

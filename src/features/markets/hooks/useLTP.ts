import { useQuery } from "@tanstack/react-query";
import { marketsKeys } from "./queryKeys";
import { isMarketOpen } from "../utils/market-hours";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

export interface LTPQuote {
  symbol: string;
  exchange: string;
  ltp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  error?: string;
}

export function useLTP(symbols: string[], exchange = "NSE") {
  const sorted = [...symbols].sort();
  return useQuery<Record<string, LTPQuote>>({
    queryKey: marketsKeys.ltp.batch(sorted, exchange),
    queryFn: async () => {
      const params = new URLSearchParams({ symbols: sorted.join(","), exchange });
      const res = await fetch(`${WORKER_URL}/v1/ltp?${params.toString()}`);
      if (!res.ok) throw new Error(`LTP fetch failed (${res.status})`);
      const json = await res.json();
      const map: Record<string, LTPQuote> = {};
      for (const q of (json.quotes ?? []) as LTPQuote[]) {
        map[q.symbol] = q;
      }
      return map;
    },
    enabled: sorted.length > 0,
    refetchInterval: () => isMarketOpen() ? 5_000 : 60_000,
    staleTime: 5_000,
  });
}

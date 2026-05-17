import { useQuery } from "@tanstack/react-query";
import { marketsKeys } from "./queryKeys";

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

function isMarketOpen(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins < 930; // 9:15 – 15:30 IST
}

export function useLTP(symbols: string[], exchange = "NSE") {
  const sorted = [...symbols].sort();
  return useQuery<Record<string, LTPQuote>>({
    queryKey: marketsKeys.ltp.batch(sorted, exchange),
    queryFn: async () => {
      const params = new URLSearchParams({ symbols: sorted.join(","), exchange });
      const res = await fetch(`/v1/ltp?${params.toString()}`);
      if (!res.ok) throw new Error(`LTP fetch failed (${res.status})`);
      const json = await res.json();
      const map: Record<string, LTPQuote> = {};
      for (const q of (json.quotes ?? []) as LTPQuote[]) {
        map[q.symbol] = q;
      }
      return map;
    },
    enabled: sorted.length > 0,
    refetchInterval: isMarketOpen() ? 5_000 : 60_000,
    staleTime: 5_000,
  });
}

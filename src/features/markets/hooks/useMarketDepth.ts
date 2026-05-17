/**
 * Fetches Level 2 market depth (5-level bid/ask order book) for a single symbol.
 *
 * GET ${WORKER_URL}/v1/depth/{symbol}?exchange=NSE
 *
 * Refreshes every 3 s during market hours, 30 s otherwise.
 * The backend caches for 3 s, so rapid re-renders are cheap.
 */

import { useQuery } from "@tanstack/react-query";
import { isMarketOpen } from "../utils/market-hours";

const WORKER_URL =
  import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

export interface DepthLevel {
  price: number;
  qty: number;
  orders: number;
}

export interface MarketDepth {
  symbol: string;
  exchange: string;
  ltp: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
  total_bid_qty: number;
  total_ask_qty: number;
  is_simulated: boolean;
  as_of: number;
}

export function useMarketDepth(symbol: string, exchange = "NSE") {
  return useQuery<MarketDepth>({
    queryKey: ["markets", "depth", symbol.toUpperCase(), exchange.toUpperCase()],
    queryFn: async () => {
      const params = new URLSearchParams({ exchange });
      const res = await fetch(
        `${WORKER_URL}/v1/depth/${encodeURIComponent(symbol)}?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`Depth fetch failed (${res.status})`);
      return res.json() as Promise<MarketDepth>;
    },
    enabled: Boolean(symbol),
    refetchInterval: () => (isMarketOpen() ? 3_000 : 30_000),
    staleTime: 3_000,
  });
}

/**
 * useMarketBreadth — fetches sector heatmap and market breadth data.
 *
 * Endpoint: GET /v1/ltp/breadth
 * staleTime:  4 minutes
 * refetchInterval: 5 minutes
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SectorData {
  sector: string;
  ticker: string;
  change_pct: number | null;
  ltp: number | null;
}

export interface IndexData {
  name: string;
  ticker: string;
  change_pct: number | null;
  ltp: number | null;
}

export interface AdvanceDecline {
  advances: number;
  declines: number;
  unchanged: number;
}

export interface BreadthData {
  sectors: SectorData[];
  indices: IndexData[];
  advance_decline: AdvanceDecline;
  as_of: string;
  is_stale: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useMarketBreadth(): UseQueryResult<BreadthData> {
  return useQuery<BreadthData>({
    queryKey: [...marketsKeys.ltp.all(), "breadth"] as const,
    queryFn: async () => {
      const res = await fetch(`${WORKER_URL}/v1/ltp/breadth`);
      if (!res.ok) throw new Error("breadth fetch failed");
      return res.json() as Promise<BreadthData>;
    },
    refetchInterval: 5 * 60_000, // 5 min
    staleTime: 4 * 60_000,       // 4 min
  });
}

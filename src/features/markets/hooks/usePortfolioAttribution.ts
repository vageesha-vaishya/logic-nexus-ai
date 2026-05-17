/**
 * Markets — Portfolio Performance Attribution hook.
 * Fetches attribution data from the markets worker API.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AttributionPosition {
  symbol: string;
  sector: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  invested: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  contribution_pct: number;
}

export interface AttributionSector {
  sector: string;
  invested: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  weight_pct: number;
  contribution_pct: number;
  position_count: number;
}

export interface AttributionData {
  portfolio_id: string;
  as_of: string;
  lookback_days: number;
  summary: {
    total_invested: number;
    total_current_value: number;
    total_pnl: number;
    total_pnl_pct: number;
    position_count: number;
  };
  positions: AttributionPosition[];
  sectors: AttributionSector[];
  top_contributors: AttributionPosition[];
  bottom_contributors: AttributionPosition[];
  monthly_flows: {
    month: string;
    buy_amount: number;
    sell_amount: number;
    net_flow: number;
  }[];
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePortfolioAttribution(portfolioId: string, lookback = 365) {
  const { session } = useAuth();

  return useQuery<AttributionData>({
    queryKey: ["portfolio", "attribution", portfolioId, lookback],
    queryFn: async () => {
      const res = await fetch(
        `${WORKER_URL}/v1/portfolio/attribution/${portfolioId}?lookback=${lookback}`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AttributionData>;
    },
    enabled: !!portfolioId && !!session?.access_token,
    staleTime: 5 * 60_000,
  });
}

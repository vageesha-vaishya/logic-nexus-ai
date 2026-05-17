/**
 * useTaxPnL — Tax P&L query hook for the Markets domain.
 * Fetches realized trades, unrealized positions, and tax estimates
 * for a given portfolio and financial year.
 *
 * API: GET /v1/tax/:portfolioId/pnl?fy=2024-25
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface TaxPnLData {
  portfolio_id: string;
  fy: string;
  fy_start: string;
  fy_end: string;
  as_of: string;
  summary: {
    equity_stcg: number;
    equity_ltcg: number;
    equity_ltcg_exempt: number;
    equity_ltcg_taxable: number;
    equity_stcg_tax_est: number;
    equity_ltcg_tax_est: number;
    total_tax_est: number;
    total_realized_gain: number;
    total_unrealized_gain: number;
    harvesting_opportunity: number;
  };
  realized_trades: RealizedTrade[];
  unrealized_positions: UnrealizedPosition[];
  available_fy_options: string[];
}

export interface RealizedTrade {
  symbol: string;
  asset_class: string;
  buy_date: string;
  sell_date: string;
  qty: number;
  buy_price: number;
  sell_price: number;
  gain: number;
  holding_days: number;
  gain_type: "STCG" | "LTCG";
  tax_rate_pct: number;
}

export interface UnrealizedPosition {
  symbol: string;
  asset_class: string;
  qty: number;
  avg_buy_price: number;
  current_price: number;
  unrealized_gain: number;
  oldest_buy_date: string;
  holding_days: number;
  gain_type: "STCG" | "LTCG";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTaxPnL(portfolioId: string, fy: string) {
  const { session } = useAuth();

  return useQuery<TaxPnLData>({
    queryKey: ["tax", "pnl", portfolioId, fy],
    queryFn: async () => {
      const res = await fetch(
        `${WORKER_URL}/v1/tax/${portfolioId}/pnl?fy=${fy}`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<TaxPnLData>;
    },
    enabled: !!portfolioId && !!session?.access_token,
    staleTime: 10 * 60_000,
  });
}

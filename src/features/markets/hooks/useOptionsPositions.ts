/**
 * useOptionsPositions — fetches live option positions with Greeks, IV,
 * P&L and theta decay for a portfolio.
 *
 * Endpoint: GET /v1/options/positions/{portfolioId}
 * Auth: Supabase JWT (same pattern as useChartData.ts)
 * Refetch: 10 s during market hours, 5 min otherwise.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import { isMarketOpen } from "../utils/market-hours";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Auth helpers (mirrors useChartData.ts) ────────────────────────────────────

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

function useActiveScope() {
  const { roles } = useAuth();
  const scoped =
    roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id)) ??
    roles.find((r) => Boolean(r.tenant_id)) ??
    roles[0];
  return { tenantId: scoped?.tenant_id ?? null, franchiseId: scoped?.franchise_id ?? null };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OptionPosition {
  symbol: string;
  underlying: string;
  option_type: "CE" | "PE";
  strike: number;
  expiry: string | null;
  days_to_expiry: number;
  qty: number;
  avg_cost: number;
  current_premium: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  moneyness: "ITM" | "ATM" | "OTM" | null;
  underlying_spot: number | null;
  theta_inr_per_day: number | null;
  lot_size: number;
}

export interface NetGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  theta_inr_per_day: number;
}

export interface OptionsPositionsData {
  portfolio_id: string;
  positions: OptionPosition[];
  net_greeks: NetGreeks;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOptionsPositions(portfolioId: string | undefined) {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<OptionsPositionsData>({
    queryKey: portfolioId
      ? marketsKeys.options.positions(portfolioId)
      : [...marketsKeys.options.all(), "positions", "disabled"],
    enabled: Boolean(portfolioId),
    staleTime: 10_000,
    refetchInterval: () => (isMarketOpen() ? 10_000 : 300_000),
    queryFn: async (): Promise<OptionsPositionsData> => {
      const token = await getToken();
      const res = await fetch(
        `${WORKER_URL}/v1/options/positions/${portfolioId}`,
        {
          headers: {
            Authorization:    `Bearer ${token}`,
            "x-tenant-id":    tenantId ?? "",
            "x-franchise-id": franchiseId ?? "",
          },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as Record<string, string>)?.detail ??
          (err as Record<string, string>)?.error ??
          `Options fetch failed (${res.status})`,
        );
      }
      return res.json() as Promise<OptionsPositionsData>;
    },
  });
}

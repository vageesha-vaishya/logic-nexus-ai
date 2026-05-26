import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PnLPoint {
  date: string;
  nav: number;
  invested: number;
  pnl: number;
  pnl_pct: number;
}

export interface PnLSummary {
  current_nav: number;
  total_invested: number;
  total_pnl: number;
  pnl_pct: number;
  realized_pnl: number;
  unrealized_pnl: number;
}

export interface PnLData {
  portfolio_id: string;
  series: PnLPoint[];
  summary: PnLSummary;
}

/**
 * Portfolio P&L history.
 *
 * Invokes the `portfolio-pnl` Supabase Edge Function (transactions-replay +
 * price-history join). Was a fetch against the FastAPI markets-worker via
 * VITE_MARKETS_WORKER_URL — that broke for the Sthira APK on LTE because
 * the worker only listens on the laptop's LAN IP. The edge function is on
 * public Supabase and works from any network. Tenant/franchise headers
 * dropped (the endpoint scopes by JWT + portfolio ownership; tenant scoping
 * was inherited from the worker contract and never actually filtered here).
 *
 * 5-minute staleTime — the price-history join is the expensive part and
 * neither prices nor transactions change intraday once posted.
 */
export function usePortfolioPnL(portfolioId: string | undefined, lookback = 365) {
  return useQuery<PnLData>({
    queryKey: ["markets", "portfolio_pnl", portfolioId, lookback],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke<PnLData>(
        "portfolio-pnl",
        { body: { portfolio_id: portfolioId, lookback } },
      );

      if (error) {
        const ctxResp = (error as { context?: Response }).context;
        let detail = "";
        let status = 0;
        if (ctxResp) {
          status = ctxResp.status;
          try {
            const body = await ctxResp.clone().json();
            if (typeof body?.detail === "string") detail = body.detail;
            else if (typeof body?.error === "string") detail = body.error;
          } catch { /* non-JSON */ }
        }
        throw new Error(detail || `P&L fetch failed (${status || error.message})`);
      }
      if (!data) throw new Error("P&L fetch failed (empty response)");
      return data;
    },
    enabled: Boolean(portfolioId),
    staleTime: 5 * 60_000,
  });
}

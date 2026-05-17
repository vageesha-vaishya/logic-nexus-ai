import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

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

export function usePortfolioPnL(portfolioId: string | undefined, lookback = 365) {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<PnLData>({
    queryKey: ["markets", "portfolio_pnl", portfolioId, lookback],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(
        `${WORKER_URL}/v1/portfolio/pnl/${portfolioId}?lookback=${lookback}`,
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
        throw new Error(err?.detail ?? err?.error ?? `P&L fetch failed (${res.status})`);
      }
      return res.json() as Promise<PnLData>;
    },
    enabled: Boolean(portfolioId),
    staleTime: 5 * 60_000,
  });
}

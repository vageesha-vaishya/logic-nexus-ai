/**
 * Mutual Funds hooks — wraps /v1/mf/* endpoints on the Python worker.
 *
 *   useMfFunds(q, category)     → search/list funds (public, no auth)
 *   useMfFundDetail(schemeCode) → single fund with NAV history + returns (public)
 *   useMfPortfolio()            → user's MF holdings + summary (auth)
 *   useMfSips()                 → active SIPs for user (auth)
 *   usePlaceMfOrder()           → mutation: purchase / redemption / SIP (auth)
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Local HTTP helpers (same pattern as useFno.ts / useBrokerConnections.ts) ───

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
  method: string, path: string,
  token: string, tenantId: string, franchiseId: string,
  body?: object,
): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-tenant-id":    tenantId,
      "x-franchise-id": franchiseId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { detail?: string; error?: string })?.detail ?? (json as { detail?: string; error?: string })?.error ?? `Worker ${res.status}`);
  return json;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MfFund {
  id?:              string;
  symbol:           string;       // amfi_code
  isin:             string | null;
  instrument_type:  string;       // mf_equity | mf_debt | mf_hybrid | mf_index
  metadata:         { amfi_code?: string; scheme_name?: string } | null;
  scheme_name?:     string;       // from metadata or enriched
  fund_house?:      string | null;
  scheme_category?: string | null;
  current_nav?:     number | null;
  nav_date?:        string | null;
}

export interface MfFundDetail extends MfFund {
  scheme_type?:    string | null;
  returns?:        {
    "1w"?: number | null;
    "1m"?: number | null;
    "3m"?: number | null;
    "6m"?: number | null;
    "1y"?: number | null;
    "3y"?: number | null;
    "5y"?: number | null;
  };
  nav_history?:    Array<{ date: string; nav: string }>;
}

export interface MfHolding {
  id:              string;
  qty:             number;
  avg_cost:        number;
  realized_pnl:    number | null;
  folio_number:    string | null;
  sip_amount:      number | null;
  sip_date:        number | null;
  last_updated_at: string | null;
  metadata:        Record<string, unknown> | null;
  instrument:      {
    id:              string;
    symbol:          string;
    isin:            string | null;
    instrument_type: string;
    metadata:        { scheme_name?: string } | null;
  } | null;
  // enriched
  scheme_name?:    string;
  amfi_code?:      string;
  invested_value?: number;
  current_nav?:    number | null;
  current_value?:  number | null;
  gain?:           number | null;
  return_pct?:     number | null;
}

export interface MfSip {
  holding_id:    string;
  amfi_code:     string | null;
  isin:          string | null;
  scheme_name:   string;
  folio_number:  string | null;
  sip_amount:    number;
  sip_date:      number | null;
  next_sip_date: string | null;
  units_held:    number;
}

export interface MfPortfolioSummary {
  total_invested: number;
  total_current:  number;
  total_gain:     number;
  return_pct:     number;
  fund_count:     number;
}

export interface MfOrderInput {
  connection_id: string;
  amfi_code:     string;
  isin:          string;
  scheme_name:   string;
  order_type:    "PURCHASE" | "REDEMPTION" | "SIP";
  amount?:       number | null;
  units?:        number | null;
  folio_number?: string | null;
  sip_amount?:   number | null;
  sip_date?:     number | null;
  portfolio_id?: string | null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Search / list mutual funds — public endpoint, no auth headers required.
 */
export function useMfFunds(q: string, category: string): UseQueryResult<MfFund[]> {
  return useQuery<MfFund[]>({
    queryKey: marketsKeys.mf.funds(q, category),
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q)        params.set("q", q);
      if (category) params.set("category", category);
      const res = await fetch(`${WORKER_URL}/v1/mf/funds?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({})) as { funds?: MfFund[] };
      if (!res.ok) throw new Error((json as { detail?: string; error?: string })?.detail ?? (json as { detail?: string; error?: string })?.error ?? `Worker ${res.status}`);
      return json.funds ?? [];
    },
  });
}

/**
 * Fetch a single fund's detail including NAV history and returns — public endpoint.
 */
export function useMfFundDetail(schemeCode: string | null): UseQueryResult<MfFundDetail> {
  return useQuery<MfFundDetail>({
    queryKey: marketsKeys.mf.fund(schemeCode ?? ""),
    enabled: Boolean(schemeCode),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch(`${WORKER_URL}/v1/mf/funds/${schemeCode}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({})) as MfFundDetail;
      if (!res.ok) throw new Error((json as { detail?: string; error?: string } & MfFundDetail)?.detail ?? (json as { detail?: string; error?: string } & MfFundDetail)?.error ?? `Worker ${res.status}`);
      return json;
    },
  });
}

/**
 * Fetch the user's MF portfolio (holdings + summary) — requires auth.
 */
export function useMfPortfolio(): UseQueryResult<{ holdings: MfHolding[]; summary: MfPortfolioSummary }> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<{ holdings: MfHolding[]; summary: MfPortfolioSummary }>({
    queryKey: marketsKeys.mf.portfolio(),
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET", "/v1/mf/portfolio",
        token, tenantId ?? "", franchiseId ?? "",
      ) as { holdings: MfHolding[]; summary: MfPortfolioSummary };
      return data;
    },
  });
}

/**
 * Fetch the user's active SIPs — requires auth.
 */
export function useMfSips(): UseQueryResult<MfSip[]> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<MfSip[]>({
    queryKey: marketsKeys.mf.sips(),
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET", "/v1/mf/sips",
        token, tenantId ?? "", franchiseId ?? "",
      ) as { sips: MfSip[] };
      return data.sips ?? [];
    },
  });
}

/**
 * Place a mutual fund order (purchase / redemption / SIP) — requires auth.
 */
export function usePlaceMfOrder(): UseMutationResult<{ order_id: string | null; status: string }, Error, MfOrderInput> {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<{ order_id: string | null; status: string }, Error, MfOrderInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      return await workerFetch(
        "POST", "/v1/mf/orders",
        token, tenantId ?? "", franchiseId ?? "",
        input,
      ) as { order_id: string | null; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.mf.portfolio() });
      queryClient.invalidateQueries({ queryKey: marketsKeys.mf.sips() });
    },
  });
}

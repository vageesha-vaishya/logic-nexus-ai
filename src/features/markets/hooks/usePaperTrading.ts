/**
 * Paper trading hooks — wraps /v1/paper/* endpoints on the Python worker.
 *
 *   usePaperCapital(portfolioId)   → GET /v1/paper/capital/{portfolioId}
 *   useSeedPaperPortfolio()        → POST /v1/paper/portfolio/seed — mutation
 *   usePaperOrder()                → POST /v1/paper/order — mutation
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Auth helpers (same pattern as useMf.ts) ───────────────────────────────────

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

async function workerFetch(
  method: string,
  path: string,
  token: string,
  tenantId: string,
  franchiseId: string,
  body?: object,
): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-franchise-id": franchiseId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { detail?: string; error?: string })?.detail ??
        (json as { detail?: string; error?: string })?.error ??
        `Worker ${res.status}`,
    );
  }
  return json;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaperCapital {
  portfolio_id:    string;
  initial_capital: number;
  available_cash:  number;
  used_capital:    number;
  return_pct:      number;
}

export interface PaperOrderInput {
  portfolio_id:  string;
  instrument_id: string;
  symbol:        string;
  exchange:      string;
  txn_type:      "buy" | "sell";
  qty:           number;
}

export interface PaperOrderResult {
  fill_price:     number;
  qty:            number;
  total_value:    number;
  charges:        number;
  remaining_cash: number;
  message:        string;
}

export interface SeedResult {
  portfolio_id:    string;
  initial_capital: number;
  available_cash:  number;
  seeded:          boolean;
  message:         string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch available cash balance for a paper portfolio.
 */
export function usePaperCapital(portfolioId: string | undefined): UseQueryResult<PaperCapital> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<PaperCapital>({
    queryKey: marketsKeys.paper.capital(portfolioId ?? ""),
    enabled: Boolean(portfolioId) && Boolean(tenantId),
    staleTime: 15_000,
    queryFn: async () => {
      const token = await getToken();
      return (await workerFetch(
        "GET",
        `/v1/paper/capital/${portfolioId}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      )) as PaperCapital;
    },
  });
}

/**
 * Seed a paper portfolio with ₹10L virtual capital (idempotent).
 */
export function useSeedPaperPortfolio(): UseMutationResult<SeedResult, Error, { portfolio_id: string }> {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<SeedResult, Error, { portfolio_id: string }>({
    mutationFn: async (input) => {
      const token = await getToken();
      return (await workerFetch(
        "POST",
        "/v1/paper/portfolio/seed",
        token,
        tenantId ?? "",
        franchiseId ?? "",
        input,
      )) as SeedResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.paper.capital(data.portfolio_id) });
    },
  });
}

/**
 * Place a paper order — simulates fill at current LTP.
 */
export function usePaperOrder(): UseMutationResult<PaperOrderResult, Error, PaperOrderInput> {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<PaperOrderResult, Error, PaperOrderInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      return (await workerFetch(
        "POST",
        "/v1/paper/order",
        token,
        tenantId ?? "",
        franchiseId ?? "",
        input,
      )) as PaperOrderResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.paper.capital(variables.portfolio_id),
      });
      queryClient.invalidateQueries({
        queryKey: marketsKeys.portfolios.detail(variables.portfolio_id),
      });
    },
  });
}

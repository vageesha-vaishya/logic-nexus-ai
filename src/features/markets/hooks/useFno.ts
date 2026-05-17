/**
 * F&O (Futures & Options) hooks — wraps /v1/fno/* endpoints on the Python worker.
 *
 *   useFnoUnderlyings()          → list of F&O-able instruments (public)
 *   useOptionChain(symbol, expiry) → NSE-style option chain with greeks
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Local HTTP helpers (mirrors useBrokerConnections.ts — not exported there) ──

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
  if (!res.ok) throw new Error(json?.detail ?? json?.error ?? `Worker ${res.status}`);
  return json;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FnoUnderlying {
  symbol:   string;
  name:     string;
  type:     "index" | "equity";
  lot_size: number;
}

export interface OptionLeg {
  ltp:       number | null;
  bid:       number | null;
  ask:       number | null;
  iv:        number | null;
  oi:        number | null;
  oi_change: number | null;
  volume:    number | null;
  delta:     number | null;
  gamma:     number | null;
  theta:     number | null;
  vega:      number | null;
}

export interface OptionStrike {
  strike:   number;
  is_atm:   boolean;
  itm_call: boolean;
  itm_put:  boolean;
  ce:       OptionLeg | null;
  pe:       OptionLeg | null;
}

export interface OptionChain {
  symbol:       string;
  spot:         number;
  atm_strike:   number;
  expiry:       string;
  expiries:     string[];
  pcr:          number | null;
  max_pain:     number | null;
  lot_size:     number;
  generated_at: string;
  is_stale:     boolean;
  cached_at:    string | null;
  strikes:      OptionStrike[];
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Lists F&O underlyings — public endpoint, no auth headers required.
 */
export function useFnoUnderlyings(): UseQueryResult<FnoUnderlying[]> {
  return useQuery<FnoUnderlying[]>({
    queryKey: marketsKeys.fno.underlyings(),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch(`${WORKER_URL}/v1/fno/underlyings`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.detail ?? json?.error ?? `Worker ${res.status}`);
      }
      const data = await res.json() as { underlyings: FnoUnderlying[] };
      return data.underlyings ?? [];
    },
  });
}

/**
 * Fetches the NSE-style option chain for a given underlying and expiry.
 */
export function useOptionChain(
  symbol: string,
  expiry: string,
): UseQueryResult<OptionChain> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<OptionChain>({
    queryKey: marketsKeys.fno.chain(symbol, expiry),
    enabled: Boolean(symbol),
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams({ symbol });
      if (expiry) params.set("expiry", expiry);
      const data = await workerFetch(
        "GET",
        `/v1/fno/chain?${params.toString()}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as OptionChain;
      return data;
    },
  });
}

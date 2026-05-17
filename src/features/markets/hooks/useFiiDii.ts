/**
 * useFiiDii — fetches FII/DII institutional flow data from the markets worker.
 *
 * Endpoint: GET /v1/fii-dii?days={days}
 * staleTime: 60 minutes
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

function useActiveScope() {
  const { roles } = useAuth();
  const scoped =
    roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id)) ??
    roles.find((r) => Boolean(r.tenant_id)) ??
    roles[0];
  return {
    tenantId: scoped?.tenant_id ?? null,
    franchiseId: scoped?.franchise_id ?? null,
  };
}

async function workerFetch(
  path: string,
  token: string,
  tenantId: string,
  franchiseId: string,
): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-franchise-id": franchiseId,
    },
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail ?? json?.error ?? `Worker ${res.status}`);
  return json;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FiiDiiPoint {
  date: string;
  fii_net: number;
  dii_net: number;
  total_net: number;
}

export interface FiiDiiResponse {
  data: FiiDiiPoint[];
  is_stale: boolean;
  as_of: string;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFiiDii(days = 30): UseQueryResult<FiiDiiResponse> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<FiiDiiResponse>({
    queryKey: [...marketsKeys.all, "fii-dii", days] as const,
    staleTime: 60 * 60 * 1000, // 60 minutes
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams({ days: String(days) });
      const data = (await workerFetch(
        `/v1/fii-dii?${params.toString()}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      )) as FiiDiiResponse;
      return data;
    },
  });
}

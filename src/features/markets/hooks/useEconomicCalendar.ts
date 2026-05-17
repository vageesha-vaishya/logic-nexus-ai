/**
 * useEconomicCalendar — fetches economic calendar events from the markets worker.
 *
 * Endpoint: GET /v1/calendar?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&types=rbi,earnings,macro
 * staleTime: 30 minutes (events don't change often)
 * Default range: start of current month → 3 months forward
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

export type EventType = "rbi_mpc" | "earnings" | "macro" | "ipo" | "holiday";
export type EventImportance = "high" | "medium" | "low";

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  end_date?: string | null;
  title: string;
  type: EventType;
  description: string;
  importance: EventImportance;
  actual?: string | null;
  expected?: string | null;
  previous?: string | null;
}

interface CalendarResponse {
  events: CalendarEvent[];
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useEconomicCalendar(
  fromDate?: string,
  toDate?: string,
  types = "rbi,earnings,macro",
): UseQueryResult<CalendarResponse> {
  const { tenantId, franchiseId } = useActiveScope();
  const defaults = defaultDateRange();
  const fd = fromDate ?? defaults.from;
  const td = toDate ?? defaults.to;

  return useQuery<CalendarResponse>({
    queryKey: [...marketsKeys.all, "calendar", fd, td, types] as const,
    staleTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams({ from_date: fd, to_date: td, types });
      const data = (await workerFetch(
        `/v1/calendar?${params.toString()}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      )) as CalendarResponse;
      return data;
    },
  });
}

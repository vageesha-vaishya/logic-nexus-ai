import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "../../hooks/queryKeys";

export interface AppStatusBanner {
  id:         string;
  message:    string;
  severity:   "info" | "warning" | "error";
  starts_at:  string;
  ends_at:    string | null;
  is_active:  boolean;
  created_at: string;
}

/**
 * Operator-driven status banner for the retail surface (closed-beta #27).
 *
 * Returns the most recent currently-active banner OR null. "Currently
 * active" means is_active=true AND now() within [starts_at, COALESCE(ends_at, +∞)].
 *
 * 5-min staleTime so the operator can push a notice via Supabase Studio
 * and have it reach every connected user within minutes without a
 * rebuild. We deliberately don't use Supabase Realtime for this — the
 * extra connection isn't worth it for a low-frequency surface; polling
 * on tab focus is enough.
 */
export function useAppStatusBanner() {
  return useQuery<AppStatusBanner | null, Error>({
    queryKey:  marketsKeys.retail.appStatusBanner(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .schema("markets")
        .from("app_status_banners")
        .select("id, message, severity, starts_at, ends_at, is_active, created_at")
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("starts_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  });
}

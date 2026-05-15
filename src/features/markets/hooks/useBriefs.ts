/**
 * Markets — portfolio briefs (AI-generated analyses).
 *
 *   useBriefs(portfolioId)         → react-query list of past briefs
 *   useGenerateBrief(portfolioId)  → mutation that POSTs to
 *                                    markets-portfolio-brief Edge Function
 *
 * The brief edge function persists into markets.briefs (RLS-owned); the list
 * hook reads that table directly via supabase-js + .schema('markets').
 *
 * Per ADR-025: server state via react-query; no direct supabase calls in UI.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type { Brief } from "../types";

function useActiveScope(): { tenantId: string | null; franchiseId: string | null } {
  const { roles } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped = roles.find((r) => Boolean(r.tenant_id));
  const active = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId: active?.tenant_id ?? null,
    franchiseId: active?.franchise_id ?? null,
  };
}

/**
 * List briefs for a specific portfolio (most-recent first).
 * RLS in markets.briefs scopes to owner_user_id = auth.uid().
 */
export function useBriefs(portfolioId: string | undefined) {
  return useQuery({
    queryKey: portfolioId
      ? marketsKeys.briefs.list({ scope: "portfolio", ownerUserId: portfolioId })
      : marketsKeys.briefs.list(),
    enabled: Boolean(portfolioId),
    queryFn: async (): Promise<Brief[]> => {
      if (!portfolioId) return [];
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("briefs")
        .select(
          "id, ts, title, body, sources, llm_provider, llm_model, input_tokens, output_tokens, cost_usd, metadata",
        )
        .eq("scope", "portfolio")
        .eq("scope_ref_id", portfolioId)
        .order("ts", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message ?? "Failed to load briefs");
      return (data ?? []) as Brief[];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Trigger generation of a new brief for the portfolio.
 * On success, optimistically prepends the new brief into the cache + invalidates.
 */
export function useGenerateBrief(portfolioId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<Brief, Error, void>({
    mutationFn: async (): Promise<Brief> => {
      if (!portfolioId) throw new Error("No portfolio selected");
      if (!tenantId || !franchiseId) {
        throw new Error("Missing tenant/franchise context");
      }

      const { data, error } = await supabase.functions.invoke<{ data: Brief }>(
        "markets-portfolio-brief",
        {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
            "x-franchise-id": franchiseId,
          },
          body: { portfolio_id: portfolioId },
        },
      );

      if (error) throw new Error(error.message ?? "Failed to generate brief");
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: (created) => {
      if (!portfolioId) return;
      const listKey = marketsKeys.briefs.list({ scope: "portfolio", ownerUserId: portfolioId });
      queryClient.setQueryData<Brief[]>(listKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
      queryClient.invalidateQueries({ queryKey: marketsKeys.briefs.all() });
    },
  });
}

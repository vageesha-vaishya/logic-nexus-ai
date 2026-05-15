/**
 * Markets — portfolios hooks.
 *
 * Per ADR-025: server state lives in react-query; no direct supabase-js
 * imports from UI components. These hooks wrap the `markets-portfolios`
 * edge function which enforces auth, domain access (tenant_domain_assignments),
 * and RLS (owner_user_id = auth.uid()).
 *
 * Edge function contract (see supabase/functions/markets-portfolios/index.ts):
 *   GET  /markets-portfolios          → { data: Portfolio[], count }
 *   POST /markets-portfolios { name, description?, mode?, base_currency? }
 *     headers required: x-tenant-id, x-franchise-id
 *
 * v1 scope: list + create only. Update/delete intentionally deferred —
 * the edge function currently exposes GET + POST. Extend both when the UI
 * requires it.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type {
  CreatePortfolioInput,
  Portfolio,
  PortfoliosListResponse,
  PortfolioMutationResponse,
} from "../types";

/**
 * Resolves the user's "active" tenant/franchise from useAuth().
 *
 * v1 selection rule: prefer the *most-scoped* role.
 *   franchise_admin (has both tenant + franchise)  ← preferred
 *   > tenant_admin   (has tenant, no franchise)
 *   > platform_admin (no tenant, no franchise)
 *
 * This avoids the case where a user holding both tenant_admin and
 * franchise_admin roles would otherwise see `franchise_id=null` because
 * `roles[0]` happened to be the tenant-scoped row. POST requires both.
 *
 * Replace with a proper "current role" selector once the role-switcher
 * UI exists (D-1 in the design doc deferred-decisions table).
 */
function useActiveScope(): {
  tenantId: string | null;
  franchiseId: string | null;
  userId: string | null;
} {
  const { roles, user } = useAuth();

  // Prefer franchise-scoped, then tenant-scoped, then any role we have.
  const franchiseScoped = roles.find(
    (r) => Boolean(r.tenant_id) && Boolean(r.franchise_id),
  );
  const tenantScoped = roles.find((r) => Boolean(r.tenant_id));
  const active = franchiseScoped ?? tenantScoped ?? roles[0];

  return {
    tenantId: active?.tenant_id ?? null,
    franchiseId: active?.franchise_id ?? null,
    userId: user?.id ?? null,
  };
}

/**
 * List the authenticated user's portfolios.
 * RLS in markets.portfolios filters to owner_user_id = auth.uid().
 */
export function usePortfolios() {
  const { tenantId } = useActiveScope();

  return useQuery({
    queryKey: marketsKeys.portfolios.list({ tenantId }),
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<Portfolio[]> => {
      if (!tenantId) {
        // enabled:false should prevent this, but defensive guard
        throw new Error("No active tenant in user context");
      }

      const { data, error } = await supabase.functions.invoke<PortfoliosListResponse>(
        "markets-portfolios",
        {
          method: "GET",
          headers: { "x-tenant-id": tenantId },
        },
      );

      if (error) throw new Error(error.message ?? "Failed to fetch portfolios");
      return data?.data ?? [];
    },
    // Per ADR-025 default config — kept here as an override-ready surface
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Create a new portfolio for the current user under the active tenant/franchise.
 * Optimistically updates the list query on success.
 */
export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<Portfolio, Error, CreatePortfolioInput>({
    mutationFn: async (input: CreatePortfolioInput): Promise<Portfolio> => {
      if (!tenantId || !franchiseId) {
        throw new Error("Cannot create portfolio without tenant/franchise context");
      }
      if (!input.name || !input.name.trim()) {
        throw new Error("Portfolio name is required");
      }

      const { data, error } = await supabase.functions.invoke<PortfolioMutationResponse>(
        "markets-portfolios",
        {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
            "x-franchise-id": franchiseId,
          },
          body: {
            name: input.name.trim(),
            description: input.description ?? null,
            mode: input.mode ?? "paper",
            base_currency: input.base_currency ?? "INR",
          },
        },
      );

      if (error) throw new Error(error.message ?? "Failed to create portfolio");
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: (created) => {
      // Push the new row into every list-query cache for this tenant
      // and invalidate so any out-of-band filters refetch cleanly.
      queryClient.setQueriesData<Portfolio[]>(
        { queryKey: marketsKeys.portfolios.all() },
        (prev) => (prev ? [created, ...prev] : [created]),
      );
      queryClient.invalidateQueries({ queryKey: marketsKeys.portfolios.all() });
    },
  });
}

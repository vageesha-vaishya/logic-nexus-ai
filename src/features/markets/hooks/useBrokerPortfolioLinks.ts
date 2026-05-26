/**
 * useBrokerPortfolioLinks — CRUD for markets.broker_portfolio_links.
 *
 * The join table activates the segment-based routing rules described in
 * docs/plans/2026-05-26-broker-portfolio-routing-design.md:
 *   • One row per (broker_connection_id, portfolio_id, sync_filter).
 *   • RLS scopes everything to owner_user_id = auth.uid().
 *   • Cross-user isolation already verified by the
 *     markets_multibroker_rls SQL suite.
 *
 * sync_filter shape for v1 is always `{ "segments": ["equity"|"fno"|...] }`.
 * weight stays at 1.0 (partial-quantity allocation deferred).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "./queryKeys";

// ── Public types ──────────────────────────────────────────────────────────

export type RoutingSegment = "equity" | "fno" | "currency" | "commodity" | "mf";

export interface BrokerPortfolioLink {
  id:                   string;
  broker_connection_id: string;
  portfolio_id:         string;
  owner_user_id:        string;
  tenant_id:            string;
  franchise_id:         string;
  weight:               number;
  sync_filter:          { segments?: RoutingSegment[] } | null;
  is_active:            boolean;
  created_at:           string;
  updated_at:           string;
}

export interface CreateLinkInput {
  broker_connection_id: string;
  portfolio_id:         string;
  segments:             RoutingSegment[];
}

// ── Scope helper (mirrors usePortfolios) ──────────────────────────────────

function useActiveScope() {
  const { roles, user } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId:    active?.tenant_id    ?? null,
    franchiseId: active?.franchise_id ?? null,
    userId:      user?.id             ?? null,
  };
}

// ── List ──────────────────────────────────────────────────────────────────

export function useBrokerPortfolioLinks(connectionId: string | undefined) {
  return useQuery<BrokerPortfolioLink[]>({
    queryKey: connectionId
      ? marketsKeys.brokers.links(connectionId)
      : ["markets", "brokers", "links", "disabled"],
    enabled: Boolean(connectionId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!connectionId) return [];
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("broker_portfolio_links")
        .select(
          "id, broker_connection_id, portfolio_id, owner_user_id, " +
          "tenant_id, franchise_id, weight, sync_filter, is_active, " +
          "created_at, updated_at",
        )
        .eq("broker_connection_id", connectionId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message ?? "Failed to fetch routing rules");
      return (data ?? []) as BrokerPortfolioLink[];
    },
  });
}

// ── Create ────────────────────────────────────────────────────────────────

export function useCreateBrokerPortfolioLink() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId, userId } = useActiveScope();

  return useMutation<BrokerPortfolioLink, Error, CreateLinkInput>({
    mutationFn: async (input) => {
      if (!tenantId || !franchiseId || !userId) {
        throw new Error("Missing tenant / franchise / user context");
      }
      const row = {
        broker_connection_id: input.broker_connection_id,
        portfolio_id:         input.portfolio_id,
        owner_user_id:        userId,
        tenant_id:            tenantId,
        franchise_id:         franchiseId,
        sync_filter:          { segments: input.segments },
        weight:               1.0,
        is_active:            true,
      };
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("broker_portfolio_links")
        .insert(row)
        .select(
          "id, broker_connection_id, portfolio_id, owner_user_id, " +
          "tenant_id, franchise_id, weight, sync_filter, is_active, " +
          "created_at, updated_at",
        )
        .single();
      if (error) throw new Error(error.message ?? "Failed to create routing rule");
      return data as BrokerPortfolioLink;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.brokers.links(vars.broker_connection_id),
      });
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────

export function useDeleteBrokerPortfolioLink() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string; broker_connection_id: string }
  >({
    mutationFn: async ({ id }) => {
      const { error } = await (supabase as any)
        .schema("markets")
        .from("broker_portfolio_links")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message ?? "Failed to remove routing rule");
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.brokers.links(vars.broker_connection_id),
      });
    },
  });
}

// ── Default-destination switch (broker_connections.portfolio_id) ──────────
//
// Editing the connection's default portfolio without going through the
// whole connect flow. Mirrors useAddBrokerConnection's worker-fetch
// pattern but uses a direct PATCH-style update on the table. RLS
// (owner_user_id) gates it.

export function useSetDefaultPortfolio() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { broker_connection_id: string; portfolio_id: string | null }
  >({
    mutationFn: async ({ broker_connection_id, portfolio_id }) => {
      const { error } = await (supabase as any)
        .schema("markets")
        .from("broker_connections")
        .update({ portfolio_id })
        .eq("id", broker_connection_id);
      if (error) throw new Error(error.message ?? "Failed to update default portfolio");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.connections() });
    },
  });
}

/**
 * Markets — strategies hooks (full CRUD).
 *
 * All queries hit markets.strategies directly via supabase-js.
 * RLS (owner_user_id = auth.uid()) handles scoping automatically.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type { CreateStrategyInput, Strategy, StrategyLifecycle } from "../types";

export type UpdateStrategyInput = Partial<CreateStrategyInput> & {
  id: string;
  lifecycle_state?: StrategyLifecycle;
};

/** Prefer the most-scoped role: franchise_admin > tenant_admin > any. */
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

export function useStrategies() {
  return useQuery({
    queryKey: marketsKeys.strategies.list(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<Strategy[]> => {
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("strategies")
        .select(
          "id, name, description, dsl, lifecycle_state, universe, constraints, " +
          "tags, version, metadata, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message ?? "Failed to load strategies");
      return (data ?? []) as Strategy[];
    },
  });
}

// ── Create ────────────────────────────────────────────────────────────────

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId, userId } = useActiveScope();

  return useMutation<Strategy, Error, CreateStrategyInput>({
    mutationFn: async (input) => {
      if (!input.name?.trim()) throw new Error("Strategy name is required");

      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("strategies")
        .insert({
          name:        input.name.trim(),
          description: input.description  ?? null,
          dsl:         input.dsl          ?? null,
          universe:    input.universe     ?? null,
          tags:        input.tags         ?? [],
          tenant_id:   tenantId,
          franchise_id: franchiseId,
          owner_user_id: userId,
        })
        .select()
        .single();

      if (error) throw new Error(error.message ?? "Failed to create strategy");
      return data as Strategy;
    },
    onSuccess: (created) => {
      queryClient.setQueriesData<Strategy[]>(
        { queryKey: marketsKeys.strategies.all() },
        (prev) => (prev ? [created, ...prev] : [created]),
      );
      queryClient.invalidateQueries({ queryKey: marketsKeys.strategies.all() });
    },
  });
}

// ── Update ────────────────────────────────────────────────────────────────

export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation<Strategy, Error, UpdateStrategyInput>({
    mutationFn: async ({ id, ...fields }) => {
      if (!id) throw new Error("Strategy id is required");

      const patch: Record<string, unknown> = {};
      if (fields.name        !== undefined) patch.name        = fields.name?.trim();
      if (fields.description !== undefined) patch.description = fields.description;
      if (fields.dsl         !== undefined) patch.dsl         = fields.dsl;
      if (fields.universe    !== undefined) patch.universe    = fields.universe;
      if (fields.tags        !== undefined) patch.tags        = fields.tags;
      if (fields.lifecycle_state !== undefined) patch.lifecycle_state = fields.lifecycle_state;

      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("strategies")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message ?? "Failed to update strategy");
      return data as Strategy;
    },
    onSuccess: (updated) => {
      queryClient.setQueriesData<Strategy[]>(
        { queryKey: marketsKeys.strategies.all() },
        (prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? [updated],
      );
      queryClient.setQueryData(marketsKeys.strategies.detail(updated.id), updated);
    },
  });
}

// ── Delete (hard) ─────────────────────────────────────────────────────────

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await (supabase as any)
        .schema("markets")
        .from("strategies")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message ?? "Failed to delete strategy");
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData<Strategy[]>(
        { queryKey: marketsKeys.strategies.all() },
        (prev) => prev?.filter((s) => s.id !== deletedId) ?? [],
      );
      queryClient.removeQueries({ queryKey: marketsKeys.strategies.detail(deletedId) });
    },
  });
}

// ── Activate ──────────────────────────────────────────────────────────────

export function useActivateStrategy() {
  const update = useUpdateStrategy();
  return {
    ...update,
    mutate: (id: string) => update.mutate({ id, lifecycle_state: "active" }),
    mutateAsync: (id: string) => update.mutateAsync({ id, lifecycle_state: "active" }),
  };
}

// ── Set Draft ─────────────────────────────────────────────────────────────

export function useDraftStrategy() {
  const update = useUpdateStrategy();
  return {
    ...update,
    mutate: (id: string) => update.mutate({ id, lifecycle_state: "draft" }),
    mutateAsync: (id: string) => update.mutateAsync({ id, lifecycle_state: "draft" }),
  };
}

/**
 * useSetupCards — list active setup tasks for the active membership and
 * mutate their state (complete / dismiss).
 *
 * Reads the active tenant + domain from useMemberships() so it auto-
 * updates when the user switches contexts via the topbar. Falls back to
 * empty for retail memberships (Sthira has its own coach-marked tour;
 * the Setup-cards panel is a B2B affordance).
 *
 * Tasks not yet recorded in tenant_setup_progress are treated as
 * status='pending' — no need to seed rows when a tenant is created.
 * "on_action" tasks are filtered out until they're promoted (an
 * on_action card with an explicit row in tenant_setup_progress is
 * considered promoted).
 *
 * See src/features/onboarding/setup-cards/types.ts.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useMemberships } from "@/hooks/useMemberships";

import { setupCardsForDomain } from "./registry";
import type { SetupCardDefinition, SetupCardRow, SetupCardStatus } from "./types";

export interface SetupCardWithState {
  def:    SetupCardDefinition;
  status: SetupCardStatus;
  /** True if the card has any tenant_setup_progress row at all — used for
   *  trigger="on_action" cards to decide whether to render. */
  has_row: boolean;
}

const setupCardsKey = (tenantId: string | undefined, domain: string | undefined) =>
  ["setup-cards", tenantId, domain] as const;

export function useSetupCards() {
  const { activeMembership } = useMemberships();
  const qc = useQueryClient();

  const tenantId    = activeMembership?.tenant_id;
  const domainCode  = activeMembership?.domain_code as ("logistics" | "markets" | null | undefined);
  const isB2B       = !activeMembership?.is_retail && (domainCode === "logistics" || domainCode === "markets");

  const rowsQuery = useQuery({
    queryKey: setupCardsKey(tenantId, domainCode ?? undefined),
    enabled:  Boolean(tenantId && isB2B),
    staleTime: 30_000,
    queryFn: async (): Promise<SetupCardRow[]> => {
      const { data, error } = await supabase
        .from("tenant_setup_progress")
        .select("tenant_id, domain_code, task_key, status, completed_at, dismissed_at, updated_at")
        .eq("tenant_id", tenantId!)
        .eq("domain_code", domainCode!);
      if (error) throw error;
      return (data as SetupCardRow[] | null) ?? [];
    },
  });

  const rowByKey = useMemo<Record<string, SetupCardRow>>(() => {
    const map: Record<string, SetupCardRow> = {};
    for (const row of rowsQuery.data ?? []) map[row.task_key] = row;
    return map;
  }, [rowsQuery.data]);

  const cards = useMemo<SetupCardWithState[]>(() => {
    if (!isB2B || !domainCode) return [];
    const defs = setupCardsForDomain(domainCode);
    return defs
      .map((def): SetupCardWithState | null => {
        const row     = rowByKey[def.key];
        const status: SetupCardStatus = row?.status ?? "pending";
        // on_action tasks stay hidden until they're explicitly promoted
        // (which we model by inserting a pending row).
        if (def.trigger === "on_action" && !row) return null;
        return { def, status, has_row: Boolean(row) };
      })
      .filter((c): c is SetupCardWithState => c !== null)
      .sort((a, b) => a.def.order - b.def.order);
  }, [domainCode, isB2B, rowByKey]);

  const pendingCount = useMemo(
    () => cards.filter((c) => c.status === "pending").length,
    [cards],
  );

  const completedCount = useMemo(
    () => cards.filter((c) => c.status === "completed").length,
    [cards],
  );

  // Total = pending + completed (dismissed ones are out of frame for
  // progress calc).
  const totalForProgress = pendingCount + completedCount;
  const progressPct      = totalForProgress === 0
    ? 0
    : Math.round((completedCount / totalForProgress) * 100);

  const setStatusMutation = useMutation({
    mutationFn: async ({
      taskKey,
      status,
    }: {
      taskKey: string;
      status:  SetupCardStatus;
    }): Promise<void> => {
      if (!tenantId || !domainCode) throw new Error("No active B2B tenant");
      const now = new Date().toISOString();
      const payload = {
        tenant_id:    tenantId,
        domain_code:  domainCode,
        task_key:     taskKey,
        status,
        updated_at:   now,
        completed_at: status === "completed" ? now : null,
        dismissed_at: status === "dismissed" ? now : null,
      };
      const { error } = await supabase
        .from("tenant_setup_progress")
        .upsert(payload, { onConflict: "tenant_id,domain_code,task_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setupCardsKey(tenantId, domainCode ?? undefined) });
    },
  });

  return {
    cards,
    pendingCount,
    completedCount,
    progressPct,
    isLoading:   rowsQuery.isLoading,
    isMutating:  setStatusMutation.isPending,
    markComplete: (taskKey: string) => setStatusMutation.mutateAsync({ taskKey, status: "completed" }),
    dismiss:      (taskKey: string) => setStatusMutation.mutateAsync({ taskKey, status: "dismissed" }),
    /** Surfaces an on_action card for the first time (status=pending). */
    promote:      (taskKey: string) => setStatusMutation.mutateAsync({ taskKey, status: "pending" }),
    isB2B,
  };
}

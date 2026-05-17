/**
 * Rebalancing hooks — CRUD for rebalancing_rules and rebalancing_alerts
 * in the markets schema.
 *
 *   useRebalancingRules(portfolioId)    — list rules for a portfolio
 *   useUpsertRebalancingRule()          — create / update a rule
 *   useDeleteRebalancingRule()          — delete a rule
 *   useRebalancingAlerts(portfolioId)   — list triggered alerts (unacknowledged first)
 *   useAcknowledgeAlert(alertId)        — mark alert as acknowledged
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "./queryKeys";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RebalancingRule {
  id:            string;
  portfolio_id:  string;
  instrument_id: string | null;
  symbol:        string | null;
  target_weight: number | null;
  min_weight:    number | null;
  max_weight:    number | null;
  alert_enabled: boolean;
  notes:         string | null;
  created_at:    string;
  updated_at:    string;
}

export interface UpsertRebalancingRuleInput {
  portfolio_id:  string;
  instrument_id: string;
  symbol?:       string;
  target_weight: number;
  min_weight:    number;
  max_weight:    number;
  alert_enabled?: boolean;
  notes?:        string | null;
}

export interface RebalancingAlert {
  id:             string;
  rule_id:        string;
  portfolio_id:   string;
  symbol:         string;
  current_weight: number;
  target_weight:  number | null;
  direction:      "over" | "under";
  triggered_at:   string;
  acknowledged:   boolean;
}

// ── Query helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const marketsFrom = (table: string) =>
  (supabase as any).schema("markets" as any).from(table as any);

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useRebalancingRules(
  portfolioId: string | undefined,
): UseQueryResult<RebalancingRule[]> {
  return useQuery<RebalancingRule[]>({
    queryKey: marketsKeys.rebalancing.rules(portfolioId ?? ""),
    enabled: Boolean(portfolioId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await marketsFrom("rebalancing_rules")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as RebalancingRule[];
    },
  });
}

export function useUpsertRebalancingRule(): UseMutationResult<
  RebalancingRule,
  Error,
  UpsertRebalancingRuleInput
> {
  const queryClient = useQueryClient();

  return useMutation<RebalancingRule, Error, UpsertRebalancingRuleInput>({
    mutationFn: async (input) => {
      const { data, error } = await marketsFrom("rebalancing_rules")
        .upsert(
          {
            ...input,
            alert_enabled: input.alert_enabled ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "portfolio_id,instrument_id" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as RebalancingRule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.rules(data.portfolio_id),
      });
    },
  });
}

export function useDeleteRebalancingRule(): UseMutationResult<
  void,
  Error,
  { ruleId: string; portfolioId: string }
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { ruleId: string; portfolioId: string }>({
    mutationFn: async ({ ruleId }) => {
      const { error } = await marketsFrom("rebalancing_rules")
        .delete()
        .eq("id", ruleId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.rules(portfolioId),
      });
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.alerts(portfolioId),
      });
    },
  });
}

export function useRebalancingAlerts(
  portfolioId: string | undefined,
): UseQueryResult<RebalancingAlert[]> {
  return useQuery<RebalancingAlert[]>({
    queryKey: marketsKeys.rebalancing.alerts(portfolioId ?? ""),
    enabled: Boolean(portfolioId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await marketsFrom("rebalancing_alerts")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("acknowledged", { ascending: true })
        .order("triggered_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RebalancingAlert[];
    },
  });
}

export function useAcknowledgeAlert(): UseMutationResult<
  void,
  Error,
  { alertId: string; portfolioId: string }
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { alertId: string; portfolioId: string }>({
    mutationFn: async ({ alertId }) => {
      const { error } = await marketsFrom("rebalancing_alerts")
        .update({ acknowledged: true })
        .eq("id", alertId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.alerts(portfolioId),
      });
    },
  });
}

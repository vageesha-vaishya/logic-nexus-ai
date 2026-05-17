/**
 * Rebalancing hooks — Worker API + Supabase fallback
 *
 * Worker-based hooks (use VITE_MARKETS_WORKER_URL):
 *   useRebalancingRules(portfolioId)      — GET /v1/rebalancing/:id/rules
 *   useUpsertRule(portfolioId)            — POST /v1/rebalancing/:id/rules
 *   useDeleteRule(portfolioId)            — DELETE /v1/rebalancing/:id/rules/:ruleId
 *   useRebalancingAnalysis(portfolioId)   — GET /v1/rebalancing/:id/analysis (staleTime 2 min)
 *   useAcknowledgeAlerts(portfolioId)     — POST /v1/rebalancing/:id/alerts/acknowledge
 *
 * Supabase-direct hooks (used by legacy RebalancingRulesPanel):
 *   useRebalancingRules (re-exported alias below)
 *   useUpsertRebalancingRule
 *   useDeleteRebalancingRule
 *   useRebalancingAlerts
 *   useAcknowledgeAlert
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

// ── Worker URL ─────────────────────────────────────────────────────────────────

const WORKER_URL =
  (import.meta.env as Record<string, string>).VITE_MARKETS_WORKER_URL ??
  "http://localhost:8001";

async function workerFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
    ...(options?.headers ?? {}),
  };
  const res = await fetch(`${WORKER_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── TypeScript interfaces ──────────────────────────────────────────────────────

export interface Rule {
  id: string;
  symbol: string;
  target_weight: number;
  min_weight: number;
  max_weight: number;
  alert_enabled: boolean;
  notes: string;
}

export interface UpsertRuleInput {
  symbol: string;
  target_weight: number;
  min_weight: number;
  max_weight: number;
  alert_enabled?: boolean;
  notes?: string;
}

export interface PositionAnalysis {
  symbol: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  current_value: number;
  current_weight: number;
  has_rule: boolean;
  target_weight: number | null;
  min_weight: number | null;
  max_weight: number | null;
  drift: number | null;
  status: "on_target" | "overweight" | "underweight" | "no_rule";
  trade_action: "BUY" | "SELL" | "HOLD" | null;
  trade_qty: number | null;
  trade_value: number | null;
}

export interface RebalancingAnalysis {
  portfolio_id: string;
  total_value: number;
  as_of: string;
  positions: PositionAnalysis[];
  unallocated_weight: number;
  drift_threshold_pct: number;
  alerts: unknown[];
}

// ── Worker-based hooks ─────────────────────────────────────────────────────────

export function useRebalancingRulesWorker(
  portfolioId: string | undefined,
): UseQueryResult<Rule[]> {
  return useQuery<Rule[]>({
    queryKey: [...marketsKeys.rebalancing.rules(portfolioId ?? ""), "worker"],
    enabled: Boolean(portfolioId),
    staleTime: 60_000,
    queryFn: () =>
      workerFetch<Rule[]>(`/v1/rebalancing/${portfolioId}/rules`),
  });
}

export function useUpsertRule(portfolioId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<Rule, Error, UpsertRuleInput>({
    mutationFn: (body) =>
      workerFetch<Rule>(`/v1/rebalancing/${portfolioId}/rules`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.rules(portfolioId ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.alerts(portfolioId ?? ""),
      });
    },
  });
}

export function useDeleteRule(portfolioId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (ruleId) =>
      workerFetch<void>(
        `/v1/rebalancing/${portfolioId}/rules/${ruleId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.rules(portfolioId ?? ""),
      });
    },
  });
}

export function useRebalancingAnalysis(
  portfolioId: string | undefined,
): UseQueryResult<RebalancingAnalysis> {
  return useQuery<RebalancingAnalysis>({
    queryKey: [
      ...marketsKeys.rebalancing.all(),
      "analysis",
      portfolioId ?? "",
    ],
    enabled: Boolean(portfolioId),
    staleTime: 2 * 60_000, // 2 min
    queryFn: () =>
      workerFetch<RebalancingAnalysis>(
        `/v1/rebalancing/${portfolioId}/analysis`,
      ),
  });
}

export function useAcknowledgeAlerts(portfolioId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<{ acknowledged: number }, Error, { alert_ids: string[] }>({
    mutationFn: (body) =>
      workerFetch<{ acknowledged: number }>(
        `/v1/rebalancing/${portfolioId}/alerts/acknowledge`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: marketsKeys.rebalancing.alerts(portfolioId ?? ""),
      });
    },
  });
}

// ── Legacy Supabase-direct types (kept for RebalancingRulesPanel) ──────────────

export interface RebalancingRule {
  id: string;
  portfolio_id: string;
  instrument_id: string | null;
  symbol: string | null;
  target_weight: number | null;
  min_weight: number | null;
  max_weight: number | null;
  alert_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertRebalancingRuleInput {
  portfolio_id: string;
  instrument_id: string;
  symbol?: string;
  target_weight: number;
  min_weight: number;
  max_weight: number;
  alert_enabled?: boolean;
  notes?: string | null;
}

export interface RebalancingAlert {
  id: string;
  rule_id: string;
  portfolio_id: string;
  symbol: string;
  current_weight: number;
  target_weight: number | null;
  direction: "over" | "under";
  triggered_at: string;
  acknowledged: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const marketsFrom = (table: string) =>
  (supabase as any).schema("markets" as any).from(table as any);

// ── Legacy hooks ──────────────────────────────────────────────────────────────

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

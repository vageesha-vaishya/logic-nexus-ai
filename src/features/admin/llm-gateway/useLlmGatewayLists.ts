// Hooks that back the LLM Gateway admin page. Each one calls
// llm-admin-list with a different `kind`. The edge function does the
// platform_admin role check and proxies to /v1/admin/* on the gateway.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminPromptRow {
  key: string;
  module: string;
  feature: string;
  description: string | null;
  active_version_id: string | null;
  total_versions: number;
  updated_at: string;
  default_capability: string | null;
  safety_class: string | null;
}

export interface AdminExperimentRow {
  id: string;
  prompt_key: string;
  status: string;
  traffic_split: number;
  variant_a_version_id: string;
  variant_b_version_id: string;
  started_at: string | null;
  evaluated_at: string | null;
  verdict: string | null;
  sample_size: number | null;
  note: string | null;
}

export interface AdminAuditRow {
  id: string;
  ts: string;
  prompt_key: string | null;
  version_id: string | null;
  provider_kind: string | null;
  model_id: string | null;
  status: string;
  error_code: string | null;
  latency_ms: number | null;
  cost_usd: number | null;
  tenant_id: string | null;
  user_id: string | null;
  experiment_id?: string | null;
  variant_label?: string | null;
}

export interface AdminBudgetStatusRow {
  scope_kind: string;
  scope_id: string;
  period_kind: 'daily' | 'weekly' | 'monthly';
  period_started_at: string | null;
  limit_usd: number;
  spent_usd: number;
  utilization_pct: number;
  warning_pct: number;
  hard_cap: boolean;
  tenant_paid_uncapped: boolean;
  invocations: number;
  tokens: number;
  counter_updated_at: string | null;
  status: 'ok' | 'warning' | 'exceeded';
}

type AnyFilters = Record<string, string | number | undefined>;

async function callList<T>(kind: 'prompts' | 'experiments' | 'audit' | 'budget-status', filters: AnyFilters = {}): Promise<{ items: T[]; note?: string }> {
  const { data, error } = await supabase.functions.invoke<{ items: T[]; note?: string }>(
    'llm-admin-list',
    { body: { kind, filters } },
  );
  if (error) throw error;
  if (!data) throw new Error('empty response from llm-admin-list');
  return data;
}

export function useAdminPromptList() {
  return useQuery({
    queryKey: ['llm-admin', 'prompts'],
    queryFn: () => callList<AdminPromptRow>('prompts'),
    staleTime: 60_000,
  });
}

export function useAdminExperimentList(status?: string) {
  return useQuery({
    queryKey: ['llm-admin', 'experiments', status ?? null],
    queryFn: () => callList<AdminExperimentRow>('experiments', status ? { status } : {}),
    staleTime: 60_000,
  });
}

export interface AuditFilters {
  prompt_key?: string;
  status?: string;
  tenant_id?: string;
  limit?: number;
}
export function useAdminBudgetStatus(periodKind?: 'daily' | 'weekly' | 'monthly') {
  return useQuery({
    queryKey: ['llm-admin', 'budget-status', periodKind ?? null],
    queryFn: () => callList<AdminBudgetStatusRow>('budget-status', periodKind ? { period_kind: periodKind } : {}),
    staleTime: 30_000,
  });
}

export function useAdminAuditList(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ['llm-admin', 'audit', filters],
    queryFn: () => callList<AdminAuditRow>('audit', filters),
    // Audit log moves fast; shorter stale window.
    staleTime: 15_000,
  });
}

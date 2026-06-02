// Bridge between the gateway.evaluate_experiment RPC + the JS evaluator.
// Same credential-deferred pattern as the rest of the gateway.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { ContingencyCounts } from './evaluator.js';

export interface EvaluatorStore {
  /** Returns null if the experiment doesn't exist. */
  fetchContingency(experiment_id: string): Promise<ContingencyCounts | null>;
  /** Atomically flip active version + mark experiment completed. */
  promoteWinner(experiment_id: string, winner_version_id: string): Promise<{
    prompt_key: string;
    prior_active_version_id: string | null;
  }>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function buildInMemoryEvaluatorStore(): EvaluatorStore & {
  setContingency(experiment_id: string, counts: ContingencyCounts): void;
  promotions(): Array<{ experiment_id: string; winner_version_id: string }>;
  clear(): void;
} {
  const byId = new Map<string, ContingencyCounts>();
  const promotionsLog: Array<{ experiment_id: string; winner_version_id: string }> = [];

  return {
    async fetchContingency(experiment_id: string) {
      return byId.get(experiment_id) ?? null;
    },
    async promoteWinner(experiment_id: string, winner_version_id: string) {
      promotionsLog.push({ experiment_id, winner_version_id });
      const c = byId.get(experiment_id);
      return {
        prompt_key: c?.prompt_key ?? '<unknown>',
        prior_active_version_id: null,
      };
    },
    setContingency(experiment_id, counts) {
      byId.set(experiment_id, counts);
    },
    promotions() {
      return [...promotionsLog];
    },
    clear() {
      byId.clear();
      promotionsLog.length = 0;
    },
  };
}

export function buildSupabaseEvaluatorStore(): EvaluatorStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('evaluator store: supabase initialized', { url_host: new URL(env.url).host });

  return {
    async fetchContingency(experiment_id: string) {
      const { data, error } = await client.rpc('evaluate_experiment', { p_experiment_id: experiment_id });
      if (error || !data || !Array.isArray(data) || data.length === 0) return null;
      const row = data[0] as Record<string, unknown>;
      return {
        experiment_id: String(row.experiment_id),
        prompt_key: String(row.prompt_key),
        variant_a_version_id: String(row.variant_a_version_id),
        variant_b_version_id: String(row.variant_b_version_id),
        traffic_split: Number(row.traffic_split),
        status: String(row.status),
        target_invocations: row.target_invocations !== null ? Number(row.target_invocations) : null,
        invocations_a: Number(row.invocations_a),
        invocations_b: Number(row.invocations_b),
        accepted_a: Number(row.accepted_a),
        accepted_b: Number(row.accepted_b),
        rejected_a: Number(row.rejected_a),
        rejected_b: Number(row.rejected_b),
        ignored_a: Number(row.ignored_a),
        ignored_b: Number(row.ignored_b),
        total_outcomes_a: Number(row.total_outcomes_a),
        total_outcomes_b: Number(row.total_outcomes_b),
      };
    },
    async promoteWinner(experiment_id: string, winner_version_id: string) {
      const { data, error } = await client.rpc('promote_experiment_winner', {
        p_experiment_id: experiment_id,
        p_winner_version_id: winner_version_id,
      });
      if (error || !data || !Array.isArray(data) || data.length === 0) {
        throw new Error(`promote_experiment_winner failed: ${error?.message ?? 'no row returned'}`);
      }
      const row = data[0] as Record<string, unknown>;
      return {
        prompt_key: String(row.prompt_key),
        prior_active_version_id: row.prior_active_version_id ? String(row.prior_active_version_id) : null,
      };
    },
  };
}

export function buildEvaluatorStore(): EvaluatorStore {
  return buildSupabaseEvaluatorStore() ?? buildInMemoryEvaluatorStore();
}

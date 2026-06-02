// Experiment store — finds the active experiment for a prompt_key.
// Same credential-deferred pattern as the rest of the gateway: Supabase
// when env vars set, in-memory otherwise. Cached 30s.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { PromptExperiment } from './experimentTypes.js';

export interface ExperimentStore {
  /** Returns the active experiment for `prompt_key`, or null. */
  getActiveFor(prompt_key: string): Promise<PromptExperiment | null>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function buildInMemoryExperimentStore(): ExperimentStore & {
  setExperiment(exp: PromptExperiment | null): void;
  clear(): void;
} {
  const byKey = new Map<string, PromptExperiment>();
  return {
    async getActiveFor(prompt_key: string) {
      return byKey.get(prompt_key) ?? null;
    },
    setExperiment(exp: PromptExperiment | null) {
      if (!exp) {
        // remove all
        byKey.clear();
        return;
      }
      if (exp.status === 'active') byKey.set(exp.prompt_key, exp);
      else byKey.delete(exp.prompt_key);
    },
    clear() {
      byKey.clear();
    },
  };
}

export function buildSupabaseExperimentStore(): ExperimentStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('experiment store: supabase initialized', { url_host: new URL(env.url).host });
  const cache = new Map<string, { exp: PromptExperiment | null; cachedAt: number }>();
  const TTL_MS = 30_000;

  return {
    async getActiveFor(prompt_key: string) {
      const hit = cache.get(prompt_key);
      if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit.exp;
      const { data, error } = await client
        .from('prompt_experiments')
        .select('id, prompt_key, variant_a_version_id, variant_b_version_id, traffic_split, status, started_at, ended_at, target_invocations, target_signal, winner_version_id, notes')
        .eq('prompt_key', prompt_key)
        .eq('status', 'active')
        .maybeSingle();
      let exp: PromptExperiment | null = null;
      if (error) {
        logger.warn('prompt_experiments lookup failed; treating as no experiment', { prompt_key, err: error.message });
      } else if (data) {
        exp = data as PromptExperiment;
      }
      cache.set(prompt_key, { exp, cachedAt: Date.now() });
      return exp;
    },
  };
}

export function buildExperimentStore(): ExperimentStore {
  return buildSupabaseExperimentStore() ?? buildInMemoryExperimentStore();
}

// Outcome store. Persists rows to gateway.outcomes (append-only).
// When SUPABASE env vars are missing, falls back to an in-memory map
// so dev/jest still functions zero-config.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import {
  OutcomeError,
  type Outcome,
  type OutcomeRecord,
} from './types.js';

/**
 * Context the gateway joins onto an outcome row at record time. The
 * invocation_id is provided by the caller; everything else is looked
 * up server-side from gateway.llm_invocations.
 */
export interface OutcomeContext {
  tenant_id: string;
  prompt_key?: string | null;
  prompt_version_id?: string | null;
  experiment_id?: string | null;
  variant_label?: 'a' | 'b' | null;
}

export interface OutcomeStore {
  /** Look up the audit context for an invocation_id; null if not found. */
  getInvocationContext(invocation_id: string): Promise<OutcomeContext | null>;
  /** Persist an outcome row. */
  record(record: OutcomeRecord): Promise<{ id: string }>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** Pure helper: shape an Outcome (caller payload) into an OutcomeRecord. */
export function buildOutcomeRecord(
  invocation_id: string,
  outcome: Outcome,
  ctx: OutcomeContext,
  source: OutcomeRecord['source'] = 'sdk',
): OutcomeRecord {
  const base: OutcomeRecord = {
    invocation_id,
    tenant_id: ctx.tenant_id,
    prompt_key: ctx.prompt_key ?? null,
    prompt_version_id: ctx.prompt_version_id ?? null,
    experiment_id: ctx.experiment_id ?? null,
    variant_label: ctx.variant_label ?? null,
    kind: outcome.kind,
    source,
    notes: outcome.notes ?? null,
  };
  if (outcome.kind !== 'ignored') {
    base.user_id = outcome.user_id;
  }
  if (outcome.kind === 'accepted_after_edit' || outcome.kind === 'overridden') {
    base.edited_output = outcome.edited_output;
  }
  return base;
}

// ── In-memory implementation (dev + jest) ──────────────────────────

export function buildInMemoryOutcomeStore(): OutcomeStore & {
  setContext(invocation_id: string, ctx: OutcomeContext): void;
  list(): OutcomeRecord[];
  clear(): void;
} {
  const contexts = new Map<string, OutcomeContext>();
  const rows: OutcomeRecord[] = [];

  return {
    async getInvocationContext(invocation_id: string) {
      return contexts.get(invocation_id) ?? null;
    },
    async record(record: OutcomeRecord) {
      const id = `inmem-outcome-${rows.length + 1}-${Date.now()}`;
      rows.push({ ...record, id });
      return { id };
    },
    setContext(invocation_id, ctx) {
      contexts.set(invocation_id, ctx);
    },
    list() {
      return [...rows];
    },
    clear() {
      contexts.clear();
      rows.length = 0;
    },
  };
}

// ── Supabase-backed implementation ─────────────────────────────────

export function buildSupabaseOutcomeStore(): OutcomeStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('outcome store: supabase initialized', { url_host: new URL(env.url).host });

  return {
    async getInvocationContext(invocation_id: string) {
      const { data, error } = await client
        .from('llm_invocations')
        .select('tenant_id, prompt_key, prompt_version_id, experiment_id, variant_label')
        .eq('id', invocation_id)
        .maybeSingle();
      if (error || !data) return null;
      return {
        tenant_id: data.tenant_id,
        prompt_key: data.prompt_key,
        prompt_version_id: data.prompt_version_id,
        experiment_id: data.experiment_id,
        variant_label: data.variant_label as 'a' | 'b' | null,
      };
    },
    async record(record: OutcomeRecord) {
      const { data, error } = await client
        .from('outcomes')
        .insert({ ...record, edited_output: record.edited_output ?? null })
        .select('id')
        .single();
      if (error || !data) {
        throw new OutcomeError('OUTCOME_STORE_UNAVAILABLE', 'insert failed', { err: error?.message });
      }
      return { id: data.id as string };
    },
  };
}

export function buildOutcomeStore(): OutcomeStore {
  return buildSupabaseOutcomeStore() ?? buildInMemoryOutcomeStore();
}

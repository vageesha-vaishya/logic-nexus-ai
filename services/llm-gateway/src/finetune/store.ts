// Fine-tune job store. Per design §9.1. Mirror the pattern used by
// every other gateway store: Supabase when env set, in-memory fallback.
//
// This slice ships storage + lifecycle CRUD only. The provider submission
// (OpenAI's /fine_tuning/jobs API, Anthropic's training endpoint when
// shipped) is a follow-up — adapters need API keys with training quota.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { ProviderKind } from '../types/gateway.types.js';

export type FineTuneStatus = 'queued' | 'preparing' | 'training' | 'succeeded' | 'failed' | 'cancelled';
export type DatasetFormat = 'jsonl' | 'parquet' | 'csv';

export interface FineTuneJob {
  id: string;
  tenant_id: string;
  provider_kind: ProviderKind;
  base_model_id: string;
  fine_tuned_model_id?: string | null;
  provider_job_id?: string | null;
  dataset_url?: string | null;
  dataset_format?: DatasetFormat | null;
  hyperparameters: Record<string, unknown>;
  status: FineTuneStatus;
  status_message?: string | null;
  result_metrics: Record<string, unknown>;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export interface FineTuneCreateInput {
  tenant_id: string;
  provider_kind: ProviderKind;
  base_model_id: string;
  dataset_url?: string;
  dataset_format?: DatasetFormat;
  hyperparameters?: Record<string, unknown>;
  created_by_user_id?: string;
}

/** Patch applied by the poller after fetching provider status. */
export interface ProviderStatusPatch {
  /** Mapped gateway status (must be reachable from the current one). */
  status: FineTuneStatus;
  /** Free-form status string from the provider (for audit). */
  status_message?: string | null;
  /** Set when the provider reports the final fine-tuned model name. */
  fine_tuned_model_id?: string | null;
  /** Provider-reported eval metrics, merged into result_metrics. */
  result_metrics?: Record<string, unknown>;
}

export interface FineTuneStore {
  create(input: FineTuneCreateInput): Promise<FineTuneJob>;
  get(id: string): Promise<FineTuneJob | null>;
  cancel(id: string, reason?: string): Promise<FineTuneJob | null>;
  /**
   * Flip a queued job into 'preparing' state once the provider has
   * accepted the submission. Captures provider_job_id + the effective
   * model id (provider may rewrite the base_model with date suffix).
   * Atomic: only flips when status is currently 'queued'.
   */
  markPreparing(args: {
    id: string;
    provider_job_id: string;
    effective_model_id?: string;
  }): Promise<FineTuneJob | null>;
  /**
   * Apply a provider-polled status update to a job. Idempotent: a no-op
   * if the new state matches the current one. Refuses to overwrite a
   * terminal state (succeeded/failed/cancelled) — those are final.
   */
  applyProviderStatus(id: string, patch: ProviderStatusPatch): Promise<FineTuneJob | null>;
  /**
   * Return non-terminal jobs with a provider_job_id set, oldest first,
   * up to `limit`. Used by the poller worker.
   */
  listInFlight(limit?: number): Promise<FineTuneJob[]>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

const TERMINAL: ReadonlySet<FineTuneStatus> = new Set(['succeeded', 'failed', 'cancelled']);

export function buildInMemoryFineTuneStore(): FineTuneStore & { clear(): void; list(): FineTuneJob[] } {
  const byId = new Map<string, FineTuneJob>();
  return {
    async create(input: FineTuneCreateInput) {
      const id = `inmem-ft-${byId.size + 1}-${Date.now()}`;
      const now = new Date().toISOString();
      const job: FineTuneJob = {
        id,
        tenant_id: input.tenant_id,
        provider_kind: input.provider_kind,
        base_model_id: input.base_model_id,
        fine_tuned_model_id: null,
        provider_job_id: null,
        dataset_url: input.dataset_url ?? null,
        dataset_format: input.dataset_format ?? null,
        hyperparameters: input.hyperparameters ?? {},
        status: 'queued',
        status_message: null,
        result_metrics: {},
        created_by_user_id: input.created_by_user_id ?? null,
        created_at: now,
        updated_at: now,
        started_at: null,
        finished_at: null,
        cancelled_at: null,
        cancel_reason: null,
      };
      byId.set(id, job);
      return job;
    },
    async get(id: string) {
      return byId.get(id) ?? null;
    },
    async cancel(id: string, reason?: string) {
      const job = byId.get(id);
      if (!job) return null;
      if (TERMINAL.has(job.status)) return job; // idempotent for already-terminal jobs
      const now = new Date().toISOString();
      const updated: FineTuneJob = {
        ...job,
        status: 'cancelled',
        cancelled_at: now,
        cancel_reason: reason ?? null,
        updated_at: now,
      };
      byId.set(id, updated);
      return updated;
    },
    async markPreparing(args) {
      const job = byId.get(args.id);
      if (!job) return null;
      if (job.status !== 'queued') return job; // idempotent — already past queued
      const now = new Date().toISOString();
      const updated: FineTuneJob = {
        ...job,
        status: 'preparing',
        provider_job_id: args.provider_job_id,
        base_model_id: args.effective_model_id ?? job.base_model_id,
        started_at: now,
        updated_at: now,
      };
      byId.set(args.id, updated);
      return updated;
    },
    async applyProviderStatus(id, patch) {
      const job = byId.get(id);
      if (!job) return null;
      if (TERMINAL.has(job.status)) return job; // final — refuse overwrite
      if (job.status === patch.status
        && (patch.status_message ?? null) === (job.status_message ?? null)
        && (patch.fine_tuned_model_id ?? null) === (job.fine_tuned_model_id ?? null)
        && !patch.result_metrics) {
        return job; // no-op
      }
      const now = new Date().toISOString();
      const isTerminal = TERMINAL.has(patch.status);
      const updated: FineTuneJob = {
        ...job,
        status: patch.status,
        status_message: patch.status_message ?? job.status_message ?? null,
        fine_tuned_model_id: patch.fine_tuned_model_id ?? job.fine_tuned_model_id ?? null,
        result_metrics: patch.result_metrics
          ? { ...job.result_metrics, ...patch.result_metrics }
          : job.result_metrics,
        finished_at: isTerminal ? (job.finished_at ?? now) : job.finished_at,
        updated_at: now,
      };
      byId.set(id, updated);
      return updated;
    },
    async listInFlight(limit = 50) {
      const inFlight = Array.from(byId.values()).filter(
        j => !TERMINAL.has(j.status) && (j.provider_job_id ?? null) !== null,
      );
      inFlight.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      return inFlight.slice(0, limit);
    },
    clear() {
      byId.clear();
    },
    list() {
      return Array.from(byId.values());
    },
  };
}

export function buildSupabaseFineTuneStore(): FineTuneStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('fine-tune store: supabase initialized', { url_host: new URL(env.url).host });

  return {
    async create(input: FineTuneCreateInput) {
      const { data, error } = await client
        .from('fine_tune_jobs')
        .insert({
          tenant_id: input.tenant_id,
          provider_kind: input.provider_kind,
          base_model_id: input.base_model_id,
          dataset_url: input.dataset_url ?? null,
          dataset_format: input.dataset_format ?? null,
          hyperparameters: input.hyperparameters ?? {},
          created_by_user_id: input.created_by_user_id ?? null,
        })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`fine_tune_jobs insert failed: ${error?.message ?? 'no row returned'}`);
      }
      return data as FineTuneJob;
    },
    async get(id: string) {
      const { data, error } = await client
        .from('fine_tune_jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as FineTuneJob | null;
    },
    async cancel(id: string, reason?: string) {
      // Atomic: only flip when status is not already terminal.
      const { data, error } = await client
        .from('fine_tune_jobs')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason ?? null,
        })
        .eq('id', id)
        .not('status', 'in', '(succeeded,failed,cancelled)')
        .select('*')
        .maybeSingle();
      if (error) return null;
      if (data) return data as FineTuneJob;
      // Row exists but was already terminal — return current state.
      return this.get(id);
    },
    async markPreparing(args) {
      // Atomic: only flip when status is currently 'queued'.
      const { data, error } = await client
        .from('fine_tune_jobs')
        .update({
          status: 'preparing',
          provider_job_id: args.provider_job_id,
          ...(args.effective_model_id ? { base_model_id: args.effective_model_id } : {}),
          started_at: new Date().toISOString(),
        })
        .eq('id', args.id)
        .eq('status', 'queued')
        .select('*')
        .maybeSingle();
      if (error) return null;
      if (data) return data as FineTuneJob;
      // Job exists but already past 'queued' — return current state.
      return this.get(args.id);
    },
    async applyProviderStatus(id, patch) {
      // Fetch current row to merge result_metrics without clobbering.
      const current = await this.get(id);
      if (!current) return null;
      if (TERMINAL.has(current.status)) return current; // final — refuse overwrite

      const isTerminal = TERMINAL.has(patch.status);
      const mergedMetrics = patch.result_metrics
        ? { ...current.result_metrics, ...patch.result_metrics }
        : current.result_metrics;

      const updatePayload: Record<string, unknown> = {
        status: patch.status,
        status_message: patch.status_message ?? current.status_message ?? null,
      };
      if (patch.fine_tuned_model_id !== undefined) {
        updatePayload.fine_tuned_model_id = patch.fine_tuned_model_id;
      }
      if (patch.result_metrics) {
        updatePayload.result_metrics = mergedMetrics;
      }
      if (isTerminal && !current.finished_at) {
        updatePayload.finished_at = new Date().toISOString();
      }

      const { data, error } = await client
        .from('fine_tune_jobs')
        .update(updatePayload)
        .eq('id', id)
        .not('status', 'in', '(succeeded,failed,cancelled)')
        .select('*')
        .maybeSingle();
      if (error) return null;
      if (data) return data as FineTuneJob;
      // Race: job became terminal between our read + write — return latest.
      return this.get(id);
    },
    async listInFlight(limit = 50) {
      const { data, error } = await client
        .from('fine_tune_jobs')
        .select('*')
        .not('status', 'in', '(succeeded,failed,cancelled)')
        .not('provider_job_id', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(limit);
      if (error || !data) return [];
      return data as FineTuneJob[];
    },
  };
}

export function buildFineTuneStore(): FineTuneStore {
  return buildSupabaseFineTuneStore() ?? buildInMemoryFineTuneStore();
}

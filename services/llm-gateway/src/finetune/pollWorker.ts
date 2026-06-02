// Fine-tune status-polling worker. Per design §9.1.
//
// Each tick:
//   1. listInFlight() — non-terminal jobs with provider_job_id set
//   2. For each, call the per-provider status fetcher
//   3. applyProviderStatus(...) — flips status + records metrics
//
// Designed as a tickable function so it can be driven from a setInterval
// in app.ts, a CronCreate row, or a test harness. No timers live in this
// module.

import { logger } from '../utils/logger.js';
import type { FineTuneJob, FineTuneStore, ProviderStatusPatch } from './store.js';
import { fetchOpenAIFineTuneStatus, FineTuneStatusError } from './openaiStatus.js';
import type { ProviderKind } from '../types/gateway.types.js';

export type StatusFetcher = (job: FineTuneJob) => Promise<ProviderStatusPatch>;

const DEFAULT_FETCHERS: Partial<Record<ProviderKind, StatusFetcher>> = {
  openai: (job) => {
    if (!job.provider_job_id) {
      throw new FineTuneStatusError(
        'JOB_NOT_FOUND',
        'no provider_job_id on job — cannot poll',
        { job_id: job.id },
      );
    }
    return fetchOpenAIFineTuneStatus(job.provider_job_id);
  },
};

export interface PollTickResult {
  scanned: number;
  updated: number;
  unchanged: number;
  failed_lookup: number;
  skipped: number;
  errors: Array<{ job_id: string; provider_kind: ProviderKind; code: string; message: string }>;
}

export interface RunPollTickOptions {
  store: FineTuneStore;
  /** Override the per-provider fetcher map; useful for tests. */
  fetchers?: Partial<Record<ProviderKind, StatusFetcher>>;
  /** Max in-flight jobs to scan per tick. */
  limit?: number;
}

/**
 * Run one polling tick. Returns counts for observability + the per-job
 * error list. Never throws — provider errors are captured and returned.
 */
export async function runPollTick(options: RunPollTickOptions): Promise<PollTickResult> {
  const limit = options.limit ?? 25;
  const fetchers = { ...DEFAULT_FETCHERS, ...(options.fetchers ?? {}) };

  const jobs = await options.store.listInFlight(limit);
  const result: PollTickResult = {
    scanned: jobs.length,
    updated: 0,
    unchanged: 0,
    failed_lookup: 0,
    skipped: 0,
    errors: [],
  };

  for (const job of jobs) {
    const fetcher = fetchers[job.provider_kind];
    if (!fetcher) {
      result.skipped += 1;
      continue;
    }
    try {
      const patch = await fetcher(job);
      const previousStatus = job.status;
      const previousMessage = job.status_message ?? null;
      const previousModel = job.fine_tuned_model_id ?? null;
      const updated = await options.store.applyProviderStatus(job.id, patch);
      if (!updated) {
        result.failed_lookup += 1;
        continue;
      }
      const changed =
        updated.status !== previousStatus
        || (updated.status_message ?? null) !== previousMessage
        || (updated.fine_tuned_model_id ?? null) !== previousModel;
      if (changed) {
        result.updated += 1;
        logger.info('finetune.poll: status updated', {
          job_id: job.id,
          provider_kind: job.provider_kind,
          from: previousStatus,
          to: updated.status,
          fine_tuned_model_id: updated.fine_tuned_model_id,
        });
      } else {
        result.unchanged += 1;
      }
    } catch (err) {
      const code = err instanceof FineTuneStatusError ? err.code : 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ job_id: job.id, provider_kind: job.provider_kind, code, message });
      logger.warn('finetune.poll: fetch failed', {
        job_id: job.id,
        provider_kind: job.provider_kind,
        provider_job_id: job.provider_job_id,
        code,
        message,
      });
      // JOB_NOT_FOUND is terminal — record as failed so we stop polling it.
      if (code === 'JOB_NOT_FOUND') {
        await options.store.applyProviderStatus(job.id, {
          status: 'failed',
          status_message: `provider lost the job: ${message}`,
        });
      }
    }
  }

  return result;
}

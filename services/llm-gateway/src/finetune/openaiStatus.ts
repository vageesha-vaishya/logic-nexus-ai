// Fine-tune status fetcher for OpenAI. Per design §9.1.
// Pure module — takes a provider_job_id, returns a normalized patch
// that the store can apply. No DB writes here; the worker layer
// composes fetch + store update.

import OpenAI from 'openai';
import type { ProviderStatusPatch } from './store.js';

export class FineTuneStatusError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_NOT_CONFIGURED'
      | 'PROVIDER_UNAVAILABLE'
      | 'JOB_NOT_FOUND',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FineTuneStatusError';
  }
}

// Maps OpenAI's job status enum onto our gateway status enum.
// OpenAI statuses (per their API docs):
//   validating_files | queued | running | succeeded | failed | cancelled
// Anything we don't recognise stays as 'preparing' with the raw value
// captured in status_message so it isn't silently dropped.
export function mapOpenAIStatus(raw: string | undefined | null): ProviderStatusPatch['status'] {
  switch (raw) {
    case 'validating_files':
    case 'queued':
      return 'preparing';
    case 'running':
      return 'training';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'preparing';
  }
}

interface OpenAIJobResponse {
  id?: string;
  status?: string;
  fine_tuned_model?: string | null;
  error?: { message?: string | null } | null;
  trained_tokens?: number | null;
  result_files?: string[] | null;
  finished_at?: number | null;
}

export interface FetchOpenAIStatusDeps {
  /** Override hook for tests — defaults to the real OpenAI SDK call. */
  retrieve?: (apiKey: string, providerJobId: string) => Promise<OpenAIJobResponse>;
}

async function defaultRetrieve(apiKey: string, providerJobId: string): Promise<OpenAIJobResponse> {
  const client = new OpenAI({ apiKey });
  return await client.fineTuning.jobs.retrieve(providerJobId) as unknown as OpenAIJobResponse;
}

/**
 * Fetch the current status of a provider_job_id from OpenAI and return
 * a normalized ProviderStatusPatch suitable for store.applyProviderStatus.
 */
export async function fetchOpenAIFineTuneStatus(
  providerJobId: string,
  deps: FetchOpenAIStatusDeps = {},
): Promise<ProviderStatusPatch> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FineTuneStatusError(
      'PROVIDER_NOT_CONFIGURED',
      'OPENAI_API_KEY missing — cannot poll fine-tune status',
    );
  }

  let resp: OpenAIJobResponse;
  try {
    resp = await (deps.retrieve ?? defaultRetrieve)(apiKey, providerJobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The SDK throws a NotFoundError for unknown job ids; treat as
    // JOB_NOT_FOUND so the worker can flip the gateway row to 'failed'
    // rather than retry forever.
    const isNotFound = /not found|404/i.test(message) || (err as { status?: number })?.status === 404;
    throw new FineTuneStatusError(
      isNotFound ? 'JOB_NOT_FOUND' : 'PROVIDER_UNAVAILABLE',
      message,
      { sdk_error: err instanceof Error ? err.name : 'unknown' },
    );
  }

  const mapped = mapOpenAIStatus(resp.status);
  const metrics: Record<string, unknown> = {};
  if (typeof resp.trained_tokens === 'number') metrics.trained_tokens = resp.trained_tokens;
  if (Array.isArray(resp.result_files) && resp.result_files.length > 0) {
    metrics.result_files = resp.result_files;
  }
  if (typeof resp.finished_at === 'number') metrics.provider_finished_at = resp.finished_at;

  return {
    status: mapped,
    status_message: resp.error?.message ?? resp.status ?? null,
    fine_tuned_model_id: resp.fine_tuned_model ?? null,
    result_metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
  };
}

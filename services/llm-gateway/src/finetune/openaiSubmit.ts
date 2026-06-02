// Fine-tune submitter for OpenAI. Per design §9.1.
// Takes a queued FineTuneJob, calls openai.fineTuning.jobs.create,
// returns the provider_job_id + the model the training run is against.
// Pure function (modulo the SDK call) — no DB writes here; the route
// layer persists the result.
//
// Credential-deferred: caller provides the OpenAI client. The route
// builds the client on each call to honor key rotation.

import OpenAI from 'openai';
import type { FineTuneJob } from './store.js';

export interface SubmitResult {
  provider_job_id: string;
  /** Provider may rewrite the model id (e.g. add a date suffix). */
  effective_model_id: string;
  /** Raw provider response for audit. */
  raw_response: unknown;
}

export interface SubmitOptions {
  /**
   * Suffix appended to the fine-tuned model id by the provider. Lets
   * tenants distinguish their runs. Max 18 chars per OpenAI.
   */
  suffix?: string;
}

export class FineTuneSubmitError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_NOT_CONFIGURED'
      | 'DATASET_REQUIRED'
      | 'PROVIDER_UNAVAILABLE'
      | 'INVALID_HYPERPARAMETERS',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FineTuneSubmitError';
  }
}

function clientForKey(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

/**
 * Submit a queued job to OpenAI. Reads OPENAI_API_KEY from env.
 * Throws FineTuneSubmitError on any pre-submit validation failure;
 * wraps SDK exceptions as PROVIDER_UNAVAILABLE.
 */
export async function submitOpenAIFineTune(
  job: FineTuneJob,
  options: SubmitOptions = {},
): Promise<SubmitResult> {
  if (job.provider_kind !== 'openai') {
    throw new FineTuneSubmitError(
      'PROVIDER_NOT_CONFIGURED',
      `submitter only handles provider_kind=openai (got ${job.provider_kind})`,
    );
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FineTuneSubmitError(
      'PROVIDER_NOT_CONFIGURED',
      'OPENAI_API_KEY missing — cannot submit fine-tune',
    );
  }
  if (!job.dataset_url) {
    throw new FineTuneSubmitError(
      'DATASET_REQUIRED',
      'fine-tune job has no dataset_url; upload training file first',
      { job_id: job.id },
    );
  }

  // The dataset_url for OpenAI must be a file id (file-abc123…) the
  // tenant has previously uploaded via openai.files.create. Bucket
  // URLs (gs://, s3://, https://supabase-storage/...) are stored in
  // dataset_url for tenant convenience but cannot be passed directly
  // to fineTuning.jobs.create. A future slice will add a translation
  // step that uploads the bucket file via openai.files.create first.
  if (!/^file-[A-Za-z0-9]{8,}$/.test(job.dataset_url)) {
    throw new FineTuneSubmitError(
      'DATASET_REQUIRED',
      `dataset_url must be an openai file id (file-...) for now; got "${job.dataset_url}". Upload via openai.files.create first.`,
      { dataset_url: job.dataset_url },
    );
  }

  const client = clientForKey(apiKey);

  // OpenAI accepts a small enumerated set of hyperparameters. Pull
  // only the recognized ones so we don't 400 on a stray field.
  const allowedHp: Record<string, unknown> = {};
  for (const key of ['n_epochs', 'batch_size', 'learning_rate_multiplier'] as const) {
    if (job.hyperparameters[key] !== undefined) {
      allowedHp[key] = job.hyperparameters[key];
    }
  }

  try {
    const created = await client.fineTuning.jobs.create({
      model: job.base_model_id,
      training_file: job.dataset_url,
      hyperparameters: Object.keys(allowedHp).length > 0 ? (allowedHp as OpenAI.FineTuning.Jobs.JobCreateParams['hyperparameters']) : undefined,
      ...(options.suffix ? { suffix: options.suffix.slice(0, 18) } : {}),
    });
    return {
      provider_job_id: created.id,
      effective_model_id: created.model ?? job.base_model_id,
      raw_response: created,
    };
  } catch (err) {
    throw new FineTuneSubmitError(
      'PROVIDER_UNAVAILABLE',
      err instanceof Error ? err.message : String(err),
      { sdk_error: err instanceof Error ? err.name : 'unknown' },
    );
  }
}

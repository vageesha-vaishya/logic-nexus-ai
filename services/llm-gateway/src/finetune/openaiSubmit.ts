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
import {
  translateDatasetToOpenAIFileId,
  FineTuneUploadError,
  OPENAI_FILE_ID_RE,
} from './openaiUpload.js';

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

  // Translate the dataset_url to an OpenAI file id. file-XXX inputs
  // pass through untouched; https:// URLs are fetched + uploaded via
  // openai.files.create; gs:///s3:// raw URIs are rejected up-front.
  // Result is cached process-wide by source URL so retries are cheap.
  let trainingFileId: string;
  try {
    const translated = await translateDatasetToOpenAIFileId(
      job.dataset_url,
      job.dataset_format ?? undefined,
    );
    trainingFileId = translated.file_id;
  } catch (err) {
    if (err instanceof FineTuneUploadError) {
      // Map upload errors onto submitter codes so the route layer's
      // existing error envelope handles them.
      const code: FineTuneSubmitError['code'] =
        err.code === 'PROVIDER_NOT_CONFIGURED' ? 'PROVIDER_NOT_CONFIGURED' :
        err.code === 'UNSUPPORTED_SCHEME'      ? 'DATASET_REQUIRED' :
        'PROVIDER_UNAVAILABLE';
      throw new FineTuneSubmitError(code, err.message, {
        upload_code: err.code,
        ...err.details,
      });
    }
    throw err;
  }
  // Defensive: translator promises file-XXX shape, but verify before
  // sending so we never call fineTuning.jobs.create with a bad ref.
  if (!OPENAI_FILE_ID_RE.test(trainingFileId)) {
    throw new FineTuneSubmitError(
      'DATASET_REQUIRED',
      `dataset translation returned non-file-id "${trainingFileId}"`,
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
      training_file: trainingFileId,
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

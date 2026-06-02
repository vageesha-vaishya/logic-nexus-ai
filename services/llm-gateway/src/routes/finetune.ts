// Fine-tuning endpoints. Per design §9.1.
//
//   POST   /v1/fine-tunes              — submit a job
//   GET    /v1/fine-tunes/:id          — poll status
//   POST   /v1/fine-tunes/:id/cancel   — cancel
//
// Scope: `submit_job`.
//
// This slice only persists job rows. A future slice will spawn a
// worker (or sync at submit-time) that hits the provider's training
// API, updates status, and writes `fine_tuned_model_id` once done.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import {
  buildFineTuneStore,
  type FineTuneStore,
  type FineTuneCreateInput,
  type DatasetFormat,
} from '../finetune/store.js';
import { submitOpenAIFineTune, FineTuneSubmitError } from '../finetune/openaiSubmit.js';
import { runPollTick } from '../finetune/pollWorker.js';
import type { ProviderKind } from '../types/gateway.types.js';

export const fineTuneRouter = Router();

let store: FineTuneStore | null = null;
function getStore(): FineTuneStore {
  if (!store) store = buildFineTuneStore();
  return store;
}
export function setFineTuneStoreForTesting(s: FineTuneStore | null): void {
  store = s;
}

const ALLOWED_PROVIDERS: ReadonlySet<ProviderKind> = new Set<ProviderKind>(
  ['anthropic', 'openai', 'google_gemini', 'mistral'],
);
const ALLOWED_FORMATS: ReadonlySet<DatasetFormat> = new Set<DatasetFormat>(['jsonl', 'parquet', 'csv']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateCreate(raw: unknown): FineTuneCreateInput {
  if (!raw || typeof raw !== 'object') {
    throw new GatewayError('INVALID_REQUEST', 'body must be a JSON object', 400);
  }
  const r = raw as Record<string, unknown>;
  const tenant_id = typeof r.tenant_id === 'string' ? r.tenant_id : '';
  const provider_kind = r.provider_kind as ProviderKind;
  const base_model_id = typeof r.base_model_id === 'string' ? r.base_model_id : '';

  if (!UUID_RE.test(tenant_id)) {
    throw new GatewayError('INVALID_REQUEST', 'tenant_id (uuid) required', 400);
  }
  if (!ALLOWED_PROVIDERS.has(provider_kind)) {
    throw new GatewayError('INVALID_REQUEST',
      `provider_kind must be one of ${Array.from(ALLOWED_PROVIDERS).join(', ')}`, 400);
  }
  if (!base_model_id || base_model_id.length > 256) {
    throw new GatewayError('INVALID_REQUEST', 'base_model_id required (max 256 chars)', 400);
  }

  const dataset_url = typeof r.dataset_url === 'string' ? r.dataset_url : undefined;
  const datasetFormatRaw = r.dataset_format as string | undefined;
  if (datasetFormatRaw !== undefined && !ALLOWED_FORMATS.has(datasetFormatRaw as DatasetFormat)) {
    throw new GatewayError('INVALID_REQUEST',
      `dataset_format must be one of ${Array.from(ALLOWED_FORMATS).join(', ')}`, 400);
  }
  const hyperparameters = r.hyperparameters && typeof r.hyperparameters === 'object'
    ? r.hyperparameters as Record<string, unknown>
    : {};
  const created_by_user_id = typeof r.created_by_user_id === 'string' ? r.created_by_user_id : undefined;

  return {
    tenant_id,
    provider_kind,
    base_model_id,
    dataset_url,
    dataset_format: datasetFormatRaw as DatasetFormat | undefined,
    hyperparameters,
    created_by_user_id,
  };
}

export function mountFineTuneRoutes(authLookup: () => AuthLookup): Router {
  // POST /v1/fine-tunes
  fineTuneRouter.post(
    '/fine-tunes',
    requireScope('submit_job', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = validateCreate(req.body);
        const job = await getStore().create(input);
        res.status(201).json(job);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /v1/fine-tunes/:id
  fineTuneRouter.get(
    '/fine-tunes/:id',
    requireScope('submit_job', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        if (!id) throw new GatewayError('INVALID_REQUEST', 'id required in path', 400);
        const job = await getStore().get(id);
        if (!job) throw new GatewayError('INVOCATION_NOT_FOUND', `fine-tune job ${id} not found`, 404);
        res.json(job);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /v1/fine-tunes/:id/submit — submits a queued job to the provider's
  // training API and flips status to 'preparing'. Admin-scoped because this
  // initiates billable training quota usage.
  fineTuneRouter.post(
    '/fine-tunes/:id/submit',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        if (!id) throw new GatewayError('INVALID_REQUEST', 'id required in path', 400);
        const job = await getStore().get(id);
        if (!job) throw new GatewayError('INVOCATION_NOT_FOUND', `fine-tune job ${id} not found`, 404);
        if (job.status !== 'queued') {
          throw new GatewayError(
            'INVALID_REQUEST',
            `job is not queued (status=${job.status}); cannot submit`,
            409,
            { current_status: job.status },
          );
        }
        if (job.provider_kind !== 'openai') {
          throw new GatewayError(
            'PROVIDER_NOT_CONFIGURED',
            `submit only supported for provider_kind=openai (got ${job.provider_kind})`,
            503,
          );
        }

        const suffix = typeof (req.body as { suffix?: unknown })?.suffix === 'string'
          ? (req.body as { suffix: string }).suffix
          : undefined;

        let submitted;
        try {
          submitted = await submitOpenAIFineTune(job, { suffix });
        } catch (err) {
          if (err instanceof FineTuneSubmitError) {
            // Map submitter codes onto the gateway's standard envelope codes.
            const status =
              err.code === 'PROVIDER_NOT_CONFIGURED' ? 503 :
              err.code === 'DATASET_REQUIRED' ? 400 :
              err.code === 'INVALID_HYPERPARAMETERS' ? 400 :
              502;
            const gatewayCode =
              err.code === 'PROVIDER_NOT_CONFIGURED' ? 'PROVIDER_NOT_CONFIGURED' :
              err.code === 'PROVIDER_UNAVAILABLE'    ? 'PROVIDER_UNAVAILABLE' :
              'INVALID_REQUEST';
            throw new GatewayError(gatewayCode, err.message, status, {
              submitter_code: err.code,
              ...err.details,
            });
          }
          throw err;
        }

        const updated = await getStore().markPreparing({
          id: job.id,
          provider_job_id: submitted.provider_job_id,
          effective_model_id: submitted.effective_model_id,
        });
        if (!updated) {
          throw new GatewayError(
            'INTERNAL',
            'submission accepted but DB state-flip failed',
            500,
            { provider_job_id: submitted.provider_job_id },
          );
        }
        res.status(200).json({
          job: updated,
          provider_job_id: submitted.provider_job_id,
          effective_model_id: submitted.effective_model_id,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /v1/fine-tunes/poll — run one polling tick against the
  // provider for every non-terminal job with a provider_job_id. Returns
  // observability counts. Admin-scoped because each tick spends provider
  // quota.
  fineTuneRouter.post(
    '/fine-tunes/poll',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limitRaw = (req.body as { limit?: unknown })?.limit;
        const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(Math.floor(limitRaw), 200)
          : undefined;
        const tick = await runPollTick({ store: getStore(), limit });
        res.json(tick);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /v1/fine-tunes/:id/cancel
  fineTuneRouter.post(
    '/fine-tunes/:id/cancel',
    requireScope('submit_job', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        if (!id) throw new GatewayError('INVALID_REQUEST', 'id required in path', 400);
        const reason = typeof (req.body as { reason?: unknown })?.reason === 'string'
          ? (req.body as { reason: string }).reason : undefined;
        const job = await getStore().cancel(id, reason);
        if (!job) throw new GatewayError('INVOCATION_NOT_FOUND', `fine-tune job ${id} not found`, 404);
        res.json(job);
      } catch (err) {
        next(err);
      }
    },
  );

  return fineTuneRouter;
}

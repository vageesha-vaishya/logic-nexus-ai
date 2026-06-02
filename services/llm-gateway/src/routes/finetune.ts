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

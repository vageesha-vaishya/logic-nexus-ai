// POST /v1/embed — embeddings endpoint. Per design §9.2.
//
// Body shape:
//   { tenant_id, model?, inputs: string[], metadata?: Record<string, unknown> }
//
// Scope: invoke (same as /v1/invoke; embeddings are billable LLM calls).
//
// Provider resolution uses the same cascade as /v1/invoke but defaults
// the provider_kind to `openai` since most embedding workloads target
// OpenAI's text-embedding-3 family today.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import { logger } from '../utils/logger.js';
import { resolveEmbedProvider } from '../embeddings/registry.js';
import type {
  EmbedProviderContext,
  EmbedRequest,
  EmbedResponse,
} from '../embeddings/types.js';

export const embedRouter = Router();

const DEFAULT_PROVIDER_KIND = 'openai' as const;
const DEFAULT_MODEL_ID = 'text-embedding-3-small';
const MAX_INPUTS = 256;
const MAX_INPUT_BYTES = 32_768;

function validate(raw: unknown): EmbedRequest {
  if (!raw || typeof raw !== 'object') {
    throw new GatewayError('INVALID_REQUEST', 'body must be a JSON object', 400);
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.tenant_id !== 'string' || r.tenant_id.length === 0) {
    throw new GatewayError('INVALID_REQUEST', 'tenant_id required', 400);
  }
  if (!Array.isArray(r.inputs) || r.inputs.length === 0) {
    throw new GatewayError('INVALID_REQUEST', 'inputs must be a non-empty array', 400);
  }
  if (r.inputs.length > MAX_INPUTS) {
    throw new GatewayError('INVALID_REQUEST', `inputs exceeds ${MAX_INPUTS}`, 400, { max: MAX_INPUTS });
  }
  for (let i = 0; i < r.inputs.length; i += 1) {
    const s = r.inputs[i];
    if (typeof s !== 'string') {
      throw new GatewayError('INVALID_REQUEST', `inputs[${i}] must be a string`, 400);
    }
    if (Buffer.byteLength(s, 'utf8') > MAX_INPUT_BYTES) {
      throw new GatewayError('INVALID_REQUEST', `inputs[${i}] exceeds ${MAX_INPUT_BYTES} bytes`, 400, {
        index: i,
        max_bytes: MAX_INPUT_BYTES,
      });
    }
  }
  const model = typeof r.model === 'string' && r.model.length > 0 ? r.model : DEFAULT_MODEL_ID;
  return {
    tenant_id: r.tenant_id,
    model,
    inputs: r.inputs as string[],
    metadata: (r.metadata ?? undefined) as Record<string, unknown> | undefined,
  };
}

export function mountEmbedRoutes(authLookup: () => AuthLookup): Router {
  embedRouter.post(
    '/embed',
    requireScope('invoke', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startedAt = performance.now();
        const invocation_id = randomUUID();
        const requestId = req.requestId;

        const parsed = validate(req.body);
        const provider = resolveEmbedProvider(DEFAULT_PROVIDER_KIND);
        const ctx: EmbedProviderContext = {
          invocation_id,
          model_id: parsed.model ?? DEFAULT_MODEL_ID,
          started_at: startedAt,
          request_id: requestId,
        };
        const result = await provider.embed(parsed, ctx);
        const latency_ms = Math.round(performance.now() - startedAt);

        const body: EmbedResponse = {
          invocation_id,
          model_used: result.model_used,
          provider_kind: provider.kind,
          embeddings: result.embeddings,
          usage: result.usage,
          cost_usd: result.cost_usd,
          latency_ms,
          warnings: result.warnings,
        };

        logger.info('embed completed', {
          request_id: requestId,
          invocation_id,
          tenant_id: parsed.tenant_id,
          provider_kind: provider.kind,
          model_used: body.model_used,
          input_count: parsed.inputs.length,
          latency_ms,
        });

        res.json(body);
      } catch (err) {
        next(err);
      }
    },
  );

  return embedRouter;
}

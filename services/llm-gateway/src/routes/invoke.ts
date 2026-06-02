// POST /v1/invoke — the heart of the gateway.
// P0: echo provider only. P1 adds resolver + real providers.
//
// Contract aligns with packages/llm-client/src/types.ts so the existing
// TS SDK (currently throws NOT_WIRED_MESSAGE) can be wired to this
// endpoint in P4 without contract changes.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

import { resolveProvider } from '../providers/index.js';
import { GatewayError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import type {
  InvokeRequest,
  InvokeResponse,
  ProviderContext,
  ProviderKind,
} from '../types/gateway.types.js';

export const invokeRouter = Router();

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function validateInvokeRequest(raw: unknown): InvokeRequest {
  if (!raw || typeof raw !== 'object') {
    throw new GatewayError('INVALID_REQUEST', 'body must be a JSON object', 400);
  }
  const r = raw as Record<string, unknown>;
  const tenant_id = asString(r.tenant_id);
  const module_ = asString(r.module);
  const feature = asString(r.feature);
  const prompt_key = asString(r.prompt_key);

  const missing: string[] = [];
  if (!tenant_id) missing.push('tenant_id');
  if (!module_) missing.push('module');
  if (!feature) missing.push('feature');
  if (!prompt_key) missing.push('prompt_key');
  if (missing.length) {
    throw new GatewayError('INVALID_REQUEST', `missing required fields: ${missing.join(', ')}`, 400, { missing });
  }

  const variables = (r.variables ?? {}) as Record<string, unknown>;
  if (variables === null || typeof variables !== 'object' || Array.isArray(variables)) {
    throw new GatewayError('INVALID_REQUEST', 'variables must be an object', 400);
  }

  const subject = r.subject as InvokeRequest['subject'] | undefined;
  if (subject != null) {
    if (typeof subject !== 'object' || !asString((subject as { type?: unknown }).type) || !asString((subject as { id?: unknown }).id)) {
      throw new GatewayError('INVALID_REQUEST', 'subject must be {type, id} when present', 400);
    }
  }

  const options = (r.options ?? undefined) as InvokeRequest['options'];
  const required_capabilities = r.required_capabilities as string[] | undefined;

  return {
    tenant_id: tenant_id!,
    module: module_!,
    feature: feature!,
    prompt_key: prompt_key!,
    variables,
    subject,
    options,
    required_capabilities,
  };
}

// P0 provider resolution: trivial. Hardcoded to echo unless options.provider_override
// is set (and only echo is registered). P1 replaces this with the 6-layer cascade.
function resolveProviderKind(req: InvokeRequest): ProviderKind {
  return req.options?.provider_override ?? 'echo';
}

invokeRouter.post('/invoke', async (req: Request, res: Response, next: NextFunction) => {
  // Express 4 doesn't auto-forward async errors to the error middleware,
  // so we wrap the whole handler in try/catch + next(err).
  try {
    const startedAt = performance.now();
    const invocation_id = randomUUID();
    const requestId = req.requestId;

    const parsed = validateInvokeRequest(req.body);
    const providerKind = resolveProviderKind(parsed);
    const provider = resolveProvider(providerKind);

    const ctx: ProviderContext = {
      invocation_id,
      model_id: parsed.options?.model_override ?? '',
      started_at: startedAt,
      request_id: requestId,
    };

    const result = await provider.invoke(parsed, ctx);
    const latency_ms = Math.round(performance.now() - startedAt);

    const body: InvokeResponse = {
      invocation_id,
      output: result.output,
      cache_hit: false,
      model_used: result.model_used,
      provider_kind: providerKind,
      usage: result.usage,
      cost_usd: result.cost_usd,
      latency_ms,
      warnings: result.warnings,
      scaffold_phase: 'P0',
    };

    logger.info('invoke completed', {
      request_id: requestId,
      invocation_id,
      tenant_id: parsed.tenant_id,
      prompt_key: parsed.prompt_key,
      provider_kind: providerKind,
      model_used: result.model_used,
      latency_ms,
    });

    res.json(body);
  } catch (err) {
    next(err);
  }
});

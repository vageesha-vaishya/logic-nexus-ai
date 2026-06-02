// Invocation audit-log writer. Writes one row per /v1/invoke into
// gateway.llm_invocations (append-only — UPDATE/DELETE blocked at the
// DB level via gateway.block_invocation_update_delete trigger).
//
// Fire-and-forget pattern: the writer is called AFTER the HTTP response
// is sent, so a DB hiccup never blocks the client. Errors land in
// structured logs only — observability picks them up via the standard
// pipeline. Per design §4.5 + §1.2.
//
// Credential-deferred: missing SUPABASE env vars → buildInvocationWriter()
// returns a no-op writer so dev/test environments without DB still work.
// Same pattern as supabaseStores / anthropic adapter.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { InvokeRequest } from '../types/gateway.types.js';
import type { ResolvedProvider } from '../resolver/types.js';

export interface InvocationAuditPayload {
  id: string;                               // invocation_id (uuid)
  tenant_id: string;
  request_id: string;
  prompt_key: string;
  module: string;
  feature: string;
  subject_type?: string | null;
  subject_id?: string | null;
  resolved_scope_kind: string;
  resolved_scope_id: string;
  provider_kind: string;
  model_id: string;
  billing_mode: string;
  fallback_used: boolean;
  cache_hit: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  provider_cost_usd: number;
  billed_cost_usd: number;
  latency_ms: number;
  warnings?: string[] | null;
  parent_invocation_id?: string | null;
  trace_id?: string | null;
}

export type InvocationWriter = (payload: InvocationAuditPayload) => void;

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Returns a writer function. If SUPABASE env vars are missing, the
 * writer is a no-op (logs once at boot, then silently discards).
 */
export function buildInvocationWriter(): InvocationWriter {
  const env = readEnv();
  if (!env) {
    logger.info('invocation writer: env vars missing, audit log disabled');
    let warnedOnce = false;
    return (_payload: InvocationAuditPayload) => {
      if (!warnedOnce) {
        logger.warn('invocation audit log dropped: no supabase env configured');
        warnedOnce = true;
      }
    };
  }

  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('invocation writer: initialized', { url_host: new URL(env.url).host });

  return (payload: InvocationAuditPayload): void => {
    // Fire-and-forget. We don't await; the caller has already
    // responded. Errors land in structured logs.
    void (async () => {
      try {
        const { error } = await client.from('llm_invocations').insert({
          id: payload.id,
          tenant_id: payload.tenant_id,
          request_id: payload.request_id,
          prompt_key: payload.prompt_key,
          module: payload.module,
          feature: payload.feature,
          subject_type: payload.subject_type ?? null,
          subject_id: payload.subject_id ?? null,
          resolved_scope_kind: payload.resolved_scope_kind,
          resolved_scope_id: payload.resolved_scope_id,
          provider_kind: payload.provider_kind,
          model_id: payload.model_id,
          billing_mode: payload.billing_mode,
          fallback_used: payload.fallback_used,
          cache_hit: payload.cache_hit,
          prompt_tokens: payload.prompt_tokens,
          completion_tokens: payload.completion_tokens,
          total_tokens: payload.total_tokens,
          provider_cost_usd: payload.provider_cost_usd,
          billed_cost_usd: payload.billed_cost_usd,
          latency_ms: payload.latency_ms,
          warnings: payload.warnings ?? null,
          parent_invocation_id: payload.parent_invocation_id ?? null,
          trace_id: payload.trace_id ?? null,
        });
        if (error) {
          logger.error('invocation audit insert failed', {
            invocation_id: payload.id,
            err: error.message,
            code: error.code,
          });
        }
      } catch (err) {
        logger.error('invocation audit insert threw', {
          invocation_id: payload.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  };
}

/**
 * Build the audit payload from the pieces /v1/invoke already has on
 * hand. Pure function — no I/O. Keeps the route handler tidy.
 */
export function buildAuditPayload(args: {
  invocation_id: string;
  request_id: string;
  request: InvokeRequest;
  resolved: ResolvedProvider;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
  cache_hit?: boolean;
  fallback_used?: boolean;
}): InvocationAuditPayload {
  return {
    id: args.invocation_id,
    tenant_id: args.request.tenant_id,
    request_id: args.request_id,
    prompt_key: args.request.prompt_key,
    module: args.request.module,
    feature: args.request.feature,
    subject_type: args.request.subject?.type ?? null,
    subject_id: args.request.subject?.id ?? null,
    resolved_scope_kind: args.resolved.resolved_scope_kind,
    resolved_scope_id: args.resolved.resolved_scope_id,
    provider_kind: args.resolved.provider_kind,
    model_id: args.resolved.model_id,
    billing_mode: args.resolved.billing_mode,
    fallback_used: args.fallback_used ?? false,
    cache_hit: args.cache_hit ?? false,
    prompt_tokens: args.usage.prompt_tokens,
    completion_tokens: args.usage.completion_tokens,
    total_tokens: args.usage.total_tokens,
    provider_cost_usd: args.cost_usd,
    billed_cost_usd: args.cost_usd,        // P5 will diverge these when markup ships
    latency_ms: args.latency_ms,
    warnings: args.warnings ?? null,
    parent_invocation_id: null,             // P3+ when agent chains land
    trace_id: null,                          // P10 with OpenTelemetry
  };
}

/**
 * Per-call observability. Every successful and failed invocation writes
 * one row through this interface — backed by `core.llm_invocations` in
 * Phase 9 (master §6.5).
 */

import type { InvokeRequest, InvokeResponse, Outcome } from "./types.js";

export interface InvocationLog {
  invocation_id: string;
  tenant_id: string;
  occurred_at: string;
  module: string;
  feature: string;
  prompt_key: string;
  prompt_version: number;
  experiment_id?: string | null;
  experiment_arm?: "control" | "variant" | null;
  subject_type?: string | null;
  subject_id?: string | null;
  variables: Record<string, unknown>;
  /** The final prompt text sent to the provider (post-redaction). */
  resolved_prompt: string;
  model_used: string;
  output_raw?: string;
  output_parsed?: unknown;
  cache_hit: boolean;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
  error?: string | null;
}

export interface InvocationLogger {
  write(entry: InvocationLog): Promise<void>;
  writeOutcome(args: {
    invocation_id: string;
    outcome: Outcome;
    recorded_at: string;
  }): Promise<void>;
}

/**
 * Phase 0 default. Discards. Replaced by a Postgres-backed logger
 * in Phase 9 that writes to `core.llm_invocations`.
 */
export class NullInvocationLogger implements InvocationLogger {
  async write(): Promise<void> {
    /* no-op */
  }
  async writeOutcome(): Promise<void> {
    /* no-op */
  }
}

/**
 * Test helper — keeps invocation rows in memory so tests can assert
 * what was logged.
 */
export class MemoryInvocationLogger implements InvocationLogger {
  readonly invocations: InvocationLog[] = [];
  readonly outcomes: Array<{
    invocation_id: string;
    outcome: Outcome;
    recorded_at: string;
  }> = [];

  async write(entry: InvocationLog): Promise<void> {
    this.invocations.push(entry);
  }
  async writeOutcome(args: {
    invocation_id: string;
    outcome: Outcome;
    recorded_at: string;
  }): Promise<void> {
    this.outcomes.push(args);
  }

  /** Test ergonomics. */
  clear(): void {
    this.invocations.length = 0;
    this.outcomes.length = 0;
  }
}

/**
 * Variables → deterministic hash for cache-key composition.
 * Stable across runs as long as variable contents are stable.
 */
export function hashVariables(variables: Record<string, unknown>): string {
  const json = JSON.stringify(variables, sortedReplacer);
  return djb2(json);
}

function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit and base36 for compactness
  return (h >>> 0).toString(36);
}

/**
 * Records what InvokeRequest/InvokeResponse combination produced an
 * invocation. Useful for tests and for the Improver Agent that reads
 * historical invocations.
 */
export function summariseInvocation(
  req: InvokeRequest,
  res: InvokeResponse,
  extras: {
    prompt_version: number;
    resolved_prompt: string;
    occurred_at: string;
  },
): InvocationLog {
  return {
    invocation_id: res.invocation_id,
    tenant_id: req.tenant_id,
    occurred_at: extras.occurred_at,
    module: req.module,
    feature: req.feature,
    prompt_key: req.prompt_key,
    prompt_version: extras.prompt_version,
    subject_type: req.subject?.type ?? null,
    subject_id: req.subject?.id ?? null,
    variables: req.variables,
    resolved_prompt: extras.resolved_prompt,
    model_used: res.model_used,
    cache_hit: res.cache_hit,
    prompt_tokens: res.usage.prompt_tokens,
    completion_tokens: res.usage.completion_tokens,
    total_tokens: res.usage.total_tokens,
    cost_usd: res.cost_usd,
    latency_ms: res.latency_ms,
    warnings: res.warnings,
  };
}

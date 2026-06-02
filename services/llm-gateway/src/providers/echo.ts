// Echo provider — P0 default. Deterministic mock. Returns a canned
// response that depends only on (prompt_key, variables) so caller-side
// dev/test code is reproducible. No network, no DB, no LLM.
//
// Per design §1.6 the gateway supports two non-provider providers:
//   - echo:   this file (P0 default)
//   - replay: serves cached real responses from fixtures/ (added in P2)

import type { InvokeRequest, ProviderAdapter, ProviderContext, ProviderResult } from '../types/gateway.types.js';

const FIXED_MODEL_ID = 'echo-v1';

const ECHO_LATENCY_HINT_MS = 5; // intentional baseline so callers can measure plumbing overhead

function deterministicTokenCount(text: string): number {
  // ~4 chars/token rough heuristic; deterministic across runs.
  return Math.max(1, Math.ceil(text.length / 4));
}

function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(',')}]`;
  const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${k}:${canonicalize(v)}`).join(',')}}`;
}

export const echoProvider: ProviderAdapter = {
  kind: 'echo',
  async invoke(req: InvokeRequest, ctx: ProviderContext): Promise<ProviderResult> {
    // Simulate a tiny processing window so consumers can observe
    // non-zero latency; intentionally < the 50ms P0 gate.
    await new Promise((resolve) => setTimeout(resolve, ECHO_LATENCY_HINT_MS));

    const variablesCanon = canonicalize(req.variables);
    const promptTokens = deterministicTokenCount(`${req.prompt_key}|${variablesCanon}`);

    const output = {
      kind: 'echo',
      prompt_key: req.prompt_key,
      tenant_id: req.tenant_id,
      module: req.module,
      feature: req.feature,
      // Loopback of (truncated) inputs so caller tests can assert
      // both the request shape and the round-trip identity.
      echo: {
        variables: req.variables,
        subject: req.subject ?? null,
      },
      message: `echo: ${req.prompt_key}`,
    };

    const outputText = JSON.stringify(output);
    const completionTokens = deterministicTokenCount(outputText);

    return {
      output,
      model_used: `${ctx.model_id || FIXED_MODEL_ID}`,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      cost_usd: 0, // echo is free
      warnings: ['echo_provider_used'],
    };
  },
};

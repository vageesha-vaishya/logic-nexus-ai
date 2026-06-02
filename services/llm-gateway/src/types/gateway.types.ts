// Core contract types for the LLM gateway. Mirrors
// packages/llm-client/src/types.ts (Phase 0 contract preserved) and
// docs/plans/2026-06-02-unified-llm-gateway-design.md §2.6.

export type ProviderKind =
  | 'anthropic'
  | 'openai'
  | 'google_gemini'
  | 'mistral'
  | 'ollama'
  | 'vllm'
  | 'azure_openai'
  | 'echo'
  | 'replay';

export type BillingMode = 'platform_paid' | 'tenant_paid';

export interface InvokeRequest {
  tenant_id: string;
  module: string;                     // e.g. 'compliance', 'sales', 'comms'
  feature: string;                    // e.g. 'screening.hit_reasoning'
  prompt_key: string;                 // canonical prompt identifier (<module>.<feature>)
  variables: Record<string, unknown>;
  subject?: { type: string; id: string };
  options?: InvokeOptions;
  required_capabilities?: string[];   // e.g. ['tools', 'vision', 'json_mode']
}

export interface InvokeOptions {
  model_override?: string;
  provider_override?: ProviderKind;
  cache_ttl_seconds?: number;
  timeout_ms?: number;
  temperature?: number;
  max_tokens?: number;
}

export interface InvokeUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface InvokeResponse<TOutput = unknown> {
  invocation_id: string;
  output: TOutput;
  cache_hit: boolean;
  model_used: string;
  provider_kind: ProviderKind;
  usage: InvokeUsage;
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
  // P0 only: surface that this is the scaffold + which provider served the call
  scaffold_phase?: 'P0';
}

// Outcome recorded by the caller via /v1/outcomes (post-P0)
export type Outcome =
  | { kind: 'accepted' }
  | { kind: 'accepted_after_edit'; edit_summary: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'overridden'; override_reason: string }
  | { kind: 'ignored' };

// Error envelope per §2.4 of the design.
export type GatewayErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TENANT_NOT_FOUND'
  | 'PROMPT_NOT_FOUND'
  | 'BUDGET_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'EGRESS_FORBIDDEN'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'MODEL_CAPABILITY_MISMATCH'
  | 'MODEL_DEPRECATED'
  | 'PII_PASS_THROUGH_NOT_CONSENTED'
  | 'PII_PATTERN_INVALID'
  | 'PII_UNREDACTABLE'
  | 'INVOCATION_NOT_FOUND'
  | 'INTERNAL';

export interface GatewayErrorBody {
  error: {
    code: GatewayErrorCode;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

// Provider adapter contract — every provider implements this.
export interface ProviderAdapter {
  kind: ProviderKind;
  invoke(req: InvokeRequest, ctx: ProviderContext): Promise<ProviderResult>;
}

export interface ProviderContext {
  invocation_id: string;
  model_id: string;
  started_at: number;       // performance.now() at request entry
  request_id: string;
  /**
   * Pre-rendered prompt body from the prompt store (P3.2). When set,
   * adapters should pass it directly to the provider as the user-message
   * content instead of building their own scaffold from the variables.
   * Undefined when no prompt is registered for the prompt_key — adapters
   * then fall back to their internal renderPromptBody scaffold so
   * callers that haven't registered prompts yet keep working.
   */
  rendered_body?: string;
  prompt_version_id?: string;
  prompt_version_number?: number;
}

export interface ProviderResult<TOutput = unknown> {
  output: TOutput;
  model_used: string;
  usage: InvokeUsage;
  cost_usd: number;
  warnings?: string[];
}

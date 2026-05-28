export type ModuleName =
  | "core"
  | "crm"
  | "sales"
  | "quotation"
  | "logistics"
  | "finance"
  | "compliance"
  | "comms"
  | "amro"
  | "uim"
  | "markets";

export interface InvokeRequest {
  tenant_id: string;
  module: ModuleName;
  /** Feature name within the module — used for usage attribution and per-feature budget caps. */
  feature: string;
  /** Canonical prompt-repository key, e.g. 'sales.lead.score_evaluation'. */
  prompt_key: string;
  /** Mustache-style template variables. Missing required variables → error. */
  variables: Record<string, unknown>;
  /** Subject the call is about — links the invocation back to a business entity for outcome tracking. */
  subject?: { type: string; id: string };
  options?: InvokeOptions;
}

export interface InvokeOptions {
  /** Force a specific model. Subject to safety_class constraints. */
  model_override?: string;
  temperature?: number;
  max_tokens?: number;
  /** Override the prompt's frontmatter cache_ttl. 0 = no cache. */
  cache_ttl_seconds?: number;
  /** Default 30000. */
  timeout_ms?: number;
}

export interface InvokeResponse<TOutput = unknown> {
  /** ULID. FK target for outcome tracking and `core.llm_invocations`. */
  invocation_id: string;
  output: TOutput;
  cache_hit: boolean;
  model_used: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  latency_ms: number;
  /** Non-fatal warnings, e.g. 'pii_redacted', 'low_confidence', 'fallback_model_used'. */
  warnings?: string[];
}

export type Outcome =
  | { kind: "accepted"; user_id: string; notes?: string }
  | { kind: "accepted_after_edit"; user_id: string; edited_output: unknown; notes?: string }
  | { kind: "rejected"; user_id: string; notes?: string }
  | { kind: "overridden"; user_id: string; edited_output: unknown; notes?: string }
  | { kind: "ignored"; notes?: string };

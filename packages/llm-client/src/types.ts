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
  /** Provider tools the model can call. Mirror of gateway §9.3. */
  tools?: ToolDef[];
  tool_choice?: ToolChoice;
  /** Multi-modal attachments (images today). Mirror of gateway §9.4. */
  attachments?: Attachment[];
  /** Required capabilities checked at config-time + per call. */
  required_capabilities?: ('tools' | 'vision' | 'json_mode' | 'streaming' | 'embeddings' | 'fine_tuning')[];
}

export interface ToolDef {
  name: string;
  description?: string;
  parameters_schema: Record<string, unknown>;
}

export type ToolChoice = 'auto' | 'required' | 'none' | { name: string };

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type AttachmentKind = 'image' | 'audio' | 'document';

export interface Attachment {
  kind: AttachmentKind;
  mime_type: string;
  content_base64?: string;
  url?: string;
  label?: string;
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
  /** Provider that served this call. Echoed by the gateway. */
  provider_kind?: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  latency_ms: number;
  /** Non-fatal warnings, e.g. 'pii_redacted', 'low_confidence', 'fallback_model_used'. */
  warnings?: string[];
  /** When the model called tools, the caller must execute them out-of-band. */
  tool_calls?: ToolCall[];
}

// ── Embeddings (gateway §9.2) ────────────────────────────────────────────
export interface EmbedRequest {
  tenant_id: string;
  /** Embedding model. Defaults to text-embedding-3-small server-side. */
  model?: string;
  /** Inputs to embed. ≤ 256 strings, each ≤ 32 KB UTF-8. */
  inputs: string[];
  metadata?: Record<string, unknown>;
}

export interface EmbedResponse {
  invocation_id: string;
  model_used: string;
  provider_kind?: string;
  /** One vector per input, in order. */
  embeddings: number[][];
  usage: { prompt_tokens: number; total_tokens: number };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

// ── Fine-tune jobs (gateway §9.1) ────────────────────────────────────────
export type FineTuneStatus = 'queued' | 'preparing' | 'training' | 'succeeded' | 'failed' | 'cancelled';
export type DatasetFormat = 'jsonl' | 'parquet' | 'csv';

export interface FineTuneCreateInput {
  tenant_id: string;
  provider_kind: 'anthropic' | 'openai' | 'google_gemini' | 'mistral';
  base_model_id: string;
  dataset_url?: string;
  dataset_format?: DatasetFormat;
  hyperparameters?: Record<string, unknown>;
  created_by_user_id?: string;
}

export interface FineTuneJob {
  id: string;
  tenant_id: string;
  provider_kind: string;
  base_model_id: string;
  fine_tuned_model_id?: string | null;
  provider_job_id?: string | null;
  dataset_url?: string | null;
  dataset_format?: DatasetFormat | null;
  hyperparameters: Record<string, unknown>;
  status: FineTuneStatus;
  status_message?: string | null;
  result_metrics: Record<string, unknown>;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export type Outcome =
  | { kind: "accepted"; user_id: string; notes?: string }
  | { kind: "accepted_after_edit"; user_id: string; edited_output: unknown; notes?: string }
  | { kind: "rejected"; user_id: string; notes?: string }
  | { kind: "overridden"; user_id: string; edited_output: unknown; notes?: string }
  | { kind: "ignored"; notes?: string };

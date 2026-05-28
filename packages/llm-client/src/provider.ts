/**
 * Provider-adapter contract. Every concrete provider integration
 * (Anthropic, OpenAI, Gemini, Mistral, etc.) implements this single
 * interface so `LlmClient` can swap or fail-over models without
 * touching call-site code.
 *
 * Real adapters import their SDKs INSIDE this package only — CI lint
 * (scripts/lint-llm-imports.mjs) enforces that boundary.
 */

export interface ProviderAdapter {
  /** Stable identifier, e.g. 'anthropic', 'openai', 'gemini'. */
  readonly name: string;

  /** Which model identifiers this adapter accepts. */
  supports(model: string): boolean;

  call(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface ProviderRequest {
  model: string;
  system_prompt?: string;
  user_prompt: string;
  /** If set, the provider should return a JSON object matching this schema. */
  output_schema?: object;
  temperature?: number;
  max_tokens?: number;
  /** Stop sequences. */
  stop?: string[];
  /** Provider-specific extras (e.g. Anthropic tool-use config). */
  extra?: Record<string, unknown>;
  /** Tenant-aware abort signal. */
  signal?: AbortSignal;
}

export interface ProviderResponse {
  output_text: string;
  /** Parsed JSON if the request had output_schema and the provider returned JSON. */
  output_parsed?: unknown;
  model_used: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Estimated cost in USD based on token counts and provider's published rate. */
  cost_usd: number;
  /** Provider-specific finish reason: 'stop', 'length', 'content_filter', etc. */
  finish_reason: string;
  /** Non-fatal warnings. */
  warnings?: string[];
}

/**
 * Phase 0 placeholder. Throws on every call so business code can
 * import the right symbol without accidentally hitting a real provider.
 */
export class NullProviderAdapter implements ProviderAdapter {
  readonly name = "null";
  supports(): boolean {
    return true;
  }
  async call(): Promise<ProviderResponse> {
    throw new Error(
      "[@platform/llm-client] NullProviderAdapter cannot make real calls. Phase 9 wires real adapters per master §7.4.",
    );
  }
}

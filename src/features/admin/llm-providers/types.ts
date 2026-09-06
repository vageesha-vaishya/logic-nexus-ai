/**
 * LLM provider configuration types.
 *
 * `domain` is the gateway task-ID prefix a config serves. `null` means the
 * tenant-wide default, used by any domain without a config of its own.
 */

/**
 * `LlmDomain` lives here rather than in constants.ts so the dependency runs
 * one way: constants.ts imports types, never the reverse. LLM_DOMAINS in
 * constants.ts is typed `readonly LlmDomain[]` against this union.
 */
export type LlmDomain = "markets" | "logistics" | "comms" | "ops" | "security";

export type LlmProviderKind =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "gemini"
  | "local-qwen"
  | "custom";

export interface LlmProviderConfig {
  id: string;
  tenant_id: string;
  provider: LlmProviderKind;
  display_name: string;
  base_url: string | null;
  default_model: string;
  domain: LlmDomain | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface CreateLlmConfigInput {
  provider: LlmProviderKind;
  display_name: string;
  default_model: string;
  api_key: string;
  base_url?: string | null;
  is_default?: boolean;
  domain?: LlmDomain | null;
}

export interface UpdateLlmConfigInput {
  display_name?: string;
  default_model?: string;
  base_url?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  api_key?: string;
  domain?: LlmDomain | null;
}

// Types for the prompt-management layer. Per design §5.3.

export type PromptStatus = 'active' | 'deprecated' | 'archived';
export type PromptVersionStatus = 'draft' | 'active' | 'superseded' | 'rolled_back';
export type PromptSource = 'git' | 'admin_ui';
export type SafetyClass = 'standard' | 'elevated' | 'restricted';

export interface PromptVersion {
  id: string;
  prompt_key: string;
  version_number: number;
  body: string;
  body_variants: Record<string, string>;   // keyed by provider_kind
  frontmatter: Record<string, unknown>;
  input_schema?: Record<string, unknown> | null;
  output_schema?: Record<string, unknown> | null;
  default_capability?: string | null;
  default_temperature?: number | null;
  default_max_tokens?: number | null;
  cache_ttl_seconds: number;
  safety_class: SafetyClass;
  status: PromptVersionStatus;
  source: PromptSource;
  git_sha?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
  promoted_at?: string | null;
}

export interface Prompt {
  key: string;
  module: string;
  feature: string;
  description?: string | null;
  status: PromptStatus;
  active_version_id: string | null;
  active_version?: PromptVersion;
  created_at: string;
  updated_at: string;
}

export class PromptError extends Error {
  constructor(
    public readonly code:
      | 'PROMPT_NOT_FOUND'
      | 'PROMPT_VERSION_NOT_FOUND'
      | 'PROMPT_NO_ACTIVE_VERSION'
      | 'PROMPT_RENDER_FAILED'
      | 'PROMPT_STORE_UNAVAILABLE',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PromptError';
  }
}

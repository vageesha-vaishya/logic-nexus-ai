export type PromptStatus = "draft" | "shadow" | "active" | "deprecated";

export type PiiHandling = "pass_through" | "redact_emails_phones" | "redact_all";

export type SafetyClass = "business_advisory" | "customer_facing" | "regulatory";

export interface PromptFrontmatter {
  key: string;
  version: number;
  status: PromptStatus;
  owner_module: string;
  default_model: string;
  fallback_model?: string;
  expected_inputs: string[];
  output_schema?: string;
  max_tokens?: number;
  temperature?: number;
  cache_ttl_seconds?: number;
  pii_handling: PiiHandling;
  safety_class: SafetyClass;
}

export interface PromptDefinition {
  frontmatter: PromptFrontmatter;
  /** Prompt body text (after the frontmatter --- block). */
  body: string;
  /** Filesystem path the prompt was loaded from. */
  source_path: string;
}

export interface PromptListFilter {
  module?: string;
  status?: PromptStatus;
}

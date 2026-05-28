import type { PromptDefinition, SafetyClass } from "@platform/llm-prompts";

export interface PromptVariant {
  prompt_key: string;
  /** The version number this variant proposes (typically current_version.version + 1). */
  version: number;
  body: string;
  /** Human-readable rationale — what the agent changed and why. */
  rationale: string;
  /** Expected improvement claim, e.g. "+8% acceptance, -15% latency". */
  expected_improvement: string;
}

export interface PromptMetrics {
  acceptance_rate: number;
  override_rate: number;
  /** Mean edit-distance between LLM output and user-edited output, when overridden. */
  override_distance: number | null;
  latency_p50_ms: number;
  latency_p95_ms: number;
  cost_per_call_usd: number;
  schema_validation_failure_rate: number;
  /** Mean delta between predicted probability and realised outcome — for prediction-style prompts. */
  confidence_calibration: number | null;
  sample_size: number;
}

/**
 * Loosely-typed historical invocation payload. Phase 9 swaps in a richer type
 * once `core.llm_invocations` is queryable.
 */
export interface HistoricalInvocation {
  invocation_id: string;
  occurred_at: string;
  variables: Record<string, unknown>;
  output_parsed: unknown;
  outcome: {
    kind: "accepted" | "rejected" | "overridden" | "ignored" | "accepted_after_edit";
    edited_output?: unknown;
  } | null;
  model_used: string;
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

export interface ImproverInput {
  prompt_key: string;
  current_version: PromptDefinition;
  historical_invocations: HistoricalInvocation[];
  failure_cases: HistoricalInvocation[];
  success_cases: HistoricalInvocation[];
  metrics: PromptMetrics;
  constraints: {
    max_tokens: number;
    model: string;
    safety_class: SafetyClass;
  };
}

export interface PromptImproverAgent {
  proposeVariants(input: ImproverInput): Promise<PromptVariant[]>;
}

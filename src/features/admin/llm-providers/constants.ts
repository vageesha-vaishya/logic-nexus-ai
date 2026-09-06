import type { LlmDomain, LlmProviderKind } from "./types";

/**
 * Gateway domains — the task-ID prefixes in LlmTaskId
 * (supabase/functions/_shared/llm-gateway.ts). This list must stay identical
 * to the SQL CHECK constraint on platform.llm_provider_configs.domain and to
 * VALID_DOMAINS in the llm-provider-config edge function.
 *
 * Fixed order: this is the order the settings page renders its sections in.
 */
export const LLM_DOMAINS: readonly LlmDomain[] =
  ["markets", "logistics", "comms", "ops", "security"] as const;

/** Gateway routing keys are not the vocabulary users see elsewhere. */
export const DOMAIN_LABELS: Record<LlmDomain, string> = {
  markets:   "Markets",
  logistics: "Logistics",
  comms:     "Communications",
  ops:       "Automation & Agents",
  security:  "Security",
};

export const DOMAIN_DESCRIPTIONS: Record<LlmDomain, string> = {
  markets:   "Briefs, sentiment, research, strategy explanations",
  logistics: "Quotes, invoice extraction, demand narratives, transport mode",
  comms:     "Smart replies and message drafting",
  ops:       "Agent planning",
  security:  "Email threat analysis",
};

export const PROVIDER_LABELS: Record<LlmProviderKind, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Google Gemini",
  "local-qwen": "Local Qwen",
  custom: "Custom (OpenAI-compatible)",
};

export const PROVIDER_HINT: Record<LlmProviderKind, string> = {
  anthropic:   "Direct Claude API. Get a key at console.anthropic.com.",
  openrouter:  "One key, many models. Models named like 'anthropic/claude-3.5-sonnet'. Get a key at openrouter.ai/keys.",
  openai:      "OpenAI native API.",
  gemini:      "Google Gemini API. Get a key at aistudio.google.com/apikey.",
  "local-qwen":"Your local Qwen server (must speak OpenAI chat-completions). Set base_url.",
  custom:      "Any OpenAI-compatible chat-completions endpoint. Set base_url and a model name the upstream understands.",
};

/**
 * Known-good Gemini models on the v1beta `generateContent` endpoint as of
 * 2026-05. Surfaced as a Select to prevent users from typing a retired
 * model name (e.g. `gemini-1.5-flash-002`) and hitting a 404 at
 * generation time. The "Custom…" sentinel lets power users still paste
 * any model id (e.g. a newly-released model not yet on this list).
 */
export const GEMINI_KNOWN_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
] as const;
export const GEMINI_CUSTOM_SENTINEL = "__custom__";

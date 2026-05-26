// =====================================================================
// LLM Gateway — single chokepoint for all LLM calls from Edge Functions.
// Per ADR-024 + the per-tenant configurability decision (2026-05-15).
//
// Provider resolution order:
//   1. Look up platform.get_tenant_llm_config(tenant_id) for the tenant's
//      active default. If present → use that provider + model + decrypted key.
//   2. Else fall back to env (legacy: ANTHROPIC_API_KEY) using the static
//      ROUTING map.
//
// Supported providers:
//   • anthropic    — native Messages API
//   • openrouter   — OpenAI-compatible chat completions, routes to many models
//                    (key https://openrouter.ai/keys)
//   • openai       — chat completions (drop-in; same shape as openrouter)
//   • gemini       — TODO (not wired)
//   • local-qwen   — TODO (D-11)
// =====================================================================

import { SupabaseClient } from "@supabase/supabase-js";
import { Logger } from "./logger.ts";

declare const Deno: any;

export type LlmProvider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "gemini"
  | "local-qwen"
  | "custom";

export type LlmTaskId =
  | "markets.daily_brief"
  | "markets.news_sentiment"
  | "markets.earnings_summary"
  | "markets.research_thread"
  | "markets.strategy_explain"
  | "markets.portfolio_diagnostic";

interface RoutingEntry {
  provider: LlmProvider;
  model: string;
  maxOutputTokens: number;
}

// Static fallback routing — used only when no tenant config exists.
// Modify via the platform.llm_provider_configs table to override per tenant.
const FALLBACK_ROUTING: Record<LlmTaskId, RoutingEntry> = {
  "markets.daily_brief":         { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 2048 },
  "markets.news_sentiment":      { provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  256 },
  "markets.earnings_summary":    { provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens: 1024 },
  "markets.research_thread":     { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 4096 },
  "markets.strategy_explain":    { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 2048 },
  "markets.portfolio_diagnostic":{ provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  800 },
};

// Max output token defaults per task. The model name comes from the tenant
// config; we keep the budget consistent per task regardless of model.
const MAX_OUTPUT_TOKENS: Record<LlmTaskId, number> = {
  "markets.daily_brief":         2048,
  "markets.news_sentiment":       256,
  "markets.earnings_summary":    1024,
  "markets.research_thread":     4096,
  "markets.strategy_explain":    2048,
  "markets.portfolio_diagnostic": 800,
};

interface PromptTemplate { version: string; system: string; user: string; }

const PROMPTS: Record<LlmTaskId, PromptTemplate> = {
  "markets.daily_brief": {
    version: "v3-2026-05-15",
    system:
      "You are a calm, India-market-focused portfolio analyst. " +
      "Output is concise Markdown. Use ₹ for INR. Never give personalized investment advice.\n\n" +
      "STRICT GROUNDING RULES (these override anything else):\n" +
      "1. You may ONLY make claims that are directly supported by an item in the Recent news JSON. " +
      "Do not draw on your general training knowledge about specific companies, prices, or events.\n" +
      "2. Every factual claim must be cited with a numbered source `[N]` where N is the 1-based index " +
      "of an item in Recent news JSON.\n" +
      "3. If Recent news JSON is empty (`[]`) or contains no items relevant to the user's tracked " +
      "instruments, you MUST output ONLY the `## No fresh news` template specified below. " +
      "Do not invent prices, movements, sentiment, or analysis from your training data.\n" +
      "4. Never name a company or symbol that does not appear in the Recent news JSON. " +
      "It is acceptable for the brief to be short.",
    user:
      "Generate today's brief for the portfolio below.\n\n" +
      "Portfolio name: ${portfolio_name}\n" +
      "Holdings JSON: ${holdings_json}\n" +
      "Tracked instruments (holdings + watchlists, NSE/BSE symbols): ${tracked_symbols_csv}\n" +
      "Watchlists JSON (name → symbols on that list): ${watchlist_json}\n" +
      "Recent news JSON (last 7 days; items mentioning tracked instruments are listed first): ${news_json}\n\n" +
      "Output format:\n\n" +
      "CASE A — Recent news JSON contains items relevant to the brief:\n" +
      "```\n" +
      "## <headline reflecting the news>\n" +
      "<two-sentence summary citing [N]>\n\n" +
      "- <bullet on a material story; cite [N]>\n" +
      "- <bullet on a material story; cite [N]>\n" +
      "- <bullet on a material story; cite [N]>\n\n" +
      "### Risks\n" +
      "- <risk grounded in a cited story [N]>\n" +
      "- <risk grounded in a cited story [N]>\n" +
      "```\n\n" +
      "CASE B — Recent news JSON is `[]`, or none of its items relate to tracked instruments " +
      "or the broader Indian market for today. Output ONLY this:\n" +
      "```\n" +
      "## No fresh news\n" +
      "No news from the last 7 days is available in our feed for your tracked instruments " +
      "(${tracked_symbols_csv}). A brief will be generated once relevant news is ingested.\n" +
      "```\n\n" +
      "Prefer Case A only if at least one Recent news JSON item directly supports the claim. " +
      "When in doubt, choose Case B. Do not blend the two.",
  },
  "markets.news_sentiment": {
    version: "v1-2026-05-15",
    system:
      "Classify each Indian-market news headline as 'positive', 'negative', or 'neutral' " +
      "for the named instruments. Reply with JSON only: " +
      `[{ "headline_index": 0, "score": -1..1, "label": "positive|negative|neutral" }, ...]`,
    user:
      "Instruments: ${instruments_csv}\n" +
      "Headlines (numbered):\n${headlines_numbered}",
  },
  "markets.earnings_summary": {
    version: "v1-2026-05-15",
    system:
      "Summarize this quarterly earnings call transcript for an Indian retail investor. " +
      "Keep it under 150 words. Lead with revenue/PAT YoY, two notable management quotes, one risk.",
    user: "${transcript}",
  },
  "markets.research_thread": {
    version: "v1-2026-05-15",
    system:
      "You are an India-market research analyst chatting with the user. " +
      "Ground every claim in the data provided in the conversation. " +
      "If you do not have data for a claim, say so explicitly.",
    user: "${user_message}",
  },
  "markets.strategy_explain": {
    version: "v1-2026-05-15",
    system:
      "Explain this trading strategy in plain English, then list its assumptions and failure modes. " +
      "Audience: an Indian retail investor evaluating it.",
    user: "Strategy DSL:\n${strategy_dsl}\n\nBacktest metrics JSON: ${metrics_json}",
  },
  "markets.portfolio_diagnostic": {
    version: "v1-2026-05-22",
    system:
      "You are a calm, India-market portfolio analyst writing a daily health diagnostic for one retail user. " +
      "Output MUST be a single JSON object — no prose before or after, no markdown fences. " +
      "Schema:\n" +
      "{\n" +
      "  \"headline\": string (≤ 80 chars, plain language, no jargon),\n" +
      "  \"findings\": string[] (1-3 items, each ≤ 140 chars, each grounded in a metric below),\n" +
      "  \"suggested_actions\": Array<{ \"type\": \"rebalance\" | \"view_harvest\" | \"view_stress_test\" | \"view_portfolio\", \"tier\"?: \"foundation\" | \"core\" | \"satellite\", \"symbol\"?: string, \"reason\": string }>\n" +
      "}\n" +
      "STRICT GROUNDING RULES:\n" +
      "1. Every finding must reference a metric value from the Metrics JSON. Do NOT invent numbers.\n" +
      "2. Use ONLY the action types listed above — each maps to an existing screen. Never invent new types or symbols not in the holdings list.\n" +
      "3. If all metrics are within target bands, output a positive headline with 1 affirming finding and an empty suggested_actions array.\n" +
      "4. Never give personalized investment advice. Frame findings as observations (\"Top holding is 28%\") not directives (\"Sell ICICI\").\n" +
      "5. Output INR amounts with ₹ prefix when relevant.",
    user:
      "Metrics JSON: ${metrics_json}\n\n" +
      "Top holdings (symbol → weight %): ${top_holdings_json}\n\n" +
      "Target tier allocations (tier → target %): ${target_allocations_json}\n\n" +
      "Generate the diagnostic JSON now.",
  },
};

// Pricing tables — best-effort; reconciled against invoices in T3.
interface ModelPricing { inputPerMillion: number; outputPerMillion: number; cachedInputPerMillion?: number; }
// Google Gemini direct (generativelanguage.googleapis.com). Pricing per
// Google's "AI Studio" rates as of 2026-05; if the model name is missing
// here we still bill 0 (zero cost recorded) rather than failing the call.
const GEMINI_PRICING: Record<string, ModelPricing> = {
  "gemini-1.5-flash":         { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-1.5-flash-002":     { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-1.5-flash-8b":      { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
  "gemini-1.5-pro":           { inputPerMillion: 1.25,  outputPerMillion: 5.00 },
  "gemini-1.5-pro-002":       { inputPerMillion: 1.25,  outputPerMillion: 5.00 },
  "gemini-2.0-flash":         { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  "gemini-2.0-flash-exp":     { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  "gemini-2.5-flash":         { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  "gemini-2.5-flash-lite":    { inputPerMillion: 0.075, outputPerMillion: 0.30 },
};
const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7":   { inputPerMillion: 15, outputPerMillion: 75, cachedInputPerMillion: 1.5 },
  "claude-sonnet-4-6": { inputPerMillion:  3, outputPerMillion: 15, cachedInputPerMillion: 0.3 },
  "claude-sonnet-4-5": { inputPerMillion:  3, outputPerMillion: 15, cachedInputPerMillion: 0.3 },
  "claude-haiku-4-5":  { inputPerMillion:  1, outputPerMillion:  5, cachedInputPerMillion: 0.1 },
};

export interface LlmCallContext {
  tenantId: string;
  franchiseId?: string | null;
  userId?: string | null;
  supabaseAdmin: SupabaseClient;
  requestId?: string;
  logger?: Logger;
}

export interface LlmCallResult {
  text: string;
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  latencyMs: number;
  promptVersion: string;
  raw: unknown;
}

export class LlmGatewayError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

interface ResolvedConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  maxOutputTokens: number;
  source: "tenant_config" | "env_fallback";
  configId?: string;
}

// ─── Resolve tenant config (or env fallback) ───────────────────────────

async function resolveConfig(
  taskId: LlmTaskId,
  ctx: LlmCallContext,
): Promise<ResolvedConfig> {
  // Try tenant config first.
  if (ctx.tenantId && ctx.tenantId !== "00000000-0000-0000-0000-000000000000") {
    try {
      const { data, error } = await (ctx.supabaseAdmin as any)
        .schema("platform")
        .rpc("get_tenant_llm_config", { p_tenant_id: ctx.tenantId });
      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0] as {
          config_id: string;
          provider: LlmProvider;
          base_url: string | null;
          default_model: string;
          api_key: string;
        };
        if (row.api_key) {
          return {
            provider: row.provider,
            model: row.default_model,
            apiKey: row.api_key,
            baseUrl: row.base_url,
            maxOutputTokens: MAX_OUTPUT_TOKENS[taskId],
            source: "tenant_config",
            configId: row.config_id,
          };
        }
        if (ctx.logger) ctx.logger.warn("tenant config found but api_key missing in vault", { config_id: row.config_id });
      } else if (error && ctx.logger) {
        ctx.logger.warn("get_tenant_llm_config rpc failed", { error: error.message });
      }
    } catch (e: any) {
      if (ctx.logger) ctx.logger.warn("get_tenant_llm_config threw", { error: e?.message ?? String(e) });
    }
  }

  // Fall back to env-based legacy routing (Anthropic only for now).
  const routing = FALLBACK_ROUTING[taskId];
  const envKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!envKey) {
    throw new LlmGatewayError(
      "no_llm_config",
      "No tenant LLM config and no env ANTHROPIC_API_KEY. Configure a provider via the Settings UI or set the env secret.",
      503,
    );
  }
  return {
    provider: routing.provider,
    model: routing.model,
    apiKey: envKey,
    baseUrl: null,
    maxOutputTokens: routing.maxOutputTokens,
    source: "env_fallback",
  };
}

// ─── Public API ────────────────────────────────────────────────────────

export async function callLLM(
  taskId: LlmTaskId,
  vars: Record<string, string>,
  ctx: LlmCallContext,
): Promise<LlmCallResult> {
  const prompt = PROMPTS[taskId];
  if (!prompt) throw new LlmGatewayError("unknown_task", `Unknown LLM task '${taskId}'`, 400);

  const config = await resolveConfig(taskId, ctx);
  const userMsg = interpolate(prompt.user, vars);
  const t0 = Date.now();

  let result: LlmCallResult;
  try {
    switch (config.provider) {
      case "anthropic":
        result = await callAnthropic(config, prompt.system, userMsg);
        break;
      case "openrouter":
        result = await callOpenRouter(config, prompt.system, userMsg);
        break;
      case "openai":
        result = await callOpenAiCompatible(config, prompt.system, userMsg, "openai");
        break;
      case "gemini":
        result = await callGemini(config, prompt.system, userMsg);
        break;
      case "local-qwen":
      case "custom":
        throw new LlmGatewayError(
          "provider_not_implemented",
          `Provider '${config.provider}' is configured but not yet wired into the Gateway.`,
          501,
        );
    }
  } catch (e: any) {
    const latency = Date.now() - t0;
    await recordUsage(ctx, {
      taskId, promptVersion: prompt.version,
      provider: config.provider, model: config.model,
      inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0,
      latencyMs: latency, status: "error",
      errorCode: e?.code ?? "provider_error",
      errorMessage: e?.message ?? String(e),
      configSource: config.source,
    });
    if (e instanceof LlmGatewayError) throw e;
    throw new LlmGatewayError("provider_error", e?.message ?? "Provider call failed", 502);
  }

  result.latencyMs = Date.now() - t0;
  result.promptVersion = prompt.version;

  await recordUsage(ctx, {
    taskId, promptVersion: prompt.version,
    provider: result.provider, model: result.model,
    inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    cachedInputTokens: result.cachedInputTokens, costUsd: result.costUsd,
    latencyMs: result.latencyMs, status: "ok",
    configSource: config.source,
    configId: config.configId,
  });

  // Update last_used_at if it was a tenant config.
  if (config.source === "tenant_config" && config.configId) {
    await (ctx.supabaseAdmin as any)
      .schema("platform")
      .from("llm_provider_configs")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", config.configId);
  }

  return result;
}

// ─── Anthropic native ──────────────────────────────────────────────────

async function callAnthropic(
  cfg: ResolvedConfig,
  system: string,
  user: string,
): Promise<LlmCallResult> {
  const url = (cfg.baseUrl ?? "https://api.anthropic.com") + "/v1/messages";
  const body = {
    model: cfg.model,
    max_tokens: cfg.maxOutputTokens,
    system,
    messages: [{ role: "user", content: user }],
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new LlmGatewayError(
      `anthropic_${resp.status}`,
      `Anthropic ${resp.status}: ${txt.slice(0, 300)}`,
      resp.status >= 500 ? 502 : 400,
    );
  }
  const json: any = await resp.json();
  const text: string = Array.isArray(json?.content)
    ? json.content.filter((b: any) => b?.type === "text" && typeof b.text === "string")
        .map((b: any) => b.text).join("")
    : "";
  const inputTokens   = Number(json?.usage?.input_tokens ?? 0);
  const outputTokens  = Number(json?.usage?.output_tokens ?? 0);
  const cachedInputTokens = Number(
    json?.usage?.cache_read_input_tokens ?? json?.usage?.cache_creation_input_tokens ?? 0,
  );
  const p = ANTHROPIC_PRICING[cfg.model];
  const costUsd = p
    ? ((inputTokens - cachedInputTokens) * p.inputPerMillion +
       cachedInputTokens * (p.cachedInputPerMillion ?? p.inputPerMillion) +
       outputTokens * p.outputPerMillion) / 1_000_000
    : 0;

  return {
    text, provider: "anthropic", model: cfg.model,
    inputTokens, outputTokens, cachedInputTokens,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
    latencyMs: 0, promptVersion: "", raw: json,
  };
}

// ─── OpenRouter (OpenAI-compatible) ────────────────────────────────────
//
// OpenRouter exposes a Chat Completions endpoint that accepts a "model"
// string in the form "provider/model" (e.g. "anthropic/claude-3.5-sonnet").
// Their docs: https://openrouter.ai/docs
//
// Usage reporting includes `prompt_tokens` and `completion_tokens` (OpenAI
// style). OpenRouter also returns the actual upstream cost in some plans.

async function callOpenRouter(
  cfg: ResolvedConfig,
  system: string,
  user: string,
): Promise<LlmCallResult> {
  return callOpenAiCompatible(cfg, system, user, "openrouter");
}

async function callOpenAiCompatible(
  cfg: ResolvedConfig,
  system: string,
  user: string,
  provider: "openrouter" | "openai",
): Promise<LlmCallResult> {
  const defaultBase =
    provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
  const url = (cfg.baseUrl ?? defaultBase) + "/chat/completions";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") {
    // OpenRouter recommends these for analytics + abuse handling.
    headers["HTTP-Referer"] = "https://sos-nexus.example";
    headers["X-Title"] = "SOS-Nexus Markets";
  }

  const body = {
    model: cfg.model,
    max_tokens: cfg.maxOutputTokens,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new LlmGatewayError(
      `${provider}_${resp.status}`,
      `${provider} ${resp.status}: ${txt.slice(0, 300)}`,
      resp.status >= 500 ? 502 : 400,
    );
  }

  const json: any = await resp.json();
  const text: string =
    json?.choices?.[0]?.message?.content ?? "";
  const inputTokens  = Number(json?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(json?.usage?.completion_tokens ?? 0);

  // Best-effort cost: OpenRouter sometimes returns "x_cost" or similar; we
  // pass it through `metadata` rather than guessing pricing per arbitrary
  // upstream model (which we don't know in advance).
  // For now: cost_usd = 0 for openrouter/openai — display "—" in the UI and
  // reconcile against the provider's own dashboard.
  // TODO when a known-cost table is provided: per-model lookup.
  const costUsd = 0;

  return {
    text,
    provider,
    model: cfg.model,
    inputTokens,
    outputTokens,
    cachedInputTokens: 0,
    costUsd,
    latencyMs: 0,
    promptVersion: "",
    raw: json,
  };
}

// ─── Google Gemini (direct, not via OpenRouter) ────────────────────────
//
// Hits generativelanguage.googleapis.com directly so a tenant who configured
// their own Gemini API key in Settings → LLM Providers gets used. Without
// this path, gemini-provider configs resolve to 501 even though they're
// valid choices in the Settings UI.
//
// Docs: https://ai.google.dev/api/generate-content

async function callGemini(
  cfg: ResolvedConfig,
  system: string,
  user: string,
): Promise<LlmCallResult> {
  const base = cfg.baseUrl ?? "https://generativelanguage.googleapis.com";
  // model names in the DB may or may not be prefixed with `models/`
  const modelPath = cfg.model.startsWith("models/") ? cfg.model : `models/${cfg.model}`;
  const url = `${base}/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  // Gemini API takes `systemInstruction` separately and `contents[]` for the
  // turn-by-turn conversation. We send a single user turn.
  const body: any = {
    contents: [
      { role: "user", parts: [{ text: user }] },
    ],
    generationConfig: {
      maxOutputTokens: cfg.maxOutputTokens,
    },
  };
  if (system && system.trim().length > 0) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new LlmGatewayError(
      `gemini_${resp.status}`,
      `Gemini ${resp.status}: ${txt.slice(0, 300)}`,
      resp.status >= 500 ? 502 : 400,
    );
  }

  const json: any = await resp.json();
  // Response shape: candidates[0].content.parts[].text
  const text: string = Array.isArray(json?.candidates)
    ? (json.candidates[0]?.content?.parts ?? [])
        .filter((p: any) => typeof p?.text === "string")
        .map((p: any) => p.text)
        .join("")
    : "";

  const usage = json?.usageMetadata ?? {};
  const inputTokens  = Number(usage.promptTokenCount     ?? 0);
  const outputTokens = Number(usage.candidatesTokenCount ?? 0);
  const cachedInputTokens = Number(usage.cachedContentTokenCount ?? 0);

  const p = GEMINI_PRICING[cfg.model] ?? GEMINI_PRICING[cfg.model.replace(/^models\//, "")];
  const costUsd = p
    ? ((inputTokens - cachedInputTokens) * p.inputPerMillion +
       cachedInputTokens * (p.cachedInputPerMillion ?? p.inputPerMillion) +
       outputTokens * p.outputPerMillion) / 1_000_000
    : 0;

  return {
    text,
    provider: "gemini",
    model: cfg.model,
    inputTokens, outputTokens, cachedInputTokens,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
    latencyMs: 0, promptVersion: "", raw: json,
  };
}

// ─── Usage logging ─────────────────────────────────────────────────────

interface UsageRow {
  taskId: string;
  promptVersion: string;
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "ok" | "error" | "rate_limited" | "timeout" | "budget_exceeded";
  errorCode?: string;
  errorMessage?: string;
  configSource?: "tenant_config" | "env_fallback";
  configId?: string;
}

async function recordUsage(ctx: LlmCallContext, row: UsageRow): Promise<void> {
  const payload: any = {
    request_id: ctx.requestId ?? null,
    task_id: row.taskId,
    prompt_version: row.promptVersion,
    tenant_id: ctx.tenantId,
    franchise_id: ctx.franchiseId ?? null,
    user_id: ctx.userId ?? null,
    provider: row.provider,
    model: row.model,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    cached_input_tokens: row.cachedInputTokens,
    cost_usd: row.costUsd,
    latency_ms: row.latencyMs,
    status: row.status,
    error_code: row.errorCode ?? null,
    error_message: row.errorMessage ?? null,
    metadata: {
      config_source: row.configSource ?? "env_fallback",
      ...(row.configId ? { config_id: row.configId } : {}),
    },
  };

  const { error } = await (ctx.supabaseAdmin as any)
    .schema("platform")
    .from("llm_usage")
    .insert(payload);

  if (error && ctx.logger) {
    ctx.logger.warn("llm_usage write failed", { error: error.message });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    if (!(key in vars)) {
      throw new LlmGatewayError(
        "missing_prompt_var",
        `Prompt template variable '${key}' was not provided`,
        400,
      );
    }
    return vars[key];
  });
}

// ─── Multi-turn conversation API ───────────────────────────────────────────
// Used by the research thread edge function to pass full conversation history.

export interface ConversationMessage {
  role:    "user" | "assistant";
  content: string;
}

/**
 * Like callLLM but accepts a full conversation history.
 * The history is passed directly to the provider; the task's system prompt
 * is still resolved from the gateway (tenant config or env fallback).
 *
 * @param taskId     Gateway task ID — used to resolve provider config + system prompt.
 * @param messages   Full conversation: [...history, { role:"user", content: latestMsg }]
 * @param ctx        Same LlmCallContext as callLLM.
 */
export async function callLLMConversation(
  taskId:   LlmTaskId,
  messages: ConversationMessage[],
  ctx:      LlmCallContext,
  systemSuffix?: string,
): Promise<LlmCallResult> {
  const prompt = PROMPTS[taskId];
  if (!prompt) throw new LlmGatewayError("unknown_task", `Unknown LLM task '${taskId}'`, 400);

  const config = await resolveConfig(taskId, ctx);
  const system = systemSuffix ? `${prompt.system}\n\n${systemSuffix}` : prompt.system;
  const t0 = Date.now();

  // Build provider-specific message array (assistant messages may not start with "user")
  // Anthropic requires alternating user/assistant starting with user.
  // Ensure messages array is valid.
  const validMessages: ConversationMessage[] = messages.length > 0 ? messages : [{ role: "user", content: "" }];

  let result: LlmCallResult;
  try {
    switch (config.provider) {
      case "anthropic": {
        const url = (config.baseUrl ?? "https://api.anthropic.com") + "/v1/messages";
        const body = {
          model:      config.model,
          max_tokens: config.maxOutputTokens,
          system,
          messages:   validMessages,
        };
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new LlmGatewayError(`anthropic_${resp.status}`, `Anthropic ${resp.status}: ${txt.slice(0, 300)}`, resp.status >= 500 ? 502 : 400);
        }
        const json: any = await resp.json();
        const text = Array.isArray(json?.content)
          ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
          : "";
        const inputTokens  = Number(json?.usage?.input_tokens  ?? 0);
        const outputTokens = Number(json?.usage?.output_tokens ?? 0);
        const cachedInputTokens = Number(json?.usage?.cache_read_input_tokens ?? 0);
        const p = ANTHROPIC_PRICING[config.model];
        const costUsd = p
          ? ((inputTokens - cachedInputTokens) * p.inputPerMillion + cachedInputTokens * (p.cachedInputPerMillion ?? p.inputPerMillion) + outputTokens * p.outputPerMillion) / 1_000_000
          : 0;
        result = { text, provider: "anthropic", model: config.model, inputTokens, outputTokens, cachedInputTokens, costUsd, latencyMs: 0, promptVersion: "", raw: json };
        break;
      }
      case "openrouter":
      case "openai": {
        const baseUrl = config.baseUrl ?? (config.provider === "openrouter" ? "https://openrouter.ai/api" : "https://api.openai.com");
        const url = baseUrl + "/v1/chat/completions";
        const oaiMessages = [{ role: "system", content: system }, ...validMessages];
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: config.model, max_tokens: config.maxOutputTokens, messages: oaiMessages }),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new LlmGatewayError(`provider_${resp.status}`, `Provider ${resp.status}: ${txt.slice(0, 300)}`, resp.status >= 500 ? 502 : 400);
        }
        const json: any = await resp.json();
        const text = json?.choices?.[0]?.message?.content ?? "";
        result = { text, provider: config.provider, model: config.model, inputTokens: Number(json?.usage?.prompt_tokens ?? 0), outputTokens: Number(json?.usage?.completion_tokens ?? 0), cachedInputTokens: 0, costUsd: 0, latencyMs: 0, promptVersion: "", raw: json };
        break;
      }
      case "gemini": {
        // Conversation-mode Gemini. Same generateContent endpoint as the
        // single-turn path; the multi-turn shape is just `contents[]` of
        // {role, parts[{text}]} per https://ai.google.dev/api/generate-content.
        const base = config.baseUrl ?? "https://generativelanguage.googleapis.com";
        const modelPath = config.model.startsWith("models/") ? config.model : `models/${config.model}`;
        const url = `${base}/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
        const contents = validMessages.map((m) => ({
          // Gemini uses "user" / "model" (not "assistant")
          role: m.role === "assistant" ? "model" : m.role,
          parts: [{ text: m.content }],
        }));
        const body: any = {
          contents,
          generationConfig: { maxOutputTokens: config.maxOutputTokens },
        };
        if (system && system.trim().length > 0) {
          body.systemInstruction = { parts: [{ text: system }] };
        }
        const resp = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new LlmGatewayError(`gemini_${resp.status}`, `Gemini ${resp.status}: ${txt.slice(0, 300)}`, resp.status >= 500 ? 502 : 400);
        }
        const json: any = await resp.json();
        const text = Array.isArray(json?.candidates)
          ? (json.candidates[0]?.content?.parts ?? [])
              .filter((p: any) => typeof p?.text === "string")
              .map((p: any) => p.text)
              .join("")
          : "";
        const usage = json?.usageMetadata ?? {};
        const inputTokens  = Number(usage.promptTokenCount     ?? 0);
        const outputTokens = Number(usage.candidatesTokenCount ?? 0);
        const cachedInputTokens = Number(usage.cachedContentTokenCount ?? 0);
        const p = GEMINI_PRICING[config.model] ?? GEMINI_PRICING[config.model.replace(/^models\//, "")];
        const costUsd = p
          ? ((inputTokens - cachedInputTokens) * p.inputPerMillion +
             cachedInputTokens * (p.cachedInputPerMillion ?? p.inputPerMillion) +
             outputTokens * p.outputPerMillion) / 1_000_000
          : 0;
        result = { text, provider: "gemini", model: config.model, inputTokens, outputTokens, cachedInputTokens, costUsd: Math.round(costUsd * 1e6) / 1e6, latencyMs: 0, promptVersion: "", raw: json };
        break;
      }
      default:
        throw new LlmGatewayError("provider_not_implemented", `Provider '${config.provider}' not wired for conversation mode.`, 501);
    }
  } catch (e: any) {
    const latency = Date.now() - t0;
    await recordUsage(ctx, { taskId, promptVersion: prompt.version, provider: config.provider, model: config.model, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0, latencyMs: latency, status: "error", errorCode: e?.code ?? "provider_error", errorMessage: e?.message, configSource: config.source });
    if (e instanceof LlmGatewayError) throw e;
    throw new LlmGatewayError("provider_error", e?.message ?? "Provider call failed", 502);
  }

  result.latencyMs    = Date.now() - t0;
  result.promptVersion = prompt.version;

  await recordUsage(ctx, { taskId, promptVersion: prompt.version, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, cachedInputTokens: result.cachedInputTokens, costUsd: result.costUsd, latencyMs: result.latencyMs, status: "ok", configSource: config.source, configId: config.configId });

  if (config.source === "tenant_config" && config.configId) {
    await (ctx.supabaseAdmin as any).schema("platform").from("llm_provider_configs").update({ last_used_at: new Date().toISOString() }).eq("id", config.configId);
  }

  return result;
}

// =====================================================================
// LLM Gateway — single chokepoint for all LLM calls from Edge Functions.
// Per ADR-024 + the per-tenant configurability decision (2026-05-15).
//
// Provider resolution order:
//   1. Look up platform.get_tenant_llm_config(tenant_id) for the tenant's
//      active default. If present → use that provider + model + decrypted key.
//   2. Else fall back to env ANTHROPIC_API_KEY using the static ROUTING map.
//   3. Else fall back further to a self-hosted vLLM rig (OpenAI-compatible),
//      if VLLM_BASE_URL/VLLM_API_KEY/VLLM_MODEL_NAME are set — lets a
//      self-hosted deployment run without any cloud LLM subscription.
//
// Supported providers:
//   • anthropic    — native Messages API
//   • openrouter   — OpenAI-compatible chat completions, routes to many models
//                    (key https://openrouter.ai/keys)
//   • openai       — chat completions (drop-in; same shape as openrouter)
//   • gemini       — TODO (not wired)
//   • local-qwen   — OpenAI-compatible chat completions against a self-hosted
//                    vLLM (or similar) endpoint. Per §9.6 (D-11): tenant
//                    configs may also set this provider directly with their
//                    own base_url/api_key.
//   • custom       — same OpenAI-compatible chat completions as local-qwen,
//                    for a tenant-supplied endpoint that isn't specifically
//                    Qwen (Settings UI exposes both under a base_url field).
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
  | "markets.portfolio_diagnostic"
  | "logistics.smart_quotes"
  | "ops.agent_plan"
  | "comms.smart_reply"
  | "security.email_threat"
  | "logistics.invoice_extract"
  | "comms.message_assistant"
  | "logistics.demand_narrative"
  | "logistics.transport_mode_suggest"
  | "logistics.cargo_damage_analysis"
  | "logistics.document_categorize"
  | "logistics.bol_extract"
  | "comms.nexus_copilot_chat"
  | "comms.portal_chatbot_reply";

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
  "markets.research_thread":     { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 2800 },
  "markets.strategy_explain":    { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 2048 },
  "markets.portfolio_diagnostic":{ provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  800 },
  "logistics.smart_quotes":     { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 2800 },
  "ops.agent_plan":              { provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  400 },
  "comms.smart_reply":           { provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  512 },
  "security.email_threat":       { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens:  500 },
  "logistics.invoice_extract":   { provider: "anthropic", model: "claude-sonnet-4-5", maxOutputTokens: 1500 },
  "comms.message_assistant":     { provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  512 },
  "logistics.demand_narrative":  { provider: "anthropic", model: "claude-haiku-4-5",  maxOutputTokens:  300 },
  "logistics.transport_mode_suggest": { provider: "anthropic", model: "claude-haiku-4-5", maxOutputTokens: 400 },
  // These four need a vision-capable model; Anthropic supports vision too
  // (not wired here yet — see callAnthropic), so this fallback routing
  // entry is only reached with no tenant config AND no PAID_FALLBACK_ON_FAILURE
  // credential, an unlikely combination. Kept for type-completeness.
  "logistics.cargo_damage_analysis": { provider: "gemini", model: "gemini-2.5-flash", maxOutputTokens: 600 },
  "logistics.document_categorize":   { provider: "gemini", model: "gemini-2.5-flash", maxOutputTokens: 200 },
  "logistics.bol_extract":           { provider: "gemini", model: "gemini-2.5-flash", maxOutputTokens: 600 },
  "comms.nexus_copilot_chat":        { provider: "anthropic", model: "claude-haiku-4-5", maxOutputTokens: 600 },
  "comms.portal_chatbot_reply":      { provider: "anthropic", model: "claude-haiku-4-5", maxOutputTokens: 500 },
};

// Max output token defaults per task. The model name comes from the tenant
// config; we keep the budget consistent per task regardless of model.
const MAX_OUTPUT_TOKENS: Record<LlmTaskId, number> = {
  "markets.daily_brief":         2048,
  "markets.news_sentiment":       256,
  "markets.earnings_summary":    1024,
  //
  // markets.research_thread was 4096 until 2026-09-10, found auditing every
  // task against the same self-hosted-throughput ceiling that caused the
  // logistics.smart_quotes bug just above: at the rig's measured ~27
  // tokens/sec, 4096 tokens is a ~152s worst case -- over BOTH
  // LLM_REQUEST_TIMEOUT_MS (115s) and Cloudflare's hard 125.1s ceiling on
  // portal.sosservices.online, so any tenant routing the "markets" domain
  // to self-hosted would have every long research-thread reply time out.
  // Unlike smart_quotes this is free-form chat text, not a fixed JSON
  // schema, so there's no field-shape constraint to work around -- 2800
  // (same safe margin used for smart_quotes: worst case 2800/27 ≈ 104s)
  // is still a substantial multi-paragraph reply and simply caps length.
  // This task also had no PAID_FALLBACK_ON_FAILURE entry at all (see below)
  // -- worse than smart_quotes' pre-fix state, since a self-hosted timeout
  // here failed outright instead of silently degrading to a paid provider.
  "markets.research_thread":     2800,
  "markets.strategy_explain":    2048,
  "markets.portfolio_diagnostic": 800,
  //
  // logistics.smart_quotes was 16000 until 2026-09-10. Measured live on the
  // self-hosted rig (qwen3.8-27b-awq via portal.sosservices.online): ~27-28
  // completion tokens/sec, and Cloudflare's hard proxy ceiling on that
  // origin is 125.1s regardless of client-side settings -- so 16000 tokens
  // (the original 5-option, deeply-itemized schema needed ~7500-8000 to
  // complete, confirmed via Gemini's own usage for the same content) was
  // never reachable on self-hosted at all; every real attempt timed out and
  // paid the Gemini-fallback cost instead. The prompt below was shrunk to 3
  // options with rolled-up per-leg charges instead of itemized line items
  // (same field shapes throughout, so no frontend/mapper changes needed --
  // see quote-mapper.ts and the components under
  // src/components/quotation/shared/, which only ever read
  // reliability.score / environmental.co2_emissions / generic
  // Object.entries() over surcharges+fees, never the fields that got
  // trimmed). Two live test runs of the shrunk schema completed naturally
  // (finish_reason: stop, not truncated) in 1398 and 2318 completion
  // tokens -- 2800 leaves real headroom above both while keeping
  // worst-case generation time (2800/27 ≈ 104s) safely under
  // LLM_REQUEST_TIMEOUT_MS (115s), itself under Cloudflare's 125.1s ceiling.
  "logistics.smart_quotes":     2800,
  "ops.agent_plan":               400,
  "comms.smart_reply":            512,
  "security.email_threat":        500,
  "logistics.invoice_extract":   1500,
  "comms.message_assistant":      512,
  "logistics.demand_narrative":   300,
  "logistics.transport_mode_suggest": 400,
  "logistics.cargo_damage_analysis": 600,
  "logistics.document_categorize":   200,
  "logistics.bol_extract":           600,
  "comms.nexus_copilot_chat":        600,
  "comms.portal_chatbot_reply":      500,
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
  "logistics.smart_quotes": {
    // v2 (2026-09-10): shrunk from 5 options with itemized per-leg charges
    // to 3 options with a single rolled-up charge per leg. The v1 schema
    // needed ~7500-8000 completion tokens to finish (confirmed via Gemini's
    // own usage generating the same content) -- unreachable on the
    // self-hosted rig, whose measured throughput (~27-28 tokens/sec) times
    // Cloudflare's 125.1s hard ceiling on that origin caps any single
    // response at roughly 3400 tokens, full stop, regardless of gateway
    // timeout settings. Every field kept here uses the exact same name and
    // shape as v1 (legs[].charges is still an array, just with one entry
    // instead of two or three; regulatory_info's two fields are still
    // arrays, just usually short/empty) specifically so no caller-side
    // code needed to change -- see MAX_OUTPUT_TOKENS' comment above for the
    // full verification detail (two live runs against the real rig,
    // finish_reason: stop both times, not truncated).
    version: "v2-2026-09-10",
    system:
      `You are an Expert Logistics Rate Analyst.
Generate exactly 3 freight quotation options: "best_value", "cheapest", "fastest".

Requirements:
1. LANGUAGE: English only.
2. Break each route into legs (Pickup -> Port -> Main Leg -> Port -> Delivery).
3. Each leg needs exactly ONE rolled-up charge line (not itemized). Zero-cost legs are not allowed.
4. Mode-specific pricing: Road ~$1.50-4.00/km + handling. Air: chargeable weight x $2.50-12.00/kg. Ocean: per-container or w/m for LCL, BAF/CAF included in the rolled-up leg charge. Rail: distance-based.
5. The option's 'total' MUST equal the sum of all leg charges.
6. Give a reliability score (1-10) and estimated total CO2 (kg) per option.
7. Keep 'ai_explanation' to ONE short sentence per option. Keep customs_procedures/restrictions arrays to at most 1-2 short items each, empty array if none.

Output JSON Format (exactly this shape, no extra nesting):
{
  "options": [
    {
      "id": "generated_uuid",
      "tier": "best_value",
      "transport_mode": "Ocean - FCL",
      "carrier": { "name": "Carrier Name", "service_level": "Direct" },
      "transit_time": { "total_days": 21, "details": "21 days port-to-port" },
      "legs": [
        {
          "sequence": 1,
          "from": "Location A",
          "to": "Location B",
          "mode": "road",
          "carrier": "Local Trucking",
          "transit_time": "1 day",
          "charges": [ { "name": "Road Leg Total", "amount": 495, "currency": "USD", "unit": "per_trip" } ]
        },
        {
          "sequence": 2,
          "from": "Location B",
          "to": "Location C",
          "mode": "ocean",
          "carrier": "Maersk",
          "transit_time": "18 days",
          "charges": [ { "name": "Ocean Leg Total", "amount": 2150, "currency": "USD", "unit": "per_container" } ]
        }
      ],
      "price_breakdown": {
        "base_fare": 2000,
        "surcharges": { "baf_caf": 200 },
        "fees": { "handling_docs": 445 },
        "taxes": 0,
        "currency": "USD",
        "total": 2645
      },
      "regulatory_info": {
        "customs_procedures": ["Export Declaration"],
        "restrictions": []
      },
      "reliability": { "score": 8.5 },
      "environmental": { "co2_emissions": "1200 kg" },
      "ai_explanation": "One short sentence."
    }
  ],
  "market_analysis": "One or two short sentences.",
  "confidence_score": 0.9,
  "anomalies": []
}

CRITICAL OUTPUT CONSTRAINT: Respond with ONLY the raw JSON object shown above — no markdown code fences (no \`\`\`), no commentary, no explanation before or after, no surrounding prose. The entire response body MUST be valid JSON parseable directly by JSON.parse(). Do not wrap it in any other key.`,
    user:
      "Route: ${origin} to ${destination} (${mode})\n" +
      "Cargo: ${commodity}, ${weight}kg, ${volume}cbm\n" +
      "Equipment: ${container_qty}x ${container_size} ${container_type}\n" +
      "Context: ${historical_context}\n\n" +
      "Generate the quotation options now.",
  },
  "ops.agent_plan": {
    version: "v1-2026-09-05",
    system:
      "You are an operations agent. Plan tool calls to achieve the goal. Use only allowed tools.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON array of steps — " +
      `[{ "name": "<tool name from the allowed list>", "args": { ... } }, ...]. ` +
      "No markdown code fences, no commentary, no explanation before or after. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse(). " +
      "If no tool call is needed to achieve the goal, return an empty array [].",
    user:
      "Goal: ${goal}\n" +
      "Allowed tools (JSON array): ${tools_json}\n\n" +
      "Return the plan now.",
  },
  "comms.smart_reply": {
    version: "v1-2026-09-05",
    system:
      "You are a logistics CRM assistant. Propose a short, professional reply that addresses the " +
      "thread context and suggests next steps. Avoid PII; keep the body under 150 words.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON object — " +
      `{ "subject": string, "body": string, "tone": "neutral" | "friendly" | "formal" }. ` +
      "No markdown code fences, no commentary, no explanation before or after. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user:
      "Thread:\n<user_context>${thread}</user_context>\n" +
      "Hint: ${hint}\n\n" +
      "Generate the reply JSON now.",
  },
  "security.email_threat": {
    version: "v1-2026-09-05",
    system:
      "You are an expert Cyber Security AI specializing in Email Security.\n" +
      "Analyze the provided email for:\n" +
      "1. Phishing attempts\n" +
      "2. Business Email Compromise (BEC) - e.g., urgent wire transfers, CEO fraud\n" +
      "3. Malicious intent or social engineering\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON object of this shape — " +
      `{ "threat_level": "safe" | "suspicious" | "malicious", "threat_score": float (0.0 to 1.0), ` +
      `"threat_type": "Phishing" | "BEC" | "Malware" | "Spam" | "None", "reasoning": "Brief explanation" }. ` +
      "No markdown code fences, no commentary, no explanation before or after. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user:
      "Subject: ${subject}\n" +
      "Sender: ${sender}\n" +
      "Body:\n${body} -- truncated",
  },
  "logistics.invoice_extract": {
    // v2: the image is now attached as real multimodal content (see the
    // `image` param on callLLM) instead of being interpolated as a
    // ${file_url} string -- the original v1 user template asked the model
    // to "extract from the invoice at this URL" without ever actually
    // sending the image, which no provider can act on.
    version: "v2-2026-09-10",
    system:
      "You are an expert logistics invoice analyzer. Extract line items from the provided invoice image.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON object with a key \"items\" containing " +
      "an array of objects. Each object must have:\n" +
      "- description (string)\n" +
      "- quantity (number)\n" +
      "- unit_price (number)\n" +
      "- total_price (number)\n" +
      "- hs_code (string, if visible)\n" +
      "- weight_kg (number, if visible)\n" +
      "- origin_country (string, if visible)\n\n" +
      "No markdown code fences (no ```), no commentary, no explanation before or after. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user: "Extract the line items from this invoice.",
  },
  "logistics.cargo_damage_analysis": {
    version: "v1-2026-09-10",
    system:
      "You are an expert cargo inspector and logistics compliance officer. " +
      "Analyze the provided image of cargo/packaging for any signs of damage or non-compliance.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON object of this shape — " +
      "{\"damage_detected\": boolean, \"damage_type\": \"none\"|\"crushed\"|\"wet\"|\"punctured\"|\"torn\"|\"broken_seal\"|\"other\", " +
      "\"severity\": \"none\"|\"low\"|\"medium\"|\"high\"|\"critical\", \"description\": string, " +
      "\"recommendation\": \"Accept\"|\"Reject\"|\"Inspect Content\"|\"Repack\", \"confidence\": number (0-1)}. " +
      "If the image is not of cargo or packaging, set damage_type to \"other\" and description to " +
      "\"Image does not appear to be cargo\". " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user: "Inspect this cargo for damage.",
  },
  "logistics.document_categorize": {
    version: "v1-2026-09-10",
    system:
      "Classify the logistics document type from the provided image. Choose one of: " +
      "bill_of_lading, invoice, packing_list, delivery_order, certificate, other.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON object — " +
      "{\"category\": \"...\", \"confidence\": 0-1}. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user: "What document type is this?",
  },
  "logistics.bol_extract": {
    version: "v1-2026-09-10",
    system:
      "Extract structured Bill of Lading fields from the provided image. " +
      "Reply JSON with keys: shipper, consignee, notify_party, booking_no, bl_no, vessel, voyage, " +
      "port_of_loading, port_of_discharge, marks_numbers, description_goods, gross_weight, measurement. " +
      "Use null for any field not visible in the image.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY the raw JSON object described above. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user: "Extract all BOL fields as JSON.",
  },
  "comms.nexus_copilot_chat": {
    version: "v1-2026-09-10",
    system:
      "You are Nexus Copilot for a logistics CRM. Answer strictly based on provided context. " +
      "If context is insufficient, say you don't know and suggest collecting more data. " +
      "Respond in plain text only — no JSON, no markdown code fences.",
    user: "Context:\n${context}\n\nQuestion:\n${question}",
  },
  "comms.portal_chatbot_reply": {
    version: "v1-2026-09-10",
    system:
      "You are a customer-facing assistant in a logistics quote portal. Answer strictly based on " +
      "provided context. If unsure, say you don't know. Do not reveal internal details.\n\n" +
      "CRITICAL OUTPUT CONSTRAINT: Respond with ONLY a raw JSON object — " +
      "{\"answer\": \"...\", \"actions\": [{\"type\": \"accept_quote\"|\"predict_eta\", \"params\": {}}]}. " +
      "The entire response body MUST be valid JSON parseable directly by JSON.parse().",
    user:
      "Question:\n<user_context>${question}</user_context>\n" +
      "Quote:\n${quote_context}\n" +
      "Docs:\n${docs}",
  },
  "comms.message_assistant": {
    version: "v1-2026-09-05",
    system:
      "You are a customer communications assistant for a logistics CRM. " +
      "Follow the instruction in the user message exactly and respond in plain text only — " +
      "no JSON, no markdown code fences, no preamble, no explanation — just the requested content.",
    user: "${instruction}\n\n${text}",
  },
  "logistics.demand_narrative": {
    version: "v1-2026-09-05",
    system: "Write a short weekly forecast summary with risks and actions.",
    user: "${context_json}",
  },
  "logistics.transport_mode_suggest": {
    version: "v1-2026-09-05",
    system:
      "You are a logistics assistant. Analyze the shipment details described by the caller and " +
      "recommend an optimal transport mode with a brief rationale. Always respond in English only, " +
      "regardless of the language of the input.",
    user: "${prompt}\n\n${format_instruction}",
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

// Every provider call below goes through this instead of a bare fetch().
// Without it, a slow provider (e.g. a self-hosted rig under load) just hangs
// until the upstream proxy (Cloudflare, ~125s here, confirmed live: a
// request with no client-side timeout at all was still killed at exactly
// 125.1s with an opaque HTML 524 page) rather than surfacing a clean error.
//
// 115s, not the original 55s: raised specifically so logistics.smart_quotes
// (see MAX_OUTPUT_TOKENS' comment there) has real room to finish on the
// self-hosted rig instead of always being cut off before it can. Measured
// throughput on that rig is ~27-28 completion tokens/sec; two live test
// runs of the shrunk schema completed naturally in 53.2s/1398 tokens and
// 83.8s/2318 tokens, and even a full worst-case run at that task's 2800-
// token ceiling (~104s at this rate) still leaves ~11s of margin under
// this timeout, and ~10s under Cloudflare's 125.1s hard ceiling. Other
// tasks' much smaller token budgets mean they'd never approach either
// number regardless of which constant is used here, so this is safe to
// share globally rather than needing a per-task override.
const LLM_REQUEST_TIMEOUT_MS = 115_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = LLM_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new LlmGatewayError("timeout", `LLM provider did not respond within ${Math.round(timeoutMs / 1000)}s`, 504);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Vision / multimodal image input ───────────────────────────────────
//
// Callers pass either a URL or raw base64 (matching each function's own
// input contract). Resolved once, up front, to {base64, mime} regardless
// of source -- this lets every provider dispatch function work from the
// same shape, and means the image is fetched at most once even if the
// primary attempt fails and a fallback provider is retried.

export interface LlmImageInput {
  url?: string;
  base64?: string;
  mime?: string;
}

interface ResolvedImage {
  base64: string;
  mime: string;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function resolveImageInput(img: LlmImageInput): Promise<ResolvedImage> {
  if (img.base64) {
    return { base64: img.base64, mime: img.mime || "image/jpeg" };
  }
  if (img.url) {
    const resp = await fetchWithTimeout(img.url, { method: "GET" }, 20_000);
    if (!resp.ok) {
      throw new LlmGatewayError("image_fetch_failed", `Failed to fetch image (${resp.status})`, 400);
    }
    const mime = resp.headers.get("content-type")?.split(";")[0] || img.mime || "image/jpeg";
    const buf = new Uint8Array(await resp.arrayBuffer());
    return { base64: encodeBase64(buf), mime };
  }
  throw new LlmGatewayError("missing_image", "No image url or base64 provided", 400);
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

// Platform policy: self-hosted/vLLM-backed providers are the default for
// every task. Paid cloud providers are a FALLBACK ONLY, used solely when
// the tenant's own (self-hosted) provider actually fails or times out --
// never chosen ahead of it. This is consulted in callLLM's catch block
// below, not in resolveConfig: the tenant/domain config is always tried
// first, unconditionally, for every task.
//
// logistics.smart_quotes needs up to 16000 tokens of deeply structured
// JSON -- self-hosted rigs observed in production can't reliably finish
// that within the upstream proxy's ~100-125s timeout window (see
// fetchWithTimeout above, and the 524 this was diagnosed from). When that
// happens, retry once with Gemini via the GOOGLE_API_KEY already present
// in this environment, rather than surfacing the failure to the caller.
// Absent here (or missing its env credential) simply means no fallback --
// the original error propagates, which is always safe.
// The four vision tasks below have no self-hosted default at all today --
// the only model this platform's self-hosted rig currently serves
// (qwen3.8-27b-awq) has no vision capability, confirmed live against its
// /v1/models endpoint. The primary attempt still always runs first per
// policy (and will simply fail fast, cleanly, since the model can't accept
// image input) before this fallback is used -- this is a real capability
// gap in the self-hosted deployment, not a policy exception, and should be
// revisited if a vision-capable self-hosted model is ever deployed.
// Gemini, not OpenAI, is the fallback here even though these functions
// originally called OpenAI directly: OPENAI_API_KEY in this environment is
// stale (confirmed via a live 401 against api.openai.com), so it would fail
// too; GOOGLE_API_KEY is confirmed valid.
const PAID_FALLBACK_ON_FAILURE: Partial<Record<LlmTaskId, { provider: LlmProvider; model: string; envKey: string }>> = {
  "logistics.smart_quotes":            { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  "logistics.cargo_damage_analysis":   { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  "logistics.document_categorize":     { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  "logistics.bol_extract":             { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  "logistics.invoice_extract":         { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  // Both text-only, no vision blocker -- fallback covers the case where the
  // self-hosted attempt errors, or (nexus-copilot/portal-chatbot specifically)
  // no tenant is resolved at all and env-based routing's other fallback
  // (VLLM_BASE_URL, a different rig with a known-stale credential) fails too.
  "comms.nexus_copilot_chat":          { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  "comms.portal_chatbot_reply":        { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
  // Added alongside the token-budget fix above: this task had no fallback
  // at all, so a self-hosted timeout (structurally guaranteed at the old
  // 4096-token budget, and still possible near the new one under load)
  // failed the request outright instead of degrading to a paid provider.
  "markets.research_thread":           { provider: "gemini", model: "gemini-2.5-flash", envKey: "GOOGLE_API_KEY" },
};

// ─── Resolve tenant config (or env fallback) ───────────────────────────

async function resolveConfig(
  taskId: LlmTaskId,
  ctx: LlmCallContext,
): Promise<ResolvedConfig> {
  // Try tenant config first.
  if (ctx.tenantId && ctx.tenantId !== "00000000-0000-0000-0000-000000000000") {
    try {
      // Task IDs are '<domain>.<feature>' (see LlmTaskId). The domain selects
      // which of the tenant's provider configs serves this call; the RPC falls
      // back to the tenant-wide default (domain IS NULL) when the domain has
      // no config of its own.
      const domain = taskId.split(".")[0];
      const { data, error } = await (ctx.supabaseAdmin as any)
        .schema("platform")
        .rpc("get_tenant_llm_config", { p_tenant_id: ctx.tenantId, p_domain: domain });
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

  // Fall back to env-based legacy routing (Anthropic).
  const routing = FALLBACK_ROUTING[taskId];
  const envKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (envKey) {
    return {
      provider: routing.provider,
      model: routing.model,
      apiKey: envKey,
      baseUrl: null,
      maxOutputTokens: routing.maxOutputTokens,
      source: "env_fallback",
    };
  }

  // No Anthropic key — fall back further to a self-hosted vLLM rig, if
  // configured. Used by the self-hosted deployment, which has no cloud
  // Anthropic subscription.
  const vllmBaseUrl = Deno.env.get("VLLM_BASE_URL");
  const vllmApiKey = Deno.env.get("VLLM_API_KEY");
  const vllmModel = Deno.env.get("VLLM_MODEL_NAME");
  if (vllmBaseUrl && vllmApiKey && vllmModel) {
    return {
      provider: "local-qwen",
      model: vllmModel,
      apiKey: vllmApiKey,
      baseUrl: vllmBaseUrl,
      maxOutputTokens: routing.maxOutputTokens,
      source: "env_fallback",
    };
  }

  throw new LlmGatewayError(
    "no_llm_config",
    "No tenant LLM config and no env ANTHROPIC_API_KEY or VLLM_BASE_URL/VLLM_API_KEY/VLLM_MODEL_NAME fallback. Configure a provider via the Settings UI or set an env secret.",
    503,
  );
}

// ─── Public API ────────────────────────────────────────────────────────

export async function callLLM(
  taskId: LlmTaskId,
  vars: Record<string, string>,
  ctx: LlmCallContext,
  opts?: { image?: LlmImageInput },
): Promise<LlmCallResult> {
  const prompt = PROMPTS[taskId];
  if (!prompt) throw new LlmGatewayError("unknown_task", `Unknown LLM task '${taskId}'`, 400);

  const userMsg = interpolate(prompt.user, vars);
  // Resolved once, before either attempt, so a fallback retry doesn't
  // re-fetch the image -- see resolveImageInput's comment above.
  const image = opts?.image ? await resolveImageInput(opts.image) : undefined;

  async function attempt(cfg: ResolvedConfig): Promise<LlmCallResult> {
    const t0 = Date.now();
    let result: LlmCallResult;
    try {
      switch (cfg.provider) {
        case "anthropic":
          if (image) throw new LlmGatewayError("vision_not_supported", "Vision input is not wired for the anthropic provider yet", 501);
          result = await callAnthropic(cfg, prompt.system, userMsg);
          break;
        case "openrouter":
          if (image) throw new LlmGatewayError("vision_not_supported", "Vision input is not wired for the openrouter provider yet", 501);
          result = await callOpenRouter(cfg, prompt.system, userMsg);
          break;
        case "openai":
          result = await callOpenAiCompatible(cfg, prompt.system, userMsg, "openai", image);
          break;
        case "gemini":
          result = await callGemini(cfg, prompt.system, userMsg, taskId, image);
          break;
        case "local-qwen":
          result = await callOpenAiCompatible(cfg, prompt.system, userMsg, "local-qwen", image);
          break;
        case "custom":
          result = await callOpenAiCompatible(cfg, prompt.system, userMsg, "custom", image);
          break;
      }
    } catch (e: any) {
      const latency = Date.now() - t0;
      await recordUsage(ctx, {
        taskId, promptVersion: prompt.version,
        provider: cfg.provider, model: cfg.model,
        inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0,
        latencyMs: latency, status: "error",
        errorCode: e?.code ?? "provider_error",
        errorMessage: e?.message ?? String(e),
        configSource: cfg.source,
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
      configSource: cfg.source,
      configId: cfg.configId,
    });

    // Update last_used_at if it was a tenant config.
    if (cfg.source === "tenant_config" && cfg.configId) {
      await (ctx.supabaseAdmin as any)
        .schema("platform")
        .from("llm_provider_configs")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", cfg.configId);
    }

    return result;
  }

  // Platform policy: the tenant's own (self-hosted, by default) config is
  // always tried first, unconditionally -- see PAID_FALLBACK_ON_FAILURE's
  // comment above resolveConfig. A paid provider is only ever attempted
  // here, second, and only when the primary attempt actually threw.
  const primaryConfig = await resolveConfig(taskId, ctx);
  try {
    return await attempt(primaryConfig);
  } catch (primaryError: any) {
    const fallback = PAID_FALLBACK_ON_FAILURE[taskId];
    if (!fallback || primaryConfig.provider === fallback.provider) throw primaryError;

    const fallbackKey = Deno.env.get(fallback.envKey);
    if (!fallbackKey) throw primaryError;

    if (ctx.logger) {
      ctx.logger.warn("primary provider failed; retrying once with paid fallback per platform policy", {
        taskId,
        primaryProvider: primaryConfig.provider,
        primarySource: primaryConfig.source,
        fallbackProvider: fallback.provider,
        error: primaryError?.message ?? String(primaryError),
      });
    }

    const fallbackConfig: ResolvedConfig = {
      provider: fallback.provider,
      model: fallback.model,
      apiKey: fallbackKey,
      baseUrl: null,
      maxOutputTokens: MAX_OUTPUT_TOKENS[taskId],
      source: "env_fallback",
    };
    return await attempt(fallbackConfig);
  }
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
  const resp = await fetchWithTimeout(url, {
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
  provider: "openrouter" | "openai" | "local-qwen" | "custom",
  image?: ResolvedImage,
): Promise<LlmCallResult> {
  const defaultBase =
    provider === "openrouter" ? "https://openrouter.ai/api/v1"
    : provider === "openai" ? "https://api.openai.com/v1"
    : "https://api.openai.com/v1"; // local-qwen/custom always supply cfg.baseUrl (required by resolveConfig)
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

  // Standard OpenAI vision content-array shape -- also what vLLM's
  // OpenAI-compatible server expects for a vision-capable served model, so
  // this same code path works unmodified the moment one is deployed
  // self-hosted (see PAID_FALLBACK_ON_FAILURE's comment on the current gap).
  const userContent = image
    ? [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } },
      ]
    : user;

  const body = {
    model: cfg.model,
    max_tokens: cfg.maxOutputTokens,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: userContent },
    ],
  };

  const resp = await fetchWithTimeout(url, {
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

// Tasks whose prompt demands a raw, directly-JSON.parse()-able response.
// Unlike OpenAI-compatible providers, Gemini supports enforcing this
// server-side (responseMimeType) rather than relying purely on the prompt's
// own instructions -- worth it for logistics.smart_quotes specifically since
// its output is large and deeply nested, exactly where a model is most
// likely to slip in a formatting mistake (confirmed live: Gemini returned
// unparseable JSON for this task before this was added).
//
// These same tasks also get thinkingBudget: 0 (below). Gemini 2.5 models
// spend part of maxOutputTokens on an invisible "thinking" pass before
// producing visible output -- confirmed live for smart_quotes: with the
// default thinking budget, 7861 of an 8192-token budget went to thinking,
// leaving only 314 for the actual JSON, which is why it kept truncating.
// Disabling thinking gives large structured-output tasks like this one the
// entire budget for the output we actually asked for.
const GEMINI_JSON_MODE_TASKS = new Set<LlmTaskId>([
  "logistics.smart_quotes",
  "logistics.cargo_damage_analysis",
  "logistics.document_categorize",
  "logistics.bol_extract",
  "logistics.invoice_extract",
  "comms.portal_chatbot_reply",
  // comms.nexus_copilot_chat deliberately excluded -- its output is plain text, not JSON.
]);

async function callGemini(
  cfg: ResolvedConfig,
  system: string,
  user: string,
  taskId?: LlmTaskId,
  image?: ResolvedImage,
): Promise<LlmCallResult> {
  const base = cfg.baseUrl ?? "https://generativelanguage.googleapis.com";
  // model names in the DB may or may not be prefixed with `models/`
  const modelPath = cfg.model.startsWith("models/") ? cfg.model : `models/${cfg.model}`;
  const url = `${base}/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  // Gemini API takes `systemInstruction` separately and `contents[]` for the
  // turn-by-turn conversation. We send a single user turn. Images go in the
  // same turn's parts[] as inline_data (base64) -- Gemini also supports a
  // file_data/file_uri form for its own File API, not used here since we
  // already have the bytes from resolveImageInput.
  const userParts: any[] = [{ text: user }];
  if (image) {
    userParts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
  }
  const body: any = {
    contents: [
      { role: "user", parts: userParts },
    ],
    generationConfig: {
      maxOutputTokens: cfg.maxOutputTokens,
      ...(taskId && GEMINI_JSON_MODE_TASKS.has(taskId)
        ? { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  };
  if (system && system.trim().length > 0) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const resp = await fetchWithTimeout(url, {
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

  const system = systemSuffix ? `${prompt.system}\n\n${systemSuffix}` : prompt.system;

  // Build provider-specific message array (assistant messages may not start with "user")
  // Anthropic requires alternating user/assistant starting with user.
  // Ensure messages array is valid.
  const validMessages: ConversationMessage[] = messages.length > 0 ? messages : [{ role: "user", content: "" }];

  async function attempt(cfg: ResolvedConfig): Promise<LlmCallResult> {
    const t0 = Date.now();
    let result: LlmCallResult;
    try {
      switch (cfg.provider) {
        case "anthropic": {
          const url = (cfg.baseUrl ?? "https://api.anthropic.com") + "/v1/messages";
          const body = {
            model:      cfg.model,
            max_tokens: cfg.maxOutputTokens,
            system,
            messages:   validMessages,
          };
          const resp = await fetchWithTimeout(url, {
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
            throw new LlmGatewayError(`anthropic_${resp.status}`, `Anthropic ${resp.status}: ${txt.slice(0, 300)}`, resp.status >= 500 ? 502 : 400);
          }
          const json: any = await resp.json();
          const text = Array.isArray(json?.content)
            ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
            : "";
          const inputTokens  = Number(json?.usage?.input_tokens  ?? 0);
          const outputTokens = Number(json?.usage?.output_tokens ?? 0);
          const cachedInputTokens = Number(json?.usage?.cache_read_input_tokens ?? 0);
          const p = ANTHROPIC_PRICING[cfg.model];
          const costUsd = p
            ? ((inputTokens - cachedInputTokens) * p.inputPerMillion + cachedInputTokens * (p.cachedInputPerMillion ?? p.inputPerMillion) + outputTokens * p.outputPerMillion) / 1_000_000
            : 0;
          result = { text, provider: "anthropic", model: cfg.model, inputTokens, outputTokens, cachedInputTokens, costUsd, latencyMs: 0, promptVersion: "", raw: json };
          break;
        }
        case "openrouter":
        case "openai":
        case "local-qwen":
        case "custom": {
          // Strip a trailing "/v1" so a configured base_url may include it or
          // not (VLLM_BASE_URL is set with a trailing /v1, matching the
          // single-turn callOpenAiCompatible convention) without doubling up.
          const rawBase = cfg.baseUrl ?? (cfg.provider === "openrouter" ? "https://openrouter.ai/api" : "https://api.openai.com");
          const baseUrl = rawBase.replace(/\/v1\/?$/, "");
          const url = baseUrl + "/v1/chat/completions";
          const oaiMessages = [{ role: "system", content: system }, ...validMessages];
          const resp = await fetchWithTimeout(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${cfg.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: cfg.model, max_tokens: cfg.maxOutputTokens, messages: oaiMessages }),
          });
          if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new LlmGatewayError(`provider_${resp.status}`, `Provider ${resp.status}: ${txt.slice(0, 300)}`, resp.status >= 500 ? 502 : 400);
          }
          const json: any = await resp.json();
          const text = json?.choices?.[0]?.message?.content ?? "";
          result = { text, provider: cfg.provider, model: cfg.model, inputTokens: Number(json?.usage?.prompt_tokens ?? 0), outputTokens: Number(json?.usage?.completion_tokens ?? 0), cachedInputTokens: 0, costUsd: 0, latencyMs: 0, promptVersion: "", raw: json };
          break;
        }
        case "gemini": {
          // Conversation-mode Gemini. Same generateContent endpoint as the
          // single-turn path; the multi-turn shape is just `contents[]` of
          // {role, parts[{text}]} per https://ai.google.dev/api/generate-content.
          const base = cfg.baseUrl ?? "https://generativelanguage.googleapis.com";
          const modelPath = cfg.model.startsWith("models/") ? cfg.model : `models/${cfg.model}`;
          const url = `${base}/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
          const contents = validMessages.map((m) => ({
            // Gemini uses "user" / "model" (not "assistant")
            role: m.role === "assistant" ? "model" : m.role,
            parts: [{ text: m.content }],
          }));
          const body: any = {
            contents,
            generationConfig: { maxOutputTokens: cfg.maxOutputTokens },
          };
          if (system && system.trim().length > 0) {
            body.systemInstruction = { parts: [{ text: system }] };
          }
          const resp = await fetchWithTimeout(url, {
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
          const p = GEMINI_PRICING[cfg.model] ?? GEMINI_PRICING[cfg.model.replace(/^models\//, "")];
          const costUsd = p
            ? ((inputTokens - cachedInputTokens) * p.inputPerMillion +
               cachedInputTokens * (p.cachedInputPerMillion ?? p.inputPerMillion) +
               outputTokens * p.outputPerMillion) / 1_000_000
            : 0;
          result = { text, provider: "gemini", model: cfg.model, inputTokens, outputTokens, cachedInputTokens, costUsd: Math.round(costUsd * 1e6) / 1e6, latencyMs: 0, promptVersion: "", raw: json };
          break;
        }
        default:
          throw new LlmGatewayError("provider_not_implemented", `Provider '${cfg.provider}' not wired for conversation mode.`, 501);
      }
    } catch (e: any) {
      const latency = Date.now() - t0;
      await recordUsage(ctx, { taskId, promptVersion: prompt.version, provider: cfg.provider, model: cfg.model, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0, latencyMs: latency, status: "error", errorCode: e?.code ?? "provider_error", errorMessage: e?.message, configSource: cfg.source });
      if (e instanceof LlmGatewayError) throw e;
      throw new LlmGatewayError("provider_error", e?.message ?? "Provider call failed", 502);
    }

    result.latencyMs    = Date.now() - t0;
    result.promptVersion = prompt.version;

    await recordUsage(ctx, { taskId, promptVersion: prompt.version, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, cachedInputTokens: result.cachedInputTokens, costUsd: result.costUsd, latencyMs: result.latencyMs, status: "ok", configSource: cfg.source, configId: cfg.configId });

    if (cfg.source === "tenant_config" && cfg.configId) {
      await (ctx.supabaseAdmin as any).schema("platform").from("llm_provider_configs").update({ last_used_at: new Date().toISOString() }).eq("id", cfg.configId);
    }

    return result;
  }

  // Same primary-then-paid-fallback policy as callLLM (see its comment
  // above PAID_FALLBACK_ON_FAILURE). This function previously had no
  // fallback at all -- found live, 2026-09-10, testing the
  // markets.research_thread budget fix in the browser: this tenant's
  // tenant-wide-default config (a "gemini" row with no domain set) has a
  // missing vault secret, so the primary attempt threw a 401, and the
  // request just failed outright even though research_thread had just been
  // given a PAID_FALLBACK_ON_FAILURE entry -- because that entry is only
  // ever consulted by callLLM, and markets-research (the only caller of
  // this function) never reaches it.
  const primaryConfig = await resolveConfig(taskId, ctx);
  try {
    return await attempt(primaryConfig);
  } catch (primaryError: any) {
    const fallback = PAID_FALLBACK_ON_FAILURE[taskId];
    if (!fallback || primaryConfig.provider === fallback.provider) throw primaryError;

    const fallbackKey = Deno.env.get(fallback.envKey);
    if (!fallbackKey) throw primaryError;

    if (ctx.logger) {
      ctx.logger.warn("primary provider failed; retrying once with paid fallback per platform policy", {
        taskId,
        primaryProvider: primaryConfig.provider,
        primarySource: primaryConfig.source,
        fallbackProvider: fallback.provider,
        error: primaryError?.message ?? String(primaryError),
      });
    }

    const fallbackConfig: ResolvedConfig = {
      provider: fallback.provider,
      model: fallback.model,
      apiKey: fallbackKey,
      baseUrl: null,
      maxOutputTokens: MAX_OUTPUT_TOKENS[taskId],
      source: "env_fallback",
    };
    return await attempt(fallbackConfig);
  }
}

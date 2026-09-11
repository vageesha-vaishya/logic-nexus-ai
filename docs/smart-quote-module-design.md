# Smart Quote Module — Design & LLM Prompt Documentation

**Status:** v3 prompt live in production (`logistics.smart_quotes`, version `v3-2026-09-11`). Third-party rate-provider tool-calling framework (§9) is built and deployed but dormant — zero real provider adapters registered yet (§9.6).
**Scope:** Import/export/inland freight quotation generation (`ai-advisor` → `generate_smart_quotes`)
**Last updated:** 2026-09-11
**Prerequisite reading:** `docs/audits/2026-09-05-ai-llm-audit-findings.md` §7–§10 — this doc builds directly on findings and fixes made there today (self-hosted throughput ceiling, charges/carrier reconciliation bugs and fixes). Nothing here repeats that investigation; it assumes the reader has it as background.

---

## 1. Executive summary

This document specifies the Smart Quote module's data architecture and the LLM prompt that drives it, and explains *why* it's built the way it is rather than the way the module's stated business goals (win deals, protect margin, account for canal fees and geopolitical risk, benchmark competitors) might naively suggest.

**The central design decision, and the reason this doc exists rather than just a prompt diff:** every one of today's requested capabilities — current canal tolls, real-time geopolitical risk, competitor pricing — is *factual, time-sensitive data the model does not have and cannot reliably invent*. Today's investigation (§7–§10 of the audit doc) measured this directly: sampling the *same* prompt against both the self-hosted model and a frontier paid model (Gemini 2.5 Flash) found **16.7–37.5% of generated quotes had internally inconsistent arithmetic**, and a real production response showed a fabricated carrier name (a local trucking company) presented as the ocean carrier. That's what an LLM does with structured facts it's asked to reason about *without being given the specific numbers* — extrapolate plausible-sounding values, not look anything up. Asking it to also know this week's Suez Canal Authority circular or which competitor is quoting what would produce the same failure mode, just about facts that are far more consequential to get wrong.

So the module is built in two layers, and the split between them is the actual design:

1. **A deterministic, code-owned data layer** — reference tables and computed lookups (canal toll reference, competitive benchmark, historical rates, chokepoint routing detection) that are *fetched or maintained outside the model* and injected into the prompt as read-only, dated, sourced context.
2. **An LLM reasoning layer** — the model's job is to synthesize a coherent, well-structured, well-explained quote *from* that context, never to originate facts the context doesn't already contain.

Everything in §4 onward follows from that split. Where real-time data integration doesn't exist yet (live canal-toll API, a maintained geopolitical-risk feed, live competitor rates), this doc says so explicitly and describes the Phase 2/3 path — it does not pretend a prompt tweak alone delivers real-time awareness, because it can't.

---

## 2. Current architecture

```
Frontend (SmartQuoteWorkspace)
        │
        ├──▶ rate-engine          (POST, parallel)  — market-rate carrier options (deterministic, contract/spot rates)
        │
        └──▶ ai-advisor           (POST, parallel)  — generate_smart_quotes action
                  │
                  ├─ 1. Cache check (ai_quote_cache, keyed on route+cargo, 24h TTL)
                  ├─ 2. Historical rate lookup (tenant's own `rates` table)
                  ├─ 2b. Maritime chokepoint + benchmark context (NEW, this doc — §6/§7)
                  ├─ 3. callLLM("logistics.smart_quotes", vars, ctx)   — _shared/llm-gateway.ts
                  │        └─ resolveConfig(): tenant's self-hosted config tried first, paid
                  │           fallback (Gemini) only on failure — platform policy, ADR-024
                  ├─ 4. applyDynamicPricing() — POST-PROCESSING, not prompt trust:
                  │        recomputes price_breakdown.total deterministically from the
                  │        model's own leg charges; rebuilds fuel/currency surcharges;
                  │        makes sum(legs[].charges) == price_breakdown.total BY
                  │        CONSTRUCTION (see audit doc §10 for why this exists)
                  └─ 5. Cache write, audit log, return

Frontend then runs the AI options (and rate-engine's market options) through:
  quote-mapper.ts → useRateFetching.ts → buildHybridRouteConfiguration()
        (carrier-name reconciliation happens here too — audit doc §10, hybrid-route-configuration.ts)
```

The two "MARKET RATE" and "AI GENERATED" option groups shown side by side in the Smart Quote UI are not decorative — **the market-rate options already are the competitive benchmark**, computed from real contract/spot carrier rates, not invented. §7 below builds on this rather than duplicating it.

---

## 3. The governing constraint: self-hosted throughput

Every schema and prompt decision in this module is downstream of one hard number, measured today, not estimated:

| Constraint | Value | Source |
|---|---|---|
| Self-hosted rig completion throughput | ~27–28 tokens/sec | Measured live, `qwen3.8-27b-awq` via `portal.sosservices.online` |
| Cloudflare proxy hard timeout on that origin | 125.1s, unconditional | Measured live with an unbounded client timeout — Cloudflare killed the connection at exactly 125.1s regardless |
| Resulting absolute ceiling on one response | ~3,400 tokens | 125.1s × 27 tok/s, with zero margin |
| Configured safe budget (`MAX_OUTPUT_TOKENS["logistics.smart_quotes"]`) | **2,800 tokens** | Leaves ~104s worst case, under both the 115s client timeout and the 125.1s ceiling |

This is why the v2 schema (2026-09-10) dropped from 5 quote options with itemized per-leg charges to 3 options with one rolled-up charge per leg — the original shape needed 7,500–8,000 completion tokens (confirmed via Gemini's own token usage generating equivalent content) and was **structurally unreachable on self-hosted at any timeout setting**. Every request for that schema had silently been paying for the paid fallback instead, which defeats the platform's self-hosted-first policy (ADR-024) at exactly the task most worth running cheaply.

**Implication for every requirement in this brief:** any change that grows the JSON schema — a new field per option, a separate canal-fee line item, a per-option risk-score object — multiplies against 3 options and eats directly into this budget. The v3 changes in this doc add zero new schema fields for exactly this reason. New information is either (a) folded into an *existing* field (the ocean leg's single rolled-up charge, `ai_explanation`, `market_analysis`) or (b) supplied as *input* context, which costs prompt (input) tokens, not completion (output) tokens, and is not subject to the same throughput ceiling.

If a future requirement genuinely cannot fit this way, the correct response is to reconsider what runs on self-hosted vs. paid for that specific field — not to silently blow the budget again.

---

## 4. Data grounding principle

| Data class | Owner | Example | Why |
|---|---|---|---|
| **Time-invariant domain knowledge** | LLM (fine) | "Ocean freight is typically quoted per-container or per-w/m for LCL" | Genuinely stable, in any reasonable training set, low stakes if slightly imprecise |
| **Facts that change on a real regulatory/market cadence** | Code, injected as dated context | Current Suez/Panama toll trend, whether Cape diversion is currently the norm | Model's training data is stale by construction; wrong here is either an embarrassing "no canal here" hallucination or a materially wrong number that would appear on a client-facing quote |
| **Tenant-specific real numbers** | Code, queried live | Historical rates on this exact lane, a real competitor's contract rate | Not knowable to any general-purpose model, ever |
| **Money that has to reconcile with itself** | Code, recomputed, never trusted from model output | `price_breakdown.total` vs. `sum(legs[].charges)` | Proven today: the model gets asked to represent the same number two different ways and doesn't reliably keep them equal — 16.7–37.5% of options across both self-hosted and Gemini didn't reconcile in live sampling |
| **Synthesis/reasoning over already-given facts** | LLM | "Given this benchmark and this routing context, produce 3 sensibly differentiated options" | This is the part an LLM is actually good at, and the actual job of this module |

The last two rows are not new to this doc — they're the audit doc §10 findings, restated here because everything in §5–§7 depends on the same principle: **give the model the facts, never ask it to be the source of the facts.**

---

## 5. Charge taxonomy

What a competitive, margin-aware quote needs to account for, and where each piece lives today:

| Charge category | Where it lives | Status |
|---|---|---|
| Inland pickup / drayage (origin) | `legs[].charges`, road-mode leg | ✅ Generated per-quote, reconciled |
| Inland delivery / drayage (destination) | `legs[].charges`, road-mode leg | ✅ Generated per-quote, reconciled |
| Ocean/air/rail base freight | `legs[].charges`, main-mode leg | ✅ Generated per-quote, reconciled |
| BAF (bunker) / CAF (currency) adjustment | `price_breakdown.surcharges`, folded into main leg | ✅ Code-computed (12% fuel / 2% currency of base), not model-invented, since 2026-09-10 (audit doc §10) |
| **Canal fees (Suez/Panama)** | Folded into main (ocean) leg's rolled-up charge, no separate field | ✅ **New this doc** — §6, model-grounded via injected reference, not invented |
| War-risk / diversion surcharge (Cape of Good Hope routing) | Folded into main leg charge; described in `ai_explanation`/`market_analysis` | ✅ **New this doc** — §6 |
| Documentation / handling fees | `price_breakdown.fees.handling_docs` | ✅ Code-computed as the sum of the non-main legs since 2026-09-10 (audit doc §10) |
| Peak season surcharge | Not currently modeled | ❌ Not in scope of this pass — candidate for Phase 2 (§10), same pattern as canal fees once a reference source exists |
| Duties / taxes | `price_breakdown.taxes` | ⚠️ Model-generated, currently almost always 0 in practice; not reconciled against any reference — flagged as a Phase 2 gap, not fixed here |
| Port congestion surcharge | Not currently modeled | ❌ Phase 2 candidate — `public.dynamic_surcharges` (see §10) already has a `port_congestion` surcharge type in its schema, unused |

---

## 6. Maritime chokepoint reference (Suez / Panama)

### What's implemented

`supabase/functions/ai-advisor/index.ts` now has:

- **`MARITIME_REFERENCE`** — a dated, sourced constant (see below for the actual content and sources). This is a **snapshot, not a feed** — see §11 for the required refresh cadence.
- **`buildMaritimeContext(origin, destination, mode)`** — a coarse keyword/region heuristic that decides whether a lane plausibly transits Suez or Panama, and if so, returns the relevant reference text; returns an empty string otherwise (including for any non-ocean mode).
- The prompt (§8) treats this as authoritative, dated context: fold its cost/time impact into the existing ocean leg charge and `transit_time`, never state a figure or routing assumption that contradicts it, and say nothing about canal fees at all when no context was provided.

### The actual reference data (verified via live web search, 2026-09-11 — not from any model's training data)

**Suez Canal:**
- Toll trend: the Suez Canal Authority raised transit tolls three times in 2026 (Mar 1, May 1, Jul 15); containership tier surcharge is ~12% on top of a base tariff unchanged since 2024. ([Suez Canal Authority raises transit tolls](https://www.bloominglobal.com/media/detail/suez-canal-raises-vessel-surcharges-as-shipping-traffic-recovers), [Suez Canal to raise transit surcharges from Jul 15](https://www.indexbox.io/blog/suez-canal-authority-to-raise-transit-surcharges-from-july-15/))
- **Routing reality (the load-bearing fact a model would otherwise miss):** despite those toll increases, most carriers are *not* actually transiting Suez right now. Ongoing Houthi attacks in the Red Sea have kept the large majority of Asia–Europe and Asia–US East Coast services on Cape of Good Hope diversion since late 2023; Suez traffic in 2026 remains roughly 60% below pre-crisis levels, and the industry expects this to continue through at least 2027. ([Red Sea shipping disruption 2026 status](https://themiddleeastinsider.com/2026/04/25/red-sea-shipping-disruption-2026/), [Red Sea Brief, Lloyd's List Intelligence, Jul 2026](https://www.lloydslistintelligence.com/resources/blog/red-sea-brief-23-july-2026))
- Cost impact: Cape diversion adds ~10–14 days transit and a war-risk/diversion surcharge of roughly $200–800 per container; the per-TEU cost differential between a (rare) Suez transit and the Cape diversion routing most carriers actually use is roughly $200–400/TEU. ([Suez vs Cape routing 2026 decision guide](https://blog.gettransport.com/trends-in-logistic/suez-canal-red-sea-2026-routing-decision-guide/))

**Panama Canal:**
- Toll trend: the Panama Canal Authority (ACP) has frozen its main toll structure through September 30, 2026. Container vessels are charged per laden TEU, roughly $35–45/TEU (so ~$70–90 for a 40ft/2-TEU container), plus a fixed per-transit vessel fee not directly allocable to an individual shipper's container. ([Panama Canal toll structure](https://porteconomicsmanagement.org/pemp/contents/part1/interoceanic-passages/panama-canal-toll-structure/), [Panama Canal tolls 2026](https://www.freightamigo.com/en/blog/logistics/what-is-the-panama-transit-fee-a-guide-to-panama-canal-costs-in-2026/))
- Routing reality: Panama routing (Asia ↔ US East/Gulf Coast, Caribbean) has not seen Suez-scale disruption and remains standard for those lanes in 2026, subject to normal seasonal draft restrictions.

### Route-detection heuristic

`buildMaritimeContext` matches on a fixed keyword list per side of each canal (e.g. Suez side A: China, India, Singapore, UAE, …; side B: Netherlands, Germany, UK, …) and fires when origin/destination match opposite sides, for ocean mode only.

**This is deliberately coarse, not a real geo-routing engine.** A false negative (a chokepoint lane the keywords miss) just means the model gets no canal guidance and falls back to its own judgment — no worse than before this change. A false positive (context injected on a lane that doesn't actually need it) costs a short, accurate paragraph that happens not to apply — a much safer failure mode than the reverse. See §9 for the Phase 2 upgrade (a real port/region lookup, e.g. keyed off `ports_locations`' existing `country`/`location_type` columns).

---

## 7. Competitive benchmarking / revenue optimization

### 7.1 What "MARKET RATE" actually was — a bug, now fixed

`rate-engine` computes carrier options and the frontend renders them alongside the AI options, labeled "MARKET RATE" vs. "AI GENERATED." The label implies these are always real, DB-backed carrier pricing. **They frequently were not, until this fix.** `rate-engine`'s location resolution (`resolveLocation()`) did an *exact string match* on `ports_locations.location_code` against whatever string the frontend sent as `origin`/`destination` — but the Smart Quote page sends the location's **display name** (e.g. `"Nhava Sheva"`), not its code (e.g. `"INNSA"`), in that field. When the match failed (the common case), `originId`/`destId` came back `null`, the real `carrier_rates` query was skipped entirely, and `rate-engine` fell through to its "10+ options guarantee" fallback — which fabricates one option per carrier in a hardcoded list, at `basePrice * (0.85 + Math.random() * 0.3)`, i.e. **a random number within ±15% of a hardcoded base rate**, not a real quote. Nothing in `rate-engine`'s response distinguished a real row from a simulated one except the simulated ones' `sim_`-prefixed `id`, which the frontend didn't check and didn't surface.

**Fixed (2026-09-11).** `resolveLocation()` now accepts the same `originDetails`/`destinationDetails` the frontend already sends (`LocationAutocomplete`'s resolved `ports_locations.id`, set by `SmartQuoteWorkspace.tsx`'s `deriveSharedPayload` — the exact mechanism §7.2 below already used) and prefers that real UUID over re-resolving the free-text string, falling back to the original UUID-passthrough/`location_code`-exact-match behavior unchanged for any caller that doesn't send `*Details` (e.g. `RateManagement.tsx`'s simpler analysis call). "MARKET RATE" options are now real whenever the tenant has an active `carrier_rates` row for the lane, not just when the free-text string happened to equal a code exactly.

This is also why §7.2 below does **not** call `rate-engine`'s HTTP endpoint and try to filter its response for the real rows, even after this fix — it queries `carrier_rates` directly from `ai-advisor`, so it never has to trust that `rate-engine`'s own response is free of `sim_`-prefixed rows.

### 7.2 Live market-rate benchmark (built, wired up)

`ai-advisor` now queries `public.carrier_rates` directly (`fetchLiveMarketRateBenchmark()`) whenever the frontend has resolved both locations to a real `ports_locations.id` — which the Smart Quote page's `LocationAutocomplete` already captures as `originDetails.id`/`destinationDetails.id` in the payload it sends (previously read by nothing; `ai-advisor` ignored these two fields entirely). The query mirrors `rate-engine`'s own filtering exactly (`status = 'active'`, unexpired `valid_to`, contract-tier rows restricted to their own `account_id`) and the same per-unit price scaling (`× containerQty` for ocean, `× weightKg` otherwise), so the resulting average is apples-to-apples comparable to what a real `rate-engine` "MARKET RATE" option would show for the same request. Because it reads `carrier_rates` directly by UUID rather than through `rate-engine`'s string-match, it never picks up a simulated/randomized row.

**Priority order:** when real `carrier_rates` rows exist for the lane, their average is used as the benchmark (`source: 'market'`) — real, currently-active carrier pricing beats the tenant's own quoting history as a competitive signal. When none exist (new lane, or the frontend didn't capture a location id), it falls back to the pre-existing historical-`rates`-table average (`source: 'historical'`, unchanged from before). It never falls back to a simulated number — an empty benchmark (§8's grounding rule 10: say nothing) is the correct behavior when neither real source has data, not a fabricated one.

`buildBenchmarkContext()`'s wording now reflects which source produced the figure — market-sourced context says "real, currently-active carrier rate agreements on this exact lane (N found)"; historical-sourced context says "this tenant's own last N quotes on this lane" (the original wording) — so the LLM (and anyone auditing a quote's provenance later) knows which kind of number it was given.

---

## 8. The v3 prompt

Full text as deployed (`llm-gateway.ts`, `PROMPTS["logistics.smart_quotes"]`, version `v3-2026-09-11`). Annotated inline; the actual template has no comments (JSON must be exactly as specified for the self-hosted model's `responseMimeType`-equivalent instruction-following to hold).

### System prompt

```
You are an Expert Logistics Rate Analyst producing quotes that must be both competitive enough to
win the deal and priced to sustain healthy margin -- not just technically valid.
Generate exactly 3 freight quotation options: "best_value", "cheapest", "fastest".

Requirements:
1. LANGUAGE: English only.
2. Break each route into legs (Pickup -> Port -> Main Leg -> Port -> Delivery).
3. Each leg needs exactly ONE rolled-up charge line (not itemized). Zero-cost legs are not allowed.
4. Mode-specific pricing: Road ~$1.50-4.00/km + handling. Air: chargeable weight x $2.50-12.00/kg.
   Ocean: per-container or w/m for LCL, BAF/CAF included in the rolled-up leg charge. Rail: distance-based.
5. The option's 'total' MUST equal the sum of all leg charges.
6. Give a reliability score (1-10) and estimated total CO2 (kg) per option.
7. Keep 'ai_explanation' to ONE short sentence per option. Keep customs_procedures/restrictions
   arrays to at most 1-2 short items each, empty array if none.

STRICT GROUNDING RULES for MARITIME CONTEXT and BENCHMARK (these override anything else, and
override your own training knowledge specifically):
8. If a MARITIME CONTEXT line is provided in the user message, treat it as the current, authoritative
   routing/toll reality for this lane -- fold its cost impact into the ocean leg's single rolled-up
   charge (do not add a separate canal-fee line item) and reflect its routing/transit-time impact in
   transit_time and ai_explanation. Do not state a canal toll figure, routing assumption, or
   transit-time impact that contradicts it.
9. If NO maritime context line is provided (blank), do not mention canal fees, Suez, Panama, or Red
   Sea routing risk at all -- say nothing rather than guess from your training data, which will be
   stale for regulatory tolls and current geopolitical routing.
10. If a BENCHMARK line is provided, price 'cheapest' at or below it and 'best_value' within a
    reasonable band above it, per its own instruction. Never invent a competitor's price or cite a
    specific competitor by name -- you have no real data on either.

Output JSON Format (exactly this shape, no extra nesting):
{ ...unchanged from v2, see §5's taxonomy for what maps where... }

CRITICAL OUTPUT CONSTRAINT: Respond with ONLY the raw JSON object shown above — no markdown code
fences, no commentary, no explanation before or after. The entire response body MUST be valid JSON
parseable directly by JSON.parse(). Do not wrap it in any other key.
```

### User prompt template

```
Route: ${origin} to ${destination} (${mode})
Cargo: ${commodity}, ${weight}kg, ${volume}cbm
Equipment: ${container_qty}x ${container_size} ${container_type}
Historical context: ${historical_context}
${maritime_context}
${benchmark_context}

Generate the quotation options now.
```

`${maritime_context}` and `${benchmark_context}` are computed server-side (`ai-advisor/index.ts`) and are legitimately empty strings on most requests — a non-ocean-mode shipment, an ocean lane the chokepoint heuristic doesn't match, or a lane with no historical rate data yet. An empty value renders as a blank line, which costs effectively nothing and produces no dangling label (both context builders return fully-formed, self-labeled text or nothing — the template doesn't add its own "Maritime context:" prefix that would otherwise show up empty).

### Live verification (2026-09-10/11, self-hosted rig, `qwen3.8-27b-awq`)

| Route | Chokepoint context fired? | Result |
|---|---|---|
| Nhava Sheva → Rotterdam (ocean) | Yes (Suez) | `market_analysis` and all 3 `ai_explanation`s correctly cited the current Cape of Good Hope diversion and Red Sea risk instead of assuming normal Suez transit. 63s latency. All 3 options: `total == sum(legs[].charges)`. Real carriers (Maersk, Hapag-Lloyd, CMA CGM). |
| Delhi → Mumbai (road) | No | No canal/risk content anywhere in the response, as instructed. 39.5s latency (faster — less context to reason about). All 3 options reconciled. |

---

## 9. Rate & charge retrieval workflow (third-party providers, LLM tool-calling)

Everything in §4–§8 covers data the *code* fetches or computes and hands the model as read-only context. This section covers a different, explicitly-decided-differently case: **live rates from named third-party freight-rate platforms** ("11 specified third-party quote rate platforms" per the original request). For those, the product decision — made explicitly, after the tradeoff below was raised — is that **the LLM itself decides when and which platform to call**, via real OpenAI-compatible tool-calling (function-calling), not a deterministic pre-fetch the way §6/§7's context is built.

### 9.1 Why this is a deliberate exception to §4's grounding principle

§4's rule is "give the model the facts, never ask it to be the source of the facts." Tool-calling looks like it violates that — the model is choosing *whether* to call a tool, which is itself a kind of judgment call over facts. It doesn't actually violate it, because the boundary is drawn differently here: the model never originates a rate number. It can only ever receive one of two things back from `get_freight_rate` — a real `NormalizedRate` object from a real HTTP call the orchestrator made, or a structured error string — and every other rule in §4 still applies to what it does with that result (it still can't invent a rate if the tool call fails; §9.4 covers exactly what happens then). What the model is trusted to decide is *when a live lookup is worth making*, not *what the number is*.

The tradeoff this doc originally flagged: a deterministic pre-fetch (code always calls whichever rate providers are configured for a lane, before the model ever runs, the same pattern as §6's maritime context) is simpler, has bounded and predictable latency, and can't be skipped by the model. Tool-calling is more flexible — the model can choose not to bother calling a slow/irrelevant provider for a lane where it has good context already — at the cost of the latency and complexity in §9.3, and at the cost of one real failure mode already caught in testing (§9.2's enum note). The tool-calling approach was chosen anyway as the explicit, informed product decision; §9.3's bounded-loop design and §9.6's dormant-risk note exist specifically to contain the downside of that choice rather than re-argue it.

### 9.2 The tool contract

`_shared/rate-providers/registry.ts`'s `getRateProviderTool()` builds the exact schema offered to the model:

```json
{
  "type": "function",
  "function": {
    "name": "get_freight_rate",
    "description": "Look up a live, real freight rate from one of this tenant's configured rate providers. Only call this for the 'provider' values listed in the enum -- there is no provider available beyond that list, regardless of what you may know about other freight rate platforms.",
    "parameters": {
      "type": "object",
      "properties": {
        "provider": { "type": "string", "enum": ["<tenant's configured, callable provider names only>"] },
        "origin": { "type": "string" },
        "destination": { "type": "string" },
        "mode": { "type": "string", "enum": ["ocean", "air", "road", "rail"] },
        "container_type": { "type": "string" }
      },
      "required": ["provider", "origin", "destination", "mode"]
    }
  }
}
```

**The `provider` field's `enum` constraint is not incidental — it is the direct fix for a real, observed failure.** A live curl test against the self-hosted rig, run with an earlier draft of this schema that left `provider` as a free-form string, got back a tool call with `provider: "Xeneta"` — a real freight-rate platform the model knows about from training data, but one this deployment has no adapter or credentials for. The model was never told "you may only use these platforms"; it inferred a plausible-sounding one from context and called it anyway. Constraining `provider` to an `enum` of only the tenant's actually-callable providers is what makes this safe: `tool_choice` sampling in every OpenAI-compatible implementation is expected to respect an `enum`, and `orchestrator.ts`'s `executeRateToolCall` re-validates the value against the same list server-side regardless (§9.4), so even a model that doesn't respect the enum perfectly can't reach a real, uncontrolled HTTP call.

If the tenant has zero callable providers (true for every tenant today — see §9.6), `getRateProviderTool()` returns `null` and the tool is not offered at all — an empty `enum` was deliberately rejected as the way to represent "no providers," since some models will still attempt a call with a hallucinated value against an empty enum rather than skip the tool.

### 9.3 The retrieval workflow, step by step

```
generateSmartQuotes()                                    [ai-advisor/index.ts]
  │
  ├─ 1. loadTenantRateProviders(supabase, tenantId)       [rate-providers/registry.ts]
  │      → calls public.get_tenant_rate_providers(tenant_id)   [SECURITY DEFINER RPC]
  │        · reads rate_provider_configs (this tenant, is_active = true)
  │        · decrypts each config's API key from vault.decrypted_secrets
  │        · excludes any provider whose rate_provider_health.status = 'open'
  │          and open_until is still in the future (circuit still tripped)
  │      → matches each returned row against the code-side ADAPTERS registry
  │        (a config with no matching registered adapter, or no resolvable
  │        API key, is silently excluded from `callable` and counted in
  │        `unmatchedConfigCount` — logged as an ops gap, never surfaced to
  │        the model or the client)
  │
  ├─ 2. getRateProviderTool(registry)                     [rate-providers/registry.ts]
  │      → builds the §9.2 tool schema from `callable`, or returns null
  │
  ├─ 3. callLLMWithTools("logistics.smart_quotes", vars, ctx, tools, executor)  [llm-gateway.ts]
  │      │
  │      ├─ tools.length === 0, OR resolved provider isn't tool-calling-capable
  │      │    (only openrouter/openai/local-qwen/custom are wired for tool-calling
  │      │    today; anthropic/gemini fall back here too — no real rate provider
  │      │    exists yet to justify building their different tool-calling wire
  │      │    formats)
  │      │    → delegate straight to plain callLLM() — IDENTICAL to pre-tool-calling
  │      │      behavior. This is the only path any tenant exercises today (§9.6).
  │      │
  │      └─ otherwise, bounded to exactly 2 LLM round trips, never more:
  │           │
  │           ├─ ROUND 1 — "decide" turn: tool_choice="auto", max_tokens=500
  │           │    (small on purpose — this call only decides whether/which
  │           │    tool(s) to invoke, not the quote itself)
  │           │    → model returns either final content directly (no tool
  │           │      needed) or up to 5 tool_calls (hard cap — prevents a
  │           │      pathological fan-out from inflating latency/cost)
  │           │
  │           ├─ if tool_calls present: execute ALL of them IN PARALLEL via
  │           │    the caller-supplied executor → ai-advisor's executor calls
  │           │    executeRateToolCall(supabase, tenantId, registry, argsJson)
  │           │    for each one (§9.4 covers what that does internally)
  │           │
  │           └─ ROUND 2 — "answer" turn: tool_choice="none" (forces real
  │                content, blocks further tool calls), max_tokens=2800
  │                (the task's FULL budget — this is where the actual quote
  │                JSON gets generated, now with real tool results as
  │                additional conversation context)
  │
  └─ 4. applyDynamicPricing() — unchanged; still recomputes price_breakdown
       deterministically regardless of whether any tool was called (§4's
       "money that has to reconcile with itself" row applies identically
       whether the leg charge came from the model's own reasoning or from
       a live rate the model was handed)
```

Any unexpected failure in the tool-loop mechanics itself (not a normal per-provider HTTP error, which §9.4 already handles) is caught and falls back to plain `callLLM()` — tool-calling breaking can never block Smart Quote generation outright.

### 9.4 Validation rules and the circuit-breaker state machine

Every `get_freight_rate` call the model makes runs through `orchestrator.ts`'s `executeRateToolCall`, which applies the same checks to every provider uniformly — no individual adapter can skip one:

1. **Argument parsing.** Malformed JSON in the tool call's arguments → `invalid_response`, returned immediately, no network call attempted.
2. **Provider re-validation.** The `provider` value is looked up against `registry.callable` again server-side — defense in depth against the enum not being respected (§9.2's Xeneta case). An unmatched value → `provider_error`, no network call.
3. **Field validation.** `mode` must be one of `ocean|air|road|rail`; `origin`/`destination` are required. Either failing → `invalid_response`, no network call.
4. **Circuit-breaker check.** If `rate_provider_health.status = 'open'` and `open_until` is still future for this `(tenant, provider)` pair → `circuit_open`, no network call. The breaker itself: `CIRCUIT_BREAKER_THRESHOLD = 3` consecutive failures trips it (`status → 'open'`, `open_until = now() + 5 min`); any success resets `consecutive_failures` to 0 and `status → 'closed'` immediately. There is no explicit "half-open" transition in code today — the breaker simply becomes callable again once `open_until` passes, and the next call's own success/failure decides the next state. (The `half_open` value exists in the DB `CHECK` constraint for a future, more gradual retry policy; it's not populated by the current implementation.)
5. **SSRF guard.** `assertExternalHostAllowed(new URL(config.baseUrl).hostname)` — reused as-is from `_shared/ssrf-guard.ts` (blocks loopback/RFC1918/link-local/cloud-metadata addresses, by literal IP or DNS resolution) — runs even though `base_url` is admin-configured, not LLM-supplied. This is defense in depth against a misconfigured or compromised config pointing at an internal address, not a defense against the model (the model never supplies a URL, only a `provider` name).
6. **Timeout.** Each adapter's real HTTP call is wrapped in `withTimeout(..., config.timeoutMs, ...)`, where `timeout_ms` is a per-provider, admin-configured value the migration constrains to `1000–30000` (1–30s).
7. **Response normalization.** Every adapter must map its provider's own response into the shared `NormalizedRate` shape (`types.ts`) — the rest of the system (including `applyDynamicPricing`'s reconciliation) never sees a provider-specific field name or unit. An adapter that can't produce a valid `NormalizedRate` must throw (§9.5), never return a partially-filled or best-guess object.

On any success: `rate_provider_health` is upserted (`status: 'closed'`, `consecutive_failures: 0`, `avg_latency_ms`, `calls_today` incremented for that UTC day), and the normalized result is best-effort cached into `external_rate_cache` (1-hour TTL — short enough that a stale quote is unlikely, long enough to avoid re-paying for a repeat call within the same buying session). A cache-write failure never fails the tool call that already succeeded.

### 9.5 Error handling and classification

`classifyError()` maps a thrown error's message to one of the `RateProviderErrorCode` values via regex on the message text:

| Code | Trigger | What the model sees | What happens to health |
|---|---|---|---|
| `timeout` | Message matches `/timed? ?out\|timeout/i` (including the orchestrator's own `withTimeout` wrapper firing) | A tool-result string describing the timeout | Counts as a failure toward the 3-strike breaker |
| `auth_failed` | `/401\|403\|unauthorized\|forbidden/i` | Same | Same |
| `rate_not_found` | `/404\|not found/i` | Same | Same |
| `provider_error` | Anything else (including the pre-network validation failures in §9.4 steps 1–3, which are classified this way without a network call ever happening) | Same | Only network-attempt failures update `rate_provider_health` — pre-network validation failures (bad args, unmatched provider) are returned to the model but don't count against that provider's circuit breaker, since the provider itself was never actually contacted |
| `circuit_open` | Breaker already tripped (§9.4 step 4) | A tool-result string saying this provider is temporarily unavailable | No-op (already open) |
| `ssrf_blocked` | `assertExternalHostAllowed` threw | A tool-result string saying the provider's base URL was rejected | Counts as a failure |
| `invalid_response` | Malformed tool-call JSON, or (reserved for adapter use) a response that can't be normalized | Same | N/A (pre-network) or counts as a failure if the adapter's own HTTP call succeeded but returned unparseable data |
| `daily_cap_exceeded` | Reserved in `types.ts`; the daily-cap check itself is not yet wired into `executeRateToolCall` — `calls_today` is tracked in `rate_provider_health` but nothing currently short-circuits a call once `daily_call_cap` is reached | — | **Known gap**, not yet built — see §10 |

**`executeRateToolCall` never throws.** Every failure mode above returns a structured `RateLookupResult` (`{ ok: false, error, errorCode, latencyMs }`), which `ai-advisor`'s executor callback `JSON.stringify()`s directly into the tool-result message the model receives in Round 2. This is the deliberate design: the model gets an honest, structured description of *why* the lookup failed and can react to it in its final answer (e.g. fall back to its own reasoning for that leg, or note the platform was unavailable) — the request never crashes over one provider's failure, and neither does the `catch` in `callLLMWithTools` need to fire for an ordinary per-provider error (only for a failure in the loop mechanics itself, e.g. a malformed model response).

### 9.6 Current status: one real adapter built, framework otherwise dormant

`_shared/rate-providers/registry.ts`'s `ADAPTERS` map now registers one real adapter (`searates-provider.ts`, §9.8) in addition to the commented-out `example-provider.ts` **template** (never registered; its request/response shapes are made up, not any real platform's actual contract — it exists purely as a copy-from-this-pattern starting point). Concretely, this means:

- `loadTenantRateProviders()` still returns `{ callable: [], unmatchedConfigCount: 0 }` for every tenant today — a code-side adapter existing is necessary but not sufficient; no tenant has actually created a `rate_provider_configs` row for `searates` (or anything else) yet. Doing so is an admin action (real SeaRates account credentials required), not a code change.
- `getRateProviderTool()` therefore still always returns `null`, and `callLLMWithTools()` still always takes its `tools.length === 0` branch — degrading to exactly today's `callLLM()` behavior. **This entire section describes a real, built code path that is not yet reachable in production**, by design: it ships and is verified structurally (§9.7) before any real tenant credential exists, not after.
- **No longer blocked on "what are the 11 platforms"** — the user provided the list (§9.8). It resolved to 6 distinct platforms, of which only one (SeaRates) has public API documentation sufficient to build a real, non-fabricated adapter today. The other 5 remain genuinely blocked, each on the same thing: a sales/demo engagement with that vendor to obtain real API docs and credentials (§9.8's table). This is not a framework gap — the framework is ready for all 6; it's a documentation-availability gap specific to those 5 vendors.

### 9.7 Open risk, not yet load-tested

The combined worst-case wall-clock time for one tool-calling round trip — Round 1 (~19s worst case at the self-hosted rig's measured ~27–28 tok/s and 500-token cap) + parallel external provider calls (bounded by the slowest configured provider's `timeout_ms`, up to 30s per the migration's `CHECK` constraint) + Round 2 (~104s, unchanged from today's plain `logistics.smart_quotes` budget, §3) — could approach or exceed ~150s. It is **unverified** whether the *outer* `ai-advisor` HTTP request (served through `supabase.sosservices.online` / `app.sosservices.online`, not necessarily the same Cloudflare zone as `portal.sosservices.online`, where the 125.1s ceiling in §3 was specifically measured) tolerates that. This risk is currently dormant and untestable precisely because §9.6 means the tool is never actually offered to the model in production yet — it must be measured for real, end-to-end, the moment the first real adapter goes live, not assumed safe by extrapolation from §3's single-call numbers.

### 9.8 The "11 specified third-party quote rate platforms" — research findings

The user supplied 11 numbered URLs. Fetched and read directly (2026-09-11) rather than assumed from training knowledge, since platform API offerings change and this is exactly the kind of fact §4 says must be grounded, not guessed. They resolve to **6 distinct platforms**, not 11 — several numbers were duplicate URLs for the same platform, and two were third-party review articles that name *other* platforms rather than being providers themselves.

| # | URL | Resolves to | API docs public? |
|---|---|---|---|
| 1, 2 | freightify.com, freightify.com/products/api-product | **Freightify** | No — "Access API Documentation" is gated behind booking a demo; only marketing claims (JSON responses, FCL/LCL, sandbox/Swagger environment "available") are public |
| 3 | modaltrans.com/blog/… | *Review article*, not a platform — compares Xeneta, Freightos Terminal, Freightify, Okargo, Cargofive, SeaRates, Freightos.com | N/A |
| 4, 5 | searates.com/integrations/quotation-system-api, /api-individual-quotes | **SeaRates** | **Yes** — real public developer portal at `docs.searates.com` with documented endpoints, auth flow, and field names (§9.6, adapter built) |
| 6, 7 | velocityos.ai/rate-management, /for-freight-forwarders | **VelocityOS** | No — page describes *inbound* carrier integrations (100+ carriers/airlines) it consumes, not an outbound API it exposes to developers; no docs link found |
| 8 | cargorates.ai/platform/API | **CargoRates.ai** | No — confirms an API exists ("rates can be requested and returned programmatically") but zero technical detail; directs to sales contact |
| 9 | cargofive.com/api-integration-erp-tms | **Cargofive** | No — "Seamless ERP/TMS Integrations," no docs link; per the Modaltrans review, Cargofive was acquired by cargo.one in February 2026, which may change (or already have changed) its API surface |
| 10 | freightoscope.com | **Freightoscope** | No — API connectivity mentioned for specific modules (eAWB, tracking) but not for rate quotation specifically; references an unlinked "Technical Guide" |
| 11 | cargoez.com/blog/… | *Review article*, not a platform — names CargoEZ, GoFreight, Quotiss, Freightify, CargoWise, Magaya, Shipthis, Wisor.ai, Logitude World, GoComet, Logistaas | N/A |

**What was built from this (§9.6):** a real `searates-provider.ts` adapter, registered in `registry.ts`. It implements SeaRates' documented three-step flow — geocode origin/destination to a `pointId` (`geocoding.searates.com/autocomplete/compact`), exchange platform credentials for a bearer token (`www.searates.com/auth/platform-token`), then query rates (`rates.searates.com/graphql`) — using the exact endpoints, parameters, and response field names `docs.searates.com` documents. Two details could not be confirmed from public docs and are flagged in the adapter's own header comment rather than silently assumed: the exact JSON field name the token-exchange endpoint returns (handled defensively, trying several plausible shapes), and the literal GraphQL query document shape (constructed from the documented input/output field names, but not shown verbatim anywhere public — validate against SeaRates' own schema on first real test). It remains **dormant** until a tenant admin creates a real `rate_provider_configs` row with actual SeaRates account credentials (§9.6) — nothing here changes production behavior today.

**What was not built, and why:** Freightify, VelocityOS, CargoRates.ai, Cargofive, and Freightoscope. All five confirm an API/integration capability exists in their marketing copy, and all five gate the actual technical contract (auth mechanism, endpoints, request/response shapes) behind a sales or demo engagement — none publish it. Building an adapter for any of them today would mean inventing a request/response shape and presenting it as if verified, which is precisely the failure mode (facts an LLM — or, here, a developer — fabricates instead of looking up) this entire module exists to eliminate. The honest, correct next step for each is the same: someone with a business relationship to that vendor requests their real API documentation, and the adapter gets built from that document the way `searates-provider.ts` was built from SeaRates' public one. The framework (types, registry, orchestrator, tool schema, DB schema, bounded loop) already supports all five without any further changes — only a same-shaped `RateProviderAdapter` file is missing per platform.

---

## 10. Phased roadmap (not built in this pass)

Ordered by leverage-to-effort, not by the order requested in the brief. Item numbers are kept stable across revisions (referenced elsewhere in this doc and in code comments), so a completed item is marked done in place rather than removed or renumbered.

1. ~~Wire `rate-engine`'s live market-rate average into `ai-advisor`'s benchmark context.~~ **Done — §7.2.** Built by querying `carrier_rates` directly, not through `rate-engine`'s HTTP endpoint. Along the way this surfaced a real, pre-existing bug in `rate-engine` itself, since fixed in a follow-up (§7.1): `resolveLocation()` exact-matched the free-text `origin`/`destination` string against `ports_locations.location_code`, but the Smart Quote page sends the display *name*, not the code — so on the common case the match failed silently, `carrier_rates` was never queried, and `rate-engine`'s response was filled entirely with randomly-simulated "MARKET RATE" options with nothing indicating to the frontend or user that they weren't real. Fixed by reading `originDetails.id`/`destinationDetails.id`, a `ports_locations` UUID the frontend already sends, instead of re-resolving a free-text string.
2. **A maintained geopolitical/regulatory advisories table**, replacing the static `MARITIME_REFERENCE` snapshot. Minimal shape: `(id, region, chokepoint, headline, cost_impact_text, transit_impact_text, effective_from, effective_to, source_url)`, admin-editable, queried the same way `buildMaritimeContext` works today (deterministic lookup → injected context, never model-invented). This is the honest way to satisfy "real-time assessment of geopolitical risks" — a maintained table with a human or a real news-API in the loop, not the LLM guessing.
3. **Wire up `public.dynamic_surcharges`** (schema already exists — `fuel`, `security`, `peak_season`, `port_congestion` surcharge types, `validity_period` daterange, `geographic_scope` jsonb — currently populated with placeholder seed data only, not queried anywhere in `ai-advisor`). Extend its `surcharge_type` check constraint to include `canal_fee`, and this becomes the real source for §6's reference data instead of a hardcoded constant, with a genuine refresh workflow instead of a doc-comment reminder.
4. **A real port/region lookup for chokepoint detection**, replacing the keyword heuristic in §6, using `ports_locations`' existing country/type columns (or a small dedicated routing table) to determine actual likely canal transit rather than string matching on origin/destination text.
5. **Duty/tax reconciliation.** Currently ungrounded and unreconciled — same category of risk the charges-arithmetic bug (audit doc §10) was, just not yet measured. Worth a dedicated sampling pass before trusting it in a client-facing quote.
6. **Predictive/ML cost modeling.** Out of scope for a prompt-and-reference-data pass entirely — this is a genuine time-series/ML project (rate trend forecasting from `platform.llm_usage`-adjacent cost history, or a proper freight-index feed), not something either the LLM or a static reference table can deliver.
7. **Wire the daily call cap into `executeRateToolCall`.** `rate_provider_configs.daily_call_cap` and `rate_provider_health.calls_today`/`calls_today_date` already exist and are maintained, but nothing yet compares one against the other before a call — `daily_cap_exceeded` (§9.5) is a defined error code with no code path that produces it. Needed before any real adapter with a metered/paid per-call third-party API goes live, to avoid an unbounded per-tenant bill.
8. **A more gradual circuit-breaker retry (`half_open`).** The DB schema already reserves the `half_open` status value; today a provider goes straight from `open` back to fully callable the instant `open_until` passes, with no single-probe-before-resuming-full-traffic step. Worth adding once real provider call volume exists to observe whether the current binary behavior causes flapping.
9. **Build real adapters for the remaining 5 named platforms** (Freightify, VelocityOS, CargoRates.ai, Cargofive, Freightoscope — §9.8). SeaRates (the 6th) is done. Each of the remaining 5 needs someone with a business relationship to that vendor to obtain their real API documentation first — building against public marketing pages alone would mean fabricating the contract, which §9.8 explains this project won't do.
10. **Validate `searates-provider.ts`'s one unverified detail** (the GraphQL query body, §9.6/§9.8) against SeaRates' real schema, and add token caching, the first time a tenant actually configures a real SeaRates account — don't wait for a production incident to discover a wrong field name.

None of these are required for the v3 prompt to be a real, verified improvement over v2, or for §9's tool-calling framework to be a real, complete, and safe implementation of the architecture the user explicitly chose — they're what "comprehensive" actually requires, sequenced by what's achievable without a larger architecture change.

---

## 11. Maintenance requirements

- **`MARITIME_REFERENCE` (ai-advisor/index.ts) needs periodic re-verification.** It is a snapshot dated 2026-09-11, not a feed. Recommended cadence: monthly, or immediately on any Suez Canal Authority circular / Panama Canal Authority (ACP) toll notice / material change in Red Sea security posture. Primary sources to re-check: [SCA Tolls Table](https://www.suezcanal.gov.eg/English/Navigation/Tolls/Pages/TollsTable.aspx), [ACP toll structure](https://porteconomicsmanagement.org/pemp/contents/part1/interoceanic-passages/panama-canal-toll-structure/), and a current Red Sea shipping status source (e.g. Lloyd's List Intelligence's Red Sea Brief series). Bump `MARITIME_REFERENCE.sourcedAt` on every update, and update this doc's §6 sourced figures to match.
- **Re-run the sampling verification (audit doc §10's methodology) whenever the prompt changes.** 8+ samples per provider, checking (a) `total == sum(legs[].charges)`, (b) `carrier.name` matches the main leg's own carrier, (c) — new for v3 — that maritime context, when injected, is actually reflected in the output and not contradicted. A single live test is a smoke test, not a verification; today's numbers (16.7–37.5% mismatch rates) only surfaced at a sample size of 8+ per provider.
- **Any future schema change to `logistics.smart_quotes` must re-verify the token budget** against the current measured throughput (§3) before shipping — throughput can change if the self-hosted deployment's hardware or model changes, and a schema that fit at 2,800 tokens today is not guaranteed to fit forever without re-checking the underlying math.
- **The first real rate-provider adapter that goes live must re-measure §9.7's latency risk end-to-end** before being trusted in production — with real network latency to a real third-party platform, not assumed from §3's single-call numbers.

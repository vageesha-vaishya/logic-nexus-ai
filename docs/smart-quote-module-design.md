# Smart Quote Module — Design & LLM Prompt Documentation

**Status:** v3 prompt live in production (`logistics.smart_quotes`, version `v3-2026-09-11`)
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
| Peak season surcharge | Not currently modeled | ❌ Not in scope of this pass — candidate for Phase 2 (§9), same pattern as canal fees once a reference source exists |
| Duties / taxes | `price_breakdown.taxes` | ⚠️ Model-generated, currently almost always 0 in practice; not reconciled against any reference — flagged as a Phase 2 gap, not fixed here |
| Port congestion surcharge | Not currently modeled | ❌ Phase 2 candidate — `public.dynamic_surcharges` (see §9) already has a `port_congestion` surcharge type in its schema, unused |

---

## 6. Maritime chokepoint reference (Suez / Panama)

### What's implemented

`supabase/functions/ai-advisor/index.ts` now has:

- **`MARITIME_REFERENCE`** — a dated, sourced constant (see below for the actual content and sources). This is a **snapshot, not a feed** — see §10 for the required refresh cadence.
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

Two mechanisms, one already in place, one added today:

1. **Market-rate comparison (already exists, not built in this pass).** `rate-engine` computes real carrier options (`carrier_rates` contract/spot rates, or a simulated spread when no contract exists) and the frontend renders them alongside the AI options in the same result set, labeled "MARKET RATE" vs. "AI GENERATED." This *is* the competitive benchmark the business objective asks for — it's driven by rate-engine's own data, not something the LLM needs to know or invent.

2. **Internal historical benchmark (new, `buildBenchmarkContext`).** `ai-advisor` already queried the tenant's own `rates` table for a historical average on this lane (`historicalAvg`) but only used it as loose "context text" the model could take or leave. It's now turned into an explicit instruction: price `cheapest` at or below this figure, `best_value` within a reasonable band above it — and, symmetrically, the prompt explicitly forbids inventing a competitor's price or naming a specific competitor, since the model has no real data on either.

**What this does not do:** it does not give the AI options access to rate-engine's live market-rate numbers, because `rate-engine` and `ai-advisor` are called as two parallel, independent requests from the frontend today — `ai-advisor` has no access to rate-engine's results at generation time. Wiring that in (sequencing the calls, or having `ai-advisor` query `carrier_rates` itself) is a real, valuable next step — see §9 — not done in this pass because it changes call sequencing/latency behavior beyond "refine the prompt," and deserves its own verification pass the way today's fixes each got one.

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

## 9. Phased roadmap (not built in this pass)

Ordered by leverage-to-effort, not by the order requested in the brief:

1. **Wire `rate-engine`'s live market-rate average into `ai-advisor`'s benchmark context.** Currently `buildBenchmarkContext` only sees the tenant's own historical `rates` table. Sequencing (or duplicating) a lightweight `carrier_rates` query inside `ai-advisor` would let `${benchmark_context}` reflect *today's* real competitor rates, not just this tenant's past quotes — directly closes the "benchmark against competitor pricing" requirement with real data instead of a proxy.
2. **A maintained geopolitical/regulatory advisories table**, replacing the static `MARITIME_REFERENCE` snapshot. Minimal shape: `(id, region, chokepoint, headline, cost_impact_text, transit_impact_text, effective_from, effective_to, source_url)`, admin-editable, queried the same way `buildMaritimeContext` works today (deterministic lookup → injected context, never model-invented). This is the honest way to satisfy "real-time assessment of geopolitical risks" — a maintained table with a human or a real news-API in the loop, not the LLM guessing.
3. **Wire up `public.dynamic_surcharges`** (schema already exists — `fuel`, `security`, `peak_season`, `port_congestion` surcharge types, `validity_period` daterange, `geographic_scope` jsonb — currently populated with placeholder seed data only, not queried anywhere in `ai-advisor`). Extend its `surcharge_type` check constraint to include `canal_fee`, and this becomes the real source for §6's reference data instead of a hardcoded constant, with a genuine refresh workflow instead of a doc-comment reminder.
4. **A real port/region lookup for chokepoint detection**, replacing the keyword heuristic in §6, using `ports_locations`' existing country/type columns (or a small dedicated routing table) to determine actual likely canal transit rather than string matching on origin/destination text.
5. **Duty/tax reconciliation.** Currently ungrounded and unreconciled — same category of risk the charges-arithmetic bug (audit doc §10) was, just not yet measured. Worth a dedicated sampling pass before trusting it in a client-facing quote.
6. **Predictive/ML cost modeling.** Out of scope for a prompt-and-reference-data pass entirely — this is a genuine time-series/ML project (rate trend forecasting from `platform.llm_usage`-adjacent cost history, or a proper freight-index feed), not something either the LLM or a static reference table can deliver.

None of these are required for the v3 prompt to be a real, verified improvement over v2 — they're what "comprehensive" actually requires, sequenced by what's achievable without a larger architecture change.

---

## 10. Maintenance requirements

- **`MARITIME_REFERENCE` (ai-advisor/index.ts) needs periodic re-verification.** It is a snapshot dated 2026-09-11, not a feed. Recommended cadence: monthly, or immediately on any Suez Canal Authority circular / Panama Canal Authority (ACP) toll notice / material change in Red Sea security posture. Primary sources to re-check: [SCA Tolls Table](https://www.suezcanal.gov.eg/English/Navigation/Tolls/Pages/TollsTable.aspx), [ACP toll structure](https://porteconomicsmanagement.org/pemp/contents/part1/interoceanic-passages/panama-canal-toll-structure/), and a current Red Sea shipping status source (e.g. Lloyd's List Intelligence's Red Sea Brief series). Bump `MARITIME_REFERENCE.sourcedAt` on every update, and update this doc's §6 sourced figures to match.
- **Re-run the sampling verification (audit doc §10's methodology) whenever the prompt changes.** 8+ samples per provider, checking (a) `total == sum(legs[].charges)`, (b) `carrier.name` matches the main leg's own carrier, (c) — new for v3 — that maritime context, when injected, is actually reflected in the output and not contradicted. A single live test is a smoke test, not a verification; today's numbers (16.7–37.5% mismatch rates) only surfaced at a sample size of 8+ per provider.
- **Any future schema change to `logistics.smart_quotes` must re-verify the token budget** against the current measured throughput (§3) before shipping — throughput can change if the self-hosted deployment's hardware or model changes, and a schema that fit at 2,800 tokens today is not guaranteed to fit forever without re-checking the underlying math.

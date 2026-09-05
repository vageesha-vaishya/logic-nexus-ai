# AI/LLM Audit — Findings

**Date:** 2026-09-05
**Scope:** the `logic-nexus-ai` product and its full deployment surface, plus the shared vLLM rig at `vllm.sosservices.online`.
**Method:** observational plus safe live probes. No exploitation, no auth-bypass attempts, nothing active against Supabase Cloud production. Secret names and locations recorded; no values.
**Spec:** `docs/superpowers/specs/2026-09-05-ai-llm-audit-design.md`
**Source workstreams:** `docs/audits/workstream-1-gateways.md`, `-2-edge-functions.md`, `-3-client.md`, `-4-topology.md`, `-5-workloads-observability.md` — each finding's full evidence lives in its workstream file; this report cites but does not duplicate all of it.

---

## Correction notice — 2026-09-05 (post-audit)

A post-audit check found that the original reachability analysis missed an entire enforcement layer. The self-hosted functions container does not serve functions individually; it runs a single router, `supabase/functions/main/index.ts`, in front of every function. That router enforces JWT per function against `supabase/functions/main/verify_jwt_map.ts` — an 85-entry map, every entry `false`, that defaults any function **not** listed to requiring a valid JWT (`main/index.ts:336`, `VERIFY_JWT_MAP[name] !== false`). The original audit read `config.toml`, `FUNCTIONS_VERIFY_JWT`, and Kong's route plugins, concluded the platform-level gate was off, and stopped there — without tracing what actually receives the request on this deployment. It never opened `main/index.ts`.

This is corrected below, in place, rather than in a changelog at the end, because it changes findings a reader may already have acted on. Three findings were materially wrong:

- **F-2.1 (`ai-advisor`)** — Critical stands, and its cross-tenant-read claim is upgraded from *inferred* to *observed*.
- **F-2.2 (`generate-embedding`)** — downgraded from **Critical to Medium**. It is not anonymously reachable: it is absent from `VERIFY_JWT_MAP`, so the router's default requires a valid JWT. It still has no in-body auth check and performs unguarded service-role writes, which remains a real defense-in-depth gap.
- **F-2.9 (platform-wide JWT default)** — downgraded from **High to Medium**. `FUNCTIONS_VERIFY_JWT=false` is real, but the router re-implements per-function enforcement on top of it, defaulting to *on*. Only the 85 functions explicitly listed `false` skip the router's check; the rest are gated regardless of the platform flag.

The executive summary's "three anonymously invocable functions" count is also revised — see below. Severity distribution and the P0 roadmap are updated accordingly. A methodology note is added to §6.

**Lesson generalized:** the audit inferred reachability from configuration layers without tracing the actual request path, and so missed the layer that actually enforces auth on this deployment. For a reachability question, trace the request path end to end — a stack of config values is not the same as the code that runs.

---

## 1. Executive summary

**39 findings: 1 Critical, 11 High, 14 Medium, 8 Low, 5 Informational.** *(Revised 2026-09-05 — see correction notice above. Original tally: 2 Critical, 12 High, 12 Medium, 8 Low, 5 Informational; no findings were added or removed, two were reclassified.)*

Three conclusions matter more than the rest.

**The governance you have is not running, and the thing that is running has none.** Three separate components in this codebase are named "LLM gateway." The most capable one — `services/llm-gateway`, 6,726 LOC, with working auth, audit, budget, PII-redaction and right-to-erasure modules — **is not deployed anywhere observed**. The one actually serving production traffic is an 863-LOC edge-function module with no PII redaction, no budget enforcement, and no erasure path of its own. A reasonable person reading this repo would conclude the platform is well-governed. It is not: the controls are all in the component that doesn't run.

**Two AI functions are anonymously invocable — re-derived against the actual enforcement layer, not assumed.** The self-hosted router (`main/index.ts`) gates each function against `VERIFY_JWT_MAP`. `ai-advisor` is listed `false` there, and its own body (`ai-advisor/index.ts:50-53`) logs a warning and *continues* rather than rejecting when auth fails — genuinely anonymously invocable. It queries an unscoped `rates` table with a service-role client (`serveWithLogger` injects `SUPABASE_SERVICE_ROLE_KEY` — see `_shared/logger.ts:210-211`, which bypasses RLS) and feeds the result to OpenAI; `rates` has both `tenant_id` and `franchise_id` columns and the query filters on neither, so the cross-tenant read is now **observed** from schema and code, not inferred from the missing filter as originally stated. `portal-chatbot` is also listed `false` and its body likewise swallows auth failures rather than rejecting them — but its data access is token-scoped (`get_quote_by_token`) and its prompts pass through `sanitizeForLLM` (F-2.6); this was already correctly framed as deliberate and stays that way. `generate-embedding` is **not** in `VERIFY_JWT_MAP`, so the router's default applies and it requires a valid JWT — contrary to the original Critical finding, it is **not** anonymously invocable today. It still deserves attention: its body has zero auth constructs of its own and performs service-role writes (`admin.from("knowledge_base").update(...)`, `admin.from("master_hts").update(...)`), so it has no second line of defense if it is ever added to the map or the router's default ever changes; it also has no caller anywhere in the codebase today. Every other AI function was checked and has an in-body auth hard-fail; `ai-advisor` and `portal-chatbot` are the only two where the router's gate is off, and only `ai-advisor` lacks a compensating code-level check outright.

**Nobody can answer "what did we spend on AI last month."** AI usage data is scattered across at least four disconnected schemas, most empty. The most complete ledger (`platform.llm_usage`, 1,459 rows, $0.086959 lifetime) has recorded nothing since 2026-06-30. The one purpose-built cost dashboard is hardcoded to return HTTP 503 because its backend is the gateway that was never deployed. Querying August 2026 today returns $0 — indistinguishable from "we spent nothing."

One piece of good news, verified rather than assumed: **no AI provider credential is present in the live production JavaScript bundle** (`/assets/index-BAs43-cJ.js`, 1,164,472 bytes, scanned, count 0). And the vLLM rig is properly gated on the three endpoints probed for auth — `/v1/models`, completions, and `/control/status` all return 401 — though `/healthz` leaks GPU/proxy telemetry unauthenticated and the root page discloses the control-token env var name and API shape (F-4.4, F-4.5).

---

## 2. Inventory map

### The three "LLM gateways"

This name collision is itself a finding, and no single workstream could see all three — W1 found the first two, W4 independently documented `markets-worker`'s `llm_gateway.py` from the deployment side, and W5's cost-ledger trail led to naming it as the third.

| # | Component | Size | Status | Governance |
|---|---|---|---|---|
| 1 | `services/llm-gateway` (Express/TS) | 6,726 LOC, 57 files | **Not deployed anywhere observed.** No container among 78 on the VPS; no compose entry. Deployment *history* prior to this audit was not checked (see §6) | auth, audit, budgets, PII, RTBF, prompts, finetune, embeddings — all wired, all inert |
| 2 | `supabase/functions/_shared/llm-gateway.ts` (Deno) | 863 LOC | **Live and authoritative.** Config RPC last read 2026-09-01 06:47 | Tenant config resolution + BYOK vault. No PII redaction, no budget enforcement, no erasure path |
| 3 | `services/markets-worker/src/markets_worker/llm_gateway.py` (Python) | — | Container up 3 days, but **silent 2+ months** | Writes the only real per-call cost ledger — last row 2026-06-30 |

### AI/LLM surface

*Denominator note: the spec's "156" figure and this report's "152" are the same count, reconciled by W2 — `supabase/functions/` has 156 top-level entries, 4 of which (`_shared/`, `deno.json`, `import_map.json`, `types.d.ts`) are not functions. 152 is the correct function count.*

| Surface | Count / state |
|---|---|
| Edge functions calling AI/ML | **38 of 152** (repo); **20 confirmed live on self-host** — 18 of the 38 are marked not-deployed in W2's per-function table (15 dormant `LLM_GATEWAY_URL` functions, plus `container-demand`, `forecast-demand`, `route-optimization`) |
| — routed via `_shared/llm-gateway.ts` | 4 (all `markets-*`) |
| — routed via `_shared/model-router.ts` | 4 |
| — targeting the undeployed `LLM_GATEWAY_URL` service | 15 (dormant — neither caller nor callee deployed) |
| — **direct provider call, no shared layer** | **15 of 38 (39%)** — the shadow-AI bucket (13 of these 15 are live) |
| Browser-originating AI paths | 6 (see §4) |
| Providers with keys provisioned | OpenAI, Google/Gemini, vLLM. **Anthropic and Mistral: no provisioned key value found in any credential store** (local `env`, self-host `.env`, or any of 25 Coolify apps — W4), despite code support. Note: W1 separately found the `ANTHROPIC_API_KEY` env-var *name* (not its value) present on the live functions container — consistent with routing code that references it even though no real credential backs it anywhere. |
| Non-LLM AI | `timesfm-service` (**actually Holt-Winters smoothing, not TimesFM**; dev-only, not in production); pgvector columns on 6 tables, **0% populated** |
| "AI"-branded features that use no model at all | Several scoring functions are hand-tuned weighted sums |

---

## 3. Findings by severity

Critical and High are given in full below. Medium, Low and Informational are indexed with pointers — full evidence for every finding is in its workstream file.

### Critical (1)

**F-2.1 — `ai-advisor` is live, publicly invocable, and queries an unscoped `rates` table with a service-role client, feeding the result to OpenAI.**
*Revised 2026-09-05 — see correction notice.* Evidence: `supabase/functions/main/verify_jwt_map.ts` lists `"ai-advisor": false`, so the self-hosted router (`main/index.ts:336`, `VERIFY_JWT_MAP[name] !== false`) skips its JWT check entirely; the function's own auth branch (`ai-advisor/index.ts:50-53`) then logs a warning and continues rather than rejecting when `requireAuth` fails. `serveWithLogger` (`_shared/logger.ts:210-211`) builds its Supabase client with `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS; the `rates` query (`ai-advisor/index.ts:266-272`) filters on `mode`, `origin`, and `destination` but on neither `tenant_id` nor `franchise_id`, both of which exist as columns on that table. Anonymous invocability and the cross-tenant read are both now **observed** — from router code, function code, and schema — where the original finding correctly identified the vulnerability but understated its certainty (it had called both "inferred"). Reachability from the open internet is still separately *inferred* — see the Unknowns section.

### Corrected findings (moved out of Critical/High — full text retained given their significance)

**F-2.2 — `generate-embedding` has no in-body authentication and performs unguarded service-role writes, but is not anonymously reachable. Downgraded from Critical to Medium.**
*Revised 2026-09-05 — see correction notice.* `generate-embedding` does **not** appear in `supabase/functions/main/verify_jwt_map.ts`. The router's lookup (`main/index.ts:336`) defaults anything absent from the map to requiring a valid JWT, so the self-hosted router returns 401 to an unauthenticated caller before the function body ever runs. The original Critical rating assumed the platform-wide `verify_jwt=false` default applied here directly; it does not, because the router re-implements enforcement independently of that flag (see F-2.9, also revised below). The underlying code-level observation still stands and is still worth recording: the function body has zero auth constructs of its own, and it performs service-role writes — `admin.from("knowledge_base").update(...)` (lines 46, 61) and `admin.from("master_hts").update(...)` (lines 78, 93) — using the same service-role client pattern as `ai-advisor`. **Severity: Medium, not Low**, because that missing in-body check is a real defense-in-depth gap with no second line of protection: if this function is ever added to `VERIFY_JWT_MAP`, or if the router's default is ever changed or bypassed, there is nothing in the function itself to stop an anonymous caller from spending AI budget and writing to `knowledge_base`/`master_hts`. Mitigating the severity further: `generate-embedding` has no caller anywhere in the codebase today — only its own registration in `supabase/functions/main/function_importers.ts:125` — so current blast radius is effectively zero, which is why this is Medium and not High.

**F-2.9 — Platform-wide `FUNCTIONS_VERIFY_JWT=false` is real, but the self-hosted router re-implements per-function enforcement on top of it, defaulting to on. Downgraded from High to Medium.**
*Revised 2026-09-05 — see correction notice.* `FUNCTIONS_VERIFY_JWT=false` and the absence of a `key-auth` plugin on Kong's `functions-v1` route (both still directly observed in live config) are real, but they are not the operative control on this deployment: `supabase/functions/main/index.ts` sits behind Kong as the single router for every function, and independently enforces JWT per function against `verify_jwt_map.ts` — 85 entries, all `false`, and *anything not listed defaults to requiring a valid JWT* (`main/index.ts:336`). The original framing — "every deployed function that does not perform its own in-body auth check is affected" — is wrong: only the 85 functions explicitly listed `false` skip the router's check; the other 67-plus are gated regardless of the platform flag. This is also why F-2.7's original framing ("per-function `verify_jwt` overrides are dead weight … not the operative control on self-host") is superseded: the map derived from those overrides *is* the operative control — the audit had it backwards. Downgraded to Medium because the practical exposure is far narrower than originally described, but it stays above Low: the platform flag being off with no Kong-level compensating control means the 85-entry map is now a single, easily-overlooked file carrying real security weight, with no drift-detection against `config.toml` and (evidenced by this very correction) no guarantee a future reviewer will find it. Deciding the platform auth default explicitly — rather than leaving it to an undocumented snapshot file — remains a legitimate P0 item; see the roadmap.

### High (11)

**F-1.1 — The 863-LOC edge gateway serves production; the 6,726-LOC Express service has not run anywhere observed.** `platform.llm_provider_configs` default row shows `last_used_at = 2026-09-01 06:47:04+00`, and only the edge module calls the RPC that updates it. No matching container among 78 on the VPS. *Observed*; the causal attribution of the timestamp is *inferred*.

**F-1.2 — The live gateway has no PII redaction and no budget enforcement of its own.** Both exist only in the service that isn't running.

**F-1.4 — The Express service's service-token auth defaults to fully open** unless an operator explicitly sets `LLM_GATEWAY_AUTH_MODE=enforced`. Latent today (it isn't deployed); a trap the moment anyone deploys it.

**F-2.3 — 15 of 38 AI-calling functions (39%) bypass every shared layer.** The headline shadow-AI number.

**F-2.6 — `portal-chatbot` is intentionally public** and can be invoked to spend AI budget with no credentials. Its router-level gate is off (`VERIFY_JWT_MAP["portal-chatbot"] === false`) and its body likewise does not hard-fail on missing auth — the same shape as `ai-advisor` — but its exposure is deliberately bounded by token-scoped data access and `sanitizeForLLM`, which is why this stays High rather than Critical.

**F-3.1 / F-3.2 — Two client-side call sites fall back to a browser-held OpenAI key** (`useAiAdvisor.ts:40`, `EmailToLeadDialog.tsx:182`). `VITE_OPENAI_API_KEY` is currently unset in the production build env, so this is latent, not live — but any `VITE_*` var is inlined into the public bundle, so setting it once publishes the key to every visitor. The server-side primary path for the second call site (`suggest-transport-mode`) does not apply PII scrubbing either — W2's per-function table marks it `pii-guard: No` — so the email content in play is unscrubbed regardless of which path handles it.

**F-4.7 — `VITE_OPENAI_API_KEY` is a client-inlined credential path by construction.** Rated High regardless of current unset state, per this audit's standing rule.

**F-5.3 — AI usage/cost data is fragmented across at least four disconnected schemas**, most empty or near-empty (`platform.*`, `core.*`, `gateway.*`, legacy `public.ai_audit_logs`).

**F-5.4 — Only 2 of 27 edge functions that import the AI-audit helper have ever logged a call.** Writes stopped 2026-05-20.

**F-5.5 — The one purpose-built AI cost dashboard is hardcoded to fail in production**, because its backend is the never-deployed gateway.

### Medium (14), Low (8), Informational (5) — index

| ID | Title | Severity | File |
|---|---|---|---|
| F-1.6 | RTBF/erasure exists only in the unused service | Medium | W1 |
| F-2.2 | `generate-embedding`: no in-body auth check, unguarded service-role writes, but not anonymously reachable (absent from `VERIFY_JWT_MAP`, router requires JWT) — **revised 2026-09-05, was Critical**, full text above | Medium | W2 |
| F-2.4 | `nexus-copilot` imports a shared helper but bypasses it for the actual generation call | Medium | W2 |
| F-2.5 | The whole `LLM_GATEWAY_URL` pathway (15 functions) targets a service that doesn't exist | Medium/Info | W2 |
| F-2.7 | Per-function `verify_jwt` overrides, once assumed dead weight, are in fact the operative control via the `main` router's `VERIFY_JWT_MAP` — **revised 2026-09-05**; the map itself is an undocumented, easily-overlooked snapshot with no drift-detection against `config.toml` | Medium | W2 |
| F-2.9 | Platform-wide `FUNCTIONS_VERIFY_JWT=false` is real, but the `main` router re-implements per-function enforcement defaulting to on — only the 85 map-listed functions skip it — **revised 2026-09-05, was High**, full text above | Medium | W2 |
| F-4.3 | `markets-worker` has two declared deploy targets; only one confirmed live | Medium | W4 |
| F-4.4 | vLLM `/healthz` unauthenticated, leaks GPU/proxy telemetry | Medium | W4 |
| F-4.6 | No per-tenant credential/quota segregation on the vLLM fallback path | Medium | W4 |
| F-4.9 | Provider API keys were excluded from the 2026-09-01 credential rotation | Medium | W4 |
| F-5.1 | "TimesFM" is Holt-Winters smoothing, and isn't deployed | Medium | W5 |
| F-5.2 | markets-worker's cost ledger is well-built but silent 2+ months | Medium | W5 |
| F-5.6 | pgvector columns on 6 active tables, 0% populated | Medium | W5 |
| F-5.9 | Nobody can answer "what did we spend on AI last month" | Medium | W5 |
| F-1.3 | "vLLM" means two different things; one is a dead type reference | Low | W1 |
| F-1.5 | Two live tables named `llm_provider_configs` in different schemas | Low | W1 |
| F-2.8 | `forecast-demand`'s internal-model fallback can't resolve, so OpenAI is the de facto default | Low | W2 |
| F-3.4 | `NexusCopilotWidget.tsx` is orphaned client code calling an edge function with no auth header (the function itself hard-fails on unauthenticated calls per W2's table, so this is currently inert either way) | Low | W3 |
| F-4.1 | `services/llm-gateway` has zero live deployment footprint | Low | W4 |
| F-4.2 | `timesfm-service` is dev-compose only | Low | W4 |
| F-4.5 | vLLM root page discloses the control-token env var name and control API shape | Low | W4 |
| F-5.8 | The general-purpose mutation-audit table is also effectively unused | Low | W5 |
| F-3.3 | **Live bundle scan: no AI credential found** (count 0) | Info | W3 |
| F-3.5 | Browser fetches OpenRouter's public model catalog directly | Info | W3 |
| F-3.6 | Markets LLM settings keys are vaulted server-side, not client-side — good practice | Info | W3 |
| F-4.8 | No Anthropic/Mistral keys provisioned anywhere, despite code support | Info | W4 |
| F-5.7 | Several "AI"-branded scoring functions are plain weighted sums, no model | Info | W5 |

---

## 4. Fragmentation and shadow-AI analysis

This section is synthesis — no single workstream could produce it.

### Five distinct paths to a provider

1. `_shared/llm-gateway.ts` — 4 `markets-*` functions. Tenant config + BYOK vault. **Live.**
2. `_shared/model-router.ts` — 4 functions. 33 LOC (controller-verified via `wc -l` during synthesis; not recorded in any workstream file), hardcoded models/URLs, reads `OPENAI_API_KEY` directly. **Live.**
3. `LLM_GATEWAY_URL` → `services/llm-gateway` — 15 functions. **Dormant: neither caller nor callee deployed.**
4. **Direct provider call, no shared layer — 15 functions.** Shadow AI.
5. Browser-originating — 6 paths, of which two (`useAiAdvisor`, `EmailToLeadDialog`) carry a direct-to-OpenAI fallback that bypasses every server-side control by construction.

Path 1's actual provider is not fixed by the code: `markets-llm-config` lets tenant/franchise/platform admins register their own provider credentials into Supabase Vault, consumed by `_shared/llm-gateway.ts`'s tenant-config resolution step, so which provider a given `markets-*` call hits can vary per tenant at runtime and isn't determinable from reading the function code alone — don't read B1 as "always Anthropic."

Plus `TIMESFM_URL` as an internal, non-third-party model path — architecturally distinct and, as W2 correctly argued, not fairly scored alongside a raw OpenAI call.

### The governed fraction

**Stated carefully, because the denominator matters and it would be easy to overstate.** Of 38 AI-calling functions in the repo, 15 (39%) bypass every shared layer at the repo level. But 18 of the 38 are not deployed to self-host at all — the 15 dormant `LLM_GATEWAY_URL` functions plus `container-demand`, `forecast-demand`, and `route-optimization` (verified against W2's per-function table) — leaving **20 live**. Of those 20, 13 call providers directly with no shared layer: **65%, a clear majority.** Measuring *production* exposure rather than *repository* exposure sharpens this conclusion rather than softening it: **the majority of live AI traffic flows through no governed path at all**, and the paths that do exist (1 and 2) provide tenant routing but neither PII redaction nor budget enforcement.

The precise per-function classification is in W2's `## Complete per-function table`.

### Reconciliations — and one that stays open

**The `last_used_at` / stale-ledger tension is a genuine, unresolved W1↔W5 contradiction about who writes the ledger — not something this synthesis can adjudicate.** W1 found the config RPC last read `2026-09-01 06:47:04.766+00`; W5 found `platform.llm_usage` (the cost ledger) silent since `2026-06-30`. An earlier pass at this synthesis resolved the gap by asserting a clean component split — the Deno edge gateway reads config, the Python markets-worker gateway writes the ledger — but W1's own text contradicts that: its inventory row for `_shared/llm-gateway.ts` ends "...writes `platform.llm_usage`," and its capability table gives the edge gateway's Audit column as "Writes `platform.llm_usage` … awaited before returning." W5, independently, says the table is written **exclusively** by `llm_gateway.py`'s `_write_usage()`. Two workstreams describe the same table and disagree about which component writes it; that disagreement is recorded here rather than resolved by picking a side.

**The sharper, better-evidenced finding is a same-second correlation.** W5's F-5.8 gives `platform.access_log`'s last write as `2026-09-01 06:47:04+00` — the same second as W1's `last_used_at = 2026-09-01 06:47:04.766+00`. A `markets-*` invocation demonstrably occurred at that moment and left an access-log row, but `platform.llm_usage` has no row anywhere near that timestamp — its last row is nearly ten weeks earlier, on 2026-06-30. A confirmed invocation with no corresponding usage row is real regardless of which component is supposed to be writing the ledger. Two Unknowns follow from this, both carried into §6: which component actually writes `platform.llm_usage`, and why the 2026-09-01 invocation produced no usage row.

**F-4.6 stays Medium — adjudicated, not deferred.** W4 flagged that its severity should drop if per-tenant override rows were in active use. They partly are: `platform.llm_provider_configs` holds 2 rows, both tenant-scoped, 1 marked default — controller-verified during synthesis via `select count(*) as total, count(tenant_id) as with_tenant, count(*) filter (where is_default) as default_rows from platform.llm_provider_configs;` → `2 | 2 | 1` (this query and its result are not recorded in any workstream file). But F-4.6 concerns the *vLLM fallback* path specifically, which resolves from process-global `VLLM_BASE_URL`/`VLLM_API_KEY`/`VLLM_MODEL_NAME` env vars with no tenant dimension. Tenant rows govern the primary path, not the fallback. The finding stands as written.

**A third disagreement, left open rather than resolved: which path is actually live for the `markets-*` gateway's fallback chain.** W4's F-4.8 states that because no `ANTHROPIC_API_KEY` is provisioned anywhere, Anthropic-first routing in `_shared/llm-gateway.ts` "always falls through to the vLLM rig in this deployment." W1's F-1.3 instead infers that the `gemini` tenant-config row (`is_default=true`, recent `last_used_at`) wins before the fallback chain is ever reached, so the vLLM/`local-qwen` branch is rarely or never exercised. Both cannot be the live behavior at once, and neither workstream traced an actual request through the resolver to settle it — recorded as an open Unknown (see §6), not adjudicated here. It bears on severity: F-4.6 is rated Medium partly on the assumption that the vLLM fallback is a rarely-taken path; if W4's reading is correct and the shared-credential vLLM path is actually the de-facto live route for every tenant without an explicit override, F-4.6 argues **up**, not down.

### The severity nuance that must not be flattened

*Revised 2026-09-05 — see correction notice.* `FUNCTIONS_VERIFY_JWT=false` (F-2.9) is a platform-wide condition, but it was never "therefore everything is Critical" — and it turns out to be narrower than the original audit believed, not broader. The self-hosted `main` router re-implements per-function JWT enforcement via `VERIFY_JWT_MAP`, defaulting to **on**; only the 85 functions explicitly listed `false` skip it. Every AI function was checked at the code level; all but two (`ai-advisor`, `portal-chatbot`) have an in-body auth hard-fail that compensates even when the router's gate is off. Of those two, `portal-chatbot` (F-2.6) deliberately and scopedly permits anonymous access rather than lacking a control outright — its exposure is bounded by a caller-supplied token and PII sanitization. `ai-advisor` (F-2.1) is Critical precisely because it is the one place where the router's gate is off *and* the application code provides no compensating control of any kind — unintended, unscoped anonymous access with a service-role client. `generate-embedding` (F-2.2), previously grouped with `ai-advisor` as Critical, is **not** in `VERIFY_JWT_MAP` at all, so the router's default requires a valid JWT — it is downgraded to Medium as a defense-in-depth gap, not an open door. Flattening this would misdirect remediation toward 38 functions (or, in the original error's direction, toward two functions when only one is truly urgent) when 1 needs urgent attention, 1 has a real but bounded latent gap, 1 is a deliberate policy call (`portal-chatbot`), and the platform default is a tractable, function-by-function review of an 85-entry map rather than an all-or-nothing decision.

---

## 5. Prioritized remediation roadmap

Ordered by severity × how many other findings each unblocks.

### P0 — Immediate (days), feeds sub-project C

1. **Close `ai-advisor`** (F-2.1). Add an in-body auth hard-fail; scope its `rates` query to the caller's tenant (`tenant_id`/`franchise_id` both exist as columns and neither is filtered — now confirmed from schema, not just inferred from the missing filter). This is the one function that is both live and missing a compensating in-body auth check on a platform where the router's gate for it is confirmed off — internet reachability is still inferred, not proven (see §6). **Add an in-body auth check to `generate-embedding`** (F-2.2) too, as a defense-in-depth fix — it is not currently reachable without a valid JWT, but it has no second line of defense if that ever changes, and the fix is cheap.
2. **Decide the platform auth default, as a per-function review of `VERIFY_JWT_MAP` — not an all-or-nothing env flag** (F-2.9, F-2.7). The real artefact governing self-hosted auth is `supabase/functions/main/verify_jwt_map.ts`, an 85-entry map, not `FUNCTIONS_VERIFY_JWT` alone — that flag governs a platform-level check the `main` router already supersedes. Review the 85 entries function by function: for each, either add/confirm an in-body auth check, or document why anonymous access is intentional (as it is for `portal-chatbot`). Separately, decide whether to also flip `FUNCTIONS_VERIFY_JWT` on or add Kong `key-auth` as defense-in-depth on top of the map, so the map is not the only thing standing between the internet and 85 functions.
3. **Remove the client-side OpenAI fallback entirely** (F-3.1, F-3.2, F-4.7). Deleting the code path is stronger than relying on a variable staying unset, and closes the trap permanently.

### P1 — Consolidation (sub-project B)

4. **Pick one gateway and mean it** (F-1.1, F-1.2, F-2.5, F-5.5). The decision is genuinely open: harden the live 863-LOC edge module, or deploy the governed 6,726-LOC service and migrate onto it. W1's recommendation is to harden what's live rather than assume the bigger implementation is the real one. Whichever is chosen, the other two should be retired — three components named "LLM gateway" is a standing source of exactly the confusion this audit had to untangle.
5. **Migrate the 15 direct-call functions onto the chosen path** (F-2.3, F-2.4, F-2.6).
6. **Fix `LLM_GATEWAY_AUTH_MODE` to default closed** (F-1.4) before anything deploys that service.

### P2 — Observability and cost (sub-project D)

7. **Pick one usage schema, wire every path into it, fix the dashboard** (F-5.3, F-5.4, F-5.5, F-5.9, F-5.2). This is a build, not a missing query.
8. **Restore or retire the audit-logging path** (F-5.4, F-5.8) — 2 of 27 instrumented functions ever wrote a row.

### P3 — Hygiene and hardening

9. Rotate provider API keys (F-4.9) — excluded from the 2026-09-01 rotation.
10. Gate vLLM `/healthz`; stop disclosing the control-token env var name (F-4.4, F-4.5).
11. Resolve the schema-drift family: duplicate `llm_provider_configs`, empty `core.*`/`gateway.*` (F-1.5, F-5.3).
12. Decide the fate of unpopulated pgvector columns and the mislabeled "TimesFM" service (F-5.6, F-5.1).

### Feeds sub-project E (compliance)

Nothing here is a compliance mapping, deliberately. But F-1.2, F-1.6 (no PII redaction, no erasure path on the live gateway) and F-5.4 (no effective audit trail) are the findings that will map hardest against ISO 27001 Annex A and NIST AI RMF, and should anchor that scoping.

### Sub-project F (rollout)

This roadmap is not sequenced against a release calendar — P0–P3 above map to sub-projects B, C, D, and E only. Sub-project F (rollout) is where this remediation plan gets scheduled against actual release windows; that sequencing work is out of scope for this audit and hasn't been started.

---

## 6. Unknowns / not verified

Union of all five workstreams, plus what synthesis could not settle. This section is deliberately not empty.

**Reachability — narrowed by the 2026-09-05 correction, not eliminated.** The original entry here treated "is an unauthenticated edge function reachable from the open internet" as one open question across all AI functions. It is not: for any function **not** listed in `verify_jwt_map.ts` (including `generate-embedding`), the self-hosted `main` router enforces JWT itself, independent of `FUNCTIONS_VERIFY_JWT` — that question is now *resolved*, not merely narrowed, for those 67-plus functions, code-level, without a live request. It remains genuinely open, and unresolvable read-only, only for the 85 functions explicitly listed `false` in the map (`ai-advisor` and `portal-chatbot` among them) — whether a request actually reaches the router at all from the open internet is a network-layer question (firewall or reverse proxy upstream of Kong) that confirming would require sending a live request, which this audit's method limits forbid. **This is the single highest-value follow-up for those 85 functions, and it needs explicit authorization for active testing.**

**Audit methodology note (added 2026-09-05).** The audit inferred reachability by reading configuration layers (`config.toml`, `FUNCTIONS_VERIFY_JWT`, Kong route plugins) without tracing the actual request path, and so missed the `main` router — the layer that actually enforces per-function JWT on this deployment. Three findings (F-2.1, F-2.2, F-2.9) were materially affected; see the correction notice at the top of this document for the full detail. The lesson generalizes: for a reachability question, trace the request path end to end; a stack of config values is not the same as the code that runs.

**Credential history not fully cleared.** A `git log --all -S"sk-"` history pickaxe timed out, so historically-committed provider keys are not ruled out. Coolify's build and deploy logs were not grepped end-to-end for leaked keys. Both belong to sub-project C.

**Whether `VLLM_*` env vars hold real values** was not determined (names only were read, per the secret rule).

**Why the cost ledger went silent 2+ months ago** — feature disabled, scheduled job stopped, or simply no triggering activity — was not determined.

**Which component actually writes `platform.llm_usage`, and why the 2026-09-01 invocation produced no usage row.** W1 and W5 give contradictory answers to who writes the table (see §4's reconciliation); independent of that, a `markets-*` invocation demonstrably occurred at `2026-09-01 06:47:04`(.766)`+00` (matching timestamps in `platform.llm_provider_configs.last_used_at` and `platform.access_log`) with no corresponding row in `platform.llm_usage`, whose last row is from 2026-06-30. Neither the authorship question nor the missing-row gap was resolved.

**Whether Anthropic-first routing or tenant-config resolution is the actual live default for the `markets-*` gateway's vLLM fallback chain.** W1 and W4 read the same evidence differently (see §4) — not settled here, and it bears on F-4.6's severity.

**Coverage caveat, stated plainly.** W2's 38-function figure came from a layered keyword/hostname/import/env-var sweep with every positive hit opened and read — not a line-by-line read of all 152 functions. Two functions (`markets-import-holdings`, `markets-portfolios`) are where that distinction is most likely to matter.

**Deployment history and hosting completeness for `services/llm-gateway`.** W1 confirmed only current absence, not whether the service was deployed in the past and later decommissioned — deployment history was not checked. W2 separately could not rule out a third Supabase Cloud project/organization outside the two reachable via the connected account. W5 found `gateway.llm_invocations` (1 row) and `gateway.prompts` (6 rows) — a schema only `services/llm-gateway` is known to write — with no determined origin given the service's observed non-deployment. None of this overturns "not deployed anywhere observed," but the caveat should travel with the claim.

**Bundle-scan point-in-time caveat.** F-3.3's "count 0" result is a scan of today's live bundle only; whether any earlier deployed bundle ever contained `VITE_OPENAI_API_KEY`, or whether the frontend build environment has ever had it set, was not checked (W3).

**`markets-worker`'s Fly.io deployment target and the vLLM rig's token-issuance process.** F-4.3 flags a second declared deploy target (`fly.toml`) whose live state could not be checked (no Fly API token available) — whether it is active, and if so whether it duplicates AI spend against the same provider budget, is unresolved (W4). Separately, the operational issuance/rotation process for the vLLM rig's own `OLLAMA_PROXY_TOKEN` lives entirely in the externally-operated rig's own documentation and was not observable from this codebase (W4).

**Whether any AI-calling path writes usage data to a destination outside the tables this audit queried** — an external provider's own dashboard, a log aggregator, or nowhere at all — was not determined (W5); relevant to how much weight the "no usage row" observation above can carry.

**Server-side vaulting details of `markets-llm-config`** — whether it actually stores keys in a proper Vault versus a plaintext column, and correctly enforces its claimed role check — was flagged by W3 as open and not independently verified by any workstream.

**Deployment-config drift:** `deploy/selfhosted-supabase/docker-compose.yml` carries a stale comment claiming no functions are deployed. The checked-in compose file is not an accurate mirror of what Coolify runs — the extent of that drift was not mapped.

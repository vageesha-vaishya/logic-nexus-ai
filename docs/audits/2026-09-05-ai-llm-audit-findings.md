# AI/LLM Audit — Findings

**Date:** 2026-09-05
**Scope:** the `logic-nexus-ai` product and its full deployment surface, plus the shared vLLM rig at `vllm.sosservices.online`.
**Method:** observational plus safe live probes. No exploitation, no auth-bypass attempts, nothing active against Supabase Cloud production. Secret names and locations recorded; no values.
**Spec:** `docs/superpowers/specs/2026-09-05-ai-llm-audit-design.md`
**Source workstreams:** `docs/audits/workstream-1-gateways.md`, `-2-edge-functions.md`, `-3-client.md`, `-4-topology.md`, `-5-workloads-observability.md` — each finding's full evidence lives in its workstream file; this report cites but does not duplicate all of it.

---

## 1. Executive summary

**39 findings: 2 Critical, 12 High, 12 Medium, 8 Low, 5 Informational.**

Three conclusions matter more than the rest.

**The governance you have is not running, and the thing that is running has none.** Three separate components in this codebase are named "LLM gateway." The most capable one — `services/llm-gateway`, 6,726 LOC, with working auth, audit, budget, PII-redaction and right-to-erasure modules — **is not deployed anywhere observed**. The one actually serving production traffic is an 863-LOC edge-function module with no PII redaction, no budget enforcement, and no erasure path of its own. A reasonable person reading this repo would conclude the platform is well-governed. It is not: the controls are all in the component that doesn't run.

**Three AI functions are anonymously invocable; two of them shouldn't be.** `ai-advisor` queries an unscoped `rates` table with a service-role client and feeds the result to OpenAI — whether that table actually holds more than one tenant's data is inferred from the missing tenant filter, not independently queried; `generate-embedding` has no authentication of any kind and lets anonymous callers spend AI budget on arbitrary text. `portal-chatbot` is also anonymously callable, but deliberately and scoped: access is gated behind a caller-supplied token (`get_quote_by_token`) and its prompts pass through `sanitizeForLLM` (F-2.6). `ai-advisor` and `generate-embedding` sit on a platform where the config gates are absent — `FUNCTIONS_VERIFY_JWT=false` globally and Kong's `functions-v1` route carries no `key-auth` plugin, while six other Kong routes do (all directly observed in live config) — but whether they are actually reachable from the open internet is inferred, not proven; confirming it would require a live request the audit's method limits forbid (see §6). Every other AI function was checked and has an in-body auth hard-fail, with the single exception of `portal-chatbot` just described; `ai-advisor` and `generate-embedding` are the two where the missing platform gate coincides with a missing compensating code-level check.

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

### Critical (2)

**F-2.1 — `ai-advisor` is live, publicly invocable, and queries an unscoped `rates` table with a service-role client, feeding the result to OpenAI.**
Evidence: `supabase/config.toml:204` sets `verify_jwt = false`; the function's own auth branch swallows failure rather than rejecting; the `rates` query carries no `tenant_id` filter anywhere in the file. *Observed* (config + code, including the missing tenant filter itself). That the `rates` table actually contains data from more than one tenant was not independently queried against the live DB — that specific claim is *inferred* from the absence of a tenant-scoping filter, not confirmed by reading table contents. Reachability from the open internet is separately *inferred* — see F-2.9 and Unknowns.

**F-2.2 — `generate-embedding` has no authentication of any kind; anonymous callers can spend AI budget on arbitrary text.**
Evidence: no `config.toml` entry (so it inherits the platform default, which is off); zero occurrences of any auth construct in the function body. *Observed* (config + code); reachability *inferred*.

Three AI functions on the platform are anonymously invocable — these two, plus `portal-chatbot` (F-2.6) — but only `ai-advisor` and `generate-embedding` lack a compensating in-body auth check outright; `portal-chatbot`'s public access is deliberate and scoped (token-gated, sanitized). That distinction is load-bearing — see F-2.9.

### High (12)

**F-1.1 — The 863-LOC edge gateway serves production; the 6,726-LOC Express service has not run anywhere observed.** `platform.llm_provider_configs` default row shows `last_used_at = 2026-09-01 06:47:04+00`, and only the edge module calls the RPC that updates it. No matching container among 78 on the VPS. *Observed*; the causal attribution of the timestamp is *inferred*.

**F-1.2 — The live gateway has no PII redaction and no budget enforcement of its own.** Both exist only in the service that isn't running.

**F-1.4 — The Express service's service-token auth defaults to fully open** unless an operator explicitly sets `LLM_GATEWAY_AUTH_MODE=enforced`. Latent today (it isn't deployed); a trap the moment anyone deploys it.

**F-2.3 — 15 of 38 AI-calling functions (39%) bypass every shared layer.** The headline shadow-AI number.

**F-2.6 — `portal-chatbot` is intentionally public** and can be invoked to spend AI budget with no credentials.

**F-2.9 — JWT verification is off platform-wide for every self-hosted edge function.** `FUNCTIONS_VERIFY_JWT=false`; live Kong `kong.yml` shows `functions-v1` carrying only a `cors` plugin — no `key-auth`, while six other routes have it. *Observed* (config). Internet reachability *inferred*; proving it needs a live request, which the method limits forbid.

**F-3.1 / F-3.2 — Two client-side call sites fall back to a browser-held OpenAI key** (`useAiAdvisor.ts:40`, `EmailToLeadDialog.tsx:182`). `VITE_OPENAI_API_KEY` is currently unset in the production build env, so this is latent, not live — but any `VITE_*` var is inlined into the public bundle, so setting it once publishes the key to every visitor. The server-side primary path for the second call site (`suggest-transport-mode`) does not apply PII scrubbing either — W2's per-function table marks it `pii-guard: No` — so the email content in play is unscrubbed regardless of which path handles it.

**F-4.7 — `VITE_OPENAI_API_KEY` is a client-inlined credential path by construction.** Rated High regardless of current unset state, per this audit's standing rule.

**F-5.3 — AI usage/cost data is fragmented across at least four disconnected schemas**, most empty or near-empty (`platform.*`, `core.*`, `gateway.*`, legacy `public.ai_audit_logs`).

**F-5.4 — Only 2 of 27 edge functions that import the AI-audit helper have ever logged a call.** Writes stopped 2026-05-20.

**F-5.5 — The one purpose-built AI cost dashboard is hardcoded to fail in production**, because its backend is the never-deployed gateway.

### Medium (12), Low (8), Informational (5) — index

| ID | Title | Severity | File |
|---|---|---|---|
| F-1.6 | RTBF/erasure exists only in the unused service | Medium | W1 |
| F-2.4 | `nexus-copilot` imports a shared helper but bypasses it for the actual generation call | Medium | W2 |
| F-2.5 | The whole `LLM_GATEWAY_URL` pathway (15 functions) targets a service that doesn't exist | Medium/Info | W2 |
| F-2.7 | Per-function `verify_jwt` overrides are dead weight on self-hosted | Medium | W2 |
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

`FUNCTIONS_VERIFY_JWT=false` (F-2.9) is a platform-wide condition, but it is **not** "therefore everything is Critical." Every AI function was checked; all but three have an in-body auth hard-fail that compensates. Of those three, `portal-chatbot` (F-2.6) deliberately and scopedly permits anonymous access rather than lacking a control outright — its exposure is bounded by a caller-supplied token and PII sanitization. F-2.1 and F-2.2 are Critical precisely because they are the two places where the platform gate is missing *and* the application code provides no compensating control of any kind — unintended, unscoped anonymous access. Flattening this would misdirect remediation toward 38 functions when 2 need urgent attention (plus a separate, deliberate policy call on `portal-chatbot`'s intentional public access) and the platform default needs a separate, deliberate decision.

---

## 5. Prioritized remediation roadmap

Ordered by severity × how many other findings each unblocks.

### P0 — Immediate (days), feeds sub-project C

1. **Close `ai-advisor` and `generate-embedding`** (F-2.1, F-2.2). Add in-body auth; scope `ai-advisor`'s `rates` query to the caller's tenant (its unscoped query implies cross-tenant exposure, though that was inferred from the missing filter, not confirmed by querying the DB). Two functions, both live, both missing a compensating in-body auth check, sitting on a platform where the config-level gate is confirmed absent — internet reachability is inferred, not proven (see §6).
2. **Decide the platform auth default** (F-2.9, F-2.7). Either flip `FUNCTIONS_VERIFY_JWT` on and fix what breaks, or add `key-auth` to Kong's `functions-v1` route, or accept it explicitly and document why. The current state — off globally, with per-function overrides that do nothing — is the worst of the three.
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

**Reachability, unresolvable read-only.** Whether the unauthenticated edge functions are actually reachable from the open internet is *inferred*, not proven. Confirming it requires sending a live request — forbidden by this audit's method limits, and in `generate-embedding`'s case would also spend real OpenAI credit. A network-layer question (firewall or reverse proxy upstream of Kong) remains open. **This is the single highest-value follow-up, and it needs explicit authorization for active testing.**

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

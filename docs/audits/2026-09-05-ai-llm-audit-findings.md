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

**The governance you have is not running, and the thing that is running has none.** Three separate components in this codebase are named "LLM gateway." The most capable one — `services/llm-gateway`, 6,726 LOC, with working auth, audit, budget, PII-redaction and right-to-erasure modules — **has never been deployed anywhere**. The one actually serving production traffic is an 863-LOC edge-function module with no PII redaction, no budget enforcement, and no erasure path of its own. A reasonable person reading this repo would conclude the platform is well-governed. It is not: the controls are all in the component that doesn't run.

**Two live AI endpoints accept unauthenticated calls.** `ai-advisor` queries cross-tenant pricing data with a service-role client and feeds it to OpenAI; `generate-embedding` has no authentication of any kind and lets anonymous callers spend AI budget on arbitrary text. Both sit on a platform where `FUNCTIONS_VERIFY_JWT=false` globally and Kong's `functions-v1` route carries no `key-auth` plugin — while six other Kong routes do. Every other AI function was checked and has an in-body auth hard-fail; these two are where the missing platform gate actually bites.

**Nobody can answer "what did we spend on AI last month."** AI usage data is scattered across at least four disconnected schemas, most empty. The most complete ledger (`platform.llm_usage`, 1,459 rows, $0.086959 lifetime) has recorded nothing since 2026-06-30. The one purpose-built cost dashboard is hardcoded to return HTTP 503 because its backend is the gateway that was never deployed. Querying August 2026 today returns $0 — indistinguishable from "we spent nothing."

One piece of good news, verified rather than assumed: **no AI provider credential is present in the live production JavaScript bundle** (`/assets/index-BAs43-cJ.js`, 1,164,472 bytes, scanned, count 0). And the vLLM rig is properly gated — `/v1/models`, completions, and `/control/status` all return 401.

---

## 2. Inventory map

### The three "LLM gateways"

This name collision is itself a finding, and no single workstream could see all three — W1 found the first two, W5's cost-ledger trail led to the third.

| # | Component | Size | Status | Governance |
|---|---|---|---|---|
| 1 | `services/llm-gateway` (Express/TS) | 6,726 LOC, 57 files | **Never deployed.** No container among 78 on the VPS; no compose entry | auth, audit, budgets, PII, RTBF, prompts, finetune, embeddings — all wired, all inert |
| 2 | `supabase/functions/_shared/llm-gateway.ts` (Deno) | 863 LOC | **Live and authoritative.** Config RPC last read 2026-09-01 06:47 | Tenant config resolution + BYOK vault. No PII redaction, no budget enforcement, no erasure path |
| 3 | `services/markets-worker/src/markets_worker/llm_gateway.py` (Python) | — | Container up 3 days, but **silent 2+ months** | Writes the only real per-call cost ledger — last row 2026-06-30 |

### AI/LLM surface

| Surface | Count / state |
|---|---|
| Edge functions calling AI/ML | **38 of 152** (repo); ~23 confirmed live on self-host |
| — routed via `_shared/llm-gateway.ts` | 4 (all `markets-*`) |
| — routed via `_shared/model-router.ts` | 4 |
| — targeting the undeployed `LLM_GATEWAY_URL` service | 15 (dormant — neither caller nor callee deployed) |
| — **direct provider call, no shared layer** | **15 of 38 (39%)** — the shadow-AI bucket |
| Browser-originating AI paths | 6 (see §4) |
| Providers with keys provisioned | OpenAI, Google/Gemini, vLLM. **Anthropic and Mistral: none anywhere**, despite code support |
| Non-LLM AI | `timesfm-service` (**actually Holt-Winters smoothing, not TimesFM**; dev-only, not in production); pgvector columns on 6 tables, **0% populated** |
| "AI"-branded features that use no model at all | Several scoring functions are hand-tuned weighted sums |

---

## 3. Findings by severity

Critical and High are given in full below. Medium, Low and Informational are indexed with pointers — full evidence for every finding is in its workstream file.

### Critical (2)

**F-2.1 — `ai-advisor` is live, publicly invocable, and queries cross-tenant pricing data with a service-role client, feeding it to OpenAI.**
Evidence: `supabase/config.toml:204` sets `verify_jwt = false`; the function's own auth branch swallows failure rather than rejecting; it queries an unscoped `rates` table with a service-role client. *Observed* (config + code). Reachability from the open internet is *inferred* — see F-2.9 and Unknowns.

**F-2.2 — `generate-embedding` has no authentication of any kind; anonymous callers can spend AI budget on arbitrary text.**
Evidence: no `config.toml` entry (so it inherits the platform default, which is off); zero occurrences of any auth construct in the function body. *Observed* (config + code); reachability *inferred*.

These two are the only AI functions on the platform lacking a compensating in-body auth check. That distinction is load-bearing — see F-2.9.

### High (12)

**F-1.1 — The 863-LOC edge gateway serves production; the 6,726-LOC Express service has never run.** `platform.llm_provider_configs` default row shows `last_used_at = 2026-09-01 06:47:04+00`, and only the edge module calls the RPC that updates it. No matching container among 78 on the VPS. *Observed*; the causal attribution of the timestamp is *inferred*.

**F-1.2 — The live gateway has no PII redaction and no budget enforcement of its own.** Both exist only in the service that isn't running.

**F-1.4 — The Express service's service-token auth defaults to fully open** unless an operator explicitly sets `LLM_GATEWAY_AUTH_MODE=enforced`. Latent today (it isn't deployed); a trap the moment anyone deploys it.

**F-2.3 — 15 of 38 AI-calling functions (39%) bypass every shared layer.** The headline shadow-AI number.

**F-2.6 — `portal-chatbot` is intentionally public** and can be invoked to spend AI budget with no credentials.

**F-2.9 — JWT verification is off platform-wide for every self-hosted edge function.** `FUNCTIONS_VERIFY_JWT=false`; live Kong `kong.yml` shows `functions-v1` carrying only a `cors` plugin — no `key-auth`, while six other routes have it. *Observed* (config). Internet reachability *inferred*; proving it needs a live request, which the method limits forbid.

**F-3.1 / F-3.2 — Two client-side call sites fall back to a browser-held OpenAI key** (`useAiAdvisor.ts:40`, `EmailToLeadDialog.tsx:182`). `VITE_OPENAI_API_KEY` is currently unset in the production build env, so this is latent, not live — but any `VITE_*` var is inlined into the public bundle, so setting it once publishes the key to every visitor.

**F-4.7 — `VITE_OPENAI_API_KEY` is a client-inlined credential path by construction.** Rated High regardless of current unset state, per this audit's standing rule.

**F-5.3 — AI usage/cost data is fragmented across at least four disconnected schemas**, most empty or near-empty (`platform.*`, `core.*`, `gateway.*`, legacy `public.ai_audit_logs`).

**F-5.4 — Only 2 of 27 edge functions that import the AI-audit helper have ever logged a call.** Writes stopped 2026-05-20.

**F-5.5 — The one purpose-built AI cost dashboard is hardcoded to fail in production**, because its backend is the never-deployed gateway.

### Medium (12), Low (8), Informational (5) — index

| ID | Title | File |
|---|---|---|
| F-1.6 | RTBF/erasure exists only in the unused service | W1 |
| F-2.4 | `nexus-copilot` imports a shared helper but bypasses it for the actual generation call | W2 |
| F-2.5 | The whole `LLM_GATEWAY_URL` pathway (15 functions) targets a service that doesn't exist | W2 |
| F-2.7 | Per-function `verify_jwt` overrides are dead weight on self-hosted | W2 |
| F-4.3 | `markets-worker` has two declared deploy targets; only one confirmed live | W4 |
| F-4.4 | vLLM `/healthz` unauthenticated, leaks GPU/proxy telemetry | W4 |
| F-4.6 | No per-tenant credential/quota segregation on the vLLM fallback path | W4 |
| F-4.9 | Provider API keys were excluded from the 2026-09-01 credential rotation | W4 |
| F-5.1 | "TimesFM" is Holt-Winters smoothing, and isn't deployed | W5 |
| F-5.2 | markets-worker's cost ledger is well-built but silent 2+ months | W5 |
| F-5.6 | pgvector columns on 6 active tables, 0% populated | W5 |
| F-5.9 | Nobody can answer "what did we spend on AI last month" | W5 |
| F-1.3 | "vLLM" means two different things; one is a dead type reference | W1 |
| F-1.5 | Two live tables named `llm_provider_configs` in different schemas | W1 |
| F-2.8 | `forecast-demand`'s internal-model fallback can't resolve, so OpenAI is the de facto default | W2 |
| F-3.4 | `NexusCopilotWidget.tsx` is orphaned client code calling an edge function with no auth header | W3 |
| F-4.1 | `services/llm-gateway` has zero live deployment footprint | W4 |
| F-4.2 | `timesfm-service` is dev-compose only | W4 |
| F-4.5 | vLLM root page discloses the control-token env var name and control API shape | W4 |
| F-5.8 | The general-purpose mutation-audit table is also effectively unused | W5 |
| F-3.3 | **Live bundle scan: no AI credential found** (count 0) | W3 |
| F-3.5 | Browser fetches OpenRouter's public model catalog directly | W3 |
| F-3.6 | Markets LLM settings keys are vaulted server-side, not client-side — good practice | W3 |
| F-4.8 | No Anthropic/Mistral keys provisioned anywhere, despite code support | W4 |
| F-5.7 | Several "AI"-branded scoring functions are plain weighted sums, no model | W5 |

---

## 4. Fragmentation and shadow-AI analysis

This section is synthesis — no single workstream could produce it.

### Five distinct paths to a provider

1. `_shared/llm-gateway.ts` — 4 `markets-*` functions. Tenant config + BYOK vault. **Live.**
2. `_shared/model-router.ts` — 4 functions. 33 LOC, hardcoded models/URLs, reads `OPENAI_API_KEY` directly. **Live.**
3. `LLM_GATEWAY_URL` → `services/llm-gateway` — 15 functions. **Dormant: neither caller nor callee deployed.**
4. **Direct provider call, no shared layer — 15 functions.** Shadow AI.
5. Browser-originating — 6 paths, of which two (`useAiAdvisor`, `EmailToLeadDialog`) carry a direct-to-OpenAI fallback that bypasses every server-side control by construction.

Plus `TIMESFM_URL` as an internal, non-third-party model path — architecturally distinct and, as W2 correctly argued, not fairly scored alongside a raw OpenAI call.

### The governed fraction

**Stated carefully, because the denominator matters and it would be easy to overstate.** Of 38 AI-calling functions in the repo, 15 (39%) bypass every shared layer. But 15 others target the dormant path — so measuring *production* exposure rather than *repository* exposure, roughly 23 AI functions are live, and of those roughly 12–13 call providers directly with no shared layer. Either way the conclusion holds: **the plurality of live AI traffic flows through no governed path at all**, and the paths that do exist (1 and 2) provide tenant routing but neither PII redaction nor budget enforcement.

The precise per-function classification is in W2's `## Complete per-function table`.

### Two reconciliations worth recording

**The `last_used_at` / stale-ledger tension is not a contradiction.** W1 found the config RPC last read 2026-09-01; W5 found the cost ledger silent since 2026-06-30. These are different components: the Deno edge gateway reads config, the Python markets-worker gateway writes the ledger. Both observations stand. The uncomfortable implication is the synthesis finding: **the live gateway makes provider calls that are recorded nowhere at all.** Config reads are recent; usage writes are two months dead; they were never the same system.

**F-4.6 stays Medium — adjudicated, not deferred.** W4 flagged that its severity should drop if per-tenant override rows were in active use. They partly are: `platform.llm_provider_configs` holds 2 rows, both tenant-scoped, 1 marked default. But F-4.6 concerns the *vLLM fallback* path specifically, which resolves from process-global `VLLM_BASE_URL`/`VLLM_API_KEY`/`VLLM_MODEL_NAME` env vars with no tenant dimension. Tenant rows govern the primary path, not the fallback. The finding stands as written.

### The severity nuance that must not be flattened

`FUNCTIONS_VERIFY_JWT=false` (F-2.9) is a platform-wide condition, but it is **not** "therefore everything is Critical." Every AI function was checked; all but two have an in-body auth hard-fail that compensates. F-2.1 and F-2.2 are Critical precisely because they are the two places where the platform gate is missing *and* the application code provides no compensating control. Flattening this would misdirect remediation toward 38 functions when 2 need urgent attention and the platform default needs a separate, deliberate decision.

---

## 5. Prioritized remediation roadmap

Ordered by severity × how many other findings each unblocks.

### P0 — Immediate (days), feeds sub-project C

1. **Close `ai-advisor` and `generate-embedding`** (F-2.1, F-2.2). Add in-body auth; scope `ai-advisor`'s `rates` query to the caller's tenant. Two functions, both live, both currently open.
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

---

## 6. Unknowns / not verified

Union of all five workstreams, plus what synthesis could not settle. This section is deliberately not empty.

**Reachability, unresolvable read-only.** Whether the unauthenticated edge functions are actually reachable from the open internet is *inferred*, not proven. Confirming it requires sending a live request — forbidden by this audit's method limits, and in `generate-embedding`'s case would also spend real OpenAI credit. A network-layer question (firewall or reverse proxy upstream of Kong) remains open. **This is the single highest-value follow-up, and it needs explicit authorization for active testing.**

**Credential history not fully cleared.** A `git log --all -S"sk-"` history pickaxe timed out, so historically-committed provider keys are not ruled out. Coolify's build and deploy logs were not grepped end-to-end for leaked keys. Both belong to sub-project C.

**Whether `VLLM_*` env vars hold real values** was not determined (names only were read, per the secret rule).

**Why the cost ledger went silent 2+ months ago** — feature disabled, scheduled job stopped, or simply no triggering activity — was not determined.

**Coverage caveat, stated plainly.** W2's 38-function figure came from a layered keyword/hostname/import/env-var sweep with every positive hit opened and read — not a line-by-line read of all 152 functions. Two functions (`markets-import-holdings`, `markets-portfolios`) are where that distinction is most likely to matter.

**Auth posture of the `nexus-copilot` edge function** and server-side vaulting details of `markets-llm-config` were flagged by W3 as open.

**Deployment-config drift:** `deploy/selfhosted-supabase/docker-compose.yml` carries a stale comment claiming no functions are deployed. The checked-in compose file is not an accurate mirror of what Coolify runs — the extent of that drift was not mapped.

# AI/LLM Audit & Inventory — Design

## Background

A request came in to audit the organization's AI/LLM setup end-to-end, then
design and build a next-generation replacement module, then re-audit to
validate. That is a program spanning roughly six independent subsystems, not
a single project:

- **A. Audit & inventory** (this spec)
- **B. Consolidation** — pick the governed path, deploy it, migrate the rest
- **C. Security hardening** — credentials, RBAC, prompt-injection, access auditing
- **D. Observability & lifecycle** — monitoring, alerting, versioning, maintenance
- **E. Compliance mapping** — NIST / ISO 27001 / CSA control mapping
- **F. Rollout** — load/latency/stress testing, canary, rollback, post-deploy monitoring

The "second validation audit" in the original request is A re-run as a closing
gate, not separate work. Documentation is a deliverable within each
sub-project, not a phase of its own.

This spec covers **A only**. B–F each get their own spec once A's findings
tell us what they actually need to contain.

### Why audit before building

A preliminary look (six commands, evidence below) found **at least four
parallel, uncoordinated AI paths** — including two entirely separate
implementations both named "LLM Gateway" — with the most capable one
apparently undeployed. Building a new module before mapping this risks
creating a fifth parallel path and worsening the exact fragmentation the
request wants solved. Several capabilities the request asks to build — audit
logging, PII handling, prompt management, budgets, per-tenant provider
routing, model lifecycle — may already exist, unused or partially wired,
across those two implementations.

### Preliminary evidence (verified, not assumed)

| Observation | How it was verified |
|---|---|
| `services/llm-gateway` is 57 TS files / 6,726 LOC, with `auth/ audit/ budgets/ embeddings/ finetune/ outcomes/ pii/ prompts/ providers/ resolver/ rtbf/` modules | `find`/`wc` over `services/llm-gateway/src` |
| Gateway ships 6 providers: `anthropic, echo, gemini, mistral, openai, replay` | `ls services/llm-gateway/src/providers` |
| Gateway references vLLM in `providers/index.ts` and `types/gateway.types.ts` but has **no `vllm.ts` provider file** | `grep -rln vllm services/llm-gateway/src` |
| `llm-gateway` does **not** appear among the 24 applications registered in Coolify | Full `GET /api/v1/applications` listing pulled 2026-09-01 |
| **A second, separate gateway implementation exists**: `supabase/functions/_shared/llm-gateway.ts`, 863 LOC, with its own provider routing, a `platform.llm_provider_configs` table for per-tenant overrides, a `local-qwen` provider, and vLLM fallback via `VLLM_BASE_URL`/`VLLM_API_KEY`/`VLLM_MODEL_NAME` | `wc -l` + `grep -n` on the file |
| Commit `5e4404a6` ("add vLLM fallback provider to LLM Gateway") touched **only** that edge-function module — not `services/llm-gateway/` at all | `git show --stat 5e4404a6` |
| **Only 4 edge functions import the shared gateway module**, while ~22 name-match `llm-*`/`ai-*`. What the other ~18 use — a third path, or direct provider calls — is unknown and is a primary audit question | `grep -rl "_shared/llm-gateway" supabase/functions/ \| wc -l` |
| 156 Supabase edge functions exist in total | `ls supabase/functions` |
| `VITE_OPENAI_API_KEY` is read in client-side code at `src/hooks/useAiAdvisor.ts:40` and `src/features/module-communications/components/email/EmailToLeadDialog.tsx:182` | `grep -rn` over `src/` |
| That variable is **not** set in the frontend's Coolify build env, so it is a latent trap rather than a live exposure | `GET /api/v1/applications/b2lt2if6x6ovekc4tj7vg8tx/envs`, key names only |

Any `VITE_*` variable is inlined into the production bundle at build time and
is publicly readable. The code path exists; only the unset variable prevents
exposure today. Anyone setting it in Coolify — reasonably, thinking the app
needs a key — would immediately publish it to every visitor.

## Goal

Produce a findings document that maps every AI/LLM surface in scope, states
what is broken or ungoverned with evidence, and hands B–F a prioritized
remediation roadmap grounded in fact rather than assumption.

## Scope boundary

**In scope:** the `logic-nexus-ai` product and its full deployment surface —
the frontend, 8 backend microservices, all 156 Supabase edge functions,
`services/llm-gateway`, the self-hosted Supabase stack, and the Supabase
Cloud production project — **plus** the shared vLLM rig at
`vllm.sosservices.online`, including its tenant-segregation and API-key model,
which is a real trust boundary for this product even though sibling products
also use it.

**Out of scope:** the other products sharing the Coolify VPS (`avaipro-*`,
`aviation-ai-pro`, `amro-pro`, `sthira`, `sos-astral`). They are separate
codebases; auditing them would be shallow and is a separate engagement.

## Method

**Observational plus safe live probes.** Read code, configs, deployment
state, DB schema and RLS policies, and environment variable *names*. Hit
health and unauthenticated endpoints to confirm reachability. Infer
vulnerabilities from code and configuration.

**Explicitly not done:** no exploitation, no prompt-injection probes, no
auth-bypass attempts, no cross-tenant access attempts, nothing active against
Supabase Cloud production. The VPS hosts 24 applications belonging to
unrelated products; the audit must not disturb them. If a finding warrants
active proof, the report names it as a recommended follow-up requiring
separate authorization — it does not test it unilaterally.

**Secret handling:** environment variable and credential *names and
locations* only. Never read, print, or record a secret's value. Coolify API
access follows the established pattern — token written to a scratch file,
`scp`'d, sourced remotely inside the same command, deleted immediately, never
interpolated into a visible command line.

## Framing

**Engineering-first.** Findings are organized by system and severity, each
carrying concrete evidence. Compliance mapping to NIST AI RMF 1.0, ISO 27001
Annex A, and the CSA AI Controls Matrix is deferred to sub-project E, where it
is far cheaper against a finished inventory. Note for E: "NIST" is ambiguous —
AI RMF 1.0 is the AI-specific governance framework, SP 800-53 the general
security control catalog; E should state which it targets.

## The ten surfaces

1. **Both gateway implementations** — `services/llm-gateway` (57 files) and
   `supabase/functions/_shared/llm-gateway.ts` (863 LOC). For each: what the
   modules do, which are live versus built-but-never-wired, whether
   `auth/ audit/ budgets/ pii/ rtbf/` enforce anything or are inert
   scaffolding, and what `platform.llm_provider_configs` actually governs.
   Critically: how the two overlap, which is authoritative, and whether either
   is reachable in production.
2. **Edge functions** — all 156, not just the ~22 that name-match. Any function
   calling a provider counts; `generate-aircraft-tasks` and
   `update-aircraft-template-model-json` already look like AI without matching
   the naming pattern. For each AI-calling function: does it route through the
   shared gateway module (only 4 do today), through some other shared helper,
   or straight to a provider?
3. **Client-side call sites** — every browser-originating AI call. Any direct
   browser→provider call is a critical finding by construction.
4. **vLLM rig** — auth model, tenant segregation, API-key issuance,
   reachability, models served.
5. **Non-LLM AI workloads** — `services/timesfm-service`,
   `services/markets-worker`, and any other ML in the codebase.
6. **Credential inventory** — every AI provider key: where it lives (Coolify
   env stores, Supabase secrets, repo-root `env`), client-exposure status,
   rotation state. Names and locations only.
7. **Data flows** — what data reaches which provider, and whether the `pii/`
   and `rtbf/` modules enforce anything on those paths.
8. **Cost controls** — whether `budgets/` enforces spend anywhere or is inert.
9. **Observability** — what AI calls are logged or audited today, and where
   those records land.
10. **Fragmentation & shadow-AI map** — every AI consumer traced to which path
    it uses, surfacing any call that bypasses a governed path entirely.

## Evidence standard

This is the requirement that makes the report trustworthy, and it is
mandatory for every workstream:

- Every finding cites `file:line`, a specific configuration value, or a
  command and its actual output.
- Anything inferred rather than directly observed is labeled as inferred.
- The report carries an explicit **"unknowns / not verified"** section. An
  honest gap is worth more than a confident guess.

This exists because two confident-sounding claims were already proven wrong
in recent work on this platform: a `docker ps | grep <name>` check concluded
five services were undeployed when Coolify's UUID-based container names simply
never contain the service name, and a Content-Type-based verification read a
JSON 404 as "fixed" when the endpoint was not implemented at all. Both passed
casual review. The standard above is what would have caught them.

## Execution

Five parallel subagent workstreams, each with an identical briefing structure
and the evidence standard above, synthesized by the controller into one
document. Parallel fan-out keeps 156 edge functions and 6,726 LOC out of the
controller's context while letting each agent go deep in its own.

- **W1 — Both gateway implementations.** Surfaces 1, 7 (gateway portion), 8.
  Reads `services/llm-gateway` and `supabase/functions/_shared/llm-gateway.ts`
  side by side: capability overlap, which is authoritative, what
  `platform.llm_provider_configs` governs, why the service references vLLM
  without a provider file, and each one's actual deployment status.
- **W2 — Edge function sweep.** Surface 2. Every function that calls a
  provider: which provider, whether it routes through the shared gateway
  module or bypasses it, auth model (`FUNCTIONS_VERIFY_JWT` posture), key
  source, deployment target (self-hosted, Cloud, or both).
- **W3 — Client/browser surface.** Surface 3. Call sites, bundle exposure,
  admin UI, and what a browser can reach directly.
- **W4 — Deployment & credential topology.** Surfaces 4, 6. Where every AI
  component actually runs, plus the vLLM rig's auth and tenancy model and the
  full credential inventory.
- **W5 — Non-LLM workloads & observability.** Surfaces 5, 9, and the non-gateway
  portion of 7.

Surface 10 (fragmentation map) is synthesis work the controller performs from
all five reports — it cannot be assigned to any single agent, since it is
precisely the cross-cutting view none of them individually holds.

Each workstream writes a findings file; the controller reads those files
rather than the raw material, then produces the report.

## Deliverable

`docs/audits/2026-09-05-ai-llm-audit-findings.md`, structured as:

1. Executive summary
2. Inventory map — every AI surface and where it runs
3. Findings by severity, each with evidence
4. Fragmentation & shadow-AI analysis
5. Prioritized remediation roadmap, scoped into candidate B–F specs
6. Unknowns / not verified

The report is also a candidate for publishing as an artifact, since it is a
document with an audience and a roadmap other people will act on. That
decision is made at execution time, not here.

## Success criteria

- Every AI/LLM entry point in scope is inventoried, with none discovered later
  that the audit missed.
- Every finding carries evidence meeting the standard above.
- The roadmap is specific enough that B–F can be scoped from it without
  re-investigation.
- No production disruption, and no secret values recorded anywhere.

## Out of scope

- Building, fixing, or remediating anything. This audit changes no code and no
  configuration. Every finding is written down, not acted on. Any fix — including
  the `VITE_OPENAI_API_KEY` trap — belongs to sub-project C, which is scoped
  from these findings.
- Sub-projects B–F.
- Compliance control mapping (sub-project E).
- Active security testing (requires separate authorization).
- Sibling products on the shared VPS.

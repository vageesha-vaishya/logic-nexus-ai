# AI/LLM Audit & Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-backed findings document mapping every AI/LLM surface in this product plus the shared vLLM rig, so sub-projects B–F can be scoped from fact rather than assumption.

**Architecture:** Five independent read-only audit workstreams run in parallel, each writing its own findings file. A final synthesis task reads those five files (not the raw material), builds the cross-cutting fragmentation map that no single workstream can see, and assembles the report.

**Tech Stack:** Investigation only — `grep`/`find`/`git`, `ssh hostinger-vps`, Coolify REST API, `psql` via `docker exec`, `curl` against health endpoints. No code is written, no configuration changed.

**Spec:** `docs/superpowers/specs/2026-09-05-ai-llm-audit-design.md` — read it for the 10 surfaces and full rationale.

## Global Constraints

### This audit is strictly read-only

- **Change nothing.** No code edits, no config changes, no deploys, no restarts, no `PATCH`/`POST`/`DELETE` against the Coolify API, no writes to any database. The only files any task creates are its own findings file under `docs/audits/`.
- **Do not fix anything you find**, however tempting or small. Every finding is written down, not acted on. Remediation is sub-project C, scoped *from* these findings. A fix applied mid-audit corrupts the baseline the audit exists to establish.
- **Never touch, modify, or delete any pre-existing resource.** If something looks stale, orphaned, or wrong, record it as a finding and move on.

### Method limits

- **Observational plus safe live probes only.** Read code, config, deployment state, DB schema and RLS. Hit health and unauthenticated endpoints to confirm reachability.
- **No exploitation.** No prompt-injection probes, no auth-bypass attempts, no cross-tenant access attempts. If a finding warrants active proof, record it as a recommended follow-up requiring separate authorization.
- **Nothing active against Supabase Cloud production.** Read-only inspection of its configuration is fine; do not send it test traffic.
- **The VPS hosts 24 applications belonging to unrelated products** (`avaipro-*`, `sthira`, `plane.so`, `jenkins`, and others). Disturbing them is the worst possible outcome of an audit. Stay read-only and stay in scope.

### Secret handling

- **Record secret NAMES and LOCATIONS only. Never a value.** Not in a findings file, not in a command, not in your own output. If a value appears in tool output by accident, do not copy it forward — note that the exposure happened and continue.
- Coolify API access uses this exact pattern every time:
  1. `grep -E '^COOLIFY_API_(URL|TOKEN)=' env > <local-scratch>/.coolify_env`
  2. `scp <local-scratch>/.coolify_env hostinger-vps:/tmp/.coolify_env`
  3. `rm -f <local-scratch>/.coolify_env` immediately
  4. `ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; <curl using ${COOLIFY_API_URL} and ${COOLIFY_API_TOKEN}>; rm -f /tmp/.coolify_env'`
- Never interpolate a token into a visible command line (no literal `-H "Authorization: Bearer <value>"`).
- When dumping logs or env output, **filter** (`grep` for what you need). Never `cat` a whole build log or `env` listing — that is how a service-role key leaked earlier in this project's history.

### Permission boundaries

- **Never retry a command a permission classifier explicitly denied**, even if the denial says the block is transient. Report BLOCKED and let the controller decide.
- If a task seems to require a write action to answer a question, it does not. Record the question in "Unknowns" instead.

### Evidence standard (mandatory, every workstream)

Every finding must carry:
- **Evidence**: a `file:line` reference, a specific config value, or a command plus its actual output.
- **Observed or inferred**: explicitly labeled. If inferred, state the reasoning.
- Anything you could not verify goes in that file's **Unknowns / not verified** section rather than being asserted.

This exists because two confident-sounding claims were already proven wrong in recent work here: a `docker ps | grep <name>` check concluded five services were undeployed (Coolify's container names are `<uuid>-<timestamp>` and never contain the service name), and a Content-Type check read a JSON 404 as "endpoint fixed" when the route was not implemented. Both passed casual review. An honest "unknown" is worth more than a confident guess.

### Severity scale (use these exact labels, so synthesis can sort)

- **Critical** — live credential exposure, unauthenticated access to a paid/privileged AI capability, or cross-tenant data leakage.
- **High** — a security control that appears to exist but does not enforce; ungoverned AI path handling real user data; a latent trap one config change away from Critical.
- **Medium** — missing governance (no audit trail, no budget enforcement) on a real path; significant fragmentation.
- **Low** — inconsistency, dead code, drift with no direct security or cost impact.
- **Informational** — inventory facts worth recording that are not defects.

### Findings file format (identical across W1–W5, so synthesis is mechanical)

```markdown
# Workstream <N>: <name>

## Scope covered
<Exhaustively: what was examined. Name the directories/files/systems.
If you did not cover something in your assigned surface, say so here.>

## Inventory
<Table of every component found: name, location, what it does, deployment status.>

## Findings

### F-<N>.<n> — <short title> [Critical|High|Medium|Low|Informational]
**What:** <one or two sentences>
**Evidence:** <file:line, config value, or command + actual output>
**Observed or inferred:** <observed | inferred — with reasoning if inferred>
**Impact:** <why it matters>

## Unknowns / not verified
<Explicit list of questions you could not answer and why.>

## Notes for synthesis
<Anything cross-cutting the controller needs: which paths you saw consumers
using, overlaps with other workstreams, contradictions with the plan's stated facts.>
```

### Parallel dispatch is intended here

Tasks 1–5 are independent, read-only, and each writes to a different file. Dispatching them concurrently is safe and is the point of the design — the usual "never run implementers in parallel" rule guards against write conflicts that cannot occur in a read-only audit. Task 6 depends on all five.

### Known facts — carry these into task briefs so agents don't re-derive them

| Fact | Verified by |
|---|---|
| `services/llm-gateway`: 57 TS files, 6,726 LOC. Providers: `anthropic, echo, gemini, mistral, openai, replay`. Modules: `auth, audit, budgets, embeddings, finetune, outcomes, pii, prompts, resolver, rtbf` | `find`/`wc`/`ls` |
| `llm-gateway` is absent from Coolify's 24-application list | `GET /api/v1/applications`, 2026-09-01 |
| `supabase/functions/_shared/llm-gateway.ts`: 863 LOC, own routing, `platform.llm_provider_configs` table, `local-qwen` provider, vLLM fallback via `VLLM_BASE_URL`/`VLLM_API_KEY`/`VLLM_MODEL_NAME` | `wc -l`, `grep -n` |
| Exactly 4 functions import it, all `markets-*`: `markets-enrich-news`, `markets-portfolio-brief`, `markets-portfolio-diagnostic`, `markets-research` | `grep -rl "_shared/llm-gateway"` |
| `supabase/functions/_shared/model-router.ts`: 33 LOC third router — `openai`/`google` only, hardcoded models and URLs, reads `OPENAI_API_KEY` directly. 4 importers | `wc -l`, `head`, `grep -rl` |
| `supabase/functions/_shared/pii-guard.ts` has **12** importers — wider adoption than either routing path | `grep -rl` |
| 156 edge functions total; ~22 name-match `llm-*`/`ai-*` | `ls supabase/functions` |
| `VITE_OPENAI_API_KEY` read at `src/hooks/useAiAdvisor.ts:40` and `src/features/module-communications/components/email/EmailToLeadDialog.tsx:182`; **not** set in the frontend Coolify build env | `grep -rn`; `GET .../b2lt2if6x6ovekc4tj7vg8tx/envs` |
| Frontend Coolify app uuid: `b2lt2if6x6ovekc4tj7vg8tx`. Self-hosted Supabase stack uuid: `i64jlyerora7ao9vkw5sweh3` | Coolify API |
| The self-hosted DB container name changes on every redeploy — always resolve it live: `ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'"` | Learned the hard way this session |

---

### Task 1 (W1): Both gateway implementations

**Files:**
- Create: `docs/audits/workstream-1-gateways.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a findings file covering spec surfaces 1, 7 (gateway portion), and 8. Task 6 reads it.

Two entirely separate implementations are both called "LLM Gateway". This workstream establishes what each actually does, which enforces anything, and whether either is reachable in production.

- [ ] **Step 1: Map `services/llm-gateway` module by module**

For each of `auth/ audit/ budgets/ embeddings/ finetune/ outcomes/ pii/ prompts/ providers/ resolver/ rtbf/`: what it does, and critically **whether it is wired into a request path or is inert scaffolding**. Trace from `src/app.ts` and `src/routes/*` inward — a module nothing imports is dead code, and saying so is a finding.

```bash
cd services/llm-gateway
cat src/app.ts
ls src/routes/ && for f in src/routes/*.ts; do echo "--- $f ---"; head -30 "$f"; done
# For each module dir, find who imports it:
for m in auth audit budgets embeddings finetune outcomes pii prompts resolver rtbf; do
  echo "=== $m: imported by ==="; grep -rln "from '.*$m/" src/ | grep -v "^src/$m/"
done
```

- [ ] **Step 2: Answer the enforcement questions for the service**

Record a yes/no with evidence for each: Does `auth/` gate requests, and how? Does `audit/` write anywhere, and to what table? Does `budgets/` block or merely record spend? Does `pii/` redact before provider calls, or only after? Does `rtbf/` have a working deletion path?

- [ ] **Step 3: Resolve the vLLM discrepancy in the service**

`providers/` has no `vllm.ts`, yet `providers/index.ts` and `types/gateway.types.ts` mention vLLM. Determine what that reference actually resolves to — a real code path, a type-only stub, or dead reference.

```bash
grep -n "vllm" services/llm-gateway/src/providers/index.ts services/llm-gateway/src/types/gateway.types.ts
```

- [ ] **Step 4: Confirm the service's deployment status**

Its absence from the Coolify app list is strong but not conclusive — it could run some other way. Check for a Dockerfile, compose entry, or any process on the VPS.

```bash
ls services/llm-gateway/ | grep -iE "dockerfile|compose"
grep -rn "llm-gateway" docker-compose.yml 2>/dev/null
ssh hostinger-vps "docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -i llm"
```

- [ ] **Step 5: Map `supabase/functions/_shared/llm-gateway.ts` (863 LOC)**

Its routing logic, provider list, how `platform.llm_provider_configs` overrides defaults, the vLLM/`local-qwen` fallback, and what it does about auth, audit, PII, and budgets — the same enforcement questions as Step 2, asked of this implementation.

- [ ] **Step 6: Inspect the `platform.llm_provider_configs` table**

Schema, row count, and RLS policies. Resolve the DB container name live first (it changes on redeploy).

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c '\d platform.llm_provider_configs'"
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c 'select count(*) from platform.llm_provider_configs;'"
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c \"select policyname, cmd, qual from pg_policies where tablename='llm_provider_configs';\""
```

- [ ] **Step 7: Compare the two implementations**

A table: capability by capability (routing, providers, auth, audit, budgets, PII, RTBF, prompts, fine-tune, embeddings), which implementation has it, and which is authoritative in production today. This comparison is the single most valuable output of this workstream.

- [ ] **Step 8: Write the findings file and commit**

Use the exact format from Global Constraints. Then:

```bash
git add docs/audits/workstream-1-gateways.md
git commit -m "audit(w1): gateway implementations findings"
```

---

### Task 2 (W2): Edge function sweep

**Files:**
- Create: `docs/audits/workstream-2-edge-functions.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a findings file covering spec surface 2. Task 6 reads it.

**All 156 functions must be checked, not the ~22 that name-match.** `generate-aircraft-tasks` and `update-aircraft-template-model-json` already look like AI without matching the naming pattern; there will be others.

- [ ] **Step 1: Find every function that calls AI, by behavior not by name**

Search for provider endpoints, SDK imports, and the known shared helpers. Cast a wide net, then confirm each hit by reading the file.

```bash
cd supabase/functions
grep -rln "api.openai.com\|api.anthropic.com\|generativelanguage.googleapis.com\|api.mistral.ai\|openai\|anthropic\|gemini\|claude-\|gpt-4\|gpt-3" . --include=*.ts | sort > /tmp/ai_candidates.txt
wc -l /tmp/ai_candidates.txt
grep -rln "_shared/llm-gateway\|_shared/model-router" . --include=*.ts | sort
```

- [ ] **Step 2: Classify every AI-calling function by its path**

Four buckets. Produce a complete table — function name in one column, bucket in the next:
1. Routes via `_shared/llm-gateway.ts` (known: the 4 `markets-*` functions)
2. Routes via `_shared/model-router.ts` (known: 4 importers — identify them)
3. Uses some other shared helper
4. **Calls a provider directly with no shared layer** — this bucket is the shadow-AI finding, and its size is the headline number of this workstream

- [ ] **Step 3: For each AI function, record provider, key source, and auth posture**

Which provider/model; where the API key comes from (`Deno.env.get("...")` — record the variable name only); and whether the function requires a JWT or is publicly invocable. Check `supabase/config.toml` (or equivalent) and the `FUNCTIONS_VERIFY_JWT` setting on the self-hosted stack for the global default, then note per-function overrides.

```bash
grep -rn "verify_jwt" supabase/config.toml 2>/dev/null
ssh hostinger-vps "grep -c FUNCTIONS_VERIFY_JWT /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
```

An AI function that is publicly invocable without a JWT is at minimum **High** — it lets an anonymous caller spend the org's provider budget — and **Critical** if it also returns or accepts tenant data.

- [ ] **Step 4: Determine deployment reality for each AI function**

Deployed to self-hosted, to Supabase Cloud production, both, or neither? A function in the repo but nowhere deployed is Low/Informational; one deployed only to Cloud production is a governance gap given the self-host migration.

```bash
ssh hostinger-vps "docker ps --filter name=functions-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'"
# then list what that container actually serves
```

- [ ] **Step 5: Check PII handling coverage**

`_shared/pii-guard.ts` has 12 importers. Cross-reference: of the AI-calling functions found in Step 1, which import `pii-guard` and which do not? An AI function sending user data to a third-party provider without it is a finding.

```bash
grep -rl "_shared/pii-guard" supabase/functions/ | sort
```

- [ ] **Step 6: Write the findings file and commit**

Include the complete per-function table — it is the raw material Task 6 needs for the fragmentation map. Then:

```bash
git add docs/audits/workstream-2-edge-functions.md
git commit -m "audit(w2): edge function AI surface findings"
```

---

### Task 3 (W3): Client and browser surface

**Files:**
- Create: `docs/audits/workstream-3-client.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a findings file covering spec surface 3. Task 6 reads it.

Any AI call originating in the browser is a finding by construction: the code, the keys it reads, and the endpoints it hits are all public.

- [ ] **Step 1: Find every client-side AI call site**

```bash
cd src
grep -rn "api.openai.com\|api.anthropic.com\|generativelanguage\|api.mistral.ai" . --include=*.ts --include=*.tsx
grep -rn "import.meta.env.VITE_[A-Z_]*\(KEY\|TOKEN\|SECRET\)" . --include=*.ts --include=*.tsx
grep -rn "/api/v1/llm\|/functions/v1/llm\|/functions/v1/ai" . --include=*.ts --include=*.tsx | head -40
```

- [ ] **Step 2: Analyse the two known `VITE_OPENAI_API_KEY` call sites**

`src/hooks/useAiAdvisor.ts:40` and `src/features/module-communications/components/email/EmailToLeadDialog.tsx:182`. For each: what happens when the variable is unset (does the feature degrade, error, or fall back to a server path?), and what would happen if someone set it. The variable is currently unset in the frontend build env, so this is a latent trap — classify accordingly (**High**, not Critical) and say plainly what would make it Critical.

- [ ] **Step 3: Confirm no AI key is in the shipped bundle**

Empirical check against the live deployed bundle, not just the env listing.

A single self-contained pipeline — resolves the hashed bundle name and scans it in one step, so there is nothing to substitute by hand:

```bash
BUNDLE=$(curl -s https://app.sosservices.online/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
echo "bundle: $BUNDLE"
curl -s "https://app.sosservices.online${BUNDLE}" | grep -coE "sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|sk-ant-[A-Za-z0-9_-]{20,}"
```

Report both the bundle name and the count. Expected: `0`. **A non-zero count is Critical — stop and escalate to the controller immediately** rather than continuing the audit and writing it up later. Do not paste any matched string into your report; report the count and the pattern that matched.

- [ ] **Step 4: Map what the browser calls for AI**

For `NexusCopilotWidget.tsx`, `useAiAdvisor.ts`, `EmailToLeadDialog.tsx`, and `src/features/admin/llm-gateway/`: which endpoint does each hit — an edge function, one of the gateways, or a provider directly? This tells Task 6 which paths have browser-originating consumers.

- [ ] **Step 5: Write the findings file and commit**

```bash
git add docs/audits/workstream-3-client.md
git commit -m "audit(w3): client and browser AI surface findings"
```

---

### Task 4 (W4): Deployment and credential topology

**Files:**
- Create: `docs/audits/workstream-4-topology.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a findings file covering spec surfaces 4 and 6. Task 6 reads it.

Where every AI component actually runs, and every credential that reaches a provider. **Names and locations only — never a value.**

- [ ] **Step 1: Inventory AI-relevant credentials across all stores**

Three stores: the repo-root gitignored `env`, Coolify per-application env stores, and the self-hosted stack's `.env`. Extract **key names only**.

```bash
# Local repo env — names only, values stripped:
grep -oE '^[A-Z_]+=' env | tr -d '=' | grep -iE "openai|anthropic|gemini|google|mistral|vllm|llm|ai_"
# Self-hosted stack env — names only:
ssh hostinger-vps "grep -oE '^[A-Z_]+=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | tr -d '=' | grep -iE 'openai|anthropic|gemini|google|mistral|vllm|llm'"
```

For each Coolify application, list env var **names** via the API (use the secret-handling pattern; the response contains values, so extract only the `key` field and never print the rest).

- [ ] **Step 2: For each credential, record location, consumers, and exposure class**

A table: variable name, which store(s) hold it, which code reads it, and exposure class — server-only, client-inlined (`VITE_*`), or unknown. Any `VITE_*` variable holding a provider key is at minimum **High**.

- [ ] **Step 3: Map deployment topology for every AI component**

Which of these actually run, and where: `services/llm-gateway`, the AI edge functions, `services/timesfm-service`, `services/markets-worker`, the vLLM rig. Use the Coolify application list plus live container inspection.

```bash
ssh hostinger-vps "docker ps --format '{{.Names}}\t{{.Status}}' | head -40"
```

- [ ] **Step 4: Audit the vLLM rig's trust boundary**

`vllm.sosservices.online`. Establish, observationally: is it reachable unauthenticated? What auth does it expect? How are API keys issued, and is there per-tenant segregation? Which models does it serve?

```bash
curl -s -o /dev/null -w 'root: %{http_code}\n' --max-time 10 https://vllm.sosservices.online/
curl -s -o /dev/null -w 'models: %{http_code}\n' --max-time 10 https://vllm.sosservices.online/v1/models
curl -s --max-time 10 https://vllm.sosservices.online/v1/models | head -c 400
```

**An unauthenticated `200` on `/v1/models` or any completion endpoint is Critical** — it means anyone on the internet can consume the org's GPU capacity. Record the status codes exactly; do not attempt to bypass any auth you find.

- [ ] **Step 5: Check rotation state**

This project rotated `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and the Coolify DB password on 2026-09-01. Provider API keys (OpenAI, Anthropic, Google, Mistral, vLLM) were **not** rotated. Note which AI credentials have known-unrotated history and whether any appeared in logs or transcripts — that is a real finding for sub-project C.

- [ ] **Step 6: Write the findings file and commit**

Re-read the file before committing and confirm no secret value appears anywhere in it.

```bash
git add docs/audits/workstream-4-topology.md
git commit -m "audit(w4): AI deployment and credential topology findings"
```

---

### Task 5 (W5): Non-LLM AI workloads and observability

**Files:**
- Create: `docs/audits/workstream-5-workloads-observability.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a findings file covering spec surfaces 5 and 9. Task 6 reads it. (Surface 7, data flows, is split between Task 1 Step 2 for the gateways and Task 2 Step 5 for the edge functions — it is not this workstream's responsibility.)

- [ ] **Step 1: Audit `services/timesfm-service`**

What model it serves, how it is invoked, its auth posture, deployment status, and what data reaches it.

```bash
ls services/timesfm-service/ && cat services/timesfm-service/Dockerfile 2>/dev/null
grep -rn "TIMESFM_URL" --include=*.ts --include=*.tsx src/ services/ supabase/ | head -20
```

- [ ] **Step 2: Audit `services/markets-worker` for AI usage**

It is a FastAPI worker proxied at `/api/markets/`. Determine whether it calls any AI/LLM provider, and if so by which path.

```bash
grep -rniE "openai|anthropic|gemini|llm|embedding|model" services/markets-worker/ --include=*.py -l | head
```

- [ ] **Step 3: Find any other ML/AI in the codebase**

Vector embeddings, `pgvector`, recommendation logic, classification, forecasting — anything model-driven that neither W1 nor W2 would have caught.

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c \"select extname from pg_extension where extname like '%vector%';\""
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c \"select table_schema, table_name from information_schema.columns where udt_name='vector' limit 20;\""
```

- [ ] **Step 4: Establish what AI activity is logged today, and where**

Across all paths: does an AI call leave a record? Look for the gateway's `audit/`, `_shared/audit.ts`, and any AI-related tables.

```bash
grep -rl "_shared/audit" supabase/functions/ | wc -l
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c \"select table_schema, table_name from information_schema.tables where table_name ~ 'llm|ai_|model|prompt|embedding' order by 1,2;\""
```

For each AI-related table found: row count and whether anything currently writes to it. **A table that exists but is empty while the feature is in use is a finding** — it means the control is not actually operating.

- [ ] **Step 5: Assess cost visibility**

Is there any way today to answer "what did we spend on AI last month, and on what?" If not, say so plainly — that is a **Medium** finding directly feeding sub-project D.

- [ ] **Step 6: Write the findings file and commit**

```bash
git add docs/audits/workstream-5-workloads-observability.md
git commit -m "audit(w5): non-LLM workloads and observability findings"
```

---

### Task 6: Synthesis, fragmentation map, and final report

**Files:**
- Create: `docs/audits/2026-09-05-ai-llm-audit-findings.md`

**Interfaces:**
- Consumes: all five findings files from Tasks 1–5.
- Produces: the audit deliverable.

**This task is performed by the controller, not delegated.** Surface 10 is precisely the cross-cutting view no individual workstream holds, and the synthesis requires weighing five reports against each other — including catching where they contradict.

- [ ] **Step 1: Read all five findings files**

Read the files, not the underlying material. If a workstream's file is missing a section required by the format, or its findings lack evidence, send it back to that workstream rather than papering over the gap.

- [ ] **Step 2: Build the fragmentation and shadow-AI map (surface 10)**

One table: every AI consumer found by any workstream → which path it uses (`services/llm-gateway`, `_shared/llm-gateway.ts`, `_shared/model-router.ts`, another helper, direct provider call, or vLLM) → its auth posture → whether it is governed (audited, PII-guarded, budgeted).

The headline metric: **what fraction of AI calls flow through a governed path.** Preliminary evidence suggests it is low — 4 functions on the shared gateway and 4 on the model router, against ~22 name-matched AI functions plus whatever W2 finds beyond those.

- [ ] **Step 3: Reconcile contradictions between workstreams**

Where two workstreams disagree — W1 says a module enforces something, W2 finds functions bypassing it — the contradiction is itself a finding, and usually a more interesting one than either half. Do not silently pick a side.

- [ ] **Step 4: De-duplicate and re-rank findings globally**

The same underlying problem will appear in several workstreams at different severities. Merge them, keep the highest justified severity, and preserve every distinct piece of evidence.

- [ ] **Step 5: Build the prioritized remediation roadmap**

Group findings into the candidate sub-projects B–F, ordered by (severity × how many other findings it unblocks). Each roadmap item names the findings it resolves. This is the section sub-projects B–F get scoped from, so it must be specific enough to write a spec against without re-investigating.

- [ ] **Step 6: Assemble the report**

`docs/audits/2026-09-05-ai-llm-audit-findings.md`, in the structure the spec requires:
1. Executive summary
2. Inventory map
3. Findings by severity, each with evidence
4. Fragmentation and shadow-AI analysis
5. Prioritized remediation roadmap, scoped into candidate B–F specs
6. Unknowns / not verified — the union of all five workstreams' unknowns, plus anything synthesis could not resolve

- [ ] **Step 7: Verify the report against the success criteria**

Before committing, confirm: every finding carries evidence; inferred claims are labeled; the unknowns section is populated (an empty one means the audit was not honest); no secret values appear anywhere.

```bash
grep -icE "sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|eyJhbGciOi" docs/audits/2026-09-05-ai-llm-audit-findings.md
```
Expected: `0`. Any other number means a credential leaked into the report — remove it before committing.

- [ ] **Step 8: Commit**

```bash
git add docs/audits/2026-09-05-ai-llm-audit-findings.md
git commit -m "audit: AI/LLM inventory and gap analysis findings"
```

- [ ] **Step 9: Report the headline numbers to the human partner**

Specifically: how many AI entry points exist, what fraction are governed, the count of Critical/High findings, and the top three roadmap items. Offer to publish the report as an artifact — it is a document with an audience and a roadmap others will act on.

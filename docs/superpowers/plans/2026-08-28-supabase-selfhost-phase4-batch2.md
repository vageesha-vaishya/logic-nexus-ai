# Phase 4 Batch 2: LLM-Provider Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the 21 Edge Functions needing an LLM provider key (OpenAI/Google/Gemini/Anthropic, plus Upstash Redis for 3 of them) to self-hosted, reusing Batch 1's router unchanged.

**Architecture:** Task 1 does everything requiring no secret values (generate `function_importers.ts` entries, prepare the function list) and can run immediately. Task 2 requires real third-party secret values from the user and cannot proceed past its first step until they're supplied — this is a genuine external dependency, not a plan gap.

**Tech Stack:** Same as Batch 1 — Deno/TypeScript, bash/scp for bind-mount deployment, no new tools.

## Global Constraints

- Self-hosted VPS via SSH alias `hostinger-vps`. The `functions` container is `functions-i64jlyerora7ao9vkw5sweh3-103525190194`. The live bind-mount path is `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions`.
- A `functions` container restart is a state-changing step on shared infrastructure — run the four standard health-check curls after every restart:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
- Self-hosted's function endpoints are reachable at `https://supabase.sosservices.online/functions/v1/<name>`.
- `verify_jwt_map.ts` needs NO new entries for this batch — all 16 of this batch's `verify_jwt=false` functions (`ai-advisor`, `ai-agent`, `ai-message-assistant`, `analyze-cargo-damage`, `analyze-email-threat`, `categorize-document`, `classify-email`, `ensemble-demand`, `extract-bol-fields`, `extract-invoice-items`, `ingest-email`, `nexus-copilot`, `portal-chatbot`, `process-franchise-import`, `smart-reply`, `suggest-transport-mode`) are already present in the map from Batch 1's final-review fix, confirmed via direct grep during planning. The remaining 5 (`generate-embedding`, `markets-enrich-news`, `markets-portfolio-brief`, `markets-portfolio-diagnostic`, `markets-research`) correctly default to `verify_jwt=true` with no map entry needed.
- The router's JWT gate validates signature+expiry only (fixed in Batch 1's final review) — any validly-signed token (anon key, service-role key, or a real user JWT) satisfies it; functions do their own identity checks internally where needed.
- Never print real secret values in any report file — reference by name/location only, per this project's established secrets convention (`env` file at repo root, gitignored).

---

### Task 1: Generate `function_importers.ts` entries and the Batch 2 function list

**Files:**
- Modify: `supabase/functions/main/function_importers.ts`
- Create: `deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt`

**Interfaces:**
- Consumes: `FUNCTION_IMPORTERS` (existing `Record<string, () => Promise<any>>` from Batch 1, defined in this same file) — this task appends to it, doesn't replace it.
- Produces: 21 new entries in `FUNCTION_IMPORTERS`, consumed by Task 2's deployment (the router's `getHandler()` looks up entries by function name — unchanged from Batch 1, no code change needed there).

- [ ] **Step 1: Add 21 entries to `function_importers.ts`**

Open the file and add these entries into the existing `FUNCTION_IMPORTERS` object literal (alongside Batch 1's 88 existing entries — do not remove or reorder those):

```typescript
  "ai-advisor": () => import("../ai-advisor/index.ts"),
  "ai-agent": () => import("../ai-agent/index.ts"),
  "ai-message-assistant": () => import("../ai-message-assistant/index.ts"),
  "analyze-cargo-damage": () => import("../analyze-cargo-damage/index.ts"),
  "analyze-email-threat": () => import("../analyze-email-threat/index.ts"),
  "categorize-document": () => import("../categorize-document/index.ts"),
  "classify-email": () => import("../classify-email/index.ts"),
  "ensemble-demand": () => import("../ensemble-demand/index.ts"),
  "extract-bol-fields": () => import("../extract-bol-fields/index.ts"),
  "extract-invoice-items": () => import("../extract-invoice-items/index.ts"),
  "generate-embedding": () => import("../generate-embedding/index.ts"),
  "ingest-email": () => import("../ingest-email/index.ts"),
  "markets-enrich-news": () => import("../markets-enrich-news/index.ts"),
  "markets-portfolio-brief": () => import("../markets-portfolio-brief/index.ts"),
  "markets-portfolio-diagnostic": () => import("../markets-portfolio-diagnostic/index.ts"),
  "markets-research": () => import("../markets-research/index.ts"),
  "nexus-copilot": () => import("../nexus-copilot/index.ts"),
  "portal-chatbot": () => import("../portal-chatbot/index.ts"),
  "process-franchise-import": () => import("../process-franchise-import/index.ts"),
  "smart-reply": () => import("../smart-reply/index.ts"),
  "suggest-transport-mode": () => import("../suggest-transport-mode/index.ts"),
```

- [ ] **Step 2: Verify the entry count**

```bash
grep -c '() => import(' supabase/functions/main/function_importers.ts
```
Expected: `109` (Batch 1's 88 + this batch's 21).

- [ ] **Step 3: Write the Batch 2 function list**

```
ai-advisor
ai-agent
ai-message-assistant
analyze-cargo-damage
analyze-email-threat
categorize-document
classify-email
ensemble-demand
extract-bol-fields
extract-invoice-items
generate-embedding
ingest-email
markets-enrich-news
markets-portfolio-brief
markets-portfolio-diagnostic
markets-research
nexus-copilot
portal-chatbot
process-franchise-import
smart-reply
suggest-transport-mode
```
Save as `deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt` (21 lines). Verify: `wc -l deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt` must show `21`.

- [ ] **Step 4: Re-verify none of these 21 need a secret this plan didn't account for**

```bash
while read -r fn; do
  hits=$(grep -rhoE "Deno\.env\.get\(['\"][A-Z_]+['\"]" "supabase/functions/$fn" "supabase/functions/_shared" 2>/dev/null | grep -v "SUPABASE_" | sort -u)
  echo "$fn: $hits"
done < deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt
```
Expected: every line shows only some combination of `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL` (this grep scans the whole `_shared` directory, which over-reports — cross-reference any surprising hit against the actual function's own imports before concluding it's a real dependency, same caveat Batch 1's Task 2 ran into and correctly worked around). If a genuinely new secret shows up that isn't one of these 6, stop and report it — the plan's Task 2 secret list needs to account for it before deployment.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/main/function_importers.ts deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt
git commit -m "feat(functions): add Phase 4 Batch 2 import map entries (LLM-provider functions)"
```

---

### Task 2: Provision secrets, deploy, and verify

**Files:**
- Modify: `deploy/selfhosted-supabase/docker-compose.yml` (add 6 new env vars to the `functions` service)
- Modify: `deploy/selfhosted-supabase/env.example` (document the 6 new env vars, matching this project's established convention of keeping this file in sync with what the compose file actually references)
- Modify: `deploy/selfhosted-supabase/README.md` (document this batch, same pattern as Batch 1's section)

**Interfaces:**
- Consumes: Task 1's 21 `function_importers.ts` entries and `phase4-batch2-functions.txt` (must exist and be committed before this task's reseed step).
- Produces: nothing further tasks depend on — this is the last task in this batch.

- [ ] **Step 1: STOP — confirm real secret values are available before proceeding**

This task cannot proceed past this point without real values for: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`. Per this plan's design spec, these were not available at planning time and needed to be supplied by the user via the repo-root gitignored `env` file. Check now:
```bash
grep -E "^(OPENAI_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|UPSTASH_REDIS_REST_TOKEN|UPSTASH_REDIS_REST_URL)=" env
```
If any are missing or still contain a placeholder value, STOP and report exactly which ones are missing — do not fabricate, skip, or substitute placeholder values for a real secret; do not deploy a subset of the batch working around a missing secret without checking with the plan owner first (some functions need more than one of these — e.g. `classify-email` needs both `GOOGLE_API_KEY` and `OPENAI_API_KEY`, `markets-portfolio-brief`/`-diagnostic`/`markets-research` each need `ANTHROPIC_API_KEY` plus both Upstash vars).

- [ ] **Step 2: Add the 6 new env vars to `docker-compose.yml`'s `functions` service**

Find the `functions` service's `environment:` block (currently ends with `VERIFY_JWT: "${FUNCTIONS_VERIFY_JWT}"` right before its `command:` block) and add these 6 lines before `VERIFY_JWT`:
```yaml
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      GOOGLE_API_KEY: ${GOOGLE_API_KEY:-}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      UPSTASH_REDIS_REST_TOKEN: ${UPSTASH_REDIS_REST_TOKEN:-}
      UPSTASH_REDIS_REST_URL: ${UPSTASH_REDIS_REST_URL:-}
```
The `:-` default-to-empty syntax matches this same file's existing pattern for optional vars (e.g. `SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_PUBLISHABLE_KEY:-}` a few services up) — safe even if a var is temporarily unset, rather than failing compose validation.

- [ ] **Step 3: Add the same 6 vars to `env.example` with descriptive comments**

```bash
grep -n "SUPABASE_SERVICE_ROLE_KEY\|^$" deploy/selfhosted-supabase/env.example | tail -5
```
Add near wherever this file's existing secret-like entries live (follow its established comment style):
```
# Phase 4 Batch 2: LLM provider keys for Edge Functions needing AI capabilities
OPENAI_API_KEY=
GOOGLE_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_REDIS_REST_URL=
```

- [ ] **Step 4: Provision the real values into the live Coolify `.env` and reseed the compose file**

Run all 6, substituting each real value from the repo-root `env` file directly in the shell command (never paste a literal secret value into this report or any committed file):
```bash
ssh hostinger-vps "grep -q '^OPENAI_API_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'OPENAI_API_KEY=<real value from repo env>' >> /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
ssh hostinger-vps "grep -q '^GOOGLE_API_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'GOOGLE_API_KEY=<real value from repo env>' >> /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
ssh hostinger-vps "grep -q '^GEMINI_API_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'GEMINI_API_KEY=<real value from repo env>' >> /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
ssh hostinger-vps "grep -q '^ANTHROPIC_API_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'ANTHROPIC_API_KEY=<real value from repo env>' >> /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
ssh hostinger-vps "grep -q '^UPSTASH_REDIS_REST_TOKEN=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'UPSTASH_REDIS_REST_TOKEN=<real value from repo env>' >> /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
ssh hostinger-vps "grep -q '^UPSTASH_REDIS_REST_URL=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'UPSTASH_REDIS_REST_URL=<real value from repo env>' >> /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
```
Then reseed the compose file itself, since `docker-compose.yml`'s bind-mounted content on the VPS doesn't auto-refresh from git on redeploy (the same gotcha documented in the README since Phase 1):
```bash
scp deploy/selfhosted-supabase/docker-compose.yml hostinger-vps:/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml
```
(Note the `.yaml` vs `.yml` extension on the live path — verified directly during planning via `ssh hostinger-vps "ls /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/ | grep docker-compose"`, which returned `docker-compose.yaml`. Re-verify this hasn't changed before assuming it, same as any live-state fact in this plan.)

- [ ] **Step 5: Reseed the bind-mount with Task 1's updated files plus the 21 new function directories**

```bash
scp supabase/functions/main/function_importers.ts hostinger-vps:/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/main/
while read -r fn; do
  scp -r "supabase/functions/$fn" "hostinger-vps:/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/"
done < deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt
```

- [ ] **Step 6: Restart the functions container and confirm it stays up**

```bash
ssh hostinger-vps "docker restart functions-i64jlyerora7ao9vkw5sweh3-103525190194"
sleep 5
ssh hostinger-vps "docker ps --filter name=functions-i64jlyerora7ao9vkw5sweh3-103525190194 --format '{{.Names}}\t{{.Status}}'"
```
Expected: `Up ... (healthy)`. If crash-looping, capture `ssh hostinger-vps "docker logs functions-i64jlyerora7ao9vkw5sweh3-103525190194 --tail 100"` before proceeding.

- [ ] **Step 7: Run the four standard health-check curls**

```bash
ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
```
Expected: all four `200`.

- [ ] **Step 8: Verify a `verify_jwt=false` function from this batch is callable without auth**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://supabase.sosservices.online/functions/v1/smart-reply
```
Expected: NOT `401` from the router (whatever `smart-reply` itself returns for an empty request is fine).

- [ ] **Step 9: Verify a `verify_jwt=true` function from this batch is reachable with a valid token**

```bash
ANON_KEY="<value from env's SUPABASE_ANON_KEY or self-hosted's own ANON_KEY>"
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $ANON_KEY" \
  https://supabase.sosservices.online/functions/v1/generate-embedding
```
Expected: NOT `401` from the router (the request should reach `generate-embedding`'s own code — whatever it returns for a minimal/empty body is fine, this only proves dispatch worked).

- [ ] **Step 10: Spot-check 3 more functions for basic reachability**

```bash
for fn in classify-email markets-research portal-chatbot; do
  echo "$fn: $(curl -s -o /dev/null -w '%{http_code}' https://supabase.sosservices.online/functions/v1/$fn)"
done
```
Expected: none return the router's own `404` (any other status means the router found and invoked the function).

- [ ] **Step 11: Regression check — spot-check 2 Batch 1 functions still work**

```bash
for fn in admin-reset-password export-data; do
  echo "$fn: $(curl -s -o /dev/null -w '%{http_code}' https://supabase.sosservices.online/functions/v1/$fn)"
done
```
Expected: same behavior as Batch 1's own verification (not a router 404) — confirms this batch's reseed didn't disturb the already-deployed 88.

- [ ] **Step 12: Document this batch in the README**

Add a short note to the existing "Phase 4: Edge Functions" section (or a "Batch 2" subsection) covering: which 21 functions were added, the 6 new secrets and where they're provisioned, and that `forecast-demand`/`route-optimization` remain deliberately excluded pending their backing services.

- [ ] **Step 13: Commit**

```bash
git add deploy/selfhosted-supabase/docker-compose.yml deploy/selfhosted-supabase/env.example deploy/selfhosted-supabase/README.md
git commit -m "feat(selfhost-supabase): deploy Phase 4 Batch 2 (21 LLM-provider functions)"
```

---

## Plan Self-Review

**Spec coverage:** Design spec §2 Goals → Task 1 (21 function_importers.ts entries, confirmed verify_jwt_map.ts needs no changes), Task 2 (secret provisioning, deployment, split at the secrets boundary exactly as the spec's Goals require). Non-Goals' `forecast-demand`/`route-optimization` exclusion → reflected in Global Constraints' function list and Task 2 Step 12's documentation ask, not silently dropped. §5 Verification Plan → Task 2 Steps 7-11 (health checks, both JWT directions, spot-checks, regression check against Batch 1). §6 Open Items: secrets sourcing → Task 2 Step 1's explicit stop-and-check; the deferred forecast-demand/route-optimization batch → noted in Step 12, not otherwise actioned since it's genuinely not yet scoped.

**Placeholder scan:** Task 2 Step 1 is a deliberate, explicit stop-condition (not a vague TBD) — it names the exact 6 env vars to check and the exact grep to run, with clear instructions not to fabricate or substitute values. Task 2 Step 4's `<real value from repo env>` is the same category of genuine external secret this plan cannot know in advance, matching Phase 2's and Batch 1's established convention for exactly this situation. No other TBD/TODO. All 21 function names and their import statements in Task 1 Step 1 are real, verified data (re-confirmed against a live, unchanged production function list during planning), not placeholders.

**Type/name consistency:** `FUNCTION_IMPORTERS` (Task 1) is the same object Batch 1 defined — this plan appends to it by exact name, doesn't redefine it. `phase4-batch2-functions.txt` (Task 1 Step 3) is read by the same relative path in Task 1 Step 4 and Task 2 Step 5 — no drift. The container name and bind-mount path are copied verbatim from Batch 1's plan/ledger (already verified live), not re-guessed.

**Round 2, after fixing two real issues found on a fresh read:** Task 2 Step 4 originally showed one example `.env`-append command and said "repeat the same pattern" for the other 5 secrets — `writing-plans` explicitly forbids this shortcut ("the engineer may be reading tasks out of order"), so all 6 commands are now written out explicitly. Separately, Step 4's note about the live compose file's `.yaml` vs `.yml` extension originally cited "confirmed in Task 2's Batch 1 report" — checked, and that citation was fabricated: Batch 1 never touched `docker-compose.yml` at all, so no such confirmation exists anywhere. Verified the real answer directly (`ssh hostinger-vps "ls ... | grep docker-compose"` → `docker-compose.yaml`) and corrected the note to cite the actual verification method instead of an invented source.

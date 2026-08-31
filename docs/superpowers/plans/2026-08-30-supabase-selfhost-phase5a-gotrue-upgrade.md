# Phase 5a: GoTrue Version Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade self-hosted GoTrue from `v2.189.0` to `v2.195.0` (matching production), applying the change surgically so only the `auth` container is touched — the other 6 stack containers, the shared VPS's other apps, and production Supabase Cloud are all unaffected.

**Architecture:** Task 1 lands the image-tag change in git only (both `main` and the `deploy/supabase-selfhost-phase1` branch Coolify actually deploys from) — no live infrastructure is touched. Task 2 applies it live via a targeted `docker compose up -d auth` on the VPS (bypassing Coolify's redeploy API, which would recreate the whole stack) and verifies convergence against the Phase 2 auth-schema diff.

**Tech Stack:** Docker Compose v5.2.0 (on the VPS), SSH, `psql` inside the `db` container, the `mcp__claude_ai_Supabase__execute_sql` tool for production-side queries. No new tools.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-30-supabase-selfhost-phase5a-gotrue-upgrade-design.md` (read it first — this plan implements its revised §3/§4/§5, written after a live-verified finding that Coolify deploys this app from `deploy/supabase-selfhost-phase1`, not `main`, and that branch is 37 commits behind).
- SSH alias `hostinger-vps`. Coolify application UUID `i64jlyerora7ao9vkw5sweh3`. Compose project name (confirmed via `com.docker.compose.project` container label): `i64jlyerora7ao9vkw5sweh3`.
- The persistent, live compose directory on the VPS is `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/` — it holds `docker-compose.yaml`, `.env`, `kong.yml`, `kong-entrypoint.sh`, and `volumes/` (the same directory the bind-mounted `volumes/functions` path resolves from). **This directory's `docker-compose.yaml` currently matches the `deploy/supabase-selfhost-phase1` branch content, NOT `main`** (main is ahead by the Phase 2–4 Batch 2 work) — do not overwrite this file wholesale from `main`'s copy; only ever make the single, targeted edit each task below specifies, or you'll pull in unrelated drift as a side effect.
- As of this plan's writing, live container names are `auth-i64jlyerora7ao9vkw5sweh3-054239010699`, `db-i64jlyerora7ao9vkw5sweh3-054239087325`, `kong-i64jlyerora7ao9vkw5sweh3-054238985058`, `rest-i64jlyerora7ao9vkw5sweh3-054239032577`, `storage-i64jlyerora7ao9vkw5sweh3-054239043652`, `realtime-dev.supabase-realtime` (this one keeps its fixed name, not the `<service>-<uuid>-<id>` pattern), `functions-i64jlyerora7ao9vkw5sweh3-054239069112`. **Re-verify these live before use** (`ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'"`) — a container recreate (including this plan's own Task 2) changes the trailing ID, and this plan's execution may not be immediate.
- Do not trigger a Coolify redeploy (`POST .../applications/i64jlyerora7ao9vkw5sweh3/start`) for this change — confirmed live that a real redeploy recreates all 7 containers together, which this plan's Task 2 must avoid per the spec's Goals.
- Baseline facts, live-verified during planning (2026-08-31) — re-verify, don't assume unchanged by execution time: self-hosted `auth.schema_migrations` latest version `20260302000000`, self-hosted `auth` schema column count `239`, `auth.custom_oauth_providers.custom_claims_allowlist` absent self-hosted. Production (project `gzhxgoigflftharcmdqj`, query via `mcp__claude_ai_Supabase__execute_sql`): latest migration `20260625000000`, `auth` schema column count `240`.
- Never print a real secret value in any report file — reference by name/location only (this project's established convention).
- After any container-affecting step, run the four standard production health-check curls:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```

---

### Task 1: Land the image-tag change on both branches

**Files:**
- Modify: `deploy/selfhosted-supabase/docker-compose.yml` (on `main`)
- Modify: `deploy/selfhosted-supabase/docker-compose.yml` (on `deploy/supabase-selfhost-phase1`, separate commit, same one-line change only)

**Interfaces:**
- Consumes: nothing from an earlier task — this is the first task.
- Produces: the new image tag string `supabase/gotrue:v2.195.0`, committed on both branches. Task 2's live edit uses this exact string.

- [ ] **Step 1: Confirm the local `deploy/supabase-selfhost-phase1` branch is up to date with origin**

```bash
git fetch origin deploy/supabase-selfhost-phase1
git rev-parse deploy/supabase-selfhost-phase1 origin/deploy/supabase-selfhost-phase1
```
If the two hashes differ, fast-forward: `git switch deploy/supabase-selfhost-phase1 && git merge --ff-only origin/deploy/supabase-selfhost-phase1 && git switch main`. (At planning time, local was 2 commits behind origin — `b332dedb` and `9be16372` — re-check live, this may have already been fixed.)

- [ ] **Step 2: Edit the image tag on `main`**

In `deploy/selfhosted-supabase/docker-compose.yml`, find the `auth:` service's `image:` line and change:
```yaml
    image: supabase/gotrue:v2.189.0
```
to:
```yaml
    image: supabase/gotrue:v2.195.0
```
(This is the only line in this file this task changes.)

- [ ] **Step 3: Commit and push on `main`**

```bash
git add deploy/selfhosted-supabase/docker-compose.yml
git commit -m "feat(selfhost-supabase): upgrade self-hosted GoTrue to v2.195.0 (Phase 5a)"
git push origin main
```

- [ ] **Step 4: Switch to `deploy/supabase-selfhost-phase1` and apply the identical one-line change**

```bash
git switch deploy/supabase-selfhost-phase1
grep -n "image: supabase/gotrue" deploy/selfhosted-supabase/docker-compose.yml
```
Expected: `image: supabase/gotrue:v2.189.0`. Edit that one line to `image: supabase/gotrue:v2.195.0` — do **not** merge or cherry-pick `main`'s commit (37 commits of unrelated drift would come along); make the identical manual one-line edit instead.

- [ ] **Step 5: Commit and push on `deploy/supabase-selfhost-phase1`**

```bash
git add deploy/selfhosted-supabase/docker-compose.yml
git commit -m "feat(selfhost-supabase): upgrade self-hosted GoTrue to v2.195.0 (Phase 5a)"
git push origin deploy/supabase-selfhost-phase1
```

- [ ] **Step 6: Switch back to `main`**

```bash
git switch main
git log --oneline -1
```
Expected: your Step 3 commit.

- [ ] **Step 7: Verify no live infrastructure was touched by this task**

```bash
ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}'"
```
Expected: all 7 containers, same uptimes as Global Constraints' baseline (unchanged — this task is git-only).

---

### Task 2: Apply live via a surgical single-service redeploy, verify, document

**Files:**
- Modify (on the VPS, not in this repo): `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml` — one line only.
- Modify: `deploy/selfhosted-supabase/README.md`

**Interfaces:**
- Consumes: Task 1's committed `supabase/gotrue:v2.195.0` tag (both branches must already have it before this task starts).
- Produces: nothing further tasks depend on — last task in this plan. Result feeds directly into the broader Phase 5 (migrating real users), which is out of scope here.

- [ ] **Step 1: Capture the pre-change baseline**

```bash
ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}\t{{.Image}}'"
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT version FROM auth.schema_migrations ORDER BY version DESC LIMIT 1;\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM information_schema.columns WHERE table_schema='auth';\""
```
Expected (per Global Constraints' baseline, re-confirm): 7 containers all healthy with matching uptimes; `auth` on `supabase/gotrue:v2.189.0`; migration version `20260302000000`; column count `239`. **Write down the exact uptimes shown** — Step 6 checks the other 6 containers' uptimes are byte-for-byte unchanged afterward, so you need this exact baseline to compare against.

- [ ] **Step 2: Edit the live on-disk compose file — one line only**

```bash
ssh hostinger-vps "grep -n 'image:.*gotrue' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml"
```
Expected: shows the `v2.189.0` line. Then:
```bash
ssh hostinger-vps "sed -i 's#supabase/gotrue:v2.189.0#supabase/gotrue:v2.195.0#' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml"
ssh hostinger-vps "grep -n 'image:.*gotrue' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml"
```
Expected: now shows `v2.195.0`. **Do not `scp` `main`'s full file over this one** — the live file lacks `main`'s later additions (the vLLM/OpenAI/Google env-var lines this session added to the `functions` service in Task 1's sibling commits) and overwriting it wholesale would touch the `functions` service too, outside this task's scope. This `sed` is the only change.

- [ ] **Step 3: Pull the new image and recreate only the `auth` container**

```bash
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml pull auth"
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml up -d auth"
```
The `-p i64jlyerora7ao9vkw5sweh3` flag matches this project's existing compose project name exactly, so Docker Compose recognizes the other 6 running containers as already part of this project with unchanged config, and only recreates `auth` (the one service whose image reference changed, and the only service named in `up -d`). The `.env` file already in that directory holds every variable the `auth` service's `environment:` block references (confirmed during planning: `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `API_EXTERNAL_URL`, `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`, `DISABLE_SIGNUP`, `JWT_EXPIRY`, all `SMTP_*`, all `MAILER_URLPATHS_*`, `ENABLE_*` flags — all present).

- [ ] **Step 4: Confirm only `auth` was recreated**

```bash
ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}\t{{.Image}}'"
```
Expected: `auth`'s container has a **new** trailing ID (recreated) and `Up <seconds/minutes>` (fresh), image now `supabase/gotrue:v2.195.0`. **The other 6 containers must show the exact same uptime you recorded in Step 1** — if any of them also show a fresh/reset uptime, STOP: this means the recreate wasn't scoped correctly (config drift or a bad `-p` match), and you need to investigate before continuing rather than proceeding on a broader change than intended.

- [ ] **Step 5: Check the new `auth` container reaches healthy, and read its logs directly**

```bash
sleep 5
ssh hostinger-vps "docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}'"
ssh hostinger-vps "docker logs \$(docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}') --tail 200"
```
Expected: `Up ... (healthy)`, not crash-looping. Per the spec's audit finding, read the log output directly rather than trusting health status alone — confirm the migration run completed without error (look for the new `20260625000000` migration applying), and note anything unexpected even if non-fatal (e.g. a WebAuthn-related warning would be harmless here since this stack doesn't configure WebAuthn, but should still be visible in the log, not silently assumed absent).

- [ ] **Step 6: Verify the version string and re-run the four standard health-check curls**

```bash
ssh hostinger-vps "curl -s https://supabase.sosservices.online/auth/v1/health"
ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
```
Expected: health response includes `"version":"v2.195.0"`; all four curls return `200`.

- [ ] **Step 7: Re-run the Phase 2 auth-schema diff for convergence**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT version FROM auth.schema_migrations ORDER BY version DESC LIMIT 1;\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM information_schema.columns WHERE table_schema='auth';\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM information_schema.columns WHERE table_schema='auth' AND table_name='custom_oauth_providers' AND column_name='custom_claims_allowlist';\""
```
Expected: migration version now `20260625000000` (was `20260302000000`); column count now `240` (was `239`); the `custom_claims_allowlist` check returns `1` (was `0`). Then re-query production for comparison (values shouldn't have moved, but re-check rather than assume):
```
mcp__claude_ai_Supabase__execute_sql, project_id="gzhxgoigflftharcmdqj":
SELECT (SELECT version FROM auth.schema_migrations ORDER BY version DESC LIMIT 1) AS latest_migration,
       (SELECT count(*) FROM information_schema.columns WHERE table_schema='auth') AS auth_col_count;
```
Expected: both sides now match exactly (`20260625000000` / `240` on both).

- [ ] **Step 8: Document this in the README**

Add a short section to `deploy/selfhosted-supabase/README.md` (near the existing "Operational gotcha" sections) covering:
- GoTrue is now `v2.195.0` self-hosted, matching production; the `auth.custom_oauth_providers.custom_claims_allowlist` gap from the Phase 2 handoff is closed.
- **A new operational finding this task surfaced:** the compose file actually used to create containers on a real Coolify redeploy is checked out fresh into an ephemeral `/artifacts/<uuid>` directory each time (confirmed deleted from disk afterward) — the persistent `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml` copy is not authoritative for what a redeploy recreates containers from, only for a manual `docker compose` invocation run directly against it (as this task did). A real Coolify redeploy also recreates the entire 7-container stack together, not just a changed service — for a single-service change, use this task's `docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml up -d <service>` pattern directly on the VPS instead of triggering `/start`.
- Note that `deploy/supabase-selfhost-phase1` (the branch Coolify's `git_branch` field points to) needed this same image-tag change applied directly, separately from `main` — link to this plan and the design spec's §3 for why.

- [ ] **Step 9: Commit**

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(selfhost-supabase): document Phase 5a GoTrue upgrade to v2.195.0 and the surgical single-service redeploy method"
git push origin main
```

---

## Rollback (if Step 5, 6, or 7 verification fails)

Per the design spec's §5: revert the image tag to `v2.189.0` on both `main` and `deploy/supabase-selfhost-phase1` (same two-commit shape as Task 1), then repeat Task 2's Steps 2–3 with the reverted tag to recreate `auth` back to the old image. GoTrue's migrations are forward-only — a downgrade after a successful migration run leaves `auth.schema_migrations` ahead of what `v2.189.0` expects. This is acceptable only because self-hosted `auth.users` holds exactly 1 disposable test user right now; it would not be an acceptable rollback story once Phase 5 migrates real users into this table.

---

## Plan Self-Review

**Spec coverage:** Design spec §3's revised Approach (both-branches commit, surgical single-service redeploy) → Task 1 (branches) + Task 2 Steps 2–4 (surgical redeploy). §4 Verification Plan's 6 points → Task 2 Steps 4 (untouched-uptime check), 5 (healthy + logs), 6 (version + health curls), 7 (schema diff). §5 Rollback → the Rollback section above, updated for the two-branch reality. §2 Goals ("zero impact on the other 6 containers") → Task 2 Step 4's explicit uptime-match stop-condition, not just an assumption.

**Placeholder scan:** No TBD/TODO. Every SQL query, container name, and expected value is either a live-verified fact from planning (with an explicit "re-verify, don't assume unchanged" caveat in Global Constraints and Task 2 Step 1) or a fully-written command — no "similar to Task N" shortcuts.

**Type/name consistency:** The compose project name `i64jlyerora7ao9vkw5sweh3` and container-name pattern are used identically across Global Constraints, Task 1 Step 7, and every Task 2 step. The image tag string `supabase/gotrue:v2.195.0` is identical in Task 1 Steps 2/4 and Task 2 Step 2's `sed` target. The migration-version and column-count expected values in Task 2 Step 7 match the exact production values captured live during planning (`20260625000000` / `240`), not placeholders.

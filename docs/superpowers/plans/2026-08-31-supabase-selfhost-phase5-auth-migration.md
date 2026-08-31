# Phase 5: Auth Data Migration & JWT Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate production's 103 `auth.users` + 101 `auth.identities` rows to self-hosted, create the `on_auth_user_created` trigger, and align the JWT signing secret so a still-valid production access token keeps working immediately after cutover.

**Architecture:** Task 1 does the data migration and trigger creation — no external dependency, can run immediately. Task 2 aligns the JWT secret — it requires production's real signing secret from the plan owner and cannot proceed past its first step until supplied, matching this project's established pattern for genuine external-secret dependencies (DB password, third-party API keys).

**Tech Stack:** `pg_dump`/`psql` (run via `docker exec` into the self-hosted `db` container), Coolify's env-var API, SSH. No new tools.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-31-supabase-selfhost-phase5-auth-migration-design.md` — read it first, especially §1's audit notes (the corrected `pg_dump` connection, insert format, and JWT GUC mechanics — this plan implements those corrected details directly, not the first-draft assumptions the audit found wrong).
- SSH alias `hostinger-vps`. Coolify application UUID `i64jlyerora7ao9vkw5sweh3`.
- As of this plan's writing, live container names: `db-i64jlyerora7ao9vkw5sweh3-054239087325`, `auth-i64jlyerora7ao9vkw5sweh3-054239010699`, `rest-i64jlyerora7ao9vkw5sweh3-054239032577`, `realtime-i64jlyerora7ao9vkw5sweh3-054239058529`, `functions-i64jlyerora7ao9vkw5sweh3-054239069112`, `kong-i64jlyerora7ao9vkw5sweh3-054238985058`, `storage-i64jlyerora7ao9vkw5sweh3-054239043652`. **Re-verify live before use** (`ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'"`) — a container recreate changes its trailing ID.
- Self-hosted `db` container's `psql` user is `supabase_admin`, database `postgres` (matches every prior phase's convention in this project).
- Production's true-direct (non-pooled) Postgres host is `db.gzhxgoigflftharcmdqj.supabase.co:5432` — **not** the repo-root `env` file's `DATABASE_URL`/`DIRECT_URL`, both of which are pgbouncer-pooled despite `DIRECT_URL`'s name and reject `pg_dump` outright (confirmed during design: `pg_dump: error: invalid URI query parameter: "pgbouncer"`). Extract the password from `DATABASE_URL` (the URL-encoded form between `postgres:` and `@` — it decodes correctly when reused in a fresh `postgresql://` URI) rather than typing it by hand. Never print this password, or any other secret, in any report file — reference by variable name/location only.
- `pg_dump` is not installed on the bare VPS host — it lives inside the self-hosted `db` container's own image. Always invoke it via `docker exec <db-container> pg_dump ...`.
- Coolify's env-var API auto-creates **two** entries per key on first creation — one `is_preview: false` (production, what the live containers actually use) and one `is_preview: true` (a preview-deployment shadow copy, confirmed unused by this app's actual containers since it runs no preview deployments, but worth keeping consistent). Confirmed live during planning (via a disposable, since-deleted probe key) that `PATCH /api/v1/applications/i64jlyerora7ao9vkw5sweh3/envs` with body `{"key": "...", "value": "..."}` updates the **existing** production copy in place (same `uuid`, no duplicate created) — this is the correct call for updating `JWT_SECRET`, which already exists from Phase 1 bootstrap (unlike `POST`, which is this project's established pattern for genuinely *new* keys only, per the README). Add `"is_preview": true` to the same body to update the preview copy instead — two separate `PATCH` calls are needed to update both.
- The `db` service's own copy of `JWT_SECRET` in `docker-compose.yml` is consumed only by a one-time init script (`volumes/db/jwt.sql`) that never reruns once `PGDATA` already exists — **do not recreate the `db` container** as part of aligning the JWT secret; it achieves nothing for this change and needlessly restarts Postgres for all 6 dependent services. The actual fix for `db`'s side is a direct `ALTER DATABASE postgres SET "app.settings.jwt_secret" TO '<value>';`, which takes effect for new sessions immediately.
- After any container-affecting step, run the four standard production health-check curls:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
- Kong's `key-auth` plugin applies to self-hosted's `/auth/v1/*` routes (a gotcha Phase 5a documented in the README) — any call to self-hosted's auth endpoints through the public domain needs an `apikey` header. **Use self-hosted's own `ANON_KEY`, not the repo-root `env` file's `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`** — those are production's keys (a different Supabase project entirely, signed with production's JWT secret) and will not satisfy Kong's key-auth here. Self-hosted's own `ANON_KEY` lives in the VPS's live `.env` (`ssh hostinger-vps "grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"`), confirmed present there during planning.

---

### Task 1: Migrate real user/identity data, create the trigger, verify with a new signup

**Files:**
- No repo files change in this task — it's entirely live database work against self-hosted (writes) and production (reads only).

**Interfaces:**
- Consumes: nothing from an earlier task — first task in this plan.
- Produces: self-hosted `auth.users`/`auth.identities` populated with production's real 103/101 rows, and a working `on_auth_user_created` trigger. Task 2 depends on this being done first (JWT alignment's verification step needs real migrated users to test against).

- [ ] **Step 1: Capture the pre-migration baseline**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities; SELECT count(*) FROM public.profiles;\""
```
Expected (re-confirm, don't assume unchanged since planning): `1` / `1` / `104`.

Also re-confirm production's current counts (they may have moved since this plan was written):
```
mcp__claude_ai_Supabase__execute_sql, project_id="gzhxgoigflftharcmdqj":
SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM auth.identities) AS identities;
```
Expected: `103` / `101` (or whatever the actual current numbers are — use these as the real target for Step 5's verification, not the numbers written here).

- [ ] **Step 2: Delete self-hosted's leftover synthetic test user and identity**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"DELETE FROM auth.identities WHERE user_id = '02424458-e64b-4584-87ca-dd1d33f414c7';\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"DELETE FROM auth.users WHERE id = '02424458-e64b-4584-87ca-dd1d33f414c7';\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities;\""
```
Expected: both counts now `0`. (Confirmed during design: this user has no `public.profiles` row, so nothing else needs cleaning up alongside it.)

- [ ] **Step 3: Dump `auth.users` from production and apply to self-hosted**

Extract production's password from the repo-root `env` file's `DATABASE_URL` (the segment between `postgres:` and `@`, still URL-encoded — reuse it as-is, do not decode by hand):
```bash
PROD_PW=$(grep -E '^DATABASE_URL=' env | sed -E 's/^DATABASE_URL="postgres:\/\/[^:]+:([^@]+)@.*/\1/')
```
Dump, transform, and apply — all as separate steps on the VPS so the dump never touches your local machine or this session's own context:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 bash -c \"pg_dump --data-only --inserts --rows-per-insert=1 --table=auth.users 'postgresql://postgres:${PROD_PW}@db.gzhxgoigflftharcmdqj.supabase.co:5432/postgres' > /tmp/phase5_auth_users.sql\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 sed -i -E 's/\);\$/) ON CONFLICT (id) DO NOTHING;/' /tmp/phase5_auth_users.sql"
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -f /tmp/phase5_auth_users.sql"
```
Watch the `psql` output for errors (it prints one `INSERT 0 1` per row on success — 103 of them expected, or whatever the real current count is per Step 1's re-check). A `ON CONFLICT` no-op still prints `INSERT 0 0`, not an error — distinguish the two in what you report.

- [ ] **Step 4: Dump `auth.identities` from production and apply to self-hosted, same pattern**

`PROD_PW` from Step 3 does not persist if this runs as a separate command — re-derive it first:
```bash
PROD_PW=$(grep -E '^DATABASE_URL=' env | sed -E 's/^DATABASE_URL="postgres:\/\/[^:]+:([^@]+)@.*/\1/')
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 bash -c \"pg_dump --data-only --inserts --rows-per-insert=1 --table=auth.identities 'postgresql://postgres:${PROD_PW}@db.gzhxgoigflftharcmdqj.supabase.co:5432/postgres' > /tmp/phase5_auth_identities.sql\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 sed -i -E 's/\);\$/) ON CONFLICT (id) DO NOTHING;/' /tmp/phase5_auth_identities.sql"
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -f /tmp/phase5_auth_identities.sql"
```
This must run **after** Step 3 — `auth.identities.user_id` foreign-keys to `auth.users.id`.

- [ ] **Step 5: Verify row counts converge, clean up the dump files**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities;\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 rm /tmp/phase5_auth_users.sql /tmp/phase5_auth_identities.sql"
```
Expected: both counts match production's real current counts from Step 1's re-check. The `rm` matters — these files hold real password hashes and PII and should not linger on disk.

- [ ] **Step 6: Structural spot-check against production (5 sampled users)**

Pick 5 `id`s from self-hosted (oldest, newest, and 3 more by your choice):
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT id, email, encrypted_password FROM auth.users ORDER BY created_at ASC LIMIT 1;\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT id, email, encrypted_password FROM auth.users ORDER BY created_at DESC LIMIT 1;\""
```
For each sampled `id`, query the same 3 columns on production via `mcp__claude_ai_Supabase__execute_sql` (`project_id="gzhxgoigflftharcmdqj"`) and confirm `email` and `encrypted_password` are byte-identical. Do not print full `encrypted_password` values side-by-side in your report if you're worried about volume — a `match`/`mismatch` verdict per sampled user is sufficient, but if you find a mismatch, quote enough to show the actual difference (a hash mismatch here is a real, reportable problem, not something to gloss over).

- [ ] **Step 7: Create the trigger — only now, after the bulk migration is done**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();\""
```
If this had been created before Step 3, every migrated row would have fired `handle_new_user()` and collided with `public.profiles`' already-replicated rows for the same `id` (see the design spec §3's note on this) — confirm you are running this only now, not earlier.

- [ ] **Step 8: Verify the trigger fires correctly on a genuinely new signup**

```bash
ssh hostinger-vps "ANON_KEY=\$(grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-); curl -s -X POST https://supabase.sosservices.online/auth/v1/signup -H \"apikey: \$ANON_KEY\" -H 'Content-Type: application/json' -d '{\"email\":\"phase5-trigger-verify-test@sosservices.online\",\"password\":\"Phase5VerifyTrigger!2026\"}'"
```
(Self-hosted's own `ANON_KEY` — see Global Constraints on why this must not be production's key from the repo-root `env` file.)
Expected: a JSON response with a new `id`. Then confirm both sides landed:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT u.id, p.id IS NOT NULL AS has_profile FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.email = 'phase5-trigger-verify-test@sosservices.online';\""
```
Expected: one row, `has_profile = t` — proves the trigger fired and `handle_new_user()` ran successfully for a real new signup.

- [ ] **Step 9: Clean up the trigger-verification test signup**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"DELETE FROM public.profiles WHERE email = 'phase5-trigger-verify-test@sosservices.online'; DELETE FROM auth.identities WHERE user_id = (SELECT id FROM auth.users WHERE email = 'phase5-trigger-verify-test@sosservices.online'); DELETE FROM auth.users WHERE email = 'phase5-trigger-verify-test@sosservices.online';\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities; SELECT count(*) FROM public.profiles;\""
```
Expected: counts back to the real migrated totals (103/101/105 — 104 original + 0, since this test row is now removed; adjust to whatever Step 5 actually confirmed).

- [ ] **Step 10: Run the four standard health-check curls**

(command in Global Constraints). Expected: all four `200`.

---

### Task 2: Align the JWT secret

**Files:**
- Modify: `env` (repo root, gitignored) — update `JWT_SECRET` to production's real value.
- Modify: `deploy/selfhosted-supabase/README.md` — document the JWT alignment and the Coolify env-var API's PATCH-for-update / preview-copy behavior discovered during planning.

**Interfaces:**
- Consumes: Task 1's migrated users (this task's verification signs in as one of them).
- Produces: nothing further tasks depend on — last task in this plan.

- [ ] **Step 1: STOP — confirm production's real JWT secret is available**

This task cannot proceed past this point without it. Ask the plan owner for it now if it hasn't been supplied (Supabase Dashboard → Project Settings → API → JWT Settings → legacy JWT secret) — do not fabricate, guess, or substitute self-hosted's existing generated value. Once supplied, update the repo-root `env` file's `JWT_SECRET` line to this real value (never print the value itself anywhere in your report).

- [ ] **Step 2: Update Coolify's env-var store for both copies**

```bash
TOKEN=$(grep -E '^COOLIFY_API_TOKEN=' env | sed 's/^COOLIFY_API_TOKEN="//;s/"$//')
NEW_SECRET=$(grep -E '^JWT_SECRET=' env | sed 's/^JWT_SECRET="//;s/"$//')
curl -s "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/envs" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X PATCH -d "{\"key\": \"JWT_SECRET\", \"value\": \"${NEW_SECRET}\"}" -w "\nHTTP:%{http_code}\n"
curl -s "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/envs" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X PATCH -d "{\"key\": \"JWT_SECRET\", \"value\": \"${NEW_SECRET}\", \"is_preview\": true}" -w "\nHTTP:%{http_code}\n"
```
Expected: both return `201` with a `uuid` matching JWT_SECRET's existing two entries (confirmed during planning: `PATCH` updates in place, does not create a third/duplicate entry — do not use `POST` here, that pattern is for genuinely new keys only). Report the two `uuid`s returned and confirm they match what a `GET` on the same endpoint shows for `JWT_SECRET` before this step (filter for `"key": "JWT_SECRET"` in the response, there should be exactly 2 matching entries both before and after — never print the `value` field in your report, it isn't even returned by `GET` on this endpoint, but the two entries' `uuid`s and `is_preview` flags are fine to quote).

- [ ] **Step 3: Recreate the 4 containers that read this env var at runtime — never `db`**

Note: `NEW_SECRET` from Step 2 was a shell variable in that step's own command — it does not persist to this step if run as a separate command. Re-derive it here (this is cheap and safe since Step 1 already wrote the real secret into the repo-root `env` file):
```bash
NEW_SECRET=$(grep -E '^JWT_SECRET=' env | sed 's/^JWT_SECRET="//;s/"$//')
```
The on-disk `.env` at the live compose directory needs the new `JWT_SECRET` too, or a manual `docker compose` invocation will re-apply the *old* value (this is the same "flat `.env` is a decoy for Coolify's own redeploys, but is what a manual `docker compose` invocation actually reads" mechanic Phase 5a's README section documents). Update it before recreating anything:
```bash
ssh hostinger-vps "sed -i \"s#^JWT_SECRET=.*#JWT_SECRET=${NEW_SECRET}#\" /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
```
Then pull (a no-op here — no image tag changed, only an env var — but costs nothing and matches Phase 5a's established two-step pattern) and recreate just these 4 services:
```bash
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml pull auth rest realtime functions"
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml up -d auth rest realtime functions"
```

Confirm: the 3 OTHER stack containers (`db`, `kong`, `storage`) must show **unchanged** uptime after this — same stop-condition discipline as Phase 5a. If any of them show a fresh uptime, stop and report before continuing.

- [ ] **Step 4: Align the database-level GUC directly — no container recreate needed for this**

Re-derive `NEW_SECRET` again if running this as a separate command from Step 3 (same reasoning as Step 3's note):
```bash
NEW_SECRET=$(grep -E '^JWT_SECRET=' env | sed 's/^JWT_SECRET="//;s/"$//')
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"ALTER DATABASE postgres SET \\\"app.settings.jwt_secret\\\" TO '${NEW_SECRET}';\""
```
Verify (do not print the actual value — just confirm its length changed from self-hosted's old generated secret, which is a different length than production's, or do a byte-length comparison rather than printing either value):
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT length(current_setting('app.settings.jwt_secret'));\""
```

- [ ] **Step 5: Verify a still-valid production access token is accepted self-hosted**

If the plan owner can supply a currently-unexpired production access token (e.g., from their own active browser session), decode its header/payload (base64, no signature verification needed just to inspect it) to confirm it's a real, unexpired GoTrue token, then:
```bash
ssh hostinger-vps "ANON_KEY=\$(grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-); curl -s -H 'Authorization: Bearer <that token>' -H \"apikey: \$ANON_KEY\" https://supabase.sosservices.online/auth/v1/user"
```
Expected: a `200` with that user's real data, not a `401`. If no such token is available to test with, this step is optional per the design spec's §4 point 3 — note in your report that it was skipped and why, don't treat it as a hard failure.

- [ ] **Step 6: Confirm self-hosted's own signup path still works after the secret change**

Repeat Task 1 Step 8's signup call with a fresh disposable email, confirm it returns a `200`/`201` with a token (not an error) — a wrong secret would break self-hosted's own token issuance, not just cross-secret validation. Clean up this second test signup the same way as Task 1 Step 9.

- [ ] **Step 7: Run the four standard health-check curls**

(command in Global Constraints). Expected: all four `200`.

- [ ] **Step 8: Document in the README**

Add a short section (near Phase 5a's) covering: the JWT secret is now aligned with production; the two-part mechanism (env var + container recreate for `auth`/`rest`/`realtime`/`functions`, plus a direct `ALTER DATABASE` for `db`'s GUC, since the `db` service's own env var is inert post-bootstrap); and the newly-confirmed Coolify env-var API behavior (`POST` for new keys, `PATCH` to update an existing one in place without duplicating, `is_preview` flag needed to reach the second of the two auto-created entries per key).

- [ ] **Step 9: Commit**

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(selfhost-supabase): document Phase 5 auth migration and JWT secret alignment"
```
(The `env` file is gitignored and never committed — its `JWT_SECRET` update from Step 1 stays local/on-VPS only, per this project's established secrets convention.)

---

## Plan Self-Review

**Spec coverage:** Design spec §2 Goals (data migrated byte-identical, trigger fires only on new signups, JWT aligned, test user removed) → Task 1 Steps 2-9 + Task 2 entirely. §3 Approach's exact corrected mechanics (true-direct host, `--inserts --rows-per-insert=1`, trigger-after-migration ordering, two-part JWT fix, no `db` recreate) → carried through verbatim into Task 1 Steps 3-4/7 and Task 2 Steps 2-4. §4 Verification Plan's 7 points → Task 1 Steps 5-6/8/10 and Task 2 Steps 5-7. §5 Rollback is not a task here (nothing in this plan is expected to need it absent a verification failure) but its two-part-revert shape is available to whoever handles a real rollback, matching how Phase 5a's plan handled the same relationship.

**Placeholder scan:** No TBD/TODO. Task 2 Step 1 is an explicit, named stop-condition (not a vague placeholder) — matches this project's established pattern for genuine external-secret dependencies (Phase 4 Batch 2's OpenAI/Google keys, Phase 2's DB password). Task 2 Step 5 is explicitly optional with a stated reason, not a silently-skippable item.

**Type/name consistency:** Container names, the Coolify UUID, and the true-direct production host string are identical everywhere they appear across both tasks and the Global Constraints. The `ON CONFLICT (id) DO NOTHING` transform and the `--inserts --rows-per-insert=1` flag combination are used identically in Task 1 Steps 3 and 4 (both tables). The PATCH-vs-POST env-var API distinction is stated once in Global Constraints and referenced, not re-derived differently, in Task 2 Step 2.

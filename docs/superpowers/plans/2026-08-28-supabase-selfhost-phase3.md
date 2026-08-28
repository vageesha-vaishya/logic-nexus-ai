# Phase 3: Storage Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicate Supabase Storage's bucket configuration, `storage.objects` RLS policies, and the actual file bytes from production (Supabase Cloud, project `gzhxgoigflftharcmdqj`) to the self-hosted stack, so self-hosted's Storage API serves the same buckets/access rules/files production does.

**Architecture:** Two tasks. Task 1 replicates the small, rarely-changing metadata (9 bucket rows, 26 RLS policies on `storage.objects`) via direct SQL. Task 2 transfers the actual file bytes (11 real objects, 155 KB total, as of this plan's writing) via a re-runnable bash script that calls each side's Storage HTTP API — no direct disk manipulation, no Postgres-level replication of `storage.objects` rows (the Storage API's own upload call creates those automatically).

**Tech Stack:** bash + curl + psql (matches this project's existing `deploy/selfhosted-supabase/scripts/` convention from Phase 2), Supabase Storage HTTP API (`/storage/v1/bucket`, `/storage/v1/object/{bucket}/{path}`), direct SQL against both Postgres instances.

## Global Constraints

- Production is Supabase Cloud project `gzhxgoigflftharcmdqj`, reachable via the `mcp__claude_ai_Supabase__execute_sql` MCP tool (`project_id: "gzhxgoigflftharcmdqj"`) for SQL, and `https://gzhxgoigflftharcmdqj.supabase.co` for its Storage API.
- Self-hosted Postgres is reachable via `ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"<SQL>\""`. Self-hosted's Storage API is reachable through Kong at `https://supabase.sosservices.online`.
- Production's `service_role` JWT is in the repo-root gitignored `env` file as `SUPABASE_SERVICE_ROLE_KEY`. Self-hosted's own `service_role` JWT lives in that same stack's `.env` on the VPS (provisioned in Phase 1, see `deploy/selfhosted-supabase/env.example`) — an implementer must fetch it via `ssh hostinger-vps "cat /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | grep SERVICE_ROLE"` or the Coolify UI, not guess it.
- Never print either `service_role` JWT in a report file — reference by name/location only, per this project's established secrets convention.
- Run the four standard production health-check curls after every state-changing step against production (there are none in this plan that write to production — see below — but confirm health after any step that touches self-hosted's live containers too, since Kong/Storage restart or misconfiguration could theoretically cascade):
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
- This plan never writes to production — every production interaction is a read (SQL SELECT, or an HTTP GET against its Storage API). See the design spec's §3b/§6 note: the `service_role` JWT itself is not access-restricted (Supabase has no read-only variant of it), so "read-only against production" here is a property of which calls this plan's scripts make, not the credential — do not describe or imply otherwise in any output.

---

### Task 1: Storage bucket and RLS policy metadata replication

**Files:**
- Create: `deploy/selfhosted-supabase/scripts/phase3-storage-buckets.sql`
- Create: `deploy/selfhosted-supabase/scripts/phase3-generate-storage-policies.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the first task).
- Produces: self-hosted `storage.buckets` populated with all 9 production buckets; self-hosted `storage.objects` has all 26 of production's RLS policies. Task 2 depends on the 9 buckets existing (its uploads target these bucket ids) but does NOT depend on the RLS policies (Task 2 authenticates as `service_role`, which bypasses RLS entirely) — the two halves of this task are independently useful, but kept in one task because they're both small, one-time metadata operations with no natural test-cycle split.

- [ ] **Step 1: Verify the production `service_role` JWT works against production's Storage API**

```bash
PROD_SERVICE_ROLE_KEY="<value from env's SUPABASE_SERVICE_ROLE_KEY>"
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $PROD_SERVICE_ROLE_KEY" \
  -H "apikey: $PROD_SERVICE_ROLE_KEY" \
  https://gzhxgoigflftharcmdqj.supabase.co/storage/v1/bucket
```
Expected: `200`. If not, stop and escalate — do not proceed with a credential that doesn't work.

- [ ] **Step 2: Verify the self-hosted `service_role` JWT works against self-hosted's Storage API**

```bash
SELFHOSTED_SERVICE_ROLE_KEY="$(ssh hostinger-vps "grep '^SERVICE_ROLE_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")"
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $SELFHOSTED_SERVICE_ROLE_KEY" \
  -H "apikey: $SELFHOSTED_SERVICE_ROLE_KEY" \
  https://supabase.sosservices.online/storage/v1/bucket
```
Expected: `200` with a JSON array (empty array `[]` is fine — no buckets exist yet on self-hosted). If the env var name differs from `SERVICE_ROLE_KEY` in that file, `grep -i service_role` to find the actual name and adjust — do not guess a name that doesn't exist in the file.

- [ ] **Step 3: Verify the RLS-referenced functions and tables exist on self-hosted**

The 26 production policies on `storage.objects` reference 3 `public`-schema functions and 5 `public`-schema tables. Confirm all 8 exist on self-hosted before creating any policy that depends on them:

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname IN ('is_platform_admin','get_user_tenant_id','get_user_franchise_id') AND pronamespace = 'public'::regnamespace) AS functions_found,
  (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('file_attachments','directives','vendors','user_roles','profiles')) AS tables_found;
\""
```
Expected: `functions_found = 3`, `tables_found = 5`. If either count is lower, STOP — do not create a policy referencing a function/table that doesn't exist self-hosted (it would fail at `CREATE POLICY` time with a clear error, but confirming first avoids wasting the rest of this task on a doomed attempt, and if a dependency really is missing, that's a real gap belonging to Phase 2's scope, not something this task should paper over).

- [ ] **Step 4: Write `phase3-storage-buckets.sql`**

```sql
-- Phase 3: replicate production's storage.buckets rows to self-hosted.
-- Source of truth: production project gzhxgoigflftharcmdqj, storage.buckets,
-- captured 2026-08-28. Re-verify against production before re-running if
-- buckets may have changed since (see Task 1 Step 5's verification query).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection) VALUES
  ('app-attachments', 'app-attachments', false, NULL, NULL, false),
  ('app-attachments-public', 'app-attachments-public', true, NULL, NULL, false),
  ('commodity-docs', 'commodity-docs', true, NULL, NULL, false),
  ('db-backups', 'db-backups', false, NULL, NULL, false),
  ('directive-attachments', 'directive-attachments', false, NULL, NULL, false),
  ('email-attachments', 'email-attachments', false, NULL, NULL, false),
  ('organization-assets', 'organization-assets', true, NULL, NULL, false),
  ('tenant-branding', 'tenant-branding', true, 2097152, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp'], false),
  ('vendor-documents', 'vendor-documents', false, NULL, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  avif_autodetection = EXCLUDED.avif_autodetection;
```

`ON CONFLICT ... DO UPDATE` makes this safe to re-run (idempotent), consistent with the design spec's re-runnability goal.

- [ ] **Step 5: Apply it to self-hosted and verify bucket config matches production exactly**

```bash
scp deploy/selfhosted-supabase/scripts/phase3-storage-buckets.sql hostinger-vps:/tmp/phase3-storage-buckets.sql
ssh hostinger-vps "docker cp /tmp/phase3-storage-buckets.sql db-i64jlyerora7ao9vkw5sweh3-103525206238:/tmp/ && docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -f /tmp/phase3-storage-buckets.sql"
```

Then diff against a fresh production read (via `mcp__claude_ai_Supabase__execute_sql`, `project_id: "gzhxgoigflftharcmdqj"`):
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types, avif_autodetection FROM storage.buckets ORDER BY 1;
```
against the self-hosted equivalent:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"SELECT id, name, public, file_size_limit, allowed_mime_types, avif_autodetection FROM storage.buckets ORDER BY 1;\""
```
Expected: all 9 rows identical field-for-field on both sides. If production shows a 10th bucket or different field values than Step 4's hardcoded INSERT (meaning something changed since this plan was written), update the SQL file to match live production before proceeding — the file must reflect actual current production state, not this plan's snapshot, if they've diverged.

- [ ] **Step 6: Write `phase3-generate-storage-policies.sql`**

This is a **generation query** — run it against production to produce the exact `CREATE POLICY` statements for self-hosted, rather than hand-transcribing 26 policies (the same "diff-driven, not hand-transcribed" discipline Phase 2 used for its 136 triggers, since manual transcription of complex policy expressions risks a silent, hard-to-spot error).

```sql
-- Phase 3: generates CREATE POLICY statements for every RLS policy on
-- storage.objects. RUN THIS AGAINST PRODUCTION. Capture the output
-- (one statement per row) and execute it against self-hosted.
SELECT format(
  E'CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s;',
  policyname,
  permissive,
  cmd,
  array_to_string(roles, ', '),
  CASE WHEN qual IS NOT NULL THEN E'\n  USING (' || qual || ')' ELSE '' END,
  CASE WHEN with_check IS NOT NULL THEN E'\n  WITH CHECK (' || with_check || ')' ELSE '' END
) AS create_policy_sql
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
```

- [ ] **Step 7: Run the generation query against production, capture the output**

Via `mcp__claude_ai_Supabase__execute_sql` with `project_id: "gzhxgoigflftharcmdqj"` and the query from Step 6. This returns 26 rows, each one complete `CREATE POLICY ...;` statement. Concatenate all 26 into one SQL script (newline-separated).

- [ ] **Step 8: Verify self-hosted's `storage.objects` has no pre-existing policies that would conflict, then apply the captured statements**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects';\""
```
Expected: `0` (GoTrue/Storage's own Phase 1 bootstrap doesn't create custom policies here — if this is nonzero, stop and investigate what's already there before blindly applying more policies on top). Then write the 26 captured statements from Step 7 to a local file, `scp`/`docker cp` it the same way as Step 5, and execute it:
```bash
ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < captured_policies.sql
```
`-v ON_ERROR_STOP=1` ensures a single bad statement (e.g. an unexpected dependency gap Step 3 missed) halts immediately rather than silently applying 25 of 26 and reporting success.

- [ ] **Step 9: Verify RLS policy match via full-set text diff, not a sample**

Re-run the Step 6 generation query against **self-hosted** too (same SQL, different connection), and diff its 26 output rows against production's Step 7 output, row for row. Expected: identical text for all 26 (this proves `USING`/`WITH CHECK` expressions, command type, and role list all match exactly — not just that 26 policies exist by count). If any differ, the plan owner must decide whether it's a real production-side change since Step 7 (re-run the whole task) or a genuine bug in this task's execution (fix and re-verify) — do not proceed to Task 2 with an unexplained mismatch.

- [ ] **Step 10: Commit**

```bash
git add deploy/selfhosted-supabase/scripts/phase3-storage-buckets.sql deploy/selfhosted-supabase/scripts/phase3-generate-storage-policies.sql
git commit -m "feat(selfhost-supabase): replicate Phase 3 storage bucket config and RLS policies"
```

---

### Task 2: File transfer and verification

**Files:**
- Create: `deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh`
- Modify: `deploy/selfhosted-supabase/README.md` (add a short "Phase 3: Storage Sync" section, mirroring Phase 2's documentation pattern)

**Interfaces:**
- Consumes: the 9 buckets created in Task 1 Step 5 (upload targets must already exist — Supabase's Storage API returns an error uploading to a nonexistent bucket, it doesn't auto-create one).
- Produces: nothing further tasks depend on — this is the last task in this plan. (Re-running this same script is how the pre-Phase-6-cutover re-sync happens, per the design spec's goal — no separate "Phase 6 prep task" needed now.)

- [ ] **Step 1: Write `phase3-storage-sync.sh`**

Object listing uses production's `postgres`-role direct connection (`env`'s `DIRECT_URL`) rather than `phase2_replicator` — that role was never granted anything on the `storage` schema (Phase 2 deliberately excluded it as one of the 10 Supabase-managed schemas), so it would fail with a permission error reading `storage.objects`. The `postgres` role, already verified working against production multiple times during Phase 2, has no such restriction.

```bash
#!/bin/bash
# Phase 3: syncs Storage object bytes from production to self-hosted via
# each side's Storage HTTP API. Idempotent (re-uploading overwrites) - this
# same script is what gets re-run just before Phase 6's cutover to catch
# anything uploaded to production in the interim.
#
# Required env vars:
#   PHASE3_PROD_SERVICE_ROLE_KEY  - production's service_role JWT (Storage API auth)
#   PHASE3_SELFHOSTED_SERVICE_ROLE_KEY - self-hosted's service_role JWT (Storage API auth)
#   PHASE3_PROD_PG_CONN           - production's direct (non-pooled) postgres-role
#                                   connection string, e.g. env's DIRECT_URL
#                                   (used only to list storage.objects rows)
#   PHASE3_SSH_HOST               - SSH alias for the VPS
#   PHASE3_DB_CONTAINER           - self-hosted Postgres container name (only
#                                   used to run the listing query through the
#                                   same already-configured psql client that
#                                   container has; no self-hosted DB write)
set -uo pipefail

: "${PHASE3_PROD_SERVICE_ROLE_KEY:?Set PHASE3_PROD_SERVICE_ROLE_KEY}"
: "${PHASE3_SELFHOSTED_SERVICE_ROLE_KEY:?Set PHASE3_SELFHOSTED_SERVICE_ROLE_KEY}"
: "${PHASE3_PROD_PG_CONN:?Set PHASE3_PROD_PG_CONN}"
: "${PHASE3_SSH_HOST:?Set PHASE3_SSH_HOST}"
: "${PHASE3_DB_CONTAINER:?Set PHASE3_DB_CONTAINER}"

PROD_URL="https://gzhxgoigflftharcmdqj.supabase.co"
SELFHOSTED_URL="https://supabase.sosservices.online"
LOG="./phase3-storage-sync.log"
: > "$LOG"

# List every real object (bucket_id, name, content-type) directly from
# production's storage.objects - simpler and more reliable than paginating
# the Storage API's list endpoint, and we already have DB read access.
OBJECTS=$(ssh -n -o BatchMode=yes -o ConnectTimeout=8 "$PHASE3_SSH_HOST" \
  "docker exec $PHASE3_DB_CONTAINER psql \"$PHASE3_PROD_PG_CONN\" -tAc \
  \"SELECT bucket_id || '|' || name || '|' || coalesce(metadata->>'mimetype','application/octet-stream') FROM storage.objects ORDER BY bucket_id, name;\"")

TOTAL=$(echo "$OBJECTS" | grep -c . || true)
DONE=0; OK=0; FAIL=0
echo "$(date -u) START total=$TOTAL" >> "$LOG"

echo "$OBJECTS" | while IFS='|' read -r BUCKET NAME MIMETYPE; do
  [ -z "$BUCKET" ] && continue
  DONE=$((DONE+1))
  TMPFILE=$(mktemp)

  HTTP_CODE=$(curl -s -o "$TMPFILE" -w '%{http_code}' \
    -H "Authorization: Bearer $PHASE3_PROD_SERVICE_ROLE_KEY" \
    -H "apikey: $PHASE3_PROD_SERVICE_ROLE_KEY" \
    "$PROD_URL/storage/v1/object/$BUCKET/$NAME")
  if [ "$HTTP_CODE" != "200" ]; then
    echo "$(date -u) [$DONE/$TOTAL] FAIL(download:$HTTP_CODE) $BUCKET/$NAME" >> "$LOG"
    FAIL=$((FAIL+1)); rm -f "$TMPFILE"; continue
  fi

  UPLOAD_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $PHASE3_SELFHOSTED_SERVICE_ROLE_KEY" \
    -H "apikey: $PHASE3_SELFHOSTED_SERVICE_ROLE_KEY" \
    -H "Content-Type: $MIMETYPE" \
    -H "x-upsert: true" \
    --data-binary "@$TMPFILE" \
    "$SELFHOSTED_URL/storage/v1/object/$BUCKET/$NAME")
  if [ "$UPLOAD_CODE" == "200" ]; then
    echo "$(date -u) [$DONE/$TOTAL] OK $BUCKET/$NAME" >> "$LOG"
    OK=$((OK+1))
  else
    echo "$(date -u) [$DONE/$TOTAL] FAIL(upload:$UPLOAD_CODE) $BUCKET/$NAME" >> "$LOG"
    FAIL=$((FAIL+1))
  fi
  rm -f "$TMPFILE"
done

echo "$(date -u) DONE total=$TOTAL" >> "$LOG"
echo "See $LOG for per-object results (the while-loop's OK/FAIL counters don't survive the pipe subshell - grep the log for the real tally)."
grep -c ' OK ' "$LOG" || true
grep -c 'FAIL' "$LOG" || true
```

- [ ] **Step 2: Save and make it executable**

Save the script from Step 1 to `deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh` and `chmod +x` it.

- [ ] **Step 3: Fetch both service-role keys and run the script**

```bash
PROD_KEY="<value from env's SUPABASE_SERVICE_ROLE_KEY>"
SELFHOSTED_KEY="$(ssh hostinger-vps "grep -i service_role /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")"
PHASE3_PROD_SERVICE_ROLE_KEY="$PROD_KEY" \
PHASE3_SELFHOSTED_SERVICE_ROLE_KEY="$SELFHOSTED_KEY" \
PHASE3_PROD_PG_CONN="<value from env's DIRECT_URL>" \
PHASE3_SSH_HOST=hostinger-vps \
PHASE3_DB_CONTAINER=db-i64jlyerora7ao9vkw5sweh3-103525206238 \
bash deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh
```
Expected: log shows 11 `OK` lines, 0 `FAIL` lines (matching the 11 real objects known to exist as of this plan's writing — re-verify the actual current count first via `SELECT count(*) FROM storage.objects;` on production if time has passed, since this is a live, still-growing-if-slowly system).

- [ ] **Step 4: Verify object completeness (count and size) on both sides**

```sql
-- On production:
SELECT bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint)) FROM storage.objects GROUP BY 1 ORDER BY 1;
```
```bash
# On self-hosted:
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"SELECT bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint)) FROM storage.objects GROUP BY 1 ORDER BY 1;\""
```
Expected: identical per-bucket counts and sizes on both sides.

- [ ] **Step 5: Live smoke test through self-hosted's actual Storage API URL**

Pick one real object (e.g. from `organization-assets`, the bucket with known content) and fetch it through self-hosted's public Kong-routed URL, not a container-internal address:
```bash
curl -s -o /tmp/selfhosted_copy -w 'HTTP %{http_code}, content-type: %{content_type}\n' \
  https://supabase.sosservices.online/storage/v1/object/public/organization-assets/<actual-object-name-from-Step-4>
```
(Use the `/object/public/` path since `organization-assets` is a public bucket — no auth header needed for a public bucket's public-read path.) Then compare its checksum against the same object fetched from production:
```bash
curl -s -o /tmp/prod_copy \
  -H "Authorization: Bearer $PROD_KEY" -H "apikey: $PROD_KEY" \
  "https://gzhxgoigflftharcmdqj.supabase.co/storage/v1/object/organization-assets/<same-object-name>"
diff <(sha256sum /tmp/selfhosted_copy | cut -d' ' -f1) <(sha256sum /tmp/prod_copy | cut -d' ' -f1)
```
Expected: `diff` produces no output (checksums match) and both curls report `HTTP 200`.

- [ ] **Step 6: Idempotency check — re-run the sync script immediately**

```bash
PHASE3_PROD_SERVICE_ROLE_KEY="$PROD_KEY" \
PHASE3_SELFHOSTED_SERVICE_ROLE_KEY="$SELFHOSTED_KEY" \
PHASE3_PROD_PG_CONN="<value from env's DIRECT_URL>" \
PHASE3_SSH_HOST=hostinger-vps \
PHASE3_DB_CONTAINER=db-i64jlyerora7ao9vkw5sweh3-103525206238 \
bash deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh
```
Expected: same `OK` count as Step 3 (uploads succeed again since `x-upsert: true` overwrites rather than erroring on an existing object), zero new `FAIL` lines, and re-running Step 4's count/size verification still matches — proving this script is safe to re-run before Phase 6's cutover without manual cleanup first.

- [ ] **Step 7: Document this phase in the README**

Add a short "Phase 3: Storage Sync" section to `deploy/selfhosted-supabase/README.md` (after the existing "Phase 2: Logical Replication" section), covering: what got replicated (buckets, RLS policies, file bytes), the two scripts and how to re-run `phase3-storage-sync.sh` before cutover, and the note from this plan's Global Constraints that `service_role` JWTs are full-access on both sides (not a Phase-2-style least-privilege role) — a future maintainer re-running this needs to know that up front, not discover it by re-reading this plan.

- [ ] **Step 8: Commit**

```bash
git add deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh deploy/selfhosted-supabase/README.md
git commit -m "feat(selfhost-supabase): add Phase 3 storage file sync script and docs"
```

- [ ] **Step 9: Final health check**

```bash
ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
```
Expected: all four `200`.

---

## Plan Self-Review

**Spec coverage:** §2 Goals → Task 1 (buckets §Goals-1, RLS policies §Goals-2), Task 2 (file bytes §Goals-3, re-runnable script §Goals-4). §3 Architecture's 3a/3b → Task 1 / Task 2 respectively, including the corrected read-only-by-behavior note from the spec's self-review carried through verbatim into this plan's Global Constraints. §4 Safety & Monitoring → health checks in Global Constraints + Task 2 Step 9; no-interaction-with-Phase-2-subscription is inherently true (nothing in either task touches `pg_subscription`/replication objects). §5 Verification Plan's 5 items → Task 1 Steps 5/9 (bucket + policy match), Task 2 Step 4 (object completeness), Step 5 (live smoke test), Step 6 (idempotency). §6 Open Items: the service-role credential question is answered directly in Task 1 Steps 1-2 (verify both work) and the credential-scope caveat is carried into Global Constraints and Task 2 Step 7's README ask; the `db-backups` bucket is included uniformly in Task 1's bucket list per the spec's stated resolution (replicate config for completeness, no file-transfer work since it's empty).

**Placeholder scan (round 2, after fixing a real bug found in round 1):** round 1 caught two issues in Task 2 Step 1's script: a dead-end `dblink` code block left in as an unexplained "worked example" (removed — `writing-plans` requires every step's code to be the actual content needed, not a wrong-turn-plus-cleanup pair), and a real correctness bug (listing `storage.objects` via `phase2_replicator`, a role Phase 2 never granted anything on the `storage` schema, since that schema was explicitly out of Phase 2's scope — this would have failed with a permission error on first run). Both fixed: the script now lists objects via production's `postgres`-role direct connection (`PHASE3_PROD_PG_CONN`, sourced from `env`'s `DIRECT_URL`), the same connection Phase 2 already verified extensively. No other TBD/TODO. Task 1 Step 4's bucket data and the credential-fetch commands use real, concrete values (actual bucket rows, actual container/app IDs) rather than generic placeholders — the only bracketed items (`<value from env's ...>`) are genuine external secrets this plan correctly cannot know in advance, matching the same convention Phase 2's plan used for its DB password.

**Type/name consistency:** `PHASE3_PROD_SERVICE_ROLE_KEY` / `PHASE3_SELFHOSTED_SERVICE_ROLE_KEY` / `PHASE3_PROD_PG_CONN` / `PHASE3_SSH_HOST` / `PHASE3_DB_CONTAINER` are defined once in Task 2 Step 1's script header and used identically in Steps 3 and 6 (both invocations now pass all five, including the corrected `PHASE3_PROD_PG_CONN` — checked specifically since this was the exact variable the round-1 fix touched). Bucket ids in Task 1 Step 4 match exactly what Task 2's verification queries reference (`organization-assets` used in both).

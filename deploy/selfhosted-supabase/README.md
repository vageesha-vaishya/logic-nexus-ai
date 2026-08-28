# Self-hosted Supabase — Phase 1 lean stack

Docker-compose config for a resource-capped, self-hosted Supabase-equivalent
stack (Postgres + Kong + Auth + REST + Storage + Realtime + Edge Runtime),
deployed through Coolify on the existing shared Hostinger VPS
(`72.61.249.111`).

This is **Phase 1** of the "Logic Nexus AI" migration off Supabase Cloud
(project `gzhxgoigflftharcmdqj`) to self-hosted infrastructure. Phase 1 only
stands up empty, isolated infrastructure with **zero production traffic** —
nothing in the live app points at this stack yet. Full background, the
memory/networking rationale, and everything explicitly out of scope (Studio,
Analytics/Logflare, imgproxy, MinIO/S3) is in the design spec:

**[docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md](../../docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md)**

This directory follows the same documentation convention as the existing
[`deploy/`](../README.md) bundle (a different, legacy systemd-based
deployment path for the frontend + markets-worker) — a compose/config
bundle plus a README, not a script-driven install like that one.

> **Revised 2026-08-22 (final whole-plan review):** the sections below
> originally described a pre-revision architecture (Postgres as a separate
> Coolify-native "Database" resource, no `db` service in this compose file,
> "not a live deployment yet"). That was never true of the final, executed
> plan and directly contradicted the Rollback section below it. Corrected to
> describe the actual, current architecture: 7 services (including `db`) in
> one compose file, live and deployed as Coolify application
> `i64jlyerora7ao9vkw5sweh3`.

## What's in this directory

| File | Purpose |
|---|---|
| `docker-compose.yml` | The 7-service stack: `db`, `kong`, `auth`, `rest`, `storage`, `realtime`, `functions` — Postgres runs as the `db` service in this same compose file, not a separate Coolify-native "Database" resource (that approach was tried and doesn't work; see the plan's Task 2 history). |
| `kong.yml` | Kong's DB-less declarative config — routes `/auth/v1`, `/rest/v1`, `/graphql/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1` to their backends. Adapted from upstream `supabase/supabase`, with Studio/postgres-meta/Analytics routes removed (out of scope). |
| `kong-entrypoint.sh` | Kong's custom entrypoint — substitutes `$SUPABASE_ANON_KEY`/`$SUPABASE_SERVICE_KEY` and builds the request-transformer Lua expressions into `kong.yml` before Kong starts. Copied verbatim from upstream; do not hand-edit the substitution logic. |
| `env.example` | Every env var the compose file references, with placeholders and comments. Copy to `.env` (not committed) and fill in real values. Named without a leading dot, like `deploy/env.example`, so the repo's pre-commit hook (which blocks any staged `.env*` file as a secrets-safety guard) doesn't reject it. |
| `volumes/db/*.sql` | Postgres init scripts, bind-mounted into `db`'s `/docker-entrypoint-initdb.d/` — required unconditionally by `supabase/postgres`'s own entrypoint (see "Operational gotcha" below for why these can't just be edited and redeployed). |

## Where this deploys

- **Coolify project/environment**: the existing Coolify instance on
  `72.61.249.111`, alongside the platform's other resources (frontend,
  8 microservices, and ~24 unrelated apps). This stack is *additive* — it
  does not touch, replace, or reconfigure any existing Coolify resource.
- **Postgres**: the `db` service in this same `docker-compose.yml` — not a
  separate Coolify-native "Database" resource. That approach (matching the
  precedent proven by the `aviation-ai-pro` app on this same box) was the
  original plan but was abandoned during Task 2's execution: `supabase/postgres`'s
  own entrypoint unconditionally requires bind-mounted init SQL under
  `/docker-entrypoint-initdb.d/` (see `volumes/db/`), which a bare Coolify
  Database resource has no way to supply. `POSTGRES_HOST`/`POSTGRES_PORT` in
  `.env` are unused by `db` itself; every other service instead points its
  DB connection URL at the literal internal hostname `db:5432`.
- **Network**: all 7 services join the shared, pre-existing `coolify` Docker
  network (`external: true` in `docker-compose.yml`) — the same network every
  other Coolify-managed resource on this VPS uses. This is required for
  container-name DNS resolution to work (confirmed via `docker inspect`
  against existing resources on this VPS); it is not an isolation boundary.
  Memory limits (below) are.
- **Gateway domain**: Kong is the only service exposed via Coolify's Traefik,
  live at `https://supabase.sosservices.online`. The other 6 services are
  reachable only from Kong and each other, over the internal `coolify`
  network — Kong's `docker-compose.yml` port binding is loopback-only (see
  below), so Traefik reaches it purely by container name over `coolify`, the
  same as every other service-to-service hop in this stack.

This compose file is deployed and live as Coolify application
`i64jlyerora7ao9vkw5sweh3` (see Rollback below for full detail) — this
directory is not merely repo-tracked config awaiting deployment.

## Memory limits

Every service has an explicit `mem_limit`, matching the design spec's Global
Constraints table, and a `memswap_limit` equal to its own `mem_limit` (fixed
2026-08-22 — the six non-`db` services previously had no `memswap_limit` at
all, which meant each could swap up to 2x its memory cap; only `db` had this
set from the start). Setting `memswap_limit` equal to `mem_limit` means zero
extra swap headroom for any service — a clean OOM-kill inside this stack's
own cgroup beats swap-thrashing that could degrade the whole VPS.

| Service | Cap (`mem_limit` = `memswap_limit`) | Image |
|---|---|---|
| `db` | 3g | `supabase/postgres:17.6.1.136` |
| `kong` | 512m | `kong/kong:3.9.3` |
| `auth` | 256m | `supabase/gotrue:v2.189.0` |
| `rest` | 256m | `postgrest/postgrest:v14.12` |
| `storage` | 512m | `supabase/storage-api:v1.60.4` |
| `realtime` | 768m | `supabase/realtime:v2.102.3` |
| `functions` | 768m | `supabase/edge-runtime:v1.74.0` |

Total: ~6.1GB across all 7 containers in this one compose file, matching the
design spec. This is the concrete mechanism protecting the other 24 apps on
the shared VPS from this stack: if this stack's usage exceeds its own
ceiling, the kernel OOM-kills a process *inside this stack's cgroup*, not an
unrelated app's process.

## Known Phase 1 limitations (not blockers)

- **Edge Functions**: `functions` mounts `./volumes/functions` (not created by
  this task) — this only proves the Edge Runtime container starts and its
  healthcheck TCP port responds. None of the platform's 155 real Edge
  Functions are deployed yet (a later phase).
- **Realtime**: a bare WebSocket handshake through Kong is not the same as
  full tenant-scoped Realtime functionality, which needs a tenant registered
  via Realtime's `/api/tenants` endpoint. Deferred to a later phase once real
  data/replication exists.
- **Storage**: local-disk backend only (`STORAGE_BACKEND=file`), no
  MinIO/S3 — matches the spec's "skip MinIO" decision. Revisit only if a
  later phase actually needs S3-compatible access.
- **Coolify application status**: shows permanently as `restarting:unknown`
  in the Coolify UI/API, not `running`/`healthy` — this is `functions`'s
  known, permanent, isolated crash-loop (real Edge Function content doesn't
  exist yet, a later phase) dragging down the whole Compose application's
  aggregate status, even though the other 6 containers are individually
  healthy. Don't waste time chasing this as a regression; check each
  container's own health status instead (`docker ps`), not the application's
  rolled-up status.

## Validating this compose file

```bash
docker compose -f deploy/selfhosted-supabase/docker-compose.yml config --quiet
```

Exits 0 with no output when the YAML/schema is valid. This does **not**
start any containers or require the Postgres resource to exist yet — it's a
syntax/schema check only.

## Operational gotcha: bind-mounted config files do not refresh from git on redeploy

**Read this before editing `kong.yml` or any of the `volumes/db/*.sql` init
scripts.** Coolify resolves this compose file's file-based bind mounts
(`kong.yml`, `kong-entrypoint.sh`, and the `volumes/db/*.sql` scripts) to a
**stable, per-application host path**
(`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/...`) that persists
across redeploys — by design, so named volumes survive. But Coolify does
**not** re-sync an individual bind-mounted *file's content* from the git
checkout into that path on a later deploy; it only reads the repo for these
files the very first time a path is created. Editing one of these files in
the repo, committing, pushing, and redeploying updates the compose
definition and any image references, but the actual on-disk file the
container mounts stays pinned to whatever content was last manually placed
there.

This is confirmed **twice**, independently, in this Phase 1 rollout:
- Task 3's initial deploy: Coolify pre-created all 9 file-based mount paths
  as **empty directories** (before the git checkout was ever read), which
  had to be `rmdir`'d and manually `scp`'d with real file content.
- Task 5's Realtime routing fix: `kong.yml` was corrected in the repo,
  committed, pushed, and the app was redeployed — but the *live* bind-mounted
  `kong.yml` on the VPS still served the old, pre-fix content, because
  redeploy never re-synced that file. Only a manual re-seed fixed it.

**If you edit `kong.yml` or any `volumes/db/*.sql` file in this repo, a
normal Coolify redeploy is not sufficient by itself.** You must also:

1. Push the change and redeploy the Coolify application as usual (updates
   the compose definition/images).
2. Manually copy the corrected file to its live host path, e.g.:
   ```bash
   scp deploy/selfhosted-supabase/kong.yml \
     hostinger-vps:/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/kong.yml
   ```
   (adjust the relative path under `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/`
   to match whichever bind-mounted file you changed).
3. Restart the affected container(s) so they pick up the freshly-seeded file
   — e.g. `ssh hostinger-vps "docker restart kong-i64jlyerora7ao9vkw5sweh3-<id>"`.
   A full Coolify redeploy alone will **not** pick up the new file content;
   only restarting the container against the re-seeded host path does.

## Phase 2: Logical Replication

Phase 2 adds ongoing data replication from Supabase Cloud (production) into
this stack's `db`, across all 795 tables spanning the 21 application schemas
(`public` plus 20 others — see the Phase 2 design spec's §1a for the full
include/exclude list). Full history, defects found, and how they were fixed
is in the Phase 2 SDD progress ledger
(`.superpowers/sdd/2026-08-22-supabase-selfhost-phase2/progress.md`); this
section is the operational summary for running/tearing this down later.

**Objects:**
- `phase2_public_migration` — the publication on **production**, covering all
  21 schemas via `FOR TABLES IN SCHEMA` (dynamic — future tables in those
  schemas auto-join without needing to alter the publication).
- `phase2_replicator` — the dedicated role on production the subscription
  connects as (SELECT-only + `REPLICATION` + `BYPASSRLS`, no superuser).
- `phase2_public_migration_sub` / `phase2_public_migration_slot` — the
  subscription and its replication slot, both on self-hosted `db`.

**⚠ WAL retention: do not leave this subscription disabled for extended
periods.** Production's `max_slot_wal_keep_size` is 4GB, and this database's
write volume is enough to exceed that within roughly a day of normal
traffic if the slot sits idle while disabled (a disabled subscription still
pins its slot's `restart_lsn` in place while production keeps generating
WAL). This happened **twice** during Phase 2 development, each requiring a
full subscription rebuild (drop + recreate with a fresh slot, plus a full
data re-sync). If you must disable it to debug something, keep the window
to a few hours at most, or explicitly plan for a rebuild afterward rather
than a resume. Check slot health any time you're unsure:
```sql
-- On production:
SELECT slot_name, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;
```
`wal_status = 'lost'` means the slot is permanently dead — see "Rebuilding
after slot invalidation" below.

**Checking replication lag/health:**
```sql
-- On self-hosted:
SELECT subname, pid, received_lsn, latest_end_time FROM pg_stat_subscription;
SELECT srsubstate, count(*) FROM pg_subscription_rel GROUP BY 1;  -- all 795 should show 'r'
```
```sql
-- On production, confirm the two pre-existing Realtime publications are
-- unaffected (the durable evidence this phase hasn't degraded Realtime —
-- its replication slots are ephemeral and expected to come and go):
SELECT pubname, count(*) AS tables FROM pg_publication_tables
WHERE pubname IN ('supabase_realtime','supabase_realtime_messages_publication')
GROUP BY 1 ORDER BY 1;
```

**Rebuilding after slot invalidation** (or after any defect that leaves the
subscription's initial-copy mechanism unreliable — see the ledger's account
of a connection-churn defect in Postgres's native tablesync process that
made this necessary once): rather than trying to resume, do a full,
manually-driven rebuild:
1. `ALTER SUBSCRIPTION phase2_public_migration_sub SET (slot_name = NONE); DROP SUBSCRIPTION phase2_public_migration_sub;` on self-hosted (the slot is already dead/gone on the publisher, so it must be disassociated first or `DROP SUBSCRIPTION` will try and fail to drop it there). Drop the dead slot on production separately if it still shows up in `pg_replication_slots`.
2. Re-sync every table's data directly using [`scripts/phase2-manual-resync.sh`](scripts/phase2-manual-resync.sh) — this sidesteps Postgres's native tablesync mechanism entirely if that's what caused the problem. It dumps and reloads one table at a time (explicit non-generated column list on both sides to avoid column-mismatch errors, `SET LOCAL session_replication_role = replica` during the load to bypass FK/trigger ordering without needing topological table ordering, `DELETE FROM` rather than `TRUNCATE` since `TRUNCATE` fails on any table referenced by an FK even from an empty table). Generate the table list and run it:
   ```bash
   ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -tAc \"SELECT schemaname||'.'||tablename FROM pg_publication_tables WHERE pubname='phase2_public_migration' ORDER BY 1;\"" > tables.txt
   PHASE2_PROD_CONN="host=db.gzhxgoigflftharcmdqj.supabase.co port=5432 dbname=postgres user=phase2_replicator password=<PHASE2_REPLICATOR_PASSWORD from env> sslmode=require" \
   PHASE2_SSH_HOST=hostinger-vps \
   PHASE2_DB_CONTAINER=db-i64jlyerora7ao9vkw5sweh3-103525206238 \
   PHASE2_TABLE_LIST=tables.txt \
   bash deploy/selfhosted-supabase/scripts/phase2-manual-resync.sh
   ```
   The script exits non-zero if any table failed — check its log (`./phase2-manual-resync.log` by default) for `FAIL` lines and re-run with just the failed tables in a new list file. The two `NOT VALID` CHECK constraints below are the known failure modes this hit during Phase 2 development; there may be others for tables not yet exercised this way.
3. `CREATE SUBSCRIPTION phase2_public_migration_sub ... WITH (copy_data = false, create_slot = true, slot_name = 'phase2_public_migration_slot');` — `copy_data = false` marks all 795 tables `'r'` immediately with no per-table tablesync workers involved, and streaming (CDC only) starts fresh from the new slot's creation point.
4. Verify: all tables `'r'`, apply worker running with no errors, slot `active = true`, and a full row-count reconciliation against production (a single `UNION ALL` query summing counts across all 795 tables run on both sides and diffed) shows no mismatches beyond ordinary lag on high-write-frequency tables.

**Teardown — clean path (publisher reachable), verified 2026-08-27/28
against disposable test objects (`phase2_teardown_test_sub`/`_slot`/`_pub`),
never against the real subscription:**
```sql
-- On self-hosted:
DROP SUBSCRIPTION phase2_public_migration_sub;
```
This alone drops the slot on the publisher too — confirmed via
`SELECT slot_name FROM pg_replication_slots WHERE slot_name = 'phase2_public_migration_slot';`
returning zero rows immediately after.

**Teardown — manual-detach path (publisher unreachable, or you don't want
`DROP SUBSCRIPTION` to depend on network connectivity to production at
all):**
```sql
-- On self-hosted — this sequence never needs to reach the publisher:
ALTER SUBSCRIPTION phase2_public_migration_sub DISABLE;
ALTER SUBSCRIPTION phase2_public_migration_sub SET (slot_name = NONE);
DROP SUBSCRIPTION phase2_public_migration_sub;
```
This leaves the slot **orphaned** on production (confirmed via testing —
the slot still exists after this sequence completes). Clean it up manually
once the publisher is reachable again:
```sql
-- On production:
SELECT pg_drop_replication_slot('phase2_public_migration_slot');
```

## Phase 3: Storage Sync

Phase 3 replicates Supabase Storage — bucket configs, RLS policies, and
actual file bytes — from production to self-hosted. Unlike Phase 2, this is
not ongoing replication: it's a point-in-time copy, re-run manually
whenever needed (most importantly, once just before Phase 6's cutover to
pick up anything uploaded to production in the interim). Full history is in
the Phase 3 implementation plan
(`docs/superpowers/plans/2026-08-28-supabase-selfhost-phase3.md`) and design
spec (`docs/superpowers/specs/2026-08-28-supabase-selfhost-phase3-design.md`).
(The SDD task reports this work was originally tracked under,
`.superpowers/sdd/2026-08-28-supabase-selfhost-phase3/task-1-report.md` and
`task-2-report.md`, are gitignored and not available on a fresh clone — use
the plan/spec above instead.)

**What got replicated:**
- All 9 `storage.buckets` rows (config only — id, name, `public`,
  `file_size_limit`, `allowed_mime_types`, `avif_autodetection`), via
  `phase3-storage-buckets.sql`.
- All 31 RLS policies on `storage.objects` (not 26 — a plan-authoring
  snapshot had gone stale by execution time on this actively-written
  production database), captured point-in-time in
  `phase3-captured-storage-policies.sql` via the generator query in
  `phase3-generate-storage-policies.sql`.
- Actual file bytes for every real object in `storage.objects`, via
  [`scripts/phase3-storage-sync.sh`](scripts/phase3-storage-sync.sh).

**⚠ `service_role` JWTs are full-access on both sides.** Unlike Phase 2's
`phase2_replicator` (a purpose-built, least-privilege role), Phase 3's
sync script authenticates to both production's and self-hosted's Storage
APIs using each side's `service_role` JWT — which bypasses RLS entirely and
can read/write any bucket. There is no scoped-down credential option here;
the Storage HTTP API doesn't support one. Treat both keys with the same
care as any other full-access production secret.

**Re-running `phase3-storage-sync.sh` before cutover:**
```bash
PROD_KEY="<value from env's SUPABASE_SERVICE_ROLE_KEY>"
SELFHOSTED_KEY="$(ssh hostinger-vps "grep -E '^SERVICE_ROLE_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")"
PHASE3_PROD_SERVICE_ROLE_KEY="$PROD_KEY" \
PHASE3_SELFHOSTED_SERVICE_ROLE_KEY="$SELFHOSTED_KEY" \
PHASE3_PROD_PG_CONN="postgresql://postgres:<postgres role password, same one in env's DIRECT_URL>@db.gzhxgoigflftharcmdqj.supabase.co:5432/postgres?sslmode=require" \
PHASE3_SSH_HOST=hostinger-vps \
PHASE3_DB_CONTAINER=db-i64jlyerora7ao9vkw5sweh3-103525206238 \
bash deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh
```
It's safe to re-run repeatedly — uploads use `x-upsert: true`, so an
already-synced object is simply overwritten, not duplicated or errored on.

**Note on `PHASE3_PROD_PG_CONN`:** despite its name, env's `DIRECT_URL` (and
`DATABASE_URL` / `SUPABASE_DB_URL`, which are identical) is actually a
**pooled** connection (`aws-1-ap-south-1.pooler.supabase.com:6543`,
`pgbouncer=true`) — `psql` rejects the `pgbouncer` query parameter outright,
and even stripped of it a pooled connection isn't what this script's
`docker exec psql` invocation needs. Use the true direct host instead
(`db.gzhxgoigflftharcmdqj.supabase.co:5432`, `user=postgres`, same password
as `DIRECT_URL`), the same host Phase 2 verified extensively — see
`PHASE2_PROD_CONN` in the "Rebuilding after slot invalidation" section
above for the equivalent libpq-keyword form.

**Known pre-existing production data issue — 2 orphaned objects:** as of
the last sync (2026-08-28), production's `storage.objects` has 11 rows in
`organization-assets` but only 9 have real backing files. The other 2
(`11111111-1111-1111-1111-111111111111/logo.png` and
`22222222-2222-2222-2222-222222222222/admin_upload.png`, both org-id
placeholders from March 2026 seed data) return `404 NoSuchKey` from
**production's own** Storage API — confirmed directly, not a sync-side
issue — meaning their `storage.objects` metadata rows were created without
ever going through a real upload. `phase3-storage-sync.sh` correctly skips
these (logged as `FAIL(download:400)`) since there's nothing to copy. This
is why self-hosted legitimately has 9 objects where production's `count(*)`
shows 11; both sides' total byte size (155 kB) and per-object checksums
match exactly for everything that actually has content. Don't be alarmed by
this specific 11-vs-9 count gap on future re-runs; do investigate if the
gap changes shape (different objects failing, or a size mismatch).

**Known limitations of the API-based sync — `owner`/`owner_id`/`created_at`
are not preserved:** `phase3-storage-sync.sh` uploads through the Storage
HTTP API, so every synced object lands on self-hosted with `owner` and
`owner_id` set to whichever credential performed the upload (here,
`service_role`, so both come out null/different from production's original
values) rather than production's original uploader, and `created_at` set to
the upload time rather than production's original creation time. The two
alternatives that would preserve these — direct disk manipulation of the
storage backend, or manually rewriting `storage.objects` metadata rows
after upload — both carry worse trade-offs (reverse-engineering the
storage backend's undocumented on-disk layout, or a second write pass with
its own consistency risk) than the API approach's small, well-understood
gap; this is an accepted, inherent trade-off of that choice, not an
oversight.

As of 2026-08-28, production's `storage.objects` has 8 rows with a non-null
`owner` and 6 with a non-null `owner_id` (out of all 11 rows, including the
2 orphaned ones above — not just the 9 successfully-transferred real
objects), while self-hosted has 0 of either. Concretely, this means the RLS
policy `"Users can delete their own email attachments"` on
`storage.objects`, which depends on `auth.uid() = owner`, would misbehave
on self-hosted for any object relying on its original owner: today this is
zero-impact because the `email-attachments` bucket is empty in production,
but if an owner-scoped object exists there (or in any other bucket with a
similar owner-dependent policy) by the time of Phase 6's cutover, that
object's original owner would silently lose their ability to act on it
under self-hosted's RLS.

**Action for Phase 6's cutover checklist:** re-run the owner/owner_id check
above against production immediately before cutover to see whether any
owner-scoped object now exists in an affected bucket. If one does, decide
before relying on self-hosted for that bucket whether to accept the
ownership gap, manually patch the affected `storage.objects` rows on
self-hosted, or otherwise remediate — don't assume the zero-impact status
from 2026-08-28 still holds.

## Phase 4: Edge Functions

Phase 4 deploys the project's Supabase Edge Functions to self-hosted, in
secret-availability-ordered batches (functions needing a third-party API key
are deferred to a later batch until that secret is provisioned on the VPS).
Full history is in the Phase 4 Batch 1 implementation plan
(`docs/superpowers/plans/2026-08-28-supabase-selfhost-phase4-batch1.md`).
(The SDD task reports this work was tracked under,
`.superpowers/sdd/2026-08-28-supabase-selfhost-phase4-batch1/task-1-report.md`
and `task-2-report.md`, are gitignored and not available on a fresh clone —
use the plan above instead.)

**Architecture — one shared router, not one function per isolate:**
self-hosted's Edge Runtime (`supabase/edge-runtime`) is configured with
`--main-service` pointing at `supabase/functions/main/index.ts`. Every
request to `/functions/v1/<name>` arrives at this one router first, which:
1. Looks up `<name>` in `main/verify_jwt_map.ts`'s `VERIFY_JWT_MAP` and, if
   the map doesn't say `false`, verifies the request's bearer token's
   **signature and expiry** against `JWT_SECRET` itself (HS256, via Web
   Crypto's `crypto.subtle.verify` — no external dependency) — reconstructing
   production's actual per-function JWT-enforcement matrix (from
   `supabase/config.toml`'s `verify_jwt = false` entries), since self-hosted's
   Edge Runtime only exposes one global toggle, not a per-function one. This
   deliberately mirrors what production's own gateway (Kong) does for
   `verify_jwt = true`: signature/expiry only, no identity/claim check — both
   the anon key and the service_role key are validly-signed JWTs with no
   `sub` claim, and both must pass (real callers depend on it: the
   `markets_t1_ingest_crons` migrations call `verify_jwt=true`
   `markets-ingest-*` functions with the service-role key, and
   `invokeAnonymous()` in `src/lib/supabase-functions.ts` calls
   `verify_jwt=true` functions like `discover-email-settings` with the anon
   key). A function that needs a real authenticated end user (e.g.
   `admin-reset-password`) calls `_shared/auth.ts`'s `requireAuth()` itself,
   internally — the router's gate and a function's own `requireAuth()` call
   are independent, exactly as on production.
2. Dispatches to the target function's own module by temporarily shimming
   the global `Deno.serve` to capture the handler each function's own
   top-level `Deno.serve(...)` call (via `_shared/logger.ts`'s
   `serveWithLogger`, or directly) registers, then invokes that captured
   handler directly. This reuses every function's existing code completely
   unmodified. Captured handlers are cached by name after first use; a
   promise-chained lock serializes the shim-install/import/shim-restore
   critical section globally, so concurrent cold-start requests for
   different functions can't race each other's shim state.

**Static import map requirement (`function_importers.ts`) — read this
before adding a function to any future batch:** the router does NOT use a
computed-string dynamic import like `import(\`../${name}/index.ts\`)`. This
was tried and empirically fails against the real, self-hosted Rust Edge
Runtime: `--main-service` mode builds its executable module graph via
**static analysis** of the entrypoint's imports at boot time, materializing
only the files it can discover into an internal sandboxed compile directory.
A computed-string import is invisible to that analyzer, so the target file
is never materialized and the import throws `Module not found` at request
time for every function, regardless of whether it uses `serveWithLogger` or
raw `Deno.serve` (confirmed against all of Batch 1 during this phase's
implementation). A plain string-literal argument to `import()` **is**
discovered by the analyzer even when nested inside an object-literal value —
that's the mechanism `supabase/functions/main/function_importers.ts` relies
on: a generated `Record<string, () => Promise<any>>` with one literal
`() => import("../<name>/index.ts")` entry per deployed function, which the
router's `getHandler()` looks up instead of computing the path itself.
**This map is intentionally scoped to the currently-deployed batch only**
(Batch 1's 88 functions), unlike `verify_jwt_map.ts` (pure data, safe to
cover all 132 functions up front). Each entry here references a real file
path — an entry for a function not yet physically present on the bind-mount
risks a boot-time failure if the runtime's static analysis can't resolve it,
not just a request-time 404 like the old dynamic-import design. **To add
functions in a future batch:** append new literal entries (name and matching
`../<name>/index.ts` path) to `FUNCTION_IMPORTERS` in
`function_importers.ts` for every function that batch deploys, matching the
existing entries' exact form, before reseeding the bind-mount with those
functions' directories — do not deploy a function's directory without also
adding its importer entry, and don't add an importer entry for a function
whose directory isn't actually being deployed in that same reseed.

**Regenerating/extending `verify_jwt_map.ts`:** re-derive from
`supabase/config.toml`'s `verify_jwt = false` entries with:
```bash
python3 -c "
import re
with open('supabase/config.toml', encoding='utf-8') as f:
    content = f.read()
false_funcs = sorted(set(re.findall(r'\[functions\.([^\]]+)\]\s*\nverify_jwt = false', content)))
print(len(false_funcs))
for f in false_funcs: print(f.rstrip())
"
```
`config.toml` has Windows CRLF line endings — `f.rstrip()` above strips the
trailing `\r` that otherwise silently breaks name comparisons. Cross-check
the result against production's actual active function list before trusting
it wholesale; not everything in `config.toml` is production-active (e.g.
`comms-unsubscribe`/`comms-webhook-resend` are configured and exist locally
but aren't currently deployed anywhere).

**Bind-mount reseed procedure (this specific volume):** the live path,
confirmed empirically (this bind-mount was empty before Phase 4 and had
never been populated by an earlier phase), is
`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/` —
mounted read-only into the `functions` container
(`functions-i64jlyerora7ao9vkw5sweh3-103525190194`, Coolify's generated name
— NOT the literal `logic-nexus-functions` name an earlier plan draft
assumed) at `/home/deno/functions`. Reseed by staging locally-checked-out
files to a scratch dir on the VPS, then atomically swapping them in:
```bash
ssh hostinger-vps "mkdir -p /tmp/phase4-functions-staging"
scp -r supabase/functions/main supabase/functions/_shared supabase/functions/_types \
  supabase/functions/deno.json supabase/functions/import_map.json supabase/functions/types.d.ts \
  hostinger-vps:/tmp/phase4-functions-staging/
while read -r fn; do
  scp -r "supabase/functions/$fn" "hostinger-vps:/tmp/phase4-functions-staging/"
done < deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt   # or the current batch's list
ssh hostinger-vps "rm -rf /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/* && \
  cp -r /tmp/phase4-functions-staging/* /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/ && \
  rm -rf /tmp/phase4-functions-staging"
ssh hostinger-vps "docker restart functions-i64jlyerora7ao9vkw5sweh3-103525190194"
```
The container's healthcheck is a bare TCP port check (see
`docker-compose.yaml`), so `docker ps` reporting `healthy` only proves the
process is listening — it does **not** prove function dispatch works. Always
follow a restart with the four standard health-check curls below, plus a
router-correctness spot check (an unauthenticated request to a
`verify_jwt=false` function should return something other than the router's
own `{"error":"Function '<name>' not found or failed to load"}` 404 body).

**Batch status:**
- **Deployed — Batch 1** (this phase): 88 functions, listed in
  [`scripts/phase4-batch1-functions.txt`](scripts/phase4-batch1-functions.txt).
  All 88 confirmed reachable through the router (no function returned the
  router's 404 "not found or failed to load" body).
- **Pending — later batches:** every function needing a third-party secret
  not yet provisioned on the self-hosted VPS (email/SMS/LLM/payment provider
  keys, etc.), to be grouped and deployed once each secret is available.
- **Permanently excluded** (not deployable under any batch — no reliable
  local source match): `feature-flags` (no local source exists in the
  repo), `migrate-flypal-directives` (superseded locally by
  `migrate-flypal-directives-v2`/`-v3`), and
  `flypal_configured_directives_id_match_with_code_form` (lowercase `code` —
  a legacy duplicate deployment; the correctly-cased
  `flypal_configured_directives_id_match_with_Code_form` has local source
  and is deployed in Batch 1).

**Note — this no longer affects the router's own gate, only functions that
call `requireAuth()` internally:** as of the Phase 4 Batch 1 final-review
fix pass, the router's own JWT check (see the Architecture section above)
verifies signature/expiry only, so both `ANON_KEY` and `SERVICE_ROLE_KEY`
pass it for any `verify_jwt=true` function, same as production. The
paragraph below is about `_shared/auth.ts`'s `requireAuth()` specifically —
still relevant for the handful of functions (e.g. `admin-reset-password`)
that call it themselves to require a real authenticated end user, on top of
(not instead of) the router's gate.

**Known gap — self-hosted `service_role` JWTs don't satisfy `requireAuth()`:**
a `service_role` JWT (from self-hosted's own `.env`) is rejected by
`_shared/auth.ts`'s `requireAuth()` with `"invalid claim: missing sub
claim"`, because `service_role` tokens carry no `sub` claim while
`requireAuth()`'s underlying `getUser`/`getClaims` check expects one (this
differs from what an earlier plan draft assumed). To exercise a function
that calls `requireAuth()` itself, obtain a real user session JWT
instead — self-hosted's GoTrue supports this via its own Auth API, e.g.
creating a throwaway user with the admin API and signing in:
```bash
curl -s -X POST "https://supabase.sosservices.online/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"<throwaway>@example.com","password":"<temp password>","email_confirm":true}'
curl -s -X POST "https://supabase.sosservices.online/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<throwaway>@example.com","password":"<temp password>"}'
# use the response's access_token as the Authorization: Bearer value
```
(Self-hosted's anonymous sign-in provider is disabled, so `signInAnonymously`-
style flows return `anonymous_provider_disabled` — use the admin-create +
password-sign-in flow above instead.) Note also: this project's self-hosted
GoTrue admin `DELETE /auth/v1/admin/users/<id>` intermittently returns `504
request_timeout` even when the delete eventually succeeds — don't assume a
504 here means the delete failed; verify with a follow-up `GET` before
retrying.

**Leftover test user still on self-hosted `auth.users` (needs opportunistic
cleanup):** a throwaway user created while verifying this behavior during
Phase 4 batch 1 —
`phase4-batch1-verify-test@sosservices.online`
(id `02424458-e64b-4584-87ca-dd1d33f414c7`) — was never successfully deleted
(hit the `DELETE` 504 above) and, as of this task, is still present on
self-hosted's live `auth.users` table. It's inert (no associated app data)
but whoever next touches self-hosted auth should delete it opportunistically,
e.g.:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"DELETE FROM auth.users WHERE id = '02424458-e64b-4584-87ca-dd1d33f414c7';\""
```

**The four standard health-check curls** (run after every `functions`
container restart, or any other state-changing step on this shared VPS):
```bash
ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
```
Expected: all four `200`.

**Phase 6 cutover checklist (started here, not yet a full section):**
- **PostgREST schema exposure gap:** self-hosted's `rest` service only sets
  `PGRST_DB_SCHEMAS=public,graphql_public`
  (`deploy/selfhosted-supabase/env.example`), while production's PostgREST
  exposes 6 schemas, including `markets`, `platform`, `core`, and `comms`.
  This batch's 11 `markets-*` functions (see
  `scripts/phase4-batch1-functions.txt`) dispatch correctly through the
  router, but any of them that actually reads/writes the `markets` schema
  via PostgREST (as opposed to a direct `postgres://` connection) will fail
  once it does real work, since that schema isn't in `rest`'s exposed list.
  This is a real gap but was explicitly left out of Phase 4 Batch 1's scope
  (it's a Phase 1 `rest`-service config matter, not an edge-function code
  issue) — do not change the live `PGRST_DB_SCHEMAS` env var casually; widen
  it to match production's schema list (and restart the `rest` container)
  as part of Phase 6 cutover prep, then re-run the four standard
  health-check curls plus a spot check against one `markets-*` function that
  actually touches PostgREST.

## Rollback

This stack is live, deployed as Coolify application `i64jlyerora7ao9vkw5sweh3`
(name `logicnexus-selfhost-supabase`) on `72.61.249.111:8000`, deploying from
branch **`deploy/supabase-selfhost-phase1`** — deliberately **not** `main`.
That branch was created during Task 3 because 9 other Coolify applications on
this same VPS (`frontend`, `crm-api`, `amro-api`, `comms-api`,
`compliance-api`, `finance-api`, `logistics-api`, `markets-worker`,
`uim-api`) track `main` directly; pushing straight to `origin/main` risked
triggering their redeploys via whatever webhook/polling Coolify has
configured for that branch. Local `main` is kept significantly ahead of
`origin/main` throughout this project — check
`git rev-list --count origin/main..main` for the current count rather than
trusting any specific figure written here, since it drifts with every commit
and would otherwise go stale (an earlier draft of this section cited a fixed
"67 commits ahead," which was already wrong within days). `main` is
periodically synced onto `deploy/supabase-selfhost-phase1` (most recently as
part of this fix wave, via `git push origin main:deploy/supabase-selfhost-phase1`)
so the two point at the same commit content-wise — but Coolify's application
is still configured to track `deploy/supabase-selfhost-phase1` specifically,
not `main`. Repoint it via `PATCH /api/v1/applications/i64jlyerora7ao9vkw5sweh3`
with a `git_branch` change if that's ever deliberately decided instead.

If this stack needs to be torn down (resource pressure, or Phase 1 is
abandoned):

1. Stop the application:
   ```bash
   curl -X POST "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/stop" \
     -H "Authorization: Bearer $COOLIFY_API_TOKEN"
   ```
   then delete it:
   ```bash
   curl -X DELETE "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3" \
     -H "Authorization: Bearer $COOLIFY_API_TOKEN"
   ```
   Note the endpoint is `/api/v1/applications/...`, **not**
   `/api/v1/services/...` — this stack is deployed as a Coolify
   **application** (custom git-sourced Docker Compose app,
   `build_pack: dockercompose`), not a Coolify **service** (the one-click
   template catalog). The two resource types have distinct, non-interchangeable
   API endpoints; using `/services/` against this UUID will 404.
2. This removes all 7 containers (`db`, `kong`, `auth`, `rest`, `storage`,
   `realtime`, `functions`) in one action, since they're all one Coolify
   Compose application — no separate database resource to clean up
   independently.
3. Re-run the four production health-check curls to confirm zero impact
   (same as every other step in this plan):
   ```bash
   curl -s -o /dev/null -m 8 -w "frontend -> %{http_code}\n" https://app.sosservices.online/
   curl -s -o /dev/null -m 8 -w "crm-api -> %{http_code}\n" https://api.sosservices.online/health
   curl -s -o /dev/null -m 8 -w "amro-api -> %{http_code}\n" https://amro.sosservices.online/health
   curl -s -o /dev/null -m 8 -w "aviation -> %{http_code}\n" https://app.aviation.sosservices.online/
   ```

Nothing in this stack is referenced by any production app's env vars, so
this teardown is safe at any time during Phase 1. The one caveat: tearing
down and later re-deploying this same stack from scratch will hit the
bind-mount-seeding gotcha documented above all over again (Coolify will
recreate the file-based mount paths from empty on a fresh deploy) — budget
time for the manual `scp` reseed step if that happens.

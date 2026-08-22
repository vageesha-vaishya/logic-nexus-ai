# Self-Hosted Supabase Phase 2 (Logical Replication of `public`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get production's `public` schema (structure + data) onto the Phase 1 self-hosted Postgres, then keep it continuously in sync via native Postgres logical replication, without disrupting production Supabase Cloud, the 24 other apps on the shared VPS, or the two existing `supabase_realtime*` replication slots already serving live production Realtime traffic.

**Architecture:** A dedicated, least-privilege replication role and a new, separate publication on Supabase Cloud (production), paired with a subscription on the self-hosted Postgres (`db` service from Phase 1) that performs the initial full copy and ongoing streaming replication as one native mechanism. Schema DDL comes from `pg_dump --schema-only` against live production, not from replaying migration files.

**Tech Stack:** PostgreSQL 17 native logical replication (`CREATE PUBLICATION`/`CREATE SUBSCRIPTION`), `pg_dump`/`pg_restore`, Supabase Cloud project `gzhxgoigflftharcmdqj` (direct host `db.gzhxgoigflftharcmdqj.supabase.co`), self-hosted `db` service from Phase 1.

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase2-design.md` — every task below implicitly includes these.)

- **Never touch, alter, or interfere with the two existing replication publications/slots** (`supabase_realtime`, `supabase_realtime_messages_publication`, and their backing slots) — they serve live production Realtime traffic right now.
- `auth` schema is explicitly out of scope for this phase — `public` only.
- Schema DDL comes from `pg_dump --schema-only --schema=public` against live production (direct host), not from replaying `supabase/migrations/*.sql`.
- The replication role must be dedicated and least-privilege (`REPLICATION` + read-only on `public`), not the `postgres` superuser or any existing admin role.
- After every state-changing step, re-verify the four production health-check curls: `https://app.sosservices.online/`, `https://api.sosservices.online/health`, `https://amro.sosservices.online/health`, `https://app.aviation.sosservices.online/`. All must return `200`.
- Confirmed live (not to re-verify, already true as of spec audit): standard roles `anon`/`authenticated`/`service_role`/`authenticator` exist on both production and self-hosted; the VPS has raw TCP reachability to `db.gzhxgoigflftharcmdqj.supabase.co:5432`.
- `DROP SUBSCRIPTION`'s automatic slot cleanup on the source only works if the publisher is reachable at drop time — the teardown procedure must implement and test both the clean path and the publisher-unreachable manual-detach path.
- Self-hosted Postgres access: `ssh hostinger-vps`, then `docker exec <current-db-container-name> psql -U supabase_admin ...` — get the current container name fresh each session via `docker ps --filter 'name=db-i64jlyerora7ao9vkw5sweh3'` (the suffix changes on every redeploy).
- Production access: Supabase MCP tools (`mcp__claude_ai_Supabase__execute_sql` with `project_id: gzhxgoigflftharcmdqj`) for queries, and direct `psql`/`pg_dump` via the direct host for anything the MCP query tool can't do (DDL dumps, `CREATE SUBSCRIPTION`, etc.) — the direct host's actual password/connection string needs to be obtained via Supabase's dashboard or the project's connection info at implementation time (not currently held anywhere in this plan — do not guess it).

---

### Task 1: Create the dedicated replication role on production, and audit `public` for replica-identity gaps and large tables

**Files:** none — this is pure database DDL on production, no repo files change.

**Interfaces:**
- Produces: a role `phase2_replicator` on Supabase Cloud with `REPLICATION` + `SELECT` on all `public` tables — Task 3's publication and Task 4's subscription connect as this role.
- Produces: a list of `public` tables lacking a primary key (for Task 1 Step 3) and a size-sorted table list (for the large-table exclusion decision, Task 3).

- [ ] **Step 1: Create the role**

Via `mcp__claude_ai_Supabase__execute_sql` (project `gzhxgoigflftharcmdqj`):
```sql
CREATE ROLE phase2_replicator WITH LOGIN REPLICATION PASSWORD '<generate a strong random password, save it durably — needed again in Task 4>';
GRANT USAGE ON SCHEMA public TO phase2_replicator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO phase2_replicator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO phase2_replicator;
```
Expected: no errors. The `ALTER DEFAULT PRIVILEGES` line ensures any table created in `public` after this point is automatically readable by the role too (relevant since `FOR TABLES IN SCHEMA public` publications, if chosen in Task 3, auto-include new tables).

- [ ] **Step 2: Verify the role**

```sql
SELECT rolname, rolreplication, rolcanlogin FROM pg_roles WHERE rolname = 'phase2_replicator';
SELECT count(*) FROM information_schema.table_privileges WHERE grantee = 'phase2_replicator' AND privilege_type = 'SELECT';
```
Expected: `rolreplication = true`, `rolcanlogin = true`; the second query returns a count roughly matching `public`'s real table count (confirm this is non-zero and in the right ballpark, e.g. 200+, not a handful).

- [ ] **Step 3: Audit `public` for tables lacking a primary key (replica identity gap)**

```sql
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint con WHERE con.conrelid = c.oid AND con.contype = 'p'
  )
ORDER BY c.relname;
```
For every table returned, decide (and apply) a `REPLICA IDENTITY`:
```sql
-- If the table has a unique, NOT NULL indexed column suitable as identity:
ALTER TABLE public.<table> REPLICA IDENTITY USING INDEX <unique_index_name>;
-- Otherwise, if no such key exists (rare, e.g. pure append-only log tables where UPDATE/DELETE never happen):
ALTER TABLE public.<table> REPLICA IDENTITY FULL;
```
Note: `REPLICA IDENTITY FULL` makes `UPDATE`/`DELETE` replication far more expensive (full old-row image on every change) — prefer a real key when one exists. Record which tables got which treatment in your task report; this matters for Task 3/4 troubleshooting if a specific table's changes don't replicate correctly later.

- [ ] **Step 4: Get a size-sorted table list for the Task 3 large-table exclusion decision**

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) AS size, pg_total_relation_size(c.oid) AS bytes
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY bytes DESC LIMIT 20;
```
Report this list — Task 3 uses it to decide whether to exclude `system_logs_y2026m*`-style large log partitions from the publication.

- [ ] **Step 5: Re-verify the four production health-check curls**

All must return `200`.

---

### Task 2: Transfer the `public` schema structure from live production to self-hosted

**Files:** none (schema lives in the database, not the repo — this plan does not commit a schema dump file to the repo; keep the dump file only as a local working artifact, deleted after use).

**Interfaces:**
- Consumes: nothing from Task 1 (this can run in parallel/independently — schema dump doesn't need the replication role).
- Produces: self-hosted `public` schema with production's real table structure, RLS policies, and functions — Task 3's publication and Task 4's subscription both depend on this existing first.

- [ ] **Step 1: Get the production direct-connection password**

This is not currently held anywhere in this plan or the repo's tracked files — obtain it via the Supabase dashboard (Project Settings → Database → Connection string, direct connection, not pooled) or by resetting the database password if needed (note: resetting invalidates the existing password used elsewhere — check the repo's `env`/`.env` files for `SUPABASE_DB_URL`/`DATABASE_URL` first; if a working direct-connection password already exists there, reuse it rather than resetting and breaking something else that depends on it).

- [ ] **Step 2: Dump the `public` schema structure only**

```bash
pg_dump "postgresql://postgres:<password>@db.gzhxgoigflftharcmdqj.supabase.co:5432/postgres" \
  --schema-only --schema=public --no-owner --no-privileges \
  -f /tmp/phase2-public-schema.sql
```
`--no-owner --no-privileges`: production's role ownership/grants reference roles that may not map 1:1 onto self-hosted in exactly the same way — apply ownership/grants explicitly and deliberately in Step 4 instead of blindly replaying production's exact `ALTER TABLE ... OWNER TO` statements, which could fail if a referenced role doesn't exist self-hosted or grant unintended privileges.

Expected: the file is created, non-trivial size (given ~300 tables, expect low tens of MB of DDL text, not KB).

- [ ] **Step 2b: Copy the dump to the VPS**

```bash
scp /tmp/phase2-public-schema.sql hostinger-vps:/tmp/phase2-public-schema.sql
```

- [ ] **Step 3: Restore onto self-hosted, watching for extension-related errors**

```bash
ssh hostinger-vps "docker cp /tmp/phase2-public-schema.sql <current-db-container-name>:/tmp/phase2-public-schema.sql"
ssh hostinger-vps "docker exec <current-db-container-name> psql -U supabase_admin -d postgres -f /tmp/phase2-public-schema.sql" 2>&1 | tee /tmp/phase2-restore-output.txt
```
Expected: mostly `CREATE TABLE`/`CREATE INDEX`/`ALTER TABLE`/`CREATE POLICY`/`CREATE FUNCTION` lines with no `ERROR`. If you see `ERROR: extension "..." already exists` or similar for `vector`/`postgis`/`pgroonga`/etc. — these are harmless if `--schema=public` scoped the dump correctly (it shouldn't try to `CREATE EXTENSION` at all since those live in a different schema), but if any appear, confirm they're skippable (not blocking subsequent statements) rather than assuming so. If you see `ERROR: role "..." does not exist` — investigate; the standard 4 roles (`anon`/`authenticated`/`service_role`/`authenticator`) are already confirmed present, but production might reference a less-common role in an ownership/grant statement (should be minimized by `--no-owner --no-privileges`, but verify).

- [ ] **Step 4: Explicitly grant the standard roles their expected access**

Production's RLS policies expect `authenticated`/`anon`/`service_role` to have the same baseline grants they have in production. Compare and apply as needed:
```sql
-- On self-hosted, confirm baseline grants match what PostgREST/RLS expects
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Adjust based on what a quick comparison against production's actual grants shows (query
-- information_schema.role_table_grants on both sides for a same table and diff the result)
```

- [ ] **Step 5: Verify schema match**

```sql
-- Run on BOTH production (via MCP) and self-hosted (via ssh/docker exec), compare:
SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
```
Expected: same count on both sides (or explain any deliberate difference, e.g. if Task 1's audit revealed something to exclude — decided in Task 3, so at this point in Task 2 they should match exactly since exclusion only affects the publication, not the schema itself).

- [ ] **Step 6: Clean up local/VPS dump files, re-verify health**

```bash
rm -f /tmp/phase2-public-schema.sql
ssh hostinger-vps "rm -f /tmp/phase2-public-schema.sql /tmp/phase2-restore-output.txt"
```
Re-run all four production health-check curls.

---

### Task 3: Create the publication on production

**Files:** none.

**Interfaces:**
- Consumes: Task 1's large-table audit (Step 4's size-sorted list) to decide exclusions.
- Produces: publication `phase2_public_migration` on production — Task 4's subscription connects to this by name.

- [ ] **Step 1: Decide publication scope based on Task 1's size audit**

If no table is disproportionately large/low-value, use the simple form (Step 2a). If `system_logs_y2026m*`-style large log partitions are present and judged not worth including in the initial replication (per the spec's explicit judgment call — this is optional scope-narrowing, not required), use the explicit-list form (Step 2b) instead.

- [ ] **Step 2a: Simple form — all of `public`**

```sql
CREATE PUBLICATION phase2_public_migration FOR TABLES IN SCHEMA public;
```

- [ ] **Step 2b: Explicit-list form — `public` minus excluded large log tables**

```sql
CREATE PUBLICATION phase2_public_migration FOR TABLE <every table from Task 1 Step 4's list except the excluded ones, plus every other public table not in that top-20 list — this requires assembling the full table list first>;
```
(If choosing this path, first run `SELECT tablename FROM pg_tables WHERE schemaname='public';` to get the complete list, then subtract the excluded tables, rather than manually enumerating 300 table names by hand from memory.)

- [ ] **Step 3: Verify the new publication doesn't overlap with the existing ones**

```sql
SELECT p.pubname, pt.schemaname, pt.tablename
FROM pg_publication p
JOIN pg_publication_tables pt ON pt.pubname = p.pubname
WHERE p.pubname IN ('phase2_public_migration', 'supabase_realtime', 'supabase_realtime_messages_publication')
ORDER BY p.pubname, pt.tablename;
```
Expected: `phase2_public_migration`'s table list is exactly what you intended (Step 2a or 2b); confirm no table appears under more than one publication in a way that would cause confusion (a table CAN legitimately be in more than one publication in Postgres — this isn't an error — but visually confirm the other two publications' table lists are unchanged from before this task, i.e. this task added a new publication without modifying the existing ones' membership at all).

- [ ] **Step 4: Re-verify the four production health-check curls.**

---

### Task 4: Create the subscription on self-hosted Postgres, verify initial copy and ongoing replication

**Files:** none.

**Interfaces:**
- Consumes: `phase2_replicator`'s password from Task 1, publication `phase2_public_migration` from Task 3, restored schema from Task 2.
- Produces: an `ACTIVE` subscription on self-hosted Postgres, replicating from production — Task 5's verification and Task 6's teardown-testing both depend on this existing.

- [ ] **Step 1: Create the subscription**

```sql
-- Run on self-hosted (docker exec ... psql -U supabase_admin -d postgres -c "...")
CREATE SUBSCRIPTION phase2_public_migration_sub
  CONNECTION 'host=db.gzhxgoigflftharcmdqj.supabase.co port=5432 dbname=postgres user=phase2_replicator password=<from Task 1> sslmode=require'
  PUBLICATION phase2_public_migration
  WITH (copy_data = true, create_slot = true, slot_name = 'phase2_public_migration_slot');
```
Expected: `CREATE SUBSCRIPTION` returns successfully. This immediately begins the initial data copy.

- [ ] **Step 2: Monitor the initial copy**

```sql
-- On self-hosted:
SELECT subname, pid, relid::regclass, state FROM pg_stat_subscription_tables WHERE srsubstate != 'r' ORDER BY subname;
-- 'r' = ready (caught up to streaming); other states ('i' initializing, 'd' data copy, 's' synchronized) mean still catching up
```
Poll until all tables report `state='r'` — for a first-time copy of a few million rows this may take minutes, not hours, but don't assume a fixed duration; check actual progress.

- [ ] **Step 3: Verify the subscription reaches `ACTIVE` steady-state**

```sql
-- On self-hosted:
SELECT subname, pid, received_lsn, latest_end_lsn, latest_end_time FROM pg_stat_subscription;
-- On production, via MCP:
SELECT slot_name, active, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots WHERE slot_name = 'phase2_public_migration_slot';
```
Expected: `active = true` on the production side; the self-hosted side shows a live, advancing `pid` and LSNs.

- [ ] **Step 4: Spot-check data actually copied**

```sql
-- Compare row counts on a handful of real tables between production (MCP) and self-hosted (docker exec):
SELECT count(*) FROM public.accounts;   -- production had 9182 as of the Phase 1 audit; self-hosted should now match (may have grown since, that's fine, they should be close/matching)
SELECT count(*) FROM public.quotes;     -- production had 461
SELECT count(*) FROM public.contacts;   -- production had 9417
```
Expected: self-hosted counts match production counts (within a small margin if production has taken new writes since the copy started — replication should be actively catching those up too).

- [ ] **Step 5: Verify ongoing replication actually streams a real change**

Use a genuinely inert test row, not real business data — e.g. insert into a low-risk reference/lookup table (check Task 1's audit for a good, harmless candidate — something like a settings/config table where a throwaway test row is unambiguously safe and easy to identify/delete afterward), or if no safe candidate exists, create a dedicated throwaway test table in `public` on production specifically for this check (and add it to the publication, or rely on `FOR TABLES IN SCHEMA public` already covering it automatically if Task 3 used that form):
```sql
-- On production (MCP), if using a dedicated test table:
CREATE TABLE IF NOT EXISTS public._phase2_replication_test (id serial primary key, note text, created_at timestamptz default now());
INSERT INTO public._phase2_replication_test (note) VALUES ('phase2-verification-<timestamp>');
```
```sql
-- On self-hosted, poll until it appears:
SELECT * FROM public._phase2_replication_test;
```
Expected: the row appears self-hosted within a short lag window (seconds, not minutes, for a trivial single-row insert once steady-state streaming is established). Clean up the test table on production afterward if you created one (`DROP TABLE public._phase2_replication_test;` — this itself will replicate as a DDL-adjacent operation; note logical replication doesn't replicate DDL, so you'll need to drop it on both sides manually).

- [ ] **Step 6: Re-verify the four production health-check curls, and check production's own replication-slot health**

```sql
-- On production (MCP):
SELECT slot_name, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots WHERE slot_name = 'phase2_public_migration_slot';
```
Expected: a small, bounded retained-WAL figure (not growing unbounded) — confirms the slot isn't falling behind.

---

### Task 5: Test and document the teardown procedure (both paths)

**Files:**
- Modify: `deploy/selfhosted-supabase/README.md` (add a Phase 2 replication section documenting the teardown procedure — this stack's README already documents Phase 1's operational gotchas, so this extends that same document rather than creating a new one).

**Interfaces:**
- Consumes: the real subscription/slot from Task 4 (tested against a **disposable test subscription**, not the real one, per the spec's explicit instruction — do not tear down the actual migration subscription as part of "testing" the teardown).

- [ ] **Step 1: Create a disposable test subscription to test teardown against**

```sql
-- On production (MCP): a throwaway publication for this test only
CREATE PUBLICATION phase2_teardown_test_pub FOR TABLE public._phase2_replication_test;
-- (recreate the test table from Task 4 Step 5 if it was dropped, or use any other harmless table)
```
```sql
-- On self-hosted:
CREATE SUBSCRIPTION phase2_teardown_test_sub
  CONNECTION 'host=db.gzhxgoigflftharcmdqj.supabase.co port=5432 dbname=postgres user=phase2_replicator password=<from Task 1> sslmode=require'
  PUBLICATION phase2_teardown_test_pub
  WITH (copy_data = true, create_slot = true, slot_name = 'phase2_teardown_test_slot');
```

- [ ] **Step 2: Test the clean teardown path (publisher reachable)**

```sql
-- On self-hosted:
DROP SUBSCRIPTION phase2_teardown_test_sub;
```
Expected: succeeds without error.
```sql
-- On production (MCP), confirm the slot is gone:
SELECT slot_name FROM pg_replication_slots WHERE slot_name = 'phase2_teardown_test_slot';
```
Expected: zero rows — confirms `DROP SUBSCRIPTION` genuinely cleaned up the source-side slot automatically when the publisher was reachable.

- [ ] **Step 3: Test the publisher-unreachable manual-detach path**

Recreate a second disposable test subscription (same pattern as Step 1, new names e.g. `phase2_teardown_test2_sub`/`_slot`/`_pub`). Then simulate unreachability by using an intentionally invalid connection detail rather than actually blocking network access (simpler and safer than firewall manipulation):
```sql
-- On self-hosted, detach from the slot without needing the publisher connection to succeed:
ALTER SUBSCRIPTION phase2_teardown_test2_sub DISABLE;
ALTER SUBSCRIPTION phase2_teardown_test2_sub SET (slot_name = NONE);
DROP SUBSCRIPTION phase2_teardown_test2_sub;
```
Expected: succeeds (this sequence doesn't require the publisher connection at all, since detaching from the slot first means `DROP SUBSCRIPTION` no longer needs to talk to the source).
```sql
-- On production (MCP), the slot is now orphaned — confirm it still exists, then drop it manually:
SELECT slot_name FROM pg_replication_slots WHERE slot_name = 'phase2_teardown_test2_slot';
SELECT pg_drop_replication_slot('phase2_teardown_test2_slot');
```
Expected: the slot existed after the subscription-side teardown (confirming it was genuinely orphaned, proving the detach-first path is necessary when reachability can't be assumed), then is successfully removed manually.

- [ ] **Step 4: Clean up test publications**

```sql
-- On production (MCP):
DROP PUBLICATION IF EXISTS phase2_teardown_test_pub;
DROP PUBLICATION IF EXISTS phase2_teardown_test_pub2;
DROP TABLE IF EXISTS public._phase2_replication_test;
```

- [ ] **Step 5: Document both procedures in the README**

Add a "Phase 2: Logical Replication" section to `deploy/selfhosted-supabase/README.md` covering: what `phase2_public_migration`/`phase2_public_migration_sub`/`phase2_public_migration_slot` are, the lag-check queries from Task 4 Step 6, and both teardown procedures (clean path + manual-detach path) verified in Steps 2-3 above, written so a future maintainer with zero session context can actually execute either one.

- [ ] **Step 6: Commit**

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(selfhost-supabase): document Phase 2 replication and teardown procedures"
```

- [ ] **Step 7: Re-verify the four production health-check curls, and confirm the REAL migration subscription (from Task 4) is still healthy** (this task's testing used disposable subscriptions — confirm the real one was never touched):

```sql
-- On self-hosted:
SELECT subname, pid FROM pg_stat_subscription WHERE subname = 'phase2_public_migration_sub';
```
Expected: still present, still has an active `pid`.

---

### Task 6: Final VPS-wide and production-wide safety verification

**Files:** none.

**Interfaces:** none — verification only.

- [ ] **Step 1: VPS-wide health re-check**

```bash
ssh hostinger-vps "free -h; echo '---'; dmesg | grep -i 'out of memory' | tail -5; echo '---'; docker ps --filter 'name=i64jlyerora7ao9vkw5sweh3' --format '{{.Names}}\t{{.Status}}'"
```
Expected: no new OOM entries beyond the known 2026-08-15 incident; `db`'s memory usage still well under its 3GB cap (the initial copy is the highest-load moment for this — check it during Task 4 too, not only here at the end); 6/7 stack containers healthy, `functions` unchanged in its known crash-loop.

- [ ] **Step 2: Production-wide replication health, final check**

```sql
-- On production (MCP):
SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots
WHERE slot_name IN ('phase2_public_migration_slot', 'supabase_realtime_replication_slot_2_129_6_893679d', 'supabase_realtime_messages_replication_slot_2_129_6_893679d');
```
Expected: all three slots `active = true` with bounded retained WAL — confirms both our new slot and the pre-existing Realtime slots are healthy (i.e., this phase's work didn't inadvertently degrade the existing Realtime replication either).

- [ ] **Step 3: Final production health-check curls, one last time**

All four must return `200`.

---

## Plan Self-Review

**Spec coverage:** §2 Goals → Tasks 1-4 (role, schema, publication, subscription) directly implement each listed goal; the "documented, tested teardown" goal → Task 5. §4 Safety & Monitoring → Task 1 (role least-privilege), Task 4 Steps 2/3/6 (lag/health monitoring), Task 5 (teardown, both paths), Task 6 (final safety check covering both the existing Realtime slots and the new one). §5 Verification Plan's 5 items map directly to Task 2 Step 5 (schema match), Task 3 Step 3 (publication scope/non-overlap), Task 4 Steps 3-5 (subscription active, data spot-check, real change propagation), Task 5 (teardown tested both paths), Task 6 (health throughout). §6 Open Items: publication scope decision → Task 3 Step 1; replica identity → Task 1 Step 3; large-table exclusion → Task 1 Step 4 + Task 3 Step 1; test-write method → Task 4 Step 5 uses a dedicated throwaway table rather than real business data, per the spec's explicit instruction.

**Placeholder scan:** Task 2 Step 1's password retrieval is intentionally left as "obtain via dashboard, check existing env files first" rather than a guessed value — this is a genuine external credential this plan cannot know in advance, not a lazy TBD; the task gives concrete alternative sources to check rather than leaving it unspecified. Task 3 Step 2b's explicit table list is deliberately left for the implementer to assemble live (querying `pg_tables` at execution time) rather than enumerating ~300 table names from a stale audit — assembling it fresh avoids the plan itself going stale the moment a new table is added to production between now and execution.

**Type/name consistency:** `phase2_replicator` (role), `phase2_public_migration` (publication), `phase2_public_migration_sub`/`phase2_public_migration_slot` (subscription/slot) are all defined in Tasks 1/3/4 and referenced identically in every later task that touches them (Task 5's teardown testing uses clearly-distinguished disposable names — `phase2_teardown_test_sub` etc. — specifically to avoid any risk of the real subscription being accidentally torn down during teardown testing).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-supabase-selfhost-phase2.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

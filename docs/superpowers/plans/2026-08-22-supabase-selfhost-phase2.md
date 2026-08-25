# Self-Hosted Supabase Phase 2 (Logical Replication of the Application Schemas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠ REVISED 2026-08-26 — scope corrected from `public`-only to all 21 application schemas.** See the spec's §1a for the full discovery and the authoritative include/exclude lists. **Tasks 1 and 2 already ran and passed review under the old `public`-only scope** — their `public` work is correct and is NOT to be redone. New **Task 1b** extends the role grants and replica-identity audit to the other 20 schemas; **Task 2b** transfers those 20 schemas' structure; Tasks 3-6 are revised for the wider scope.

**Goal:** Get production's 21 application schemas (structure + data) onto the Phase 1 self-hosted Postgres, then keep them continuously in sync via native Postgres logical replication, without disrupting production Supabase Cloud, the 24 other apps on the shared VPS, or the two existing `supabase_realtime*` replication slots already serving live production Realtime traffic.

**The 21 application schemas (authoritative):** `public`, `amro`, `api`, `comms`, `compliance`, `core`, `crm`, `finance`, `flypal`, `gateway`, `logistics`, `markets`, `module_amro`, `module_crm`, `module_finance`, `module_shared`, `module_uim`, `platform`, `quotation`, `sales`, `uim`.
**Excluded (Supabase-managed):** `auth`, `cron`, `extensions`, `graphql`, `graphql_public`, `net`, `realtime`, `storage`, `supabase_migrations`, `vault`.

**Architecture:** A dedicated, least-privilege replication role and a new, separate publication on Supabase Cloud (production), paired with a subscription on the self-hosted Postgres (`db` service from Phase 1) that performs the initial full copy and ongoing streaming replication as one native mechanism. Schema DDL comes from `pg_dump --schema-only` against live production, not from replaying migration files.

**Tech Stack:** PostgreSQL 17 native logical replication (`CREATE PUBLICATION`/`CREATE SUBSCRIPTION`), `pg_dump`/`pg_restore`, Supabase Cloud project `gzhxgoigflftharcmdqj` (direct host `db.gzhxgoigflftharcmdqj.supabase.co`), self-hosted `db` service from Phase 1.

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase2-design.md` — every task below implicitly includes these.)

- **Never touch, alter, or interfere with the two existing replication publications/slots** (`supabase_realtime`, `supabase_realtime_messages_publication`, and their backing slots) — they serve live production Realtime traffic right now.
- The 10 Supabase-managed schemas (listed above, incl. `auth`) are explicitly out of scope — the 21 application schemas only.
- Schema DDL comes from `pg_dump --schema-only` with the application schemas in scope, against live production, not from replaying `supabase/migrations/*.sql`.
- The replication role must be dedicated and least-privilege (`REPLICATION` + read-only on the 21 application schemas), not the `postgres` superuser or any existing admin role.
- After every state-changing step, re-verify the four production health-check curls: `https://app.sosservices.online/`, `https://api.sosservices.online/health`, `https://amro.sosservices.online/health`, `https://app.aviation.sosservices.online/`. All must return `200`.
- Confirmed live (not to re-verify, already true as of spec audit): standard roles `anon`/`authenticated`/`service_role`/`authenticator` exist on both production and self-hosted; the VPS has raw TCP reachability to `db.gzhxgoigflftharcmdqj.supabase.co:5432`.
- `DROP SUBSCRIPTION`'s automatic slot cleanup on the source only works if the publisher is reachable at drop time — the teardown procedure must implement and test both the clean path and the publisher-unreachable manual-detach path.
- Self-hosted Postgres access: `ssh hostinger-vps`, then `docker exec <current-db-container-name> psql -U supabase_admin ...` — get the current container name fresh each session via `docker ps --filter 'name=db-i64jlyerora7ao9vkw5sweh3'` (the suffix changes on every redeploy).
- Production access: Supabase MCP tools (`mcp__claude_ai_Supabase__execute_sql` with `project_id: gzhxgoigflftharcmdqj`) for queries, and direct `psql`/`pg_dump` for anything the MCP query tool can't do (DDL dumps, etc.).
- **Credentials (resolved 2026-08-26, do not reset anything):** the repo-root `env` file (gitignored) holds the current, verified-working production DB password in `DATABASE_URL`/`DIRECT_URL`/`SUPABASE_DB_URL` — note all three are actually *pooler* URLs (`aws-1-ap-south-1.pooler.supabase.com:6543`) despite their names; extract the password and use it with the real direct host `db.gzhxgoigflftharcmdqj.supabase.co:5432` when a direct connection is needed. `env` also holds `PHASE2_REPLICATOR_PASSWORD` (the dedicated replication role's password, created in Task 1). Both were verified authenticating successfully. Never print either value in a report or short status message; read them from `env` at use time.
- **No local Postgres client tools**: the controller's machine has no `psql`/`pg_dump`. Run them from inside the self-hosted `db` container on the VPS instead (`docker exec <db-container> pg_dump ...`), which has matching-version client binaries — this is the proven approach from Task 2.

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

### Task 1b: Extend the replication role's grants and the replica-identity audit to the other 20 application schemas

**Why this task exists:** Tasks 1 and 2 ran under the superseded `public`-only scope. Task 1 created `phase2_replicator` with `SELECT` on `public` only, and audited replica identity for `public` only (finding and fixing 5 tables). Both need extending to the other 20 application schemas before the publication (Task 3) can include them — a publication can only replicate tables the role can read, and `UPDATE`/`DELETE` replication silently misbehaves on tables lacking a usable replica identity.

**Files:** none — production database DDL only.

**Interfaces:**
- Consumes: the `phase2_replicator` role created in Task 1.
- Produces: that same role, now readable across all 21 application schemas; every table in those schemas confirmed to have a workable replica identity. Task 3's publication depends on both.

- [ ] **Step 1: Extend grants to the other 20 schemas**

Via `mcp__claude_ai_Supabase__execute_sql` (`project_id: gzhxgoigflftharcmdqj`). Run this as one statement block — it loops so you don't hand-write 20 near-identical blocks:

```sql
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['amro','api','comms','compliance','core','crm','finance','flypal','gateway','logistics','markets','module_amro','module_crm','module_finance','module_shared','module_uim','platform','quotation','sales','uim']
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO phase2_replicator', s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO phase2_replicator', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO phase2_replicator', s);
  END LOOP;
END $$;
```

- [ ] **Step 2: Verify the grants landed, and that nothing leaked outside the 21**

```sql
SELECT table_schema, count(*) AS select_grants
FROM information_schema.table_privileges
WHERE grantee = 'phase2_replicator' AND privilege_type = 'SELECT'
GROUP BY table_schema ORDER BY table_schema;
```
Expected: exactly 21 rows, one per application schema (`api` may return 0 rows or be absent since it's empty — that's fine and expected, note it either way), and **no row for any Supabase-managed schema**.

```sql
SELECT has_schema_privilege('phase2_replicator','auth','USAGE')     AS auth,
       has_schema_privilege('phase2_replicator','storage','USAGE')  AS storage,
       has_schema_privilege('phase2_replicator','realtime','USAGE') AS realtime,
       has_schema_privilege('phase2_replicator','vault','USAGE')    AS vault;
```
Expected: all `false` — confirms least-privilege still holds after widening.

Also re-confirm the role gained no write access and no elevated attributes:
```sql
SELECT DISTINCT privilege_type FROM information_schema.table_privileges WHERE grantee='phase2_replicator';
SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname='phase2_replicator';
```
Expected: only `SELECT`; all four role attributes `false`.

- [ ] **Step 3: Replica-identity audit across the other 20 schemas**

```sql
SELECT n.nspname AS schema, c.relname AS table
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('amro','api','comms','compliance','core','crm','finance','flypal','gateway','logistics','markets','module_amro','module_crm','module_finance','module_shared','module_uim','platform','quotation','sales','uim')
  AND c.relkind IN ('r','p')
  AND c.relreplident = 'd'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conrelid = c.oid AND con.contype = 'p')
ORDER BY 1, 2;
```
This finds tables still on the `default` replica identity but with no primary key to back it — exactly the failure case. (Note this correctly ignores tables already switched to `FULL`/`USING INDEX`, unlike Task 1's simpler query.)

For each result, apply the same decision rule Task 1 used — and follow its precedent, which the Task 1 review confirmed was sound:
```sql
-- Preferred: a genuinely UNIQUE index whose columns are all NOT NULL
ALTER TABLE <schema>.<table> REPLICA IDENTITY USING INDEX <unique_index_name>;
-- Only when no such index exists:
ALTER TABLE <schema>.<table> REPLICA IDENTITY FULL;
```
To find candidate indexes for a given table, reuse Task 1's investigation query (see `task-1-report.md` Step 3 — it joins `pg_index`/`pg_attribute` to show uniqueness and column nullability together). Record which table got which treatment and why.

- [ ] **Step 4: Verify every application-schema table now has a workable replica identity**

Re-run Step 3's query. Expected: **zero rows**.

- [ ] **Step 5: Re-verify the four production health-check curls.**

---

### Task 2b: Transfer the other 20 application schemas' structure to self-hosted

**Why this task exists:** Task 2 transferred `public` only (451 = 451 tables, 991 = 991 RLS policies — verified, do not redo). The other 20 schemas were never transferred, which is why the 14 cross-schema views in `public` are currently broken on the self-hosted copy.

**Files:** none — the dump is a transient working artifact, deleted after use; nothing is committed to the repo.

**Interfaces:**
- Consumes: the self-hosted Postgres with `public` already restored (Task 2).
- Produces: all 21 application schemas present and structurally matching production self-hosted; the 14 cross-schema views in `public` now resolving. Tasks 3/4 depend on this.

- [ ] **Step 1: Dump the other 20 schemas, structure only**

Run from inside the self-hosted `db` container (it has matching-version client binaries; the local machine has none). Get the current container name first via `docker ps --filter 'name=db-i64jlyerora7ao9vkw5sweh3' --format '{{.Names}}'`.

```bash
ssh hostinger-vps "docker exec <db-container> bash -c \"PGPASSWORD='<from env>' pg_dump 'postgresql://postgres@db.gzhxgoigflftharcmdqj.supabase.co:5432/postgres?sslmode=require' --schema-only --no-owner --no-privileges \
  -n amro -n api -n comms -n compliance -n core -n crm -n finance -n flypal -n gateway -n logistics -n markets -n module_amro -n module_crm -n module_finance -n module_shared -n module_uim -n platform -n quotation -n sales -n uim \
  -f /tmp/phase2-other-schemas.sql\""
```
Note `public` is deliberately absent from the `-n` list — it's already done.

Expected: file created, non-trivial size. Sanity-check it: `docker exec <db-container> wc -l /tmp/phase2-other-schemas.sql` and `grep -c 'CREATE TABLE' /tmp/phase2-other-schemas.sql` (expect roughly 340+ tables' worth of DDL).

- [ ] **Step 2: Restore onto self-hosted**

```bash
ssh hostinger-vps "docker exec <db-container> bash -c \"psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0 -f /tmp/phase2-other-schemas.sql\" 2>&1 | tail -100"
```
`ON_ERROR_STOP=0` deliberately: like Task 2, expect some errors and triage them rather than halting on the first. **Capture the full error list** — do not just eyeball the tail.

Task 2's precedent for what's expected vs. what's a real problem:
- **Missing extensions are the known trap.** Task 2 hit exactly this: `ltree` and `pg_trgm` weren't installed self-hosted, which broke two tables and cascaded into ~400 downstream errors. If you see `type "..." does not exist` or `function "..." does not exist` errors, check whether production has an extension the self-hosted DB lacks: compare `SELECT extname, extnamespace::regnamespace FROM pg_extension ORDER BY 1;` on both sides, install any missing ones **into the same schema production uses**, then re-run the restore idempotently.
- `already exists` errors for objects Task 2 created are harmless.
- `role "..." does not exist` — investigate; `--no-owner --no-privileges` should prevent most, but report any that appear.

- [ ] **Step 3: Verify schema-by-schema table counts match production**

Run on both sides and compare per schema (not just a grand total — a matching total can hide two offsetting errors):
```sql
SELECT n.nspname AS schema, count(*) AS tables
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','amro','api','comms','compliance','core','crm','finance','flypal','gateway','logistics','markets','module_amro','module_crm','module_finance','module_shared','module_uim','platform','quotation','sales','uim')
  AND c.relkind = 'r'
GROUP BY 1 ORDER BY 1;
```
Expected: identical counts per schema on both sides. Report the full side-by-side table.

- [ ] **Step 4: Verify the 14 cross-schema views now actually resolve — the regression test for the whole scope correction**

```sql
-- On self-hosted. Each should return without error (0 rows is fine — they're empty until Task 4 copies data).
SELECT 'v_accounts' AS v, count(*) FROM public.v_accounts
UNION ALL SELECT 'v_contacts', count(*) FROM public.v_contacts
UNION ALL SELECT 'v_campaigns', count(*) FROM public.v_campaigns
UNION ALL SELECT 'v_campaign_members', count(*) FROM public.v_campaign_members
UNION ALL SELECT 'v_commissions', count(*) FROM public.v_commissions
UNION ALL SELECT 'v_commission_rules', count(*) FROM public.v_commission_rules
UNION ALL SELECT 'v_finance_invoices', count(*) FROM public.v_finance_invoices
UNION ALL SELECT 'v_outbox_retries', count(*) FROM public.v_outbox_retries
UNION ALL SELECT 'uim_v_stock_audit_export', count(*) FROM public.uim_v_stock_audit_export
UNION ALL SELECT 'uim_v_stock_balance_summary', count(*) FROM public.uim_v_stock_balance_summary
UNION ALL SELECT 'uim_v_stock_ledger_current_balance', count(*) FROM public.uim_v_stock_ledger_current_balance
UNION ALL SELECT 'uim_v_stock_valuation_summary', count(*) FROM public.uim_v_stock_valuation_summary
UNION ALL SELECT 'amro_v_item_master', count(*) FROM public.amro_v_item_master
UNION ALL SELECT 'quote_items', count(*) FROM public.quote_items;
```
Expected: all 14 return a count without error. Any `relation ... does not exist` means that view's source schema didn't restore correctly — investigate before proceeding.

- [ ] **Step 5: Apply grants for the standard roles on the new schemas**

Mirror what Task 2 did for `public`, using production's actual grant pattern as the reference (query `information_schema.role_table_grants` on production for a sample table in a few of these schemas and match it) rather than assuming. At minimum the `anon`/`authenticated`/`service_role` roles need `USAGE` on each schema for PostgREST/RLS to behave as production does.

- [ ] **Step 6: Clean up and re-verify**

```bash
ssh hostinger-vps "docker exec <db-container> rm -f /tmp/phase2-other-schemas.sql"
```
Re-run all four production health-check curls.

---

### Task 3: Create the publication on production

**Files:** none.

**Interfaces:**
- Consumes: Task 1's large-table audit (Step 4's size-sorted list) to decide exclusions.
- Produces: publication `phase2_public_migration` on production — Task 4's subscription connects to this by name.

- [ ] **Step 1: Decide publication scope based on Task 1's size audit**

Task 1 Step 4's size audit found `system_logs_y2026m04/m05/m06` dominate `public` (~3.65 GB combined, vs. ~240 MB for all 20 other application schemas put together). The spec (§6) flags a real tension here: **`FOR TABLES IN SCHEMA` is all-or-nothing per schema — it cannot exclude individual tables.** So excluding those partitions means dropping to an explicit table list *for `public` specifically*, while the other 20 schemas can still use the schema-level form in the same publication.

**The spec recommends (a) — include everything** — unless the initial copy proves painfully slow in practice. Correctness and low maintenance beat a one-time transfer cost, and the VPS had ~100 GB free disk as of Phase 1, so size isn't the binding constraint. Take (a) unless you find a concrete reason not to; if you take (b), say why in your report.

- [ ] **Step 2a: (Recommended) All 21 application schemas**

```sql
CREATE PUBLICATION phase2_public_migration
FOR TABLES IN SCHEMA public, amro, api, comms, compliance, core, crm, finance,
  flypal, gateway, logistics, markets, module_amro, module_crm, module_finance,
  module_shared, module_uim, platform, quotation, sales, uim;
```
(If `api` errors because it's empty, drop it from the list and note that in your report — an empty schema in `FOR TABLES IN SCHEMA` should be accepted by Postgres, but it's inert either way.)

- [ ] **Step 2b: (Only if you have a concrete reason) `public` as an explicit list minus the `system_logs_*` partitions, plus the other 20 schemas schema-level**

Assemble the `public` table list live rather than hand-enumerating it:
```sql
SELECT string_agg(format('public.%I', tablename), ', ' ORDER BY tablename)
FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'system\_logs\_%';
```
Then:
```sql
CREATE PUBLICATION phase2_public_migration
FOR TABLES IN SCHEMA amro, api, comms, compliance, core, crm, finance, flypal,
  gateway, logistics, markets, module_amro, module_crm, module_finance,
  module_shared, module_uim, platform, quotation, sales, uim,
  TABLE <paste the string_agg output here>;
```
**Trade-off to record if you choose this:** new tables added to `public` later will NOT auto-join the publication; someone must remember to add them manually.

- [ ] **Step 3: Verify the new publication doesn't overlap with the existing ones**

```sql
SELECT p.pubname, pt.schemaname, pt.tablename
FROM pg_publication p
JOIN pg_publication_tables pt ON pt.pubname = p.pubname
WHERE p.pubname IN ('phase2_public_migration', 'supabase_realtime', 'supabase_realtime_messages_publication')
ORDER BY p.pubname, pt.tablename;
```
Given the table count (~790 across 21 schemas) that raw list is too long to eyeball — aggregate it instead:
```sql
SELECT pubname, schemaname, count(*) AS tables
FROM pg_publication_tables
WHERE pubname IN ('phase2_public_migration','supabase_realtime','supabase_realtime_messages_publication')
GROUP BY 1,2 ORDER BY 1,2;
```
Expected: `phase2_public_migration` covers exactly the intended schemas with per-schema counts matching Task 2b Step 3's production figures, **and no Supabase-managed schema appears under it**. A table CAN legitimately belong to more than one publication in Postgres — that isn't an error — but confirm the other two publications' own membership is unchanged from before this task (this task adds a publication; it must not modify the existing ones).

- [ ] **Step 4: Re-verify the four production health-check curls.**

---

### Task 4: Create the subscription on self-hosted Postgres, verify initial copy and ongoing replication

**Files:** none.

**Interfaces:**
- Consumes: `PHASE2_REPLICATOR_PASSWORD` from the repo-root `env` file, publication `phase2_public_migration` from Task 3, restored schemas from Tasks 2 and 2b.
- Produces: an `ACTIVE` subscription on self-hosted Postgres, replicating from production — Task 5's verification and Task 6's teardown-testing both depend on this existing.

- [ ] **Step 1: Create the subscription**

```sql
-- Run on self-hosted (docker exec ... psql -U supabase_admin -d postgres -c "...")
CREATE SUBSCRIPTION phase2_public_migration_sub
  CONNECTION 'host=db.gzhxgoigflftharcmdqj.supabase.co port=5432 dbname=postgres user=phase2_replicator password=<PHASE2_REPLICATOR_PASSWORD from env> sslmode=require'
  PUBLICATION phase2_public_migration
  WITH (copy_data = true, create_slot = true, slot_name = 'phase2_public_migration_slot');
```
Expected: `CREATE SUBSCRIPTION` returns successfully. This immediately begins the initial data copy.

- [ ] **Step 2: Monitor the initial copy**

```sql
-- On self-hosted — summary view, since ~790 tables are now in scope:
SELECT srsubstate, count(*) FROM pg_subscription_rel GROUP BY 1 ORDER BY 1;
-- 'r' = ready (caught up to streaming); 'i' initializing, 'd' data copy, 's' synchronized
-- Drill into stragglers only if progress stalls:
SELECT srrelid::regclass AS table, srsubstate FROM pg_subscription_rel WHERE srsubstate <> 'r' ORDER BY 1 LIMIT 40;
```
Poll until everything reports `r`. With ~790 tables and ~4.4 GB in scope (dominated by the `system_logs` partitions if Step 2a was used in Task 3), expect this to take meaningfully longer than the original `public`-only estimate — likely tens of minutes. Don't assume a fixed duration; watch actual progress, and if the count of non-`r` tables stops decreasing for a long stretch, investigate rather than continuing to wait indefinitely.

**Watch production load while this runs** — this is the heaviest I/O step of the whole phase. Re-run the four health-check curls periodically during the copy, not only at the end.

- [ ] **Step 3: Verify the subscription reaches `ACTIVE` steady-state**

```sql
-- On self-hosted:
SELECT subname, pid, received_lsn, latest_end_lsn, latest_end_time FROM pg_stat_subscription;
-- On production, via MCP:
SELECT slot_name, active, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots WHERE slot_name = 'phase2_public_migration_slot';
```
Expected: `active = true` on the production side; the self-hosted side shows a live, advancing `pid` and LSNs.

- [ ] **Step 4: Spot-check data actually copied**

Spot-check across **several schemas**, not just `public` — the whole point of the scope correction is that the other 20 now carry real data. Run the same query on both sides and compare:
```sql
SELECT 'public.accounts' t, count(*) FROM public.accounts
UNION ALL SELECT 'public.contacts', count(*) FROM public.contacts
UNION ALL SELECT 'public.quotes',   count(*) FROM public.quotes
UNION ALL SELECT 'core.*(sample)',  count(*) FROM core.<pick a populated table>
UNION ALL SELECT 'crm.*(sample)',   count(*) FROM crm.<pick a populated table>
UNION ALL SELECT 'amro.*(sample)',  count(*) FROM amro.<pick a populated table>
UNION ALL SELECT 'markets.*(sample)', count(*) FROM markets.<pick a populated table>
UNION ALL SELECT 'uim.*(sample)',   count(*) FROM uim.<pick a populated table>;
```
Pick the sample tables by querying production for populated ones first: `SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname IN ('core','crm','amro','markets','uim') AND n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 20;`

Reference figures from the 2026-08-26 audit (production live rows per schema, for sanity — these grow over time): `markets` 247,469 · `core` 62,181 · `amro` 51,168 · `flypal` 38,592 · `module_crm` 21,926 · `crm` 18,663 · `uim` 5,546.

Expected: self-hosted counts match production (within a small margin if production has taken new writes since the copy started — replication should be catching those up continuously).

**Also re-run Task 2b Step 4's 14-view check now that data exists** — those views should now return real rows, not just resolve without error.

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

**⚠ Corrected 2026-08-26 — do not expect the two Realtime slots to exist.** This step originally listed three slot names and expected `active = true` for all three. That was wrong: Supabase's Realtime slots are **ephemeral**, created when Realtime has active subscribers and dropped when idle. Verified during Task 3 via both MCP and a direct `psql` connection — production had **zero** slots and zero WAL senders at that moment, with both publications still intact. Checking for those two slot names by name will fail spuriously and tell you nothing.

```sql
-- On production. List ALL slots rather than asserting specific names:
SELECT slot_name, plugin, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots ORDER BY slot_name;
```
Expected: **our** slot `phase2_public_migration_slot` present, `active = true`, with bounded (not unboundedly growing) retained WAL. Any `supabase_realtime*` slots may or may not be present depending on live Realtime usage — their absence is normal and is **not** evidence this phase degraded anything.

The durable check that this phase didn't harm Realtime is that its **publications** are intact, not its slots:
```sql
SELECT pubname, count(*) AS tables FROM pg_publication_tables
WHERE pubname IN ('supabase_realtime','supabase_realtime_messages_publication')
GROUP BY 1 ORDER BY 1;
```
Expected: unchanged membership (`supabase_realtime` = 1 table, as of 2026-08-26).

- [ ] **Step 3: Final production health-check curls, one last time**

All four must return `200`.

---

## Plan Self-Review

**Spec coverage (updated for the 2026-08-26 scope correction):** §2 Goals → Tasks 1+1b (role, now across 21 schemas), 2+2b (schema transfer, `public` then the other 20), 3 (publication), 4 (subscription); the "documented, tested teardown" goal → Task 5. §1a's schema landscape → Task 1b Step 1 (grants), Task 2b (structure transfer), Task 3 Step 2a (publication scope). §4 Safety & Monitoring → Tasks 1/1b (role least-privilege, re-verified after widening), Task 4 Steps 2/3/6 (lag/health monitoring, incl. watching prod load *during* the heavier copy), Task 5 (teardown, both paths), Task 6 (final safety check covering both the existing Realtime slots and the new one). §5 Verification Plan's 5 items → Task 2b Step 3 (per-schema counts) + Step 4 (the 14-view regression test, the specific check for the scope correction), Task 3 Step 3 (publication scope/non-overlap), Task 4 Steps 3-5 (subscription active, multi-schema data spot-check, real change propagation), Task 5 (teardown both paths), Task 6 (health throughout). §6 Open Items: publication scope → resolved, Task 3 Step 2a; replica identity → Task 1 Step 3 (`public`) + Task 1b Step 3 (other 20); large-table exclusion vs. `FOR TABLES IN SCHEMA` tension → Task 3 Step 1's explicit (a)/(b) decision; test-write method → Task 4 Step 5 uses a dedicated throwaway table, not real business data.

**Scope-correction note:** Tasks 1 and 2 completed and passed independent review under the superseded `public`-only scope. Their work is correct and is deliberately not redone — Tasks 1b and 2b are additive, covering only the 20 schemas the original scope missed. A reader picking this plan up fresh should run 1 → 2 → 1b → 2b → 3 → 4 → 5 → 6, or, if 1 and 2 are already done (they are, as of 2026-08-26), start at 1b.

**Placeholder scan:** Task 2 Step 1's password retrieval is intentionally left as "obtain via dashboard, check existing env files first" rather than a guessed value — this is a genuine external credential this plan cannot know in advance, not a lazy TBD; the task gives concrete alternative sources to check rather than leaving it unspecified. Task 3 Step 2b's explicit table list is deliberately left for the implementer to assemble live (querying `pg_tables` at execution time) rather than enumerating ~300 table names from a stale audit — assembling it fresh avoids the plan itself going stale the moment a new table is added to production between now and execution.

**Type/name consistency:** `phase2_replicator` (role), `phase2_public_migration` (publication), `phase2_public_migration_sub`/`phase2_public_migration_slot` (subscription/slot) are all defined in Tasks 1/3/4 and referenced identically in every later task that touches them (Task 5's teardown testing uses clearly-distinguished disposable names — `phase2_teardown_test_sub` etc. — specifically to avoid any risk of the real subscription being accidentally torn down during teardown testing).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-supabase-selfhost-phase2.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

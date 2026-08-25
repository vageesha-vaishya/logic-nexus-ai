# Self-Hosted Supabase Migration — Phase 2: Logical Replication of the Application Schemas - Design Specification

**Date:** 2026-08-22
**Scope:** Get production's **21 application schemas** (`public` plus 20 others — application data: quotes, accounts, work orders, CRM, finance, AMRO, markets, etc.) from Supabase Cloud onto the self-hosted Postgres stood up in Phase 1, and keep them continuously in sync via native Postgres logical replication until the eventual cutover. This is what makes near-zero-downtime cutover possible later: instead of a one-time dump/restore with hours of staleness, the self-hosted copy stays live-current, and cutover becomes "confirm replication lag is ~0, flip env vars," not "wait for a big data transfer."
**Status:** Approved for implementation

> **⚠ REVISED 2026-08-26 — scope corrected from `public`-only to all 21 application schemas.**
> The original version of this spec scoped Phase 2 to the `public` schema alone. **That was a defect in this spec, caught during Task 2's execution.** When originally designing this phase I framed the scope question as "`public` only vs `public` + `auth`" without ever checking whether other *application* schemas existed. They do — see §1a. A `public`-only replication would have produced a self-hosted database missing ~340 tables and ~500,000 live rows that this platform's 8 backend microservices depend on, plus 14 permanently-broken compatibility views in `public` itself. §§1a, 2, 3, 5, 6 below reflect the corrected scope; superseded `public`-only text has been rewritten rather than left as dead prose.

## 1. Background

Phase 1 (complete, see `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md`) stood up a self-hosted Supabase-equivalent stack on the shared Coolify VPS, live at `https://supabase.sosservices.online`, serving zero production traffic. Its Postgres (`db` service) currently only has the default bootstrap schemas GoTrue/Storage/Realtime create on their own (`auth` 23 tables, `storage` 10, `realtime` 8+4, plus extension schemas `cron`/`net`/`pgsodium`/`vault`) — `public` has essentially nothing (confirmed directly: 1-3 tables, none of the ~300 real application tables).

Production (Supabase Cloud project `gzhxgoigflftharcmdqj`, "SG-Logistics-Pro-Enterprise") was directly queried before designing this phase:
- `wal_level = logical` — already enabled (Supabase Cloud turns this on by default; its own Realtime feature depends on it).
- **Two existing publications**: `supabase_realtime` and `supabase_realtime_messages_publication` (both `puballtables=false`, table-scoped — `supabase_realtime` covers exactly 1 table). **These must not be touched, altered, or interfered with.**
- **⚠ CORRECTED 2026-08-26 — the backing slots are EPHEMERAL, not fixed infrastructure.** This spec originally recorded two "active replication slots already in production use" (`supabase_realtime_replication_slot_2_129_6_893679d` / wal2json, and `supabase_realtime_messages_replication_slot_2_129_6_893679d` / pgoutput) and treated them as permanent fixtures to design around. That was a point-in-time observation mistaken for a standing fact. Re-checked during Task 3 (via **both** the MCP pooler *and* a genuine direct `psql` connection, so this is not a connection-routing artifact): production now has **zero** replication slots and **zero** active WAL senders, while both publications remain intact. Supabase's Realtime service creates a slot when it has active subscribers and drops it when idle — so slot presence fluctuates with real Realtime usage. Nothing in this phase caused this (no slot DDL has ever been run against production here; Task 3 only created a publication, which cannot drop slots).
  **Consequences that matter downstream:** (1) do not assume the two Realtime slots exist — any check expecting them `active = true` will fail spuriously; (2) our subscription's slot may well be the *only* slot on production, not "a third alongside two existing"; (3) the persistent objects to protect are the **publications**, not the slots.
- Direct (non-pooled) connection host: `db.gzhxgoigflftharcmdqj.supabase.co`, Postgres engine 17 — same major version as the self-hosted `supabase/postgres:17.6.1.136`, which avoids cross-version logical replication quirks.
- Roles with `rolreplication=true` already exist (`postgres`, `supabase_admin`, `supabase_replication_admin`, `dashboard_user`, `supabase_etl_admin`) — confirms replication is supported and reachable at the account level, though this phase creates its own dedicated role rather than reusing any of these (see §3).

**Decisions made during design (explicit, informed trade-offs):**
- **All 21 application schemas, but not `auth`** (corrected 2026-08-26, see §1a). Self-hosted GoTrue manages its own `auth` schema via its own internal migration versioning (already bootstrapped in Phase 1). Logical-replicating Supabase Cloud's live `auth` tables directly risks colliding with that if the two GoTrue versions' schema expectations ever diverge. Real user/session data migration is deferred to Phase 5 (already scoped for JWT/auth continuity), which is the more appropriate place to reconcile this carefully rather than bolt it onto Phase 2. The same reasoning excludes the other Supabase-managed schemas (`storage`, `realtime`, `vault`, `cron`, `net`, `extensions`, `graphql`, `graphql_public`, `supabase_migrations`) — these are infrastructure the self-hosted stack manages itself, not application data.
- **Schema DDL comes from `pg_dump --schema-only` against live production, not from replaying the repo's 1,111 migration files.** This guarantees the self-hosted schema exactly matches what's actually running now, including any manual/dashboard changes that may not be captured in migration files — a common source of drift in Supabase projects, and a real risk if replication depends on the two schemas actually matching column-for-column.

## 0. ⚠ HANDOFF TO PHASE 5 — do not lose this

Found during Phase 2 Task 2b's re-review (2026-08-26) and deliberately **not** fixed here, because `auth` is out of Phase 2's scope and Phase 5 owns auth-schema reconciliation:

**Production has a trigger `on_auth_user_created` on `auth.users` that self-hosted does not.** Verified directly on both sides — production `auth.users` has 1 non-internal trigger, self-hosted has 0.

```sql
-- production: AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
-- public.handle_new_user() is SECURITY DEFINER and does:
--   INSERT INTO public.profiles (id, email, first_name, last_name)
--   VALUES (NEW.id, NEW.email,
--           COALESCE(NEW.raw_user_meta_data->>'first_name',''),
--           COALESCE(NEW.raw_user_meta_data->>'last_name',''));
```

**The function `public.handle_new_user()` DOES exist on self-hosted** (it lives in `public`, so Task 2 restored it correctly). Only the trigger that fires it is missing.

**Consequence if not fixed before cutover:** every new user signup against the self-hosted stack would create an `auth.users` row but **no matching `public.profiles` row** — silently. The app depends on `profiles` (104 rows in production today). This would not surface as an error at signup; it would surface later as users with missing profile data.

**Why it's missing:** the `auth` schema on self-hosted is bootstrapped by GoTrue itself, not restored from production, so anything the application added to `auth` (like this trigger) was never carried over. There may be other application-added objects in `auth` — **Phase 5 should diff the whole `auth` schema between production and self-hosted, not just recreate this one trigger.**

**Fix is one statement**, but must be applied as part of Phase 5's auth work (after GoTrue's own schema expectations are reconciled), not bolted on earlier:
```sql
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 1a. The Application Schema Landscape (discovered 2026-08-26, source of the scope correction)

Production's data model is **not** confined to `public`. Queried directly against production:

| Schema | Tables | Live rows | Notes |
|---|---|---|---|
| `public` | 449 (+26 views, 2 partitioned) | — | 4179 MB, dominated by `system_logs_y2026m*` partitions |
| `markets` | 60 | 247,469 | markets-worker / Sthira product |
| `core` | 56 (+4 views) | 62,181 | shared core domain |
| `amro` | 36 (+1 view) | 51,168 | AMRO maintenance module |
| `flypal` | 9 | 38,592 | |
| `module_crm` | 6 | 21,926 | |
| `module_amro` | 12 | 20,367 | |
| `crm` | 6 | 18,663 | |
| `platform` | 16 | 10,381 | |
| `sales` | 9 | 5,620 | |
| `uim` | 23 (+6 views) | 5,546 | |
| `compliance` | 10 (+2 views) | 5,102 | |
| `quotation` | 4 | 4,451 | |
| `module_uim` | 5 | 3,600 | |
| `comms` | 17 (+3 views) | 859 | |
| `logistics` | 24 | 295 | |
| `module_shared` | 4 | 216 | |
| `finance` | 30 | 55 | |
| `module_finance` | 3 | 36 | |
| `gateway` | 16 | 36 | |
| `api` | 0 | 0 | Completely empty — no tables, views, or functions. Included for completeness; inert. |

These schema names map directly onto the platform's 8 backend microservices (`crm-api`, `uim-api`, `amro-api`, `comms-api`, `compliance-api`, `finance-api`, `logistics-api`, `sales`) plus `markets-worker` — they are actively-used application data, not legacy remnants.

**Cross-schema coupling that makes `public`-only untenable:** 14 views *inside* `public` read from other schemas, confirmed by querying `pg_rewrite`/`pg_depend` dependencies directly:

| View in `public` | Reads from |
|---|---|
| `v_accounts`, `v_contacts` | `core`, `crm` |
| `v_campaigns`, `v_campaign_members` | `crm` |
| `v_commissions`, `v_commission_rules`, `v_finance_invoices` | `finance` |
| `v_outbox_retries` | `core` |
| `uim_v_stock_audit_export`, `uim_v_stock_balance_summary`, `uim_v_stock_ledger_current_balance`, `uim_v_stock_valuation_summary` | `uim` |
| `amro_v_item_master` | `amro` |
| `quote_items` | `logistics` |

Under a `public`-only scope these 14 views exist on the self-hosted copy but are permanently broken (their source tables don't exist there) — a concrete, already-observed symptom of the scope error, not a theoretical concern.

**Authoritative include list (21 schemas):** `public`, `amro`, `api`, `comms`, `compliance`, `core`, `crm`, `finance`, `flypal`, `gateway`, `logistics`, `markets`, `module_amro`, `module_crm`, `module_finance`, `module_shared`, `module_uim`, `platform`, `quotation`, `sales`, `uim`.

**Authoritative exclude list (Supabase-managed, 10):** `auth`, `cron`, `extensions`, `graphql`, `graphql_public`, `net`, `realtime`, `storage`, `supabase_migrations`, `vault`.

## 2. Goals / Non-Goals

**Goals:**
- The self-hosted Postgres's **21 application schemas** have an identical structure to production's live ones (tables, columns, indexes, constraints, RLS policies, functions/triggers, cross-schema views), obtained via `pg_dump --schema-only` with all 21 schemas in scope.
- A dedicated, least-privilege Postgres role exists on Supabase Cloud for this replication (not the `postgres` superuser), with `REPLICATION` and read-only access scoped to **all 21 application schemas** (Task 1 already created this role with `public`-only grants — extending its grants to the other 20 schemas is now in scope).
- A new publication on Supabase Cloud, scoped to the 21 application schemas' tables only, entirely separate from and non-interfering with the two existing `supabase_realtime*` publications/slots.
- A subscription on the self-hosted Postgres, connected via the direct (non-pooled) host, performs the initial full data copy and then continuously streams ongoing changes — one native mechanism, not a separate one-time dump-of-data step.
- Documented, tested procedure for checking replication lag/health, and for cleanly tearing down the subscription+slot (protecting production's WAL retention/disk if this phase is ever paused or abandoned).
- Zero impact on production Supabase Cloud's live performance/availability, and zero impact on the shared VPS's other 24 apps (same standing constraint as Phase 1).

**Non-Goals (deferred):**
- `auth` schema / real user data migration (Phase 5).
- Storage file sync (Phase 3).
- Edge Function deployment (Phase 4, the 155 real functions — Phase 1 only proved the Edge Runtime container itself starts).
- The actual cutover, JWT secret alignment, or Supabase Cloud decommission (Phases 5-7).
- Fixing the 10 tables with RLS disabled (a separately-flagged, pre-existing security issue, unrelated to this migration) — noted again here only because `pg_dump --schema-only` will faithfully carry that state over; not something this phase corrects.

## 3. Architecture

```
   Supabase Cloud (gzhxgoigflftharcmdqj, production, LIVE — never disrupted)
   ─────────────────────────────────────────────────────────────────────
   Direct connection: db.gzhxgoigflftharcmdqj.supabase.co (Postgres 17)

   Existing (untouched):
     publication: supabase_realtime               (Realtime feature, in use)
     publication: supabase_realtime_messages_publication (Realtime, in use)
     slot: supabase_realtime_replication_slot_...  (wal2json, active)
     slot: supabase_realtime_messages_replication_slot_... (pgoutput, active)

   NEW, this phase:
     role: phase2_replicator      REPLICATION + SELECT on all 21 app schemas
     publication: phase2_public_migration
                  FOR TABLES IN SCHEMA public, amro, api, comms, compliance,
                  core, crm, finance, flypal, gateway, logistics, markets,
                  module_amro, module_crm, module_finance, module_shared,
                  module_uim, platform, quotation, sales, uim
     (a third, independent replication slot is created automatically when the
      self-hosted subscription below is created — Postgres names it after the
      subscription)
                              │
                              │ logical replication (initial copy + ongoing stream)
                              ▼
   Self-hosted Postgres (db service, Coolify VPS, Phase 1)
   ─────────────────────────────────────────────────────────────────────
   All 21 application schemas: structure from `pg_dump --schema-only`
   (exact match to live production), then populated + kept in sync by:
     subscription: phase2_public_migration_sub     connects to the direct
                                                    Supabase Cloud host,
                                                    copy_data=true (initial
                                                    full copy on creation)
```

(The publication/subscription/slot names retain their `phase2_public_migration*` naming from before the scope correction — renaming live objects that Task 1 already created buys nothing and risks confusion against work already done; the name is now a slight misnomer covering all 21 schemas, noted here so a future reader isn't misled by it.)

**Why a dedicated role instead of reusing an existing superuser-equivalent**: least privilege — this role only needs `REPLICATION` (to open a replication connection) and read access to the 21 application schemas' tables (for the initial `COPY`). It should not be able to touch `auth`/`storage`/`realtime`/`vault` or any other Supabase-managed schema at all, and should not have write access to anything. This limits blast radius if the credential is ever mishandled, independent of how careful the process around it is.

**Why a brand-new publication rather than adding to an existing one**: `supabase_realtime` and `supabase_realtime_messages_publication` are actively serving production traffic right now. Reusing or modifying them for migration purposes — even just adding tables to `supabase_realtime` — risks changing what Realtime actually broadcasts to live connected clients. A dedicated, separate publication has zero interaction with the existing ones.

**Why `CREATE SUBSCRIPTION` handles both initial sync and ongoing replication**: this is native PostgreSQL behavior (not something built manually) — when a subscription is created with the default `copy_data = true`, Postgres performs a snapshot-consistent initial `COPY` of every table in the publication, then seamlessly transitions to streaming logical replication from the same point, no gap or separate coordination step required.

## 4. Safety & Monitoring

**Pre-implementation checks already done during spec audit (not deferred, confirmed now):**
- The 4 standard Supabase roles referenced by RLS policies (`anon`, `authenticated`, `service_role`, `authenticator`) are confirmed present on **both** production and the self-hosted Postgres already (queried directly on both sides) — restoring the application schemas (including their RLS policies, which grant `TO authenticated`/`TO anon` etc.) will not fail on a missing role.
- Raw TCP reachability from the VPS to `db.gzhxgoigflftharcmdqj.supabase.co:5432` confirmed directly (`timeout 6 bash -c 'echo > /dev/tcp/...'` from the VPS itself) — no network restriction blocks the connection at the transport level. Authentication is still a separate, later concern (the dedicated role's password), but this rules out the more common failure mode of a Supabase project's IP allow-list rejecting the VPS outright.

**Protecting production Supabase Cloud** (the more important direction here — this phase's failure mode risk is against the *source*, not just the self-hosted target):
- A replication slot retains WAL on the source for as long as it exists and isn't fully consumed. If the self-hosted subscriber falls far behind or disconnects for an extended period, Supabase Cloud's own disk usage grows — a real production risk, independent of the VPS-side concerns Phase 1 was built around.
- This phase documents (and Task-level work will implement) a health-check query pattern using `pg_stat_replication` (on the source) and `pg_stat_subscription`/replication lag views (on the target), plus an explicit, tested teardown procedure. **Corrected during spec audit — the teardown is not unconditionally automatic:** `DROP SUBSCRIPTION` only cleans up the matching slot on the source automatically if it can still open a live connection to the publisher at drop time. If that connection isn't available (network issue, revoked credential, paused project), the drop fails outright unless the subscription is first detached from its slot (`ALTER SUBSCRIPTION ... DISABLE`, then `ALTER SUBSCRIPTION ... SET (slot_name = NONE)`, then `DROP SUBSCRIPTION`), after which the now-orphaned slot must be dropped manually on the source (`SELECT pg_drop_replication_slot('...')`). Task-level work must implement and test **both** paths — the clean case and the publisher-unreachable case — not just the happy path.
- Initial schema dump/restore and publication/subscription creation are all metadata/DDL-level operations plus a bounded initial data copy — none of this locks or blocks production's own live traffic in normal operation (`pg_dump --schema-only` takes a lightweight consistent snapshot, not an exclusive lock). The subscription's initial `COPY` of table data is similarly non-blocking (snapshot-consistent, not an exclusive lock) but is genuinely the heaviest I/O step in this phase — expect measurable, temporary extra read load on production while it runs, proportional to the 21 application schemas' real data volume, not just a metadata-level cost like the schema dump.
- **Schema-drift timing gap**: `pg_dump --schema-only` and `CREATE SUBSCRIPTION` happen as two separate steps, not atomically. If a real schema migration lands on any of the 21 application schemas on production (this is an actively-developed application) in the gap between them, the self-hosted copy misses it. Do these two steps as close together in time as practically possible, and re-diff the schema immediately before creating the subscription if any meaningful time has passed.
- **Large low-value tables**: the production table audit done before Phase 1 found `system_logs_y2026m04`/`m05` alone at 1.35M/2.36M rows — operational log partitions, not core business data. Consider excluding very large `system_logs_*` partitions (and similar pure-log/audit tables, distinct from business-meaningful audit trails like `audit_logs` itself) from the publication to reduce initial-copy time and production read load, unless there's a real reason to need them replicated from day one. This is a legitimate scope-narrowing option to decide at implementation time, not a requirement.

**Protecting the shared VPS's other 24 apps** (same standing constraint as Phase 1): the self-hosted `db` service already has a hard 3GB memory cap from Phase 1 — the initial data copy (a few million rows across ~300 tables, based on the production table-size audit done before Phase 1) should comfortably fit within that, but this phase's verification explicitly re-runs the four production health-check curls before/after every step, exactly as Phase 1 did throughout.

## 5. Verification Plan

Before Phase 2 is considered done:
1. Self-hosted table counts and structure match production's live counterparts **for every one of the 21 application schemas** (spot-check row/column definitions on a sample of tables per schema, not just table counts). Additionally: the 14 cross-schema views in `public` (§1a) must now actually resolve — querying each should succeed rather than erroring on a missing relation. This is the specific, concrete regression test for the scope correction.
2. The new publication (`phase2_public_migration`) exists on Supabase Cloud, is scoped to the 21 application schemas and no Supabase-managed schema, and is confirmed distinct from (doesn't overlap with) the two existing Realtime publications.
3. The subscription is `ACTIVE` (self-hosted `pg_stat_subscription`), initial copy completed, and a test write on a production table (or a genuinely inert/throwaway test row, decided at implementation time to avoid touching real business data) appears on the self-hosted copy within a reasonable lag window.
4. Replication lag-check and teardown procedures are documented and dry-run-tested against a disposable test subscription first, not the real one — both the clean teardown path (publisher reachable) and the detach-then-manually-drop path (publisher unreachable) are exercised, not just the happy path.
5. All four production health-check curls remain 200 throughout every step; Supabase Cloud's own dashboard/metrics show no adverse impact (replication slot WAL retention checked explicitly, not just "the app still responds").

## 6. Open Items

- ~~**Exact publication scope**~~ — resolved 2026-08-26: `FOR TABLES IN SCHEMA <all 21 application schemas>` (see §1a's authoritative include list). Automatically covers any table added later to any of those schemas without needing to remember to update the publication. Still worth a quick confirm at implementation time that no individual table in scope holds data that genuinely shouldn't leave production.
- **Replica identity**: tables without a primary key need explicit `REPLICA IDENTITY` set for `UPDATE`/`DELETE` replication to work. Task 1 audited and fixed this for `public` (5 tables found and remediated) — **the same audit must now be re-run across the other 20 application schemas**, which were never checked under the original `public`-only scope.
- **Large log-table exclusion** (added during spec audit, see §4) — **now in direct tension with the resolved publication scope, flagged 2026-08-26**: `FOR TABLES IN SCHEMA` is all-or-nothing per schema; it cannot exclude individual tables. So excluding the `system_logs_y2026m*` partitions (~3.65 GB, the dominant share of `public`'s 4179 MB) requires abandoning `FOR TABLES IN SCHEMA public` in favour of an explicit table list for `public` specifically — while the other 20 schemas can still use the simpler schema-level form in the same publication (`FOR TABLES IN SCHEMA a, b, c, ... , TABLE x, y, z` is valid). Decide at implementation time: **(a)** simplest — include everything, accept a slower initial copy and a larger self-hosted footprint; or **(b)** explicit table list for `public` minus the `system_logs_*` partitions, schema-level for the rest, accepting that new `public` tables won't auto-join the publication and someone must remember to add them. Recommend (a) unless the initial copy proves painfully slow in practice — correctness and low-maintenance beat a one-time transfer cost here, and the self-hosted `db` has a 3 GB memory cap but no comparably tight disk constraint (the VPS had ~100 GB free as of Phase 1).
- **Test-write verification method** (item 3 above): use a genuinely inert test table/row rather than a real production business record, to avoid any risk of the verification step itself becoming a de facto "we wrote test data to production" incident.

# Self-Hosted Supabase Migration — Phase 2: Logical Replication of the `public` Schema - Design Specification

**Date:** 2026-08-22
**Scope:** Get the production `public` schema (application data — quotes, accounts, work orders, etc.) from Supabase Cloud onto the self-hosted Postgres stood up in Phase 1, and keep it continuously in sync via native Postgres logical replication until the eventual cutover. This is what makes near-zero-downtime cutover possible later: instead of a one-time dump/restore with hours of staleness, the self-hosted copy stays live-current, and cutover becomes "confirm replication lag is ~0, flip env vars," not "wait for a big data transfer."
**Status:** Approved for implementation

## 1. Background

Phase 1 (complete, see `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md`) stood up a self-hosted Supabase-equivalent stack on the shared Coolify VPS, live at `https://supabase.sosservices.online`, serving zero production traffic. Its Postgres (`db` service) currently only has the default bootstrap schemas GoTrue/Storage/Realtime create on their own (`auth` 23 tables, `storage` 10, `realtime` 8+4, plus extension schemas `cron`/`net`/`pgsodium`/`vault`) — `public` has essentially nothing (confirmed directly: 1-3 tables, none of the ~300 real application tables).

Production (Supabase Cloud project `gzhxgoigflftharcmdqj`, "SG-Logistics-Pro-Enterprise") was directly queried before designing this phase:
- `wal_level = logical` — already enabled (Supabase Cloud turns this on by default; its own Realtime feature depends on it).
- **Two existing, active replication slots already in production use**: `supabase_realtime_replication_slot_2_129_6_893679d` (plugin `wal2json`) and `supabase_realtime_messages_replication_slot_2_129_6_893679d` (plugin `pgoutput`), backing publications `supabase_realtime` and `supabase_realtime_messages_publication` (both `puballtables=false`, table-scoped). **These must not be touched, altered, or interfered with** — they're actively serving production's live Realtime functionality right now.
- Direct (non-pooled) connection host: `db.gzhxgoigflftharcmdqj.supabase.co`, Postgres engine 17 — same major version as the self-hosted `supabase/postgres:17.6.1.136`, which avoids cross-version logical replication quirks.
- Roles with `rolreplication=true` already exist (`postgres`, `supabase_admin`, `supabase_replication_admin`, `dashboard_user`, `supabase_etl_admin`) — confirms replication is supported and reachable at the account level, though this phase creates its own dedicated role rather than reusing any of these (see §3).

**Decisions made during design (explicit, informed trade-offs):**
- **`public` schema only, not `auth`.** Self-hosted GoTrue manages its own `auth` schema via its own internal migration versioning (already bootstrapped in Phase 1). Logical-replicating Supabase Cloud's live `auth` tables directly risks colliding with that if the two GoTrue versions' schema expectations ever diverge. Real user/session data migration is deferred to Phase 5 (already scoped for JWT/auth continuity), which is the more appropriate place to reconcile this carefully rather than bolt it onto Phase 2.
- **Schema DDL comes from `pg_dump --schema-only` against live production, not from replaying the repo's 1,111 migration files.** This guarantees the self-hosted schema exactly matches what's actually running now, including any manual/dashboard changes that may not be captured in migration files — a common source of drift in Supabase projects, and a real risk if replication depends on the two schemas actually matching column-for-column.

## 2. Goals / Non-Goals

**Goals:**
- The self-hosted Postgres's `public` schema has an identical structure to production's live `public` schema (tables, columns, indexes, constraints, RLS policies, functions/triggers relevant to `public`), obtained via `pg_dump --schema-only`.
- A dedicated, least-privilege Postgres role exists on Supabase Cloud for this replication (not the `postgres` superuser), with `REPLICATION` and read-only access scoped to `public`.
- A new publication on Supabase Cloud, scoped to `public` tables only, entirely separate from and non-interfering with the two existing `supabase_realtime*` publications/slots.
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
     role: phase2_replicator                       REPLICATION + SELECT on public only
     publication: phase2_public_migration           FOR TABLES IN SCHEMA public
     (a third, independent replication slot is created automatically when the
      self-hosted subscription below is created — Postgres names it after the
      subscription)
                              │
                              │ logical replication (initial copy + ongoing stream)
                              ▼
   Self-hosted Postgres (db service, Coolify VPS, Phase 1)
   ─────────────────────────────────────────────────────────────────────
   public schema: structure from `pg_dump --schema-only` (exact match to live
   production), then populated + kept in sync by:
     subscription: phase2_public_migration_sub     connects to the direct
                                                    Supabase Cloud host,
                                                    copy_data=true (initial
                                                    full copy on creation)
```

**Why a dedicated role instead of reusing an existing superuser-equivalent**: least privilege — this role only needs `REPLICATION` (to open a replication connection) and read access to `public`'s tables (for the initial `COPY`). It should not be able to touch `auth`/`storage`/`realtime`/`vault` schemas at all, and should not have write access to anything. This limits blast radius if the credential is ever mishandled, independent of how careful the process around it is.

**Why a brand-new publication rather than adding to an existing one**: `supabase_realtime` and `supabase_realtime_messages_publication` are actively serving production traffic right now. Reusing or modifying them for migration purposes — even just adding tables to `supabase_realtime` — risks changing what Realtime actually broadcasts to live connected clients. A dedicated, separate publication (`FOR TABLES IN SCHEMA public`, or an explicit table list if `FOR TABLES IN SCHEMA` proves too broad once the real table list is inspected) has zero interaction with the existing ones.

**Why `CREATE SUBSCRIPTION` handles both initial sync and ongoing replication**: this is native PostgreSQL behavior (not something built manually) — when a subscription is created with the default `copy_data = true`, Postgres performs a snapshot-consistent initial `COPY` of every table in the publication, then seamlessly transitions to streaming logical replication from the same point, no gap or separate coordination step required.

## 4. Safety & Monitoring

**Pre-implementation checks already done during spec audit (not deferred, confirmed now):**
- The 4 standard Supabase roles referenced by RLS policies (`anon`, `authenticated`, `service_role`, `authenticator`) are confirmed present on **both** production and the self-hosted Postgres already (queried directly on both sides) — restoring `public`'s schema (including its RLS policies, which grant `TO authenticated`/`TO anon` etc.) will not fail on a missing role.
- Raw TCP reachability from the VPS to `db.gzhxgoigflftharcmdqj.supabase.co:5432` confirmed directly (`timeout 6 bash -c 'echo > /dev/tcp/...'` from the VPS itself) — no network restriction blocks the connection at the transport level. Authentication is still a separate, later concern (the dedicated role's password), but this rules out the more common failure mode of a Supabase project's IP allow-list rejecting the VPS outright.

**Protecting production Supabase Cloud** (the more important direction here — this phase's failure mode risk is against the *source*, not just the self-hosted target):
- A replication slot retains WAL on the source for as long as it exists and isn't fully consumed. If the self-hosted subscriber falls far behind or disconnects for an extended period, Supabase Cloud's own disk usage grows — a real production risk, independent of the VPS-side concerns Phase 1 was built around.
- This phase documents (and Task-level work will implement) a health-check query pattern using `pg_stat_replication` (on the source) and `pg_stat_subscription`/replication lag views (on the target), plus an explicit, tested teardown procedure. **Corrected during spec audit — the teardown is not unconditionally automatic:** `DROP SUBSCRIPTION` only cleans up the matching slot on the source automatically if it can still open a live connection to the publisher at drop time. If that connection isn't available (network issue, revoked credential, paused project), the drop fails outright unless the subscription is first detached from its slot (`ALTER SUBSCRIPTION ... DISABLE`, then `ALTER SUBSCRIPTION ... SET (slot_name = NONE)`, then `DROP SUBSCRIPTION`), after which the now-orphaned slot must be dropped manually on the source (`SELECT pg_drop_replication_slot('...')`). Task-level work must implement and test **both** paths — the clean case and the publisher-unreachable case — not just the happy path.
- Initial schema dump/restore and publication/subscription creation are all metadata/DDL-level operations plus a bounded initial data copy — none of this locks or blocks production's own live traffic in normal operation (`pg_dump --schema-only` takes a lightweight consistent snapshot, not an exclusive lock). The subscription's initial `COPY` of table data is similarly non-blocking (snapshot-consistent, not an exclusive lock) but is genuinely the heaviest I/O step in this phase — expect measurable, temporary extra read load on production while it runs, proportional to `public`'s real data volume, not just a metadata-level cost like the schema dump.
- **Schema-drift timing gap**: `pg_dump --schema-only` and `CREATE SUBSCRIPTION` happen as two separate steps, not atomically. If a real schema migration lands on production `public` (this is an actively-developed application) in the gap between them, the self-hosted copy misses it. Do these two steps as close together in time as practically possible, and re-diff the schema immediately before creating the subscription if any meaningful time has passed.
- **Large low-value tables**: the production table audit done before Phase 1 found `system_logs_y2026m04`/`m05` alone at 1.35M/2.36M rows — operational log partitions, not core business data. Consider excluding very large `system_logs_*` partitions (and similar pure-log/audit tables, distinct from business-meaningful audit trails like `audit_logs` itself) from the publication to reduce initial-copy time and production read load, unless there's a real reason to need them replicated from day one. This is a legitimate scope-narrowing option to decide at implementation time, not a requirement.

**Protecting the shared VPS's other 24 apps** (same standing constraint as Phase 1): the self-hosted `db` service already has a hard 3GB memory cap from Phase 1 — the initial data copy (a few million rows across ~300 tables, based on the production table-size audit done before Phase 1) should comfortably fit within that, but this phase's verification explicitly re-runs the four production health-check curls before/after every step, exactly as Phase 1 did throughout.

## 5. Verification Plan

Before Phase 2 is considered done:
1. Self-hosted `public` schema table count and structure match production's live `public` schema (spot-check row/column definitions on a sample of tables, not just table count).
2. The new publication (`phase2_public_migration`) exists on Supabase Cloud, is scoped only to `public`, and is confirmed distinct from (doesn't overlap with) the two existing Realtime publications.
3. The subscription is `ACTIVE` (self-hosted `pg_stat_subscription`), initial copy completed, and a test write on a production table (or a genuinely inert/throwaway test row, decided at implementation time to avoid touching real business data) appears on the self-hosted copy within a reasonable lag window.
4. Replication lag-check and teardown procedures are documented and dry-run-tested against a disposable test subscription first, not the real one — both the clean teardown path (publisher reachable) and the detach-then-manually-drop path (publisher unreachable) are exercised, not just the happy path.
5. All four production health-check curls remain 200 throughout every step; Supabase Cloud's own dashboard/metrics show no adverse impact (replication slot WAL retention checked explicitly, not just "the app still responds").

## 6. Open Items

- **Exact publication scope**: `FOR TABLES IN SCHEMA public` (all current and future `public` tables automatically included) vs. an explicit table list. Default to `FOR TABLES IN SCHEMA public` for simplicity (matches "public schema only" intent exactly, and automatically covers any table added later without needing to remember to update the publication) — confirm no unexpected table in `public` shouldn't be replicated (e.g., a table with genuinely sensitive data that shouldn't leave production) before finalizing at implementation time.
- **Replica identity**: tables without a primary key need explicit `REPLICA IDENTITY` set for `UPDATE`/`DELETE` replication to work — needs a live audit of `public` tables lacking a PK before subscribing, deferred to implementation.
- **Large log-table exclusion** (added during spec audit, see §4): whether to exclude `system_logs_y2026m*` partitions (and similarly large pure-log tables) from the initial publication scope to reduce initial-copy time/production read load — a real option, not a requirement, decide at implementation time based on how large the live `public` schema audit turns out to be.
- **Test-write verification method** (item 3 above): use a genuinely inert test table/row rather than a real production business record, to avoid any risk of the verification step itself becoming a de facto "we wrote test data to production" incident.

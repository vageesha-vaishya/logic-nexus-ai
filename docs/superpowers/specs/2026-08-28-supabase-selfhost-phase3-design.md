# Self-Hosted Supabase Migration — Phase 3: Storage Sync - Design Specification

## 1. Background

Phase 1 (complete) stood up a self-hosted Supabase-equivalent stack with zero production traffic, using a local-disk Storage backend (`STORAGE_BACKEND=file`, no MinIO/S3 — see `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md` §"Known Phase 1 limitations"). Phase 2 (complete) replicated all 795 tables of application data across 21 schemas via native Postgres logical replication — but explicitly excluded the `storage` schema (one of the 10 Supabase-managed schemas), since `storage.buckets`/`storage.objects` are metadata for a service (Storage API) that self-hosted runs independently, not raw application data to stream.

This phase closes that gap: replicating Storage's bucket configuration, access-control policies, and the actual file bytes from production (Supabase Cloud, project `gzhxgoigflftharcmdqj`) to self-hosted.

**Discovered during brainstorming, materially shaping this design:** production's actual Storage footprint is tiny. Of 9 buckets, only one (`organization-assets`) has any objects — 11 files, 155 KB total. Every other bucket is empty. This is a different scale problem than Phase 2 (795 tables, ~4.4GB) and does not need Phase 2's heavy resumability/retry machinery — a straightforward one-file-at-a-time loop is proportionate.

## 2. Goals / Non-Goals

**Goals:**
- Self-hosted `storage.buckets` matches production exactly (id, public flag, `file_size_limit`, `allowed_mime_types`) for all 9 buckets.
- Self-hosted `storage.objects` RLS policies match production's 26 policies exactly (verified via `pg_get_expr` text diff, the same methodology Phase 2 used for triggers).
- All object bytes currently on production exist on self-hosted, reachable through self-hosted's own Storage API with correct content-type.
- A re-runnable script (not a one-shot manual procedure) so the same sync can be repeated just before Phase 6's cutover to catch anything uploaded to production in the interim.

**Non-Goals:**
- No ongoing/continuous sync mechanism (polling, webhooks, CDC) — current volume doesn't justify it, and production stays the source of truth until cutover regardless.
- No migration of `storage.buckets`/`storage.objects`' underlying data via Phase 2's logical replication — `storage` remains deliberately excluded from that publication (self-hosted's Storage API owns this schema's lifecycle, same reasoning as `auth`).
- No change to Storage backend choice (local-disk stays local-disk; MinIO/S3 remains out of scope, matching Phase 1's decision).
- No handling of buckets/objects created *after* this phase's final pre-cutover run — anything uploaded to production between that run and the actual cutover moment is Phase 6's problem, not this phase's.

## 3. Architecture

Two independent pieces, both driven from a single re-runnable script (not two separate one-off procedures):

**3a. Metadata replication** (buckets + RLS policies): a one-time SQL step, since these change rarely (bucket creation is a deploy-time app change, not routine user activity). Bucket rows are inserted directly (`INSERT INTO storage.buckets ...`, all 9, matching production's `id`/`name`/`public`/`file_size_limit`/`allowed_mime_types`/`avif_autodetection` fields exactly). The 26 RLS policies on `storage.objects` are recreated verbatim via `CREATE POLICY` statements built from production's `pg_get_expr(polqual, ...)`/`pg_get_expr(polwithcheck, ...)` output — diff-driven against production, not hand-transcribed, per the lesson from Phase 2's trigger recreation (a pattern-based or manually-retyped approach risks silently missing an edge case). These policies reference `public`-schema functions (`is_platform_admin`, `get_user_tenant_id`, `get_user_franchise_id`) and tables (`file_attachments`, `directives`, `vendors`, `user_roles`, `profiles`) that Phase 2 already replicated into self-hosted's `public` schema — no new dependency to solve, but the plan's implementer must verify each referenced function/table actually exists self-hosted *before* creating a policy that depends on it (same "verify dependencies exist before creating the dependent object" discipline Phase 2's trigger fix used).

**3b. File transfer**: a script that, per bucket, lists objects from `storage.objects` (already have DB access — simpler and more reliable than paginating the Storage API's list endpoint), downloads each via production's Storage HTTP API (`GET /storage/v1/object/{bucket}/{path}` with the `phase2_replicator`-style service-role auth — a **read-only** service role scoped to Storage, not reusing the Postgres-level `phase2_replicator` role which has no bearing on Storage's own JWT-based auth), and re-uploads via self-hosted's Storage API (`POST /storage/v1/object/{bucket}/{path}`, self-hosted's own service-role key) with the original `content-type` preserved. Idempotent (upload overwrites if the object already exists), so the same script is what gets re-run before cutover.

**Data flow:** `production storage.objects` (list) → download via production Storage API → upload via self-hosted Storage API → verify.

**Script location:** `deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh` (or `.ts` if a scripting language with better JSON/HTTP ergonomics than bash suits this better — implementer's call, not load-bearing for this spec) — following the same convention Phase 2 established of committing reusable operational scripts under `deploy/selfhosted-supabase/scripts/`, parameterized via environment variables, no hardcoded secrets.

## 4. Safety & Monitoring

- **Read-only against production**: this phase never writes to production. The only production interaction is listing/downloading via its Storage API using read-only credentials.
- **Self-hosted only, zero production traffic**: matches Phase 1/2's standing constraint — self-hosted still serves no live app traffic, so a mistake here (a bad bucket config, a wrong RLS policy) has no user-facing blast radius before Phase 6.
- **Health checks**: the same 4 standard production health-check curls after every state-changing step, per this project's established practice.
- **No interaction with the Phase 2 logical replication subscription** — this phase's SQL changes (bucket rows, RLS policies) live in the `storage` schema, which the subscription doesn't touch. No risk of colliding with `phase2_public_migration_sub`'s slot/WAL retention concerns.

## 5. Verification Plan

1. **Bucket config match**: query `storage.buckets` on both sides, diff all fields for all 9 buckets — zero differences expected.
2. **RLS policy match**: `pg_get_expr`-based text diff of all 26 policies on `storage.objects`, both sides — zero differences expected (same full-set-hash-or-equivalent rigor as Phase 2's 356-trigger verification, not a sample).
3. **Object completeness**: per-bucket object count and total byte size, both sides — must match exactly (11 objects / 155 KB as of this spec's writing, subject to drift by the time this executes).
4. **Live smoke test**: fetch at least one real object through self-hosted's actual Storage API URL (through Kong, not container-internal) and confirm correct bytes (checksum match against the source) and correct `content-type` header.
5. **Idempotency check**: re-run the sync script a second time immediately after the first successful run; confirm it reports "already up to date" / makes no changes on the second pass, proving the re-sync-before-cutover plan will behave correctly.

## 6. Open Items

- **Storage-service-role credential**: Storage API auth is JWT-based (a service-role JWT, not a Postgres role/password like `phase2_replicator`). The plan must specify where this comes from for both production (already exists, in whatever secret store the app currently uses) and self-hosted (Phase 1's `SUPABASE_SERVICE_ROLE_KEY` env var, already provisioned for the self-hosted stack per Phase 1's `env.example`) — confirm both are usable for this purpose before the plan assumes it, don't guess.
- **`db-backups` bucket**: empty on production, and its RLS policies suggest it's an app-internal mechanism for user-initiated DB export downloads rather than a bucket needing real historical data. Replicate its config/policies for completeness (cheap, consistent with treating all 9 buckets uniformly) but no file-transfer work applies since it's empty.

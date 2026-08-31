# Self-Hosted Supabase Migration — Phase 5a: GoTrue Version Upgrade - Design Specification

**Date:** 2026-08-30
**Scope:** Upgrade the self-hosted stack's GoTrue (Auth) image from `v2.189.0` to `v2.195.0` to close the schema-version gap the Phase 2 handoff found (§0a of `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase2-design.md`), before Phase 5 migrates any real user data. This is a small, scoped sub-project done first and separately, at the user's explicit request, because it's genuinely low-risk right now (only 1 test user exists self-hosted) and becomes riskier once real production users are present.
**Status:** Approved for implementation

## 1. Background

Phase 2's auth-schema diff (completed 2026-08-28) found self-hosted GoTrue (`v2.189.0`, confirmed via `docker-compose.yml` and the live `/auth/v1/health` version string) is behind production's GoTrue (`v2.195.0`, confirmed the same way against Supabase Cloud). The gap produced exactly one real structural difference — `auth.custom_oauth_providers.custom_claims_allowlist` (`text[]`, NOT NULL) exists in production, missing self-hosted — everything else in `auth` (239/240 other columns, all functions, table count) already matches.

`v2.195.0` is confirmed pullable on Docker Hub. GitHub release notes for all 7 intermediate releases (`v2.190.0` through `v2.195.0`) were checked directly and contain no "BREAKING" callouts.

**Corrected/strengthened during a second audit pass (2026-08-31):** the first pass only grepped release bodies for the literal word "BREAKING" — a real gap, since conventional-changelog release notes don't reliably label every self-host-relevant config change that way. Re-checked more thoroughly:

- **Full release bodies re-scanned for config/env-var-relevant lines** (`GOTRUE_`, "env var", "config", "required", "deprecated", "removed", "renamed"), not just the word "BREAKING". Found: `v2.190.0` changed WebAuthn config to *warn instead of erroring* on invalid config (a leniency improvement, not a new requirement) and added optional JSON-file config support (doesn't affect our env-var-based setup); `v2.195.0` only removed two unused audit-log *event types* (cosmetic, not a config/env-var change). No new required env var, no renamed/removed one, across any of the 7 releases. We don't configure WebAuthn at all in this stack, so that change is moot either way.
- **Upstream's own reference `docker-compose.yml` (`supabase/supabase:docker/docker-compose.yml`) still pins `v2.189.0`** — re-checked live, unchanged since Phase 1. This means `v2.195.0` is genuinely ahead of what Supabase's official self-host reference config currently ships and tests against; this upgrade can't lean on "upstream already validated this exact config," unlike every other version pin in this project so far, which matched upstream's own current reference exactly. It's still a reasonable upgrade — Supabase Cloud runs `v2.195.0` at real production scale, so the *binary* is proven, just not in this exact self-host compose shape. This raises (without blocking) the importance of the Verification Plan's health/diff checks actually being run carefully rather than treated as a formality.

**Why now, not bundled into the rest of Phase 5:** self-hosted `auth.users` currently holds exactly 1 test user (confirmed via the same Phase 2 diff) — no real production user data is at stake yet. Doing the version bump before Phase 5 migrates the real 103 users/101 identities means any migration problem is cheap to discover and retry, rather than something to debug under the pressure of live user data.

## 2. Goals / Non-Goals

**Goals:**
- Self-hosted GoTrue runs `v2.195.0`, matching production.
- GoTrue's own internal migration tooling applies the schema changes (including the `custom_claims_allowlist` column) automatically on startup — not applied by hand.
- Re-running the Phase 2 auth-schema diff afterward shows convergence: same column count, same migration version stamp, on both sides.
- Zero impact on the other 6 stack containers, the shared VPS's other apps, or production Supabase Cloud (this touches only the self-hosted stack).

**Non-Goals (still Phase 5, not this sub-project):**
- Migrating the real 103 users / 101 identities from production.
- Creating the `on_auth_user_created` trigger.
- JWT secret alignment.
- Any change to production Supabase Cloud.

## 3. Approach

1. Change `deploy/selfhosted-supabase/docker-compose.yml`'s `auth` service image tag from `supabase/gotrue:v2.189.0` to `supabase/gotrue:v2.195.0`. This is a compose-file change (not a bind-mounted file), so a normal Coolify redeploy picks it up directly — no manual reseed step needed, unlike the `kong.yml`/SQL-init-script gotcha documented elsewhere in the README.
2. Redeploy. On startup, GoTrue's entrypoint runs its own internal migration tool against `auth.schema_migrations`, applying every migration between the current stamp (`20260302000000`) and whatever `v2.195.0` expects.
3. Verify GoTrue reaches a healthy state (not crash-looping on its own migration step) and re-run the exact diff queries from the Phase 2 handoff to confirm convergence.

## 4. Verification Plan

1. `auth` container reaches `Up ... (healthy)` after redeploy, not crash-looping.
2. `GET /auth/v1/health` (through Kong) reports `"version":"v2.195.0"`.
3. **`docker logs` on the new `auth` container is read directly, not inferred from health status alone** (added during spec audit — since upstream hasn't validated this exact config at this version, per §1, a Docker healthcheck passing doesn't rule out a startup warning worth knowing about, e.g. the WebAuthn leniency change surfacing a warning rather than an error). Confirm the migration run completed without error and note anything unexpected even if non-fatal.
4. Re-run the Phase 2 diff: column count (should now be 240/240, not 239/240), the specific `custom_oauth_providers.custom_claims_allowlist` column exists self-hosted, and `auth.schema_migrations` latest version matches production's `20260625000000` (or whatever the actual current production stamp is by the time this runs — re-check live, don't assume it hasn't moved).
5. The other 6 stack containers remain healthy throughout (unaffected by an `auth` container change).
6. All four production health-check curls remain 200 throughout (this only touches the self-hosted stack, but verify anyway — same discipline as every other phase).

## 5. Rollback

Revert the image tag to `v2.189.0` and redeploy. **Documented limitation, not a blocker given no real data is at stake:** GoTrue's migrations are forward-only by design — a rollback after a successful upgrade leaves `auth.schema_migrations` ahead of what `v2.189.0`'s own code expects, which could itself cause GoTrue to behave unexpectedly on downgrade. This is acceptable here specifically because the only data involved is 1 disposable test user; it would not be an acceptable rollback story once Phase 5 migrates real users.

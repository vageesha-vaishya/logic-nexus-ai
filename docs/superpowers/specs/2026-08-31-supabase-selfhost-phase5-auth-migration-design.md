# Self-Hosted Supabase Migration — Phase 5: Auth Data Migration & JWT Alignment - Design Specification

**Date:** 2026-08-31
**Scope:** The remaining Phase 5 work handed off by Phase 2 (§0/§0a of `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase2-design.md`), now that Phase 5a has closed the GoTrue version/schema gap: migrate production's 103 `auth.users` + 101 `auth.identities` rows to self-hosted, create the `on_auth_user_created` trigger, and align the JWT signing secret so an already-issued, still-valid production access token keeps working immediately after cutover.
**Status:** Approved for implementation

## 1. Background

Phase 2's handoff (§0) found production has a trigger (`on_auth_user_created` → `public.handle_new_user()`) that self-hosted's GoTrue-bootstrapped `auth` schema never had, and deliberately deferred fixing it to Phase 5. The completed full `auth` diff (§0a, 2026-08-28) found self-hosted's `auth` schema was otherwise nearly identical to production except for one GoTrue version-driven column gap and, critically, near-empty `auth.users`/`auth.identities` tables (1 test user/identity vs. production's 103/101) and a stale migration stamp. §0a's own conclusion named Phase 5's scope precisely: "(1) upgrade GoTrue to close the version skew, (2) migrate 103 users + 101 identities, (3) create the `on_auth_user_created` trigger, (4) align the JWT secret so existing sessions survive cutover."

Item (1) is done — Phase 5a (`docs/superpowers/specs/2026-08-30-supabase-selfhost-phase5a-gotrue-upgrade-design.md`) upgraded self-hosted GoTrue to v2.195.0, confirmed the `auth` schema now converges with production exactly (240/240 columns, migration stamp `20260625000000` on both sides). This spec covers items (2)-(4).

**Confirmed live during this design pass (2026-08-31):**
- Self-hosted `auth.users` currently holds exactly 1 row: a synthetic test user (`phase4-batch1-verify-test@sosservices.online`, id `02424458-e64b-4584-87ca-dd1d33f414c7`, created during Phase 4 Batch 1's own verification) with a matching 1 row in `auth.identities`. It has **no** corresponding `public.profiles` row (confirmed via direct query) — deleting it is a clean removal, no orphaned data to also clean up.
- `public.profiles` already holds all 104 production rows self-hosted (Phase 2's ongoing logical replication of `public` covers this table) — this matters directly for ordering (see §3).
- Neither `auth.users` nor `auth.identities` has any pgsodium/vault-encrypted column (confirmed via `information_schema.columns` against production: `encrypted_password` is GoTrue's own bcrypt hash — self-contained, not tied to any per-database encryption key — and `identity_data`/`raw_app_meta_data`/`raw_user_meta_data` are plain `jsonb`, not vault-encrypted). A byte-for-byte row copy is safe and preserves login capability exactly; there is no per-database secret that would make a copied row undecryptable or unusable on self-hosted.

## 2. Goals / Non-Goals

**Goals:**
- Production's 103 `auth.users` + 101 `auth.identities` rows exist self-hosted, byte-identical to production (preserving password hashes, UUIDs, timestamps, metadata exactly — no transformation, no re-hashing).
- The `on_auth_user_created` trigger exists self-hosted and correctly fires `public.handle_new_user()` on **new** signups (verified with a fresh test signup, not a migrated row).
- Self-hosted's `JWT_SECRET` matches production's real signing secret, so a still-unexpired access token issued by production before cutover continues to verify successfully against self-hosted immediately after.
- Self-hosted's leftover synthetic test user/identity is removed before the real data lands.

**Non-Goals (explicitly deferred, per this design's clarifying questions):**
- Migrating `auth.sessions` / `auth.refresh_tokens`. Users simply get a normal re-login prompt once their current access token naturally expires (`JWT_EXPIRY=3600`, so within an hour of cutover at the latest) — no silent-refresh continuity across cutover.
- Any repeatable/incremental re-sync mechanism. This is a one-shot snapshot taken close to the actual production→self-hosted traffic cutover, not a dry run — production is expected to stop taking new signups at or shortly before this runs. (The restore statements are still written with `ON CONFLICT DO NOTHING` for safe manual retry after a partial failure, but this is not a repeated-sync tool.)
- Any change to production Supabase Cloud itself.

## 3. Approach

Order matters — steps 2 and 3 are sequenced specifically to avoid a real failure mode (see the note on step 3):

1. **Delete self-hosted's synthetic test user and identity** (`02424458-e64b-4584-87ca-dd1d33f414c7`) — confirmed no `public.profiles` row references it, so this is a clean two-row delete (`auth.identities` first, then `auth.users`, respecting the FK).
2. **Migrate the real data**, via `pg_dump --data-only` from production against just `auth.users` then `auth.identities` (in that order — `identities.user_id` FKs to `users.id`), restored into self-hosted's `db` container. Uses this project's established pg_dump/psql pattern from Phase 2, not GoTrue's admin API (which cannot accept a pre-computed bcrypt hash without re-registering it as a "password reset," and has no bulk-identity-import path at all). Restore statements use `ON CONFLICT (id) DO NOTHING` — safe to re-run once if a partial failure needs a retry, without becoming a general-purpose sync mechanism.
3. **Only after step 2 completes, create the trigger:**
   ```sql
   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```
   **Why this must come after, not before:** `public.profiles` already holds all 104 production rows via Phase 2's ongoing replication. If the trigger existed *before* step 2's bulk insert, every migrated `auth.users` row would fire `handle_new_user()`, which does `INSERT INTO public.profiles (id, ...)` — colliding with the row Phase 2 already replicated for that same user (`id` is the primary key), aborting the insert. Creating the trigger only after the bulk migration means it only ever fires for genuinely new signups, which have no pre-existing `profiles` row to collide with.
4. **Align the JWT secret.** This step pauses here: it needs production's actual signing secret (Supabase Dashboard → Project Settings → API → JWT Settings → legacy JWT secret), which isn't retrievable via the MCP tools or any API available to this session, and the plan owner will supply it at execution time — the same pattern already established for the DB password and third-party API keys earlier in this project. Once supplied: update `JWT_SECRET` in the repo-root `env` file and in Coolify's env-var store for this app (per the established "flat `.env` is a decoy" gotcha — must go through Coolify's real API, not just the file), then recreate whichever containers reference it (`auth`, `rest`, `realtime`, `functions`, per `docker-compose.yml`) the same surgical, single-service-at-a-time way Phase 5a established, not via a full Coolify redeploy.
5. Verify (see §4).

## 4. Verification Plan

1. Row counts converge: self-hosted `auth.users` = 103, `auth.identities` = 101 (matching production exactly at the time of the dump — re-check production's live counts at execution time rather than assuming they haven't moved since this design was written).
2. Structural spot-check, not a live login test (production's real user passwords are not available to this session): for 5 sampled users (a mix of the oldest, the newest, and 3 random by `id`), confirm `id`, `email`, and `encrypted_password` are byte-identical between production and self-hosted. Byte-identical `encrypted_password` is sufficient evidence a user's real password will keep working, since bcrypt hashes are self-contained and not tied to any per-database secret (confirmed in §1).
3. **Optional, real end-to-end check:** if the plan owner's own account is among the 103 migrated users and they know their real password, an actual login attempt against self-hosted's `/auth/v1/token?grant_type=password` endpoint is the strongest possible verification — offer this, but do not treat it as required given most of the 103 users' passwords are unknown to this session.
4. Trigger verification uses a **new** signup (e.g., a disposable test email through self-hosted's own signup flow), not any migrated row — confirms `on_auth_user_created` fires and creates the matching `public.profiles` row, and confirms it does NOT fire retroactively on data that's already there.
5. JWT alignment: decode a still-valid production-issued access token's header/payload (no need to force a fresh login) and confirm self-hosted's `/auth/v1/user` (or equivalent) accepts it once the secret is aligned — this is the actual goal, not just "the config value looks right."
6. The four standard production health-check curls, before and after every container-affecting step.
7. Self-hosted's own signup path (used for step 4's test) continues to work end-to-end after the JWT secret change (a wrong secret would break self-hosted's own token issuance, not just cross-secret validation).

## 5. Rollback

- Steps 1-3 (test-user cleanup, data migration, trigger creation) are ordinary DML/DDL against self-hosted's `auth`/`public` schemas — reversible by deleting the migrated rows and dropping the trigger, with zero effect on production (all reads from production, no writes).
- Step 4 (JWT secret) is the one step with real blast radius: reverting means restoring self-hosted's own prior generated secret via Coolify's env-var API and recreating the affected containers again. Any self-hosted session issued with the aligned (production) secret during the window it was live would stop validating on rollback — acceptable given this is explicitly a near-cutover, one-shot step, not a long-lived dual-running state.
- If cutover is aborted after this phase runs, production is entirely unaffected (this phase only ever reads from it) — the self-hosted stack would simply hold a stale, no-longer-current snapshot of users until a repeat run closer to the real cutover.

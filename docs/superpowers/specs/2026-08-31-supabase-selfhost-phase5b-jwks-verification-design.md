# Self-Hosted Supabase Migration — Phase 5b: JWKS-Based Verification of Production Tokens - Design Specification

**Date:** 2026-08-31
**Scope:** Phase 5's JWT alignment (`docs/superpowers/specs/2026-08-31-supabase-selfhost-phase5-auth-migration-design.md`) aligned self-hosted's legacy HS256 `JWT_SECRET` with production's, on the assumption production's real signing secret was that same legacy HS256 secret. A real production access token supplied for verification during that phase's final review disproved this: production issues **ES256** tokens (asymmetric, via Supabase's JWT Signing Keys / JWKS feature), confirmed against production's live JWKS endpoint and empirically confirmed self-hosted rejects such a token outright (`"signing method ES256 is invalid"`). This phase makes self-hosted able to verify production's real, current tokens, while still being able to issue its own tokens for logins/signups that happen directly against it.

**Status:** Approved for implementation

## 1. Background

**What Phase 5 actually achieved vs. what it was meant to achieve:** all of Phase 5's mechanics (updating `JWT_SECRET` in Coolify's env store and the `db` GUC, regenerating `ANON_KEY`/`SERVICE_ROLE_KEY` to match, recreating the affected containers) were executed correctly against their target — the legacy HS256 secret. The stated goal ("a still-valid production access token keeps validating against self-hosted immediately after cutover") is not met for any token issued under production's current scheme, because HS256 (symmetric, shared-secret) and ES256 (asymmetric, public/private keypair) are not interchangeable — no shared value can make an HS256-only verifier accept an ES256-signed token. This was proven empirically, not inferred: a real, current production access token (`alg: ES256`, `kid: c3dfc32a-6c1a-49b1-8830-4f554903ff30`) returned `403 {"code":"bad_jwt","msg":"...signing method ES256 is invalid"}` from self-hosted's `/auth/v1/user`.

**Confirmed via production's live JWKS endpoint** (`https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json`): it currently publishes 2 ES256 public keys (`kid`s `c3dfc32a-6c1a-49b1-8830-4f554903ff30` and `5a9b1446-5e00-4a18-a807-fc54aba5241c`) — the first matches the sampled token exactly; the second is presumably a standby/rotation key. The legacy HS256 secret retrieved from the dashboard for Phase 5 still exists and is exposed there, but is not what's actively signing current tokens.

**Researched and confirmed (not assumed) before this design was written**, against GoTrue v2.195.0's actual source (`supabase/auth`, `internal/conf/jwk.go`) and PostgREST's documented config:
- `GOTRUE_JWT_KEYS` accepts a JSON array of JWKs. Verify-only entries can be bare public keys (no private/`d` component) — this is exactly production's JWKS shape, usable as-is. Exactly one entry in the whole array must be marked `key_ops: ["sign"]` (with its private component present) — GoTrue uses that one to sign new tokens it issues itself; `Validate()` errors if zero or more than one entry claims the signing role.
- Setting `GOTRUE_JWT_KEYS` at all switches GoTrue's own token issuance off `GOTRUE_JWT_SECRET` entirely, onto the one designated signing key in that array.
- `PGRST_JWT_SECRET` (PostgREST) directly accepts a literal JWK or a full `{"keys":[...]}` JWKS JSON blob — no separate config path needed, and no private key material required since PostgREST never signs, only verifies.
- Neither GoTrue nor PostgREST support fetching a JWKS from a live URL — key material is static, supplied via env var. If production rotates its ES256 keys after this phase's snapshot is taken, self-hosted's copy goes stale until manually re-synced. Acceptable here because this is meant to be a short cutover-window measure, not a permanent architecture, but the whole reason this matters at all *this time* was a real, undocumented mismatch — a full re-check of production's JWKS immediately before the actual cutover is worth budgeting for, not assumed away.
- This exact scenario — a self-hosted stack that needs to verify (not just issue) another, external Supabase Cloud project's tokens during a migration window — is not a documented Supabase self-host pattern. This phase assembles it from GoTrue/PostgREST's individual, real capabilities above, not from an official recipe.

## 2. Goals / Non-Goals

**Goals:**
- Self-hosted's `auth`/`rest` (and any other JWT-verifying service) accept currently-valid production-issued ES256 access tokens — verified against the real, still-valid token sampled during Phase 5's review, not merely against a freshly-minted test token.
- Self-hosted continues to be able to issue its own valid tokens for logins/signups happening directly against it (both before and after the eventual cutover) — via a newly-generated, self-hosted-owned signing keypair.
- `ANON_KEY`/`SERVICE_ROLE_KEY` (Phase 5's bare-HS256, `kid`-less regenerated versions) are regenerated once more, this time properly signed under the new self-hosted signing key with a matching `kid`, so self-hosted's own REST API keeps working under the new verification scheme rather than repeating Phase 5's "changed the verification scheme, broke the stack's own anon/service tokens" mistake.
- Zero change to production Supabase Cloud (this phase only ever reads production's already-public JWKS endpoint).

**Non-Goals:**
- Live/automatic JWKS refresh from production — explicitly out of scope per the researched limitation above; a manual re-check immediately before the real cutover is a process step, not something this phase automates.
- Migrating `auth.sessions`/`auth.refresh_tokens` — unchanged from Phase 5's own non-goal; still no silent-refresh continuity across cutover, only access-token verification continuity for whatever's still unexpired.
- Any change to how production issues or rotates its own keys.
- **`storage` and `realtime`'s own independent JWT verification** (`AUTH_JWT_SECRET`/`API_JWT_SECRET`, both currently the legacy HS256 secret, per `docker-compose.yml`) are **not** covered by this design — research for this phase focused on `auth`/`rest` specifically, and whether `storage-api`/`realtime` support an equivalent JWKS-shaped secret was not checked. This is a real, acknowledged scope gap, not an oversight glossed over: a production-issued token presented directly to self-hosted's `storage` or `realtime` endpoints will very likely still fail the same way `rest` did before this phase, unless a follow-up confirms and applies the same treatment there. Flagged explicitly rather than silently implied as covered — if file access or realtime subscriptions need to keep working with production tokens too, that's this phase's most likely next follow-up, not something to assume is already handled.

## 3. Approach

1. **Generate a new ES256 keypair for self-hosted's own future token issuance.** Chosen to match production's own algorithm (simpler mental model, and avoids any question of whether GoTrue's mixed-algorithm key list has edge cases the researched sources didn't surface) rather than keeping HS256 for self-issuance alongside ES256 for verification. Format as a JWK with a fresh, self-hosted-specific `kid` (not reusing any production `kid`), `key_ops: ["sign"]`, including the private component.
2. **Re-fetch production's JWKS immediately before assembling config** (not reuse the copy taken during design) — `GET https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json`, re-confirming the same 2 keys or capturing any that have changed since this design was written.
3. **Configure `GOTRUE_JWT_KEYS`** as a JSON array: the one new self-hosted signing key (from step 1) + production's public keys as-is (verify-only, no modification needed since they're already public-only). Leave `GOTRUE_JWT_SECRET` in place (harmless once `GOTRUE_JWT_KEYS` is set, since GoTrue's own issuance no longer reads it) rather than removing it, to avoid an unnecessary second change.
4. **Configure `PGRST_JWT_SECRET`** as the equivalent JWKS JSON: the new self-hosted key's **public** component (PostgREST never signs, so no private material needed here) + the same production public keys.
5. **Regenerate `ANON_KEY`/`SERVICE_ROLE_KEY`** signed with the new self-hosted key (matching claims to what Phase 5 already established — `role`/`iss`/`iat`/`exp` — plus a `kid` header matching the new key this time, unlike Phase 5's bare-HS256 regeneration), and roll out to Coolify's env store + the on-disk `.env` + every consuming container, the same surgical, blast-radius-scoped pattern established across Phase 5a and Phase 5.
6. **Recreate the affected containers** (`auth`, `rest`, and any others referencing the changed vars — determine the exact list from `docker-compose.yml` at implementation time, the same way Phase 5 did) — never `db` for this (same reasoning as Phase 5: nothing here is consumed by a one-time init script, but confirm this holds for these specific new vars before assuming it).
7. Verify (see §4).

## 4. Verification Plan

1. **The real, already-sampled production token** (the one that returned `403` before this phase) — re-test it against self-hosted's `/auth/v1/user` after this phase's changes. Expected: `200`, correct user data. This is the actual goal, proven against real evidence, not a fresh synthetic token.
2. Confirm self-hosted's own token issuance still works: create a test signup via GoTrue's Admin API (same substitute Phase 5 established, given the still-open SMTP gap), obtain a password-grant token, confirm it's signed with the new self-hosted `kid` (decode its header), and confirm it validates (`/auth/v1/user` → `200`).
3. Confirm the regenerated `ANON_KEY`/`SERVICE_ROLE_KEY` work: a `GET /rest/v1/...` call using the new `ANON_KEY` → `200`, not the `PGRST301` failure Phase 5 hit with its first regeneration attempt.
4. Confirm the 4 standard production health-check curls stay `200` throughout.
5. Confirm none of the 103 real migrated users' own data was touched (row counts unchanged) — this phase only changes verification/signing configuration, never touches `auth.users`/`auth.identities` data.
6. Re-verify production's JWKS one more time at the end of implementation (not just at the start) — if it changed mid-implementation, the config assembled in step 3-4 above would already be stale; catch this before declaring the phase done, don't assume the snapshot from step 2 held for the whole implementation window.

## 5. Rollback

Revert `GOTRUE_JWT_KEYS`/`PGRST_JWT_SECRET` to unset (falling back to `GOTRUE_JWT_SECRET`/legacy `PGRST_JWT_SECRET` as Phase 5 left them), and revert `ANON_KEY`/`SERVICE_ROLE_KEY` to Phase 5's own regenerated (bare-HS256) values. This returns the stack to exactly Phase 5's end state — self-hosted's own operation keeps working, at the cost of once again being unable to verify production's real current tokens (the same gap this phase exists to close). No production-side rollback is needed or possible from this phase's side — nothing here writes to production.

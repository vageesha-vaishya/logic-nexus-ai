# Feature Flags Read Path Fix — Design

## Background

Investigated and written up in `docs/investigation/FEATURE_FLAGS_READ_PATH_BROKEN.md`
(2026-09-15, no code changed there). Summary: `useAppFeatureFlag` (the
`FEATURE_FLAGS`-based wrapper used by app code, `src/lib/feature-flags.ts`)
calls `useFeatureFlags()` with no keys, so the underlying React Query never
fires and every flag silently resolves to its local hardcoded default.
Separately, the `feature-flags` edge function that both `useFeatureFlags.ts`
and the admin page (`FeatureFlagsPage.tsx`) call doesn't exist anywhere in
the repo — confirmed via a live 404 against the production self-hosted
instance. This spec fixes both, plus two independently-discovered real bugs
this investigation surfaced along the way.

This design was audited by an independent review pass against the live
codebase before being written up here; findings from that audit are folded
into the design below rather than listed separately.

## Goal

`/dashboard/settings/feature-flags` actually works end to end: toggling a
flag there changes real app behavior. Every existing `useAppFeatureFlag`
call site keeps its exact current production behavior the moment this
ships — no flag silently flips value as a side effect of fixing the
infrastructure around it, except the two call sites in Non-Goals below
whose current behavior is itself a bug being fixed deliberately.

## Non-Goals

- No override CRUD (`platform.feature_flag_overrides` create/list/delete)
  — the current admin UI has no controls for it; adding endpoints with no
  consumer is speculative work. `resolve_flags` already honors any
  override row that exists; this spec just doesn't add a way to manage
  them yet.
- No deploy. This spec produces reviewed, tested artifacts only — no task
  applies the seed migration or deploys the edge function to any live
  instance, self-hosted or otherwise. That is a deliberate, separate,
  explicitly-confirmed human action, matching how the `ux_feedback`
  migration was handled in the prior plan on this branch.
- `header_debug_button` is explicitly excluded from the seed and left
  entirely alone — it already has a working, unrelated source of truth
  (`public.system_settings` + `public.get_platform_debug_button_enabled()`,
  consumed by `DebugSettingsCard.tsx`). Seeding it into
  `platform.feature_flags` would create two stores that can silently
  diverge. `DashboardLayout.tsx:202`'s `useAppFeatureFlag` call for it is
  untouched and keeps its current `false` default (harmless — no DB row
  will ever exist for this key, so it can never resolve to anything else).

## Architecture

One new edge function, `supabase/functions/feature-flags/index.ts`,
following this repo's established pattern (`supabase/functions/
admin-reset-password/index.ts` as precedent): `serveWithLogger` (injects a
service-role Supabase client) + `getCorsHeaders` + `requireAuth` from
`supabase/functions/_shared/`.

It serves both of the two callers that already exist and are unchanged by
this spec's frontend edits:

**GET** `?keys=a,b,c&tenant_id=..&user_id=..`
(`src/hooks/useFeatureFlags.ts`'s `fetchFlagsFromEdge` — sends only an
`apikey` header, no `Authorization`)
- No auth check — public resolve. `verify_jwt = false` must be set for
  this function in `supabase/config.toml` (every one of the ~85 existing
  function blocks sets this; the edge runtime otherwise rejects any
  request with no `Authorization` header before the handler runs, which
  would make this endpoint fail exactly like the missing function does
  today).
- Reject with 400 if `keys` is missing or its parsed array exceeds 50
  entries (defends against an unbounded loop inside `resolve_flags`; no
  real caller sends anywhere near this many).
- Calls `supabase.schema('platform').rpc('resolve_flags', { p_keys, p_tenant_id, p_user_id, p_franchise_id: null })`
  — the explicit `.schema('platform')` matters: a bare `.rpc()` targets
  `public` and 404s.
- `serveWithLogger`'s wrapper unconditionally writes one `platform.access_log`
  row per non-OPTIONS request, regardless of what the handler does — this
  is baked into the shared wrapper every edge function in this repo uses,
  not something a single function can opt out of without abandoning the
  wrapper (and its centralized error handling/correlation IDs) entirely.
  This function follows the same convention as all ~85 existing functions
  rather than deviating; `platform.access_log` retention is an
  already-existing, platform-wide operational concern (see
  `supabase/functions/cleanup-logs`), not something this one function
  needs to solve.
- Returns `{ data: { flags: Record<string, boolean> } }` — exactly what
  `fetchFlagsFromEdge` already parses (`body?.data?.flags`).

**POST** `{action: "list"}` / `{action: "upsert", key, name, enabled}`
(`FeatureFlagsPage.tsx`'s `callFlags` — sends `Authorization: Bearer <user JWT>` + `apikey`)
- `requireAuth(req)` first; 401 if missing/invalid.
- Then a `platform_admin` check via the same pattern as
  `admin-reset-password`: `serviceClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle()`;
  403 if absent.
- `list`: `SELECT id, key, name, description, enabled, rollout_pct, tags, updated_at FROM platform.feature_flags ORDER BY key` via the injected service-role client (table has no `SELECT` grant for `authenticated`/`anon` — see Seed Migration — so this must run as service role). Returns `{ ok: true, data: { flags: FlagRow[] } }` with **all eight** fields the frontend's `FlagRow` interface declares — the page reads `flag.rollout_pct < 100` and `flag.tags[0]` unguarded and will throw on a shape that's missing either.
- `upsert`: **UPDATE only**, not a true upsert — `UPDATE platform.feature_flags SET name = $1, enabled = $2 WHERE key = $3 RETURNING *`. If no row matched, return 404. The admin UI only ever calls this against a `key` it just received from `list`; there is no "create a new flag" UI, so treating an unknown key as an error (rather than silently minting a permanent orphan row from an admin typo) is the safer, least-surprise behavior. Returns `{ ok: true, data: { flag: FlagRow } }`.
- Unknown `action` → 400. `OPTIONS` → CORS headers, no body, no auth.
- Any error path (auth failure, DB error) returns `{ ok: false, error: string }`, matching what `callFlags` already expects (`if (!json.ok) throw new Error(json.error ?? ...)`).

## Seed Migration

New migration file (name: `supabase/migrations/<timestamp>_seed_app_feature_flags.sql`)
does three things:

**1. Grants.** `platform.feature_flags`/`platform.feature_flag_overrides`
currently have RLS policies but *zero* `GRANT` statements anywhere in
their migration history — table privileges are checked before RLS, so the
existing `anyone_read_flags USING (true)` policy is presently decorative,
and the admin POST path above would hit `permission denied for table
feature_flags` without this:
```sql
GRANT SELECT ON platform.feature_flags TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON platform.feature_flags TO service_role;
GRANT SELECT ON platform.feature_flag_overrides TO anon, authenticated, service_role;
```
(The GET path's RPC runs `SECURITY DEFINER` so it doesn't strictly need
the `anon`/`authenticated` grants to function — but granting `SELECT`
keeps the RLS policy's stated intent actually true, matches how
`platform.llm_provider_configs` was granted, and costs nothing.)

**2. Harden `resolve_flags`.** Add `SET search_path = platform, public` to
the function definition (`CREATE OR REPLACE FUNCTION platform.resolve_flags
(...) ... SECURITY DEFINER SET search_path = platform, public AS $$ ... $$`)
— it's `SECURITY DEFINER` with a mutable search path today, which Supabase's
own advisor already flags; promoting this function to back a public,
unauthenticated endpoint is the point at which that gap should close.

**3. Seed rows.** `INSERT ... ON CONFLICT (key) DO NOTHING` for exactly
these 11 keys — every `FEATURE_FLAGS.*` key actually consumed via
`useAppFeatureFlag` that doesn't already have a row (`ux_feedback_widget`
was seeded by an earlier migration; `header_debug_button` is deliberately
excluded, see Non-Goals):

| Key | `enabled` | Verified call site |
|---|---|---|
| `amro_rbac_fix_enabled` | `true` | `src/components/navigation/CommandCenterNav.tsx:142` |
| `hybrid_route_configuration_v1` | `true` | `src/hooks/useRateFetching.ts:486` |
| `quotation_import_export_v2` | `true` | `src/pages/dashboard/QuoteDetail.tsx:150`, `src/pages/dashboard/Quotes.tsx:85` |
| `hybrid_route_metrics_dashboard_v1` | `false` | `src/hooks/useRateFetching.ts:487` |
| `domain_grouped_nav` | `false` | `src/components/layout/AppSidebar.tsx:146` |
| `user_info_header_module` | `false` | `src/components/layout/DashboardLayout.tsx:200` |
| `user_info_header_dual_mode` | `false` | `src/components/layout/DashboardLayout.tsx:201` |
| `composer_multi_leg_autofill` | `false` | `src/components/quotation/composer/LegsConfigurationStep.tsx:24` |
| `quotation_phase2_guards` | `false` | `src/components/quotation/quote-form/useQuoteRepository.ts:610` |
| `lead_three_section_layout` | **`true`** | see "Two independently-discovered bugs" below — this is the *actual* current production behavior, not the call sites' nominal default |

Every row: `rollout_pct = 100` (no partial rollout at seed time — at 100
the rollout branch in `resolve_flags` never evaluates, so this is a hard
guarantee, not a probabilistic one).

Other `FEATURE_FLAGS.*` keys not in this table (`QUICK_QUOTE_V2`,
`GATEWAY_COMPAT_FACADE_V1`, `GATEWAY_V2_SHADOW_READ`,
`ROUTE_INVENTORY_DASHBOARD_V1`, `MIGRATION_BASELINE_SLO_V1`,
`LEAD_WORKSPACE_ENHANCEMENTS_V1`, `LEAD_WORKSPACE_SCROLLING_V1`) are dead
constants with zero real consumers (grepped repo-wide; the only hits are
the constant definitions themselves, one docs file, and a stale test mock
in `LeadWorkspaceSections.test.tsx` for a component that doesn't import
`@/lib/feature-flags` at all) — out of scope, not seeded.

## Two independently-discovered bugs, fixed as part of this spec

**Bug A — `LEAD_THREE_SECTION_LAYOUT` is read wrong, not gated at all.**
`src/pages/dashboard/LeadDetail.tsx:52` and `LeadNew.tsx:25` do:
```ts
const threeSectionLeadWorkspace = useAppFeatureFlag(FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT);
```
then branch on the whole returned object (`threeSectionLeadWorkspace ? ... : ...`
at `LeadDetail.tsx:919`, `LeadNew.tsx:183`) instead of `.enabled`.
`useAppFeatureFlag` always returns a truthy object, so this layout has been
rendering unconditionally in production regardless of the flag's value the
entire time. Fixed in this spec (both call sites read `.enabled`); the seed
value above (`true`) is chosen to match this actual current behavior, so
fixing the read bug and seeding the flag land together with zero visible
change on day one — the flag becomes real, toggleable machinery instead of
dead code, without silently turning the layout off for anyone.

**Bug B — the fetch failure path defaults every flag to `false`, not to
each caller's own default.** `src/hooks/useFeatureFlags.ts`'s
`fetchFlagsFromEdge`:
```ts
} catch {
  // Graceful degradation: default all to false
  return Object.fromEntries(keys.map(k => [k, false]));
}
```
`isEnabled(key, defaultValue)` only falls back to `defaultValue` when the
key is **absent** from the result — the catch block puts every key in the
result, set to `false`. So any transient failure (cold start timeout, a
502, a CORS hiccup) — not just "the function doesn't exist" — flips every
`true`-default flag off. Fixed: the catch returns `{}` instead, so
`isEnabled` correctly falls back to each call site's own `defaultValue` on
any failure. This is what makes the whole system fail-*safe* rather than
fail-*wrong*, and is unrelated to whether the edge function itself is
deployed correctly — it's a permanent safety property.

## Frontend Changes

1. `src/lib/feature-flags.ts:40` — `useFeatureFlags()` → `useFeatureFlags([key])`.
2. `src/hooks/useFeatureFlags.ts` — catch block returns `{}` instead of
   `Object.fromEntries(keys.map(k => [k, false]))` (Bug B above).
3. `src/pages/dashboard/LeadDetail.tsx:52` and `LeadNew.tsx:25` — read
   `.enabled` off the hook's return value (Bug A above).

No other frontend file changes. `FeatureFlagsPage.tsx` and every other
`useAppFeatureFlag` call site are already correct against this fixed
backend and need no edits.

## Testing

This repo's edge functions are tested with **vitest**, not Deno — follow
`supabase/functions/generate-aircraft-tasks/index.test.ts`'s convention:
`vi.mock` `_shared/logger.ts`, `_shared/cors.ts`, `_shared/auth.ts` to
capture the handler `serveWithLogger` was called with, then invoke that
handler directly against a synthetic `Request` and a stub `supabase`
client (`_shared/logger.ts`'s `serveWithLogger` injects a service-role
client as the third handler argument — the stub takes its place).

**`supabase/functions/feature-flags/index.test.ts`:**
- GET with `?keys=a,b` → 200, `{data:{flags:{...}}}`; assert the stub's
  `.schema('platform').rpc('resolve_flags', ...)` was called (not a bare
  `.rpc(...)`, which would silently target `public`).
- GET with `keys` missing → 400. GET with 51+ keys → 400.
- POST `{action:"list"}` with no `Authorization` → 401.
- POST `{action:"list"}` with auth but no `platform_admin` row → 403.
- POST `{action:"list"}` with `platform_admin` → 200, each returned flag
  object has all 8 `FlagRow` fields.
- POST `{action:"upsert", key, name, enabled}` against an existing key →
  200, updated row returned. Against an unknown key → 404.
- POST with an unrecognized `action` → 400.
- `OPTIONS` → CORS headers, empty body, no auth check performed.

**`supabase/tests/feature_flags_seed.sql`** (same convention as
`ux_feedback_rls.sql` — self-contained `DO $$ ... $$`, `RAISE EXCEPTION`
assertions, read-only except for its own setup/cleanup, run via
`scripts/run-supabase-smokes.sh`, never invoked automatically by any task
in this plan):
- `platform.resolve_flags` on each of the 11 seeded keys returns the value
  in the table above.
- `platform.resolve_flags` on an unknown key returns `false`.
- All 11 seeded rows have `rollout_pct = 100`.
- **No row in `platform.feature_flag_overrides` references any of these 11
  keys.** This is the assertion that actually backs the "byte-for-byte
  identical behavior" claim — everything else in this spec assumes it, and
  nothing else checks it.

**Frontend unit tests:**
- `src/lib/feature-flags.test.ts` (new): `useAppFeatureFlag` calls the
  mocked `useFeatureFlags` with `[key]`, not `[]`. Every existing suite
  that touches this code mocks `useAppFeatureFlag` away entirely
  (`CommandCenterNav.test.tsx`, `LegsConfigurationStep.test.tsx`,
  `QuoteRepository.test.tsx`), so nothing today would catch this exact bug
  recurring — this test is the regression guard.
- `src/hooks/useFeatureFlags.test.ts` (new or extend existing, if one
  exists — check first): a failed fetch resolves to `{}`, not
  `{key: false}`.
- `LeadDetail.test.tsx` / `LeadNew.test.tsx`: flag-off renders the
  original (non-three-section) layout; flag-on renders the three-section
  one — the first real test coverage this branch ever had, since the bug
  meant it was always the same regardless of the flag.

## Pre-Deploy Step (explicit, separate, human-confirmed — not part of this plan's tasks)

Before applying the seed migration to the self-hosted instance, confirm via
a read-only query that none of the 11 keys above already exist in
`platform.feature_flags` with a different `enabled` value, and that no row
in `platform.feature_flag_overrides` references any of them — the same
check the smoke test above encodes, run for real against production data
before the migration is applied. If any of the 11 keys already has a row,
the seed's `ON CONFLICT (key) DO NOTHING` is a silent no-op and the
existing row's value wins; that must be reconciled by hand, not assumed
away.

## Known Limitations (acknowledged, not fixed by this spec)

- **Per-key request amplification.** `useFeatureFlags`'s cache key is
  `keys.sorted().join(",")`, so two components each calling
  `useAppFeatureFlag` with a different single key never share a cache
  entry — `DashboardLayout.tsx` alone fires 3 separate round-trips for its
  3 flags. Real, but pre-existing in `useFeatureFlags`'s design (not
  introduced by this fix) and out of scope; batching call sites into a
  single `useFeatureFlags([...])` call is a separate, larger refactor.
- **Override priority ordering bug.** `resolve_flags`'s comment states
  "user > tenant > franchise" but its `ORDER BY CASE ... WHEN 'franchise'
  THEN 2 ELSE 3` actually ranks franchise above tenant. Currently moot —
  no frontend caller ever passes `p_franchise_id` — but noted here so
  nobody relies on the comment later. Not fixed in this spec since fixing
  it has zero observable effect today and isn't worth the migration churn
  on its own; revisit if/when franchise-scoped overrides are ever used.
- **`platform.access_log` write amplification on deploy.** Each
  `useAppFeatureFlag([key])` call now fires its own HTTP GET (see the
  "Per-key request amplification" limitation above), and `serveWithLogger`
  writes one `platform.access_log` row per non-OPTIONS request
  unconditionally. A single dashboard page load will produce roughly 5-6
  new access_log rows once this is deployed — check this against
  `platform.access_log`'s retention/cleanup behavior (see
  `supabase/functions/cleanup-logs`) before deploying, given this
  instance's documented WAL-retention sensitivity.

## Global Constraints

- No task in the implementation plan applies this migration or deploys the
  edge function to any live database or instance — local or self-hosted.
  Both are written, tested, reviewed artifacts only.
- No task runs `npm run supabase:db:push`, `scripts/supabase-exec.sh`, a
  Supabase CLI deploy command, or any other command that writes schema or
  function code to a live instance.
- Secrets convention: no new secrets are needed by this work; if any
  environment value is required during implementation, it goes in the
  gitignored repo-root `env` file, never in a report or doc file.

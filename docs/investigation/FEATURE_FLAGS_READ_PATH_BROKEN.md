# Feature Flags Read Path Is Broken (Tracked, Fixed and Deployed)

**Status:** Fixed and deployed live 2026-09-15 — merged to `main`
(`docs/superpowers/plans/2026-09-15-feature-flags-read-path-fix.md`,
`docs/superpowers/specs/2026-09-15-feature-flags-read-path-fix-design.md`),
the seed migration applied to the self-hosted instance, and the
`feature-flags` edge function deployed (see
`deploy/selfhosted-supabase/README.md`'s Phase 4 section for the
deployment record). Confirmed live: `GET .../functions/v1/feature-flags`
resolves real seeded values.
The rest of this document is kept as the original investigation record.

## Executive Summary

The app-level feature-flag system (`FEATURE_FLAGS` + `useAppFeatureFlag` in
`src/lib/feature-flags.ts`, backing the `/dashboard/settings/feature-flags`
admin page) does not actually work end to end. Two independent, stacked
defects mean every flag consumed through `useAppFeatureFlag` silently uses
its hardcoded local default today, regardless of what's configured in
`platform.feature_flags`:

1. A one-line caller bug in `useAppFeatureFlag` means the underlying React
   Query that would fetch flag state never runs.
2. Even if that bug is fixed, the edge function it depends on
   (`feature-flags`) **does not exist** — not undeployed, not misnamed,
   simply never written. Both the read path (`useFeatureFlags.ts`) and the
   admin UI's CRUD path (`FeatureFlagsPage.tsx`) call the same nonexistent
   function.

**Do not fix defect 1 in isolation** — see "Why the obvious fix is
currently harmful" below.

## 1. Problem Description

- **Symptom:** Toggling a flag at `/dashboard/settings/feature-flags` has
  no effect on the running app for any of the 13 real call sites checked
  (see table below). Every one of them behaves exactly as its hardcoded
  `defaultValue` argument says, always, for every tenant.
- **Impact:** The admin UI presents itself as a working per-tenant rollout
  control and isn't one. Anyone who has used it to try to roll out or roll
  back a feature has seen no actual effect.

## 2. Root Cause Analysis

### Defect 1 — `useAppFeatureFlag` never triggers the flags query

`src/lib/feature-flags.ts:39-43`:
```ts
export function useAppFeatureFlag(key: FeatureFlagKey, defaultValue: boolean = false) {
  const { isEnabled, isLoading, error } = useFeatureFlags();   // ← no keys passed
  const envOverride = resolveFeatureFlagEnvOverride(key);
  const enabled = envOverride ?? isEnabled(key, defaultValue);
  return { enabled, isLoading, error };
}
```

`src/hooks/useFeatureFlags.ts:35,55,67`:
```ts
export function useFeatureFlags(keys: string[] = []) {
  ...
  const query = useQuery({
    ...
    enabled: keys.length > 0,   // ← false when called with no args
    queryFn: () => fetchFlagsFromEdge(keys, tenantId, userId),
  });
```

`useFeatureFlags()` called with no keys never enables its query, so
`resolvedFlags` stays `{}` forever, and `isEnabled(key, defaultValue)`
falls straight through to `defaultValue`. `useFeatureFlags` itself is
correctly designed for callers that *do* pass keys (its own JSDoc example
does), and other direct callers in the codebase use it correctly — the bug
is isolated to this one caller.

**Fix in isolation:** `useFeatureFlags([key])` instead of `useFeatureFlags()`.

### Defect 2 — the `feature-flags` edge function doesn't exist

Verified two ways:

- `find supabase/functions -maxdepth 1 -type d` / `ls supabase/functions |
  grep -i flag` — no `feature-flags` folder anywhere in the repo.
- Live check against the production self-hosted instance (read-only HTTP
  request to the same public path the app's own browser code calls — no
  database or SSH access used):
  ```
  curl "$VITE_SUPABASE_URL/functions/v1/feature-flags?keys=..." \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"

  → HTTP 404
  → {"error":"Function 'feature-flags' not found"}
  ```

Both the read hook (`src/hooks/useFeatureFlags.ts:27`,
`FLAGS_EDGE = .../functions/v1/feature-flags`) and the admin page's CRUD
(`src/pages/dashboard/settings/FeatureFlagsPage.tsx:38`, same URL) target
this same nonexistent function. The admin page is not just cosmetically
disconnected from the read path — its own writes almost certainly 404 too.

## 3. Why the obvious fix is currently harmful

`fetchFlagsFromEdge` (`src/hooks/useFeatureFlags.ts:30-50`) treats any
fetch failure — including a 404 — as "all requested keys are `false`", not
as "unknown, fall back to caller default":
```ts
} catch {
  // Graceful degradation: default all to false
  return Object.fromEntries(keys.map(k => [k, false]));
}
```

`isEnabled` only falls back to `defaultValue` when the key is *absent* from
the result (`if (!(key in resolvedFlags)) return defaultValue`) — but the
catch block puts every requested key in the result, set to `false`. So:

- Today (defect 1 present): the query never runs, `resolvedFlags` is `{}`,
  every key is absent, `isEnabled` returns each caller's own
  `defaultValue`. This is accidentally safe.
- If defect 1 alone is fixed, with defect 2 still present: the query runs,
  hits a real endpoint, gets a 404, the catch fires, and **every flag
  resolves to `false`** — overriding any call site whose `defaultValue` is
  `true`.

## 4. Affected call sites (13, across 10 files)

| Flag | Default | File |
|---|---|---|
| `AMRO_RBAC_FIX_ENABLED` | `true` | `src/components/navigation/CommandCenterNav.tsx:142` |
| `HYBRID_ROUTE_CONFIGURATION_V1` | `true` | `src/hooks/useRateFetching.ts:486` |
| `QUOTATION_IMPORT_EXPORT_V2` | `true` | `src/pages/dashboard/QuoteDetail.tsx:150`, `src/pages/dashboard/Quotes.tsx:85` |
| `DOMAIN_GROUPED_NAV` | `false` | `src/components/layout/AppSidebar.tsx:146` |
| `USER_INFO_HEADER_MODULE` | `false` | `src/components/layout/DashboardLayout.tsx:200` |
| `USER_INFO_HEADER_DUAL_MODE` | `false` | `src/components/layout/DashboardLayout.tsx:201` |
| `HEADER_DEBUG_BUTTON` | `false` | `src/components/layout/DashboardLayout.tsx:202` |
| `COMPOSER_MULTI_LEG_AUTOFILL` | `false` | `src/components/quotation/composer/LegsConfigurationStep.tsx:24` |
| `QUOTATION_PHASE2_GUARDS` | (see call site) | `src/components/quotation/quote-form/useQuoteRepository.ts:608` |
| `HYBRID_ROUTE_METRICS_DASHBOARD_V1` | `false` | `src/hooks/useRateFetching.ts:487` |
| `LEAD_THREE_SECTION_LAYOUT` | (unspecified → `false`) | `src/pages/dashboard/LeadDetail.tsx:52`, `LeadNew.tsx:25` |
| `UX_FEEDBACK_WIDGET` | `false` | `src/components/feedback/UxFeedbackWidget.tsx:39` (2026-09-15 plan; works today only via `VITE_FEATURE_FLAG_OVERRIDES`) |

If defect 2 is ever fixed alone (edge function deployed) without also
fixing defect 1, nothing changes — the query still never fires.

## 5. Path forward (now implemented — see the plan above)

1. Design and implement the `feature-flags` edge function: read from
   `platform.feature_flags` (+ whatever per-tenant/user override table the
   admin UI expects — check `FeatureFlagsPage.tsx` and the
   `20260516080945_platform_feature_flags.sql` migration for the full
   schema, including `feature_flag_overrides`), matching the response
   shape `fetchFlagsFromEdge` already expects: `{ data: { flags: Record<string, boolean> } }`.
2. Before deploying, inventory the actual current rows in
   `platform.feature_flags` on the self-hosted instance for all 10 keys in
   the table above, so it's known in advance which call sites will change
   behavior the moment the read path starts working.
3. Only then apply the one-line `useAppFeatureFlag` fix
   (`useFeatureFlags([key])`).
4. Treat this as its own scoped plan (brainstorm → spec → plan →
   subagent-driven implementation → review), given it touches shared
   platform code with a 10-flag, 13-call-site blast radius on
   production-adjacent infrastructure — not a same-session drive-by fix.

## 6. Constraints for whoever picks this up

- The self-hosted Supabase instance (`supabase.sosservices.online` via SSH
  `hostinger-vps`) is shared, production-adjacent infrastructure — 24
  unrelated apps share the same Coolify VPS. No schema change, edge
  function deploy, or flag-value write should happen without explicit,
  deliberate confirmation, the same way Plan 3's migration was deliberately
  left unapplied.
- Read-only checks (like the `curl` above, or a `SELECT` against
  `platform.feature_flags`) are low-risk and fine to do freely during
  investigation; deploys and writes are not.

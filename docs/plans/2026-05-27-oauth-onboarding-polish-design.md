# OAuth onboarding polish — design

**Date:** 2026-05-27
**Status:** Validated (brainstorm complete), pre-implementation
**Builds on:** [2026-05-27-google-microsoft-auth-design.md](2026-05-27-google-microsoft-auth-design.md)
**Commits this builds on:** `61ee5525` (domain-aware OAuth provisioner)

## Problem

The domain-aware OAuth provisioner shipped today (commit `61ee5525`)
leaves three UX rough edges:

1. **User lands on the multi-membership chooser** at `/auth/choose-account`
   even though they just signed up for a specific domain. Confusing:
   "I clicked Logistics, why am I picking between Logistics and a Sthira
   account I never asked for?"
2. **Auto-guessed org name is ugly** — `it@miamigloballines.com` →
   "Miamigloballines" (one word, no spaces). User has no path to rename
   it without hunting through Settings.
3. **No first-landing communication** — the org was created silently;
   user discovers it only by chance. No moment of "your org 'X' is
   ready, here's how to customize it."

The retail tag-along membership (Auth hook always runs retail
provisioning) is left alone — fighting the Auth-hook timing isn't worth
the engineering cost, and a quietly-discoverable retail account is
acceptable.

## Section 1 — Architecture & flow

The polished OAuth signup flow:

```
1. User clicks "Continue with Google" on /signup/logistics
2. signInWithProviderOAuth writes signupContext to sessionStorage    (existing)
3. Provider roundtrip → /auth/callback (or native deep-link)
4. Session established                                                (existing)
5. NEW: dispatch provision-retail-user with domain meta
   ─ Edge fn returns { membership_id, was_new_user } of the new row
6. NEW: write user_active_membership = membership_id
   ─ Skips /auth/choose-account; user lands directly in Logistics
7. NEW: if was_new_user: write
     raw_user_meta_data.oauth_welcome_pending = {
       domain_code, org_name, created_at
     }
8. RootRedirect → /dashboard
9. NEW: Dashboard layout mounts <OAuthWelcomeBanner /> which reads
   the flag. Renders:
     "Welcome to Logistics CRM. Your organization
      'Miamigloballines' is ready. [Rename] [Looks good]"
   ─ Rename     → Settings → Organization (with name field focused)
   ─ Looks good → updateUser({ data: { oauth_welcome_pending: null } })
```

The retail membership from the Auth hook still exists but is hidden by
the explicit `user_active_membership` write. The user only discovers it
if they open the membership switcher in Settings, where it's labeled
"(auto-created on signup)".

## Section 2 — Storage & contract changes

### a) Welcome banner flag — `auth.users.raw_user_meta_data.oauth_welcome_pending`

Lives in user metadata, not in a separate table or localStorage:

- Survives device/browser changes (vs localStorage).
- No schema migration (vs new table).
- Per-user, server-authoritative.
- Edge function writes once (service role); client reads via
  `supabase.auth.getUser()`; client clears via `updateUser` (users
  own their own metadata, no RLS needed).

Shape:

```json
{
  "domain_code": "logistics",
  "org_name":    "Miamigloballines",
  "created_at":  "2026-05-27T16:42:00Z"
}
```

`created_at` lets the banner component auto-hide stale flags (> 30
days) without explicit dismissal — avoids polluted metadata for users
who never click either button.

### b) `provision-retail-user` returns `membership_id` + `was_new_user`

The edge function today spreads whatever `provision_org_tenant` returns
into its response. Need to:

- Verify the SQL function returns the new `user_roles.id`. If not, a
  small SQL patch adds `RETURNS jsonb` shape `{ tenant_id, franchise_id,
  membership_id }`.
- Add `was_new_user` derived from `auth.users.created_at` within the
  last 60s. Existing-user OAuth (sign-in) returns `was_new_user: false`
  and the client skips both the active-membership write and the welcome
  flag write.

### c) Client writes `user_active_membership` post-dispatch

After the edge function returns successfully:

```ts
await supabase.from("user_active_membership").upsert(
  { user_id, membership_id, updated_at: now },
  { onConflict: "user_id" },
);
```

Reuses the exact upsert pattern from
`useMemberships.ts:switchMutation` so RLS rules and triggers behave
identically.

**Race with the Auth hook:** `provision_new_retail_user` (retail
provisioner the Auth hook runs) may or may not write
`user_active_membership`. Last-writer-wins on the unique `user_id` row,
and our write runs AFTER `await`-ing the edge function — but the edge
function we call doesn't directly chain to the Auth hook's retail call.
Need to grep the SQL to confirm; if there's a real race, a
`WHERE NOT EXISTS` guard in `provision_new_retail_user` is the fix.

## Section 3 — Edge cases & failure modes

| Scenario | Behaviour |
|---|---|
| Dispatch fails mid-flight (5xx) | Toast: "Couldn't set up your org — try again from Settings → Add organization." User lands on retail home (Auth hook ran fine). No `user_active_membership` or welcome flag written. Retry is idempotent. |
| Existing user via OAuth (sign-in, not signup) | Edge fn detects `created_at` > 60s ago, returns `was_new_user: false`. Client skips active-membership + welcome flag writes. Just signs them in. |
| Retail signup via OAuth from `/auth` | Banner still fires with retail-flavored copy: "Welcome to Sthira — your retail account is ready. [Get started]". Same component, different copy per `domain_code`. |
| Native (Sthira APK) | Suppress welcome banner write — Capacitor.isNativePlatform() check. The native shell's `/sthira/splash` has its own first-run UX (`useSthiraOnboardingProgress`); avoid duplicate onboarding. |
| Stale banner flag (>30 days) | Component auto-hides. No explicit cleanup; metadata stays but UI ignores it. |
| Dismissal race across tabs | Tab A clears flag → Tab B still has stale `getUser()` cache → banner shows again until next refresh. Acceptable. |

## Verification — done 2026-05-27

- [x] `provision_org_tenant` returns
      `{ tenant_id, franchise_id, role_id, assignment_id, created }`.
      `role_id` is the new `user_roles.id` (== our membership_id). No
      SQL migration needed; client just reads `result.role_id`.
- [x] **Surprise win:** `provision_org_tenant` already writes
      `user_active_membership` when `created=true`. And
      `provision_new_retail_user` (the Auth-hook retail call) does NOT
      write `user_active_membership`. So there is no race, and the
      planned client-side `user_active_membership.upsert` is
      **redundant** — drop it from the plan.
- [x] No `Settings → Organization` rename route exists. Existing
      `BrandingSettings`/`Tenants` pages are general or admin-only.
      Cleaner approach: **inline rename dialog** triggered directly
      from the banner. Skips a route, skips Settings refactor, keeps
      the rename inside the welcome moment.

## Plan changes from verification

1. **Drop client-side `user_active_membership.upsert`** — the SQL
   function already handles it. AuthOAuthCallback + useOAuthDeepLink
   only need to invoke the edge function and trust its work.
2. **Move welcome-flag write into the edge function** (service-role
   context). Detection logic:
   - If called by Auth hook (payload shape `{ record: { id } }`): new
     user by definition (Auth hook only fires on user creation).
     Always write the flag for retail flow.
   - If called by frontend (`{ user_id, meta }`): for B2B flow, the
     RPC's own `created` boolean tells us whether it was new. For
     retail flow via frontend (rare — /onboarding fallback only),
     skip the flag.
3. **Inline rename dialog** in the banner — direct
   `UPDATE tenants SET name WHERE id = …` via supabase-js. RLS already
   allows `tenant_admin` to update their own tenant (confirmed at code
   level by existing branding/settings flows).

## Out of scope

- Suppressing the retail tag-along membership entirely. Decided
  against: the Auth-hook timing makes it fragile, and a quietly-
  discoverable retail account is harmless. Membership switcher labels
  it "(auto-created on signup)" for clarity.
- Country detection from browser locale. SignupForm defaults to "IN";
  user can fix in Settings.
- Org-name smart-casing (`miamigloballines` → "Miami Global Lines").
  Hard to do well; the rename CTA on the banner is the correct path.
- Enterprise SSO domain pre-provisioning. Future, not relevant for
  consumer-style Google/Microsoft OAuth.

## Implementation order

1. SQL verification + any patches needed (Section "Verification").
2. Edge function: add `was_new_user` + ensure `membership_id` is
   returned. Add welcome-flag write.
3. Client dispatch (AuthOAuthCallback + useOAuthDeepLink): write
   `user_active_membership`, handle the new return shape.
4. `<OAuthWelcomeBanner />` component + mount in DashboardLayout.
5. Settings → Organization name-field focus URL param (if needed).
6. Native suppression check in `useOAuthDeepLink`.
7. Smoke test on `app.sosservices.online` once consoles are live.

Estimated effort: 2–3 hours.

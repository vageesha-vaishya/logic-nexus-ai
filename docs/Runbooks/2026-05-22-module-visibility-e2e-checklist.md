# Module visibility + domain login — manual E2E checklist

Audience: solo operator. Run before flipping the `DOMAIN_GROUPED_NAV`
feature flag on for any tenant or before migrating real routes to the
new `moduleCode` gate. Estimated time: ~30 min on desktop.

Companion docs:
- `docs/plans/2026-05-22-module-visibility-and-domain-login-design.md`
- `docs/Runbooks/2026-05-22-unified-onboarding-e2e-checklist.md` (the U0 chain — prerequisites)
- `docs/Runbooks/2026-05-22-self-onboarding-e2e-checklist.md` (Sthira retail)

## Prereqs

1. The U0 + BR0 epics are deployed (so `tenant_domain_assignments`,
   `subscription_plans.limits`, the membership context switcher, and the
   per-domain accent strip are all live).
2. At least one B2B tenant exists with **both** Logistics and Markets
   assignments active (so the multi-domain sidebar grouping is testable).
3. A second tenant exists with only Logistics (for the
   `wrong_tenant`-style fallback test).
4. You have a Sthira retail account on the same email as a B2B
   membership (for the multi-membership switcher tests).
5. A logistics route with `<ProtectedRoute moduleCode="...">` exists —
   if none yet, gate one of the existing routes (e.g. `/dashboard/leads`)
   temporarily so the remedy pages can be exercised.

## Track A — Domain-themed login chrome (MV-5)

### A1. SOS-neutral default (no hints)

- [ ] Sign out. Visit `/auth` directly. Card shows the SOS master logo
      + "SOS Services" headline. No 4px accent strip. No "Welcome back
      to SOS X" eyebrow.

### A2. Sthira variant via `?intent=retail`

- [ ] Visit `/auth?intent=retail`. Card switches to cream / copper /
      serif "Sthira" wordmark. No accent strip (Sthira chrome doesn't
      use the per-domain accent — its own visual system).

### A3. Logistics tint via `next` param

- [ ] Visit `/auth?next=%2Fdashboard%2Fleads`. SOS chrome stays neutral
      except: 4px blue (`#1D4ED8`) strip at the top of the card +
      "Welcome back to SOS Logistics" eyebrow (uppercase tracked).

### A4. AMRO tint via `next` param

- [ ] Visit `/auth?next=%2Fdashboard%2Famro%2Fwork-orders`. 4px orange
      strip + "Welcome back to SOS AMRO".

### A5. Referrer-derived tint

- [ ] From a signup form: at `/signup/logistics`, click "Sign in"
      (footer link). Land on `/auth` — `document.referrer` should
      carry `/signup/logistics`. Logistics tint applies.

### A6. Markets does NOT tint SOS chrome

- [ ] Visit `/auth?next=%2Fdashboard%2Fmarkets%2Fterminal`. SOS chrome
      stays fully neutral — no tint, no "Welcome back to SOS Markets"
      eyebrow. Markets is reserved for the retail-leaning Sthira variant.

### A7. Sthira variant + B2B tint shouldn't co-exist

- [ ] Visit `/auth?intent=retail&next=%2Fdashboard%2Famro%2Fwork-orders`.
      Sthira variant wins (priority 1). No orange strip.

## Track B — Sidebar grouping (MV-3)

Flip `FEATURE_FLAGS.DOMAIN_GROUPED_NAV` on (via the feature-flag service
or `VITE_FEATURE_FLAG_OVERRIDES={"domain_grouped_nav":true}`).

### B1. Single-domain tenant

- [ ] Sign in to a logistics-only tenant. Sidebar shows:
  - "Workspace" section at top (Home, Settings, etc.)
  - One collapsible "Logistics" group with all logistics items
  - "Add a product" footer link (tenant_admin only)

### B2. Multi-domain tenant

- [ ] Switch to the tenant with both Logistics + Markets. Sidebar shows
      both groups, each collapsible, each tagged with its accent-color
      dot beside the header.

### B3. Active-group auto-expand

- [ ] Navigate to `/dashboard/leads/pipeline`. Logistics group expanded.
- [ ] Collapse Logistics manually. Refresh — Logistics is *still*
      expanded because the URL is inside it (auto-expand wins).
- [ ] Navigate to `/dashboard/markets/terminal`. Logistics collapses,
      Markets auto-expands.

### B4. Active-item left border

- [ ] On a logistics page, the active sidebar item has a 3px blue left
      border (the `#1D4ED8` logistics accent).
- [ ] Switch to a markets page; the active item gets the emerald
      accent strip.

### B5. localStorage persistence

- [ ] Manually collapse the Markets group while on a logistics page.
      Refresh. Markets stays collapsed. Sign out + back in as the same
      user on the same tenant — collapse state preserved.

### B6. "Add a product" footer

- [ ] As a `tenant_admin` — link is visible at the bottom, routes to
      `/dashboard/settings/billing`.
- [ ] As a regular `user` — link is hidden.

## Track C — ProtectedRoute moduleCode gates + remedy pages (MV-4)

Pick a route to test against. For example, temporarily wrap one with
`<ProtectedRoute moduleCode="logistics.experimental" moduleLabel="Experimental Logistics">`.

### C1. Wrong tenant (signed-out)

- [ ] Sign out. Visit the gated route directly. `<SwitchTenantPrompt />`
      renders with "Sign in to continue" CTA.

### C2. Wrong tenant (signed-in, no matching membership)

- [ ] Sign in as a user whose memberships don't include any tenant that
      has this module. Visit the gated route.
- [ ] If single-membership: "Sign out and switch accounts" button +
      "Back to my dashboard".
- [ ] If multi-membership: list of pickable memberships with the active
      one highlighted.

### C3. Domain off (tenant doesn't have this domain assigned)

- [ ] Sign in to a tenant that DOES NOT have the module's domain
      enabled. Visit the gated route. `<AddDomainPrompt />` shows
      briefly, then auto-redirects (800ms delay) to
      `/dashboard/settings/billing?add={DOMAIN}`.

### C4. Role too low

- [ ] Set the module's manifest route's `requiredRole = ['tenant_admin']`.
- [ ] Sign in as a regular `user`. Visit the route.
      `<RequestAccessPrompt />` shows with the tenant_admin's email
      pre-filled in a mailto.
- [ ] Click "Email {admin}". Mailto opens with subject "Access request:
      ..." and a body pre-filled.

### C5. Plan tier too low

- [ ] Set `minPlanTier = 'professional'`. Make the active tenant's plan
      `starter`. Visit the route.
- [ ] `<UpgradePrompt />` shows, then auto-redirects to
      `/dashboard/settings/billing?promote={moduleCode}` (800ms delay).
- [ ] The Billing page's matching upgrade card is highlighted via the
      `promote` param.

### C6. Explicit per-module deny

- [ ] Set `subscription_plans.limits.modules['{moduleCode}'] = false`
      for the active plan. Visit the route. Same `<UpgradePrompt />`
      treatment as C5.

### C7. Legacy gates unaffected

- [ ] Visit `/dashboard/settings` (gated by `requiredRole={PLATFORM_ADMIN_ROLE}`)
      as a `tenant_admin`. Still redirects to `/unauthorized` — legacy
      path unchanged.

## Track D — URL → accent transitions

- [ ] On the multi-domain tenant, click the logistics group's first
      module. Top 4px strip and sidebar dot turn blue (#1D4ED8).
- [ ] Click a markets module. Strip + dot turn emerald (#059669) without
      a hard reload (the strip uses CSS custom-property, not query
      invalidation).
- [ ] Visit `/dashboard/settings/billing` (workspace, no domain).
      Strip falls back to `--sos-copper`.

## Track E — Deep-link recovery

- [ ] Bookmark `/dashboard/markets/portfolio` while in a Logistics
      tenant. Open the bookmark — the page redirects through the
      `domain_off` or `role` remedy depending on what the module
      requires.
- [ ] Copy a colleague's URL for a feature they can access but you
      can't. Paste into a new browser tab. Lands on the appropriate
      remedy page per `<ProtectedRoute moduleCode>`.

## Failure modes — symptom map

| Symptom | Likely cause | Fix |
|---|---|---|
| Login card stays neutral despite `?next=/dashboard/leads` | Manifest pathPrefixes missing or wrong | Re-verify `logisticsManifest.pathPrefixes` contains `/dashboard/leads` |
| Sidebar group never auto-expands | `resolveActiveDomain` returning null for the URL | Check the manifest's pathPrefixes; `pathname.startsWith(prefix + '/')` must succeed |
| All sidebar groups render even when empty | The empty-group filter isn't applied | DomainGroupedNav should skip domains with `(items.length === 0)` |
| `<UpgradePrompt>` auto-redirects to billing immediately | Working as designed (800ms delay). If too fast, increase in `AddDomainPrompt.tsx` / `UpgradePrompt.tsx` |
| Existing `/unauthorized` redirects break | A route added `moduleCode` and no longer hits the legacy path | Verify `moduleCode` was intentional; legacy + moduleCode can coexist on the same route |
| `<RequestAccessPrompt>` says "Couldn't find your workspace admin's email" | Tenant has no user with role `tenant_admin` (only `platform_admin`?) | Either promote one user to `tenant_admin`, or expand the query in `RequestAccessPrompt.tsx` to fall back to `platform_admin` |

## When this checklist is green

Flip `FEATURE_FLAGS.DOMAIN_GROUPED_NAV` to default-on, migrate routes
to the `moduleCode` gate one at a time (Logistics → Markets → AMRO),
and add the manifest-level `requiredRole` / `minPlanTier` annotations
as you go. The legacy `requiredRole` / `requiredPermissions` props
keep working until every route migrates — no rush.

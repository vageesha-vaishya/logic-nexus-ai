# Domain-specific login + module visibility for authorized users — design

Date: 2026-05-22 · Audience: solo operator + future contributors · Status:
locked, pending implementation.

## Why now

The U0 + BR0 epics shipped the multi-domain platform's foundation:
multi-membership identity, per-tenant domain assignments, tier-aware
billing, audience-aware login chrome. But the day-to-day experience
still treats modules uniformly — the sidebar renders every nav item
and lets `<ProtectedRoute>` block access at click time. A multi-domain
tenant on the freemium plan sees the same nav as an Enterprise tenant
with three domains active. This works for an internal alpha but doesn't
scale to the "B2B platform that sells multiple products" the brand
architecture promises.

This design closes the gap with a single coherent visibility +
discoverability model that uses the four signals already in the schema
— role × domain × plan × tenant — and adds a smart fallback for every
"you can't access that" case.

## Locked decisions

| # | Topic | Choice |
|---|---|---|
| 1 | Visibility philosophy | **Hybrid by tier.** Hide non-accessible modules in `/dashboard/*`; show the full catalog in `/dashboard/settings/billing` |
| 2 | Login adaptation | **Domain-themed when arriving from a domain-aware path** — extends BR-2 with a per-domain accent strip + headline; Sthira variant unchanged |
| 3 | Visibility inputs | **Role + active domain + plan tier** — the four signals already in the schema |
| 4 | Where rules live | **Code declares modules, DB declares plan-tier mapping** — TS manifests + `subscription_plans.limits` jsonb |
| 5 | Sidebar shape | **Tenant-wide, grouped by domain, collapsible per group** |
| 6 | Active-domain resolution | **URL-pattern matching via manifests** — each domain manifest declares its path prefixes; a resolver matches URL → domain |
| 7 | Unauthorized access | **Smart fallback per reason** — role / plan / domain / wrong-tenant each get a tailored remedy page |

## Mental model

```
Visitor → /auth (domain-themed if intent or referrer hints which domain)
         │
         ▼ signed in
   DashboardLayout
     ├── Topbar — membership switcher (tenant scope) + 4px accent strip (per-domain)
     ├── Sidebar (Section 4)
     │     ├── Tenant-wide section (Settings / Team / Billing)
     │     ├── Per-domain groups — only for tenant's enabled domains
     │     │     • Each group is collapsible; auto-expands on URL match
     │     │     • Inside: only modules the user passes (role + plan + permission)
     │     └── "Add a product" footer link → /dashboard/settings/billing
     └── Main panel
           • URL nav → useDomainAccent() resolves domain via manifests → strip updates
           • ProtectedRoute denies → useUnauthorizedReason() classifies →
             routes to the matching remedy page (Section 6)
```

**What stays the same:** the 4-signal access model
(`user_roles.role`, `tenant_domain_assignments.domain_id`,
`tenant_domain_assignments.plan_id` → `subscription_plans.limits`,
`user_active_membership`); the membership switcher; the
per-domain accent strip from BR-3; the existing `?intent=retail`
Sthira variant; `subscription_plans.limits` jsonb (we start using a
`modules` key in it).

**What's new:** extended manifest schema, two resolver functions, a
`useModuleAccess` hook, a `useUnauthorizedReason` classifier, a
refactored sidebar that consumes the manifests, a refactored
`<ProtectedRoute>` that hands denials to remedy pages.

## Extended manifest schema

```typescript
// src/platform/domains/types.ts
export interface DomainManifest {
  code:        string;             // "logistics", "markets", "amro", …
  name:        string;
  description: string;

  // NEW — path prefixes this domain owns. URL→domain resolver matches in order.
  pathPrefixes: readonly string[]; // e.g. ["/dashboard/markets", "/sthira"]

  // NEW — sidebar grouping
  sidebar?: {
    label:    string;
    icon:     LucideIcon;
    collapsedByDefault?: boolean;
  };

  routes: readonly DomainRoute[];
  // existing: brand, services, defaultAssignmentPolicy, seedMigration
}

export interface DomainRoute {
  path:        string;
  component:   () => Promise<{ default: ComponentType }>;
  mobile?:     boolean;
  children?:   readonly DomainRoute[];

  // NEW — visibility metadata
  moduleCode?:        string;     // "markets.signals", "crm.invoices"
  label?:             string;     // sidebar label (omit = hide from sidebar)
  icon?:              LucideIcon;
  requiredRole?:      AppRole | AppRole[];
  requiredPermissions?: Permission[];
  minPlanTier?:       "free" | "starter" | "professional" | "enterprise";
}
```

**`subscription_plans.limits.modules` map.** A Pro plan unlocks every
module its `minPlanTier` covers by default; explicit `false` entries
deny specific modules even when the tier matches. Example:

```jsonc
{
  "users": 25,
  "signals_per_month": -1,
  "modules": {
    "markets.signals":    true,
    "markets.live_money": false   // disabled even though tier qualifies
  }
}
```

One source of truth — manifests carry everything sidebar / resolver /
ProtectedRoute / unauthorized fallback need.

## Module access + active-domain resolution

```typescript
// src/platform/domains/resolver.ts

export type ModuleAccessReason =
  | "ok" | "wrong_tenant" | "domain_off" | "role" | "plan" | "unknown_module";

export interface ModuleAccess {
  allowed: boolean;
  reason:  ModuleAccessReason;
  remedy?: {
    kind:          "request_access" | "upgrade" | "add_product" | "switch_tenant";
    targetPath?:   string;
    targetTenant?: string;
  };
}

export function resolveModuleAccess(input: {
  moduleCode:    string;
  membership:    ActiveMembership;
  assignment:    DomainAssignment | null;
  planLimits:    PlanLimits | null;
  manifestRoute: DomainRoute;
}): ModuleAccess { /* … */ }

export function resolveActiveDomain(pathname: string): DomainManifest | null {
  for (const m of allManifests()) {
    for (const prefix of m.pathPrefixes) {
      if (pathname.startsWith(prefix)) return m;
    }
  }
  return null;
}
```

**Decision order (deny on first failure):**
1. `wrong_tenant` — module's domain belongs to a tenant the user isn't in
2. `domain_off` — tenant has no `tenant_domain_assignments` row for this domain
3. `role` — user's role doesn't satisfy `requiredRole`
4. `plan` — `minPlanTier` higher than assignment plan, OR `limits.modules[code] === false`
5. `ok`

**`useModuleAccess(moduleCode)`** wraps the resolver with active
membership + cached assignment + plan limits.

## Sidebar

```
<AppSidebar>
  <SidebarHeader>             ← logo / wordmark
  <SidebarBody>
    <TenantWideSection>       ← Settings / Team / Billing
    {tenantActiveDomains.map(domain => (
      <DomainGroup>            ← collapsible
        <DomainGroupHeader>{domain.sidebar.label}</DomainGroupHeader>
        {domain.routes
          .filter(r => useModuleAccess(r.moduleCode).allowed)
          .filter(r => r.label)
          .map(r => <SidebarItem ... />)}
      </DomainGroup>
    ))}
    <AddProductLink to="/dashboard/settings/billing"/>
  </SidebarBody>
</AppSidebar>
```

**Active domains for this tenant** come from
`tenant_domain_assignments` where `subscription_status IN ('active',
'trialing')`. Cancelled / past_due domains do not render.

**Collapse behaviour:** auto-expand the group matching
`resolveActiveDomain(pathname)`; collapse the rest. State persists per
`(user, tenant)` in localStorage. URL navigation into a collapsed
group's route auto-expands it.

**Hidden cases:**
- Modules where `useModuleAccess()` returns `allowed: false`
- Routes without a `label` (deep / admin-only routes)
- Empty groups don't render

**Active indication:** active path gets a 3px `--domain-accent`
left border in the sidebar. Combined with the 4px top accent strip
from BR-3, the user has two reinforcing "you are in {domain}" signals.

## Domain-themed login adaptation

Extends the BR-2 audience-aware chrome. The Sthira variant is
unchanged; the SOS-neutral variant becomes "SOS-neutral, optionally
domain-tinted."

**Detection signals (priority order):**
1. `?intent=retail` → Sthira chrome (unchanged)
2. `?next=…` query param → match against manifests' `pathPrefixes` to derive domain
3. `document.referrer` is a `/signup/[domain]` page → derive domain
4. Otherwise → SOS-neutral default (no domain tint)

**What changes per-domain (subtle):**
- 4px accent strip at the top of the login card (same `--domain-accent` token)
- Eyebrow text: "Welcome back to **SOS Logistics**" / "**SOS Markets Advisor**" / etc.
- Everything else (SosLogo, form layout, copy, recovery flow) identical

The domain hint is presentational only — if the user authenticates and
the target `next` path isn't accessible to their active membership,
the smart unauthorized fallback (next section) takes over.

## Unauthorized access — smart fallback

Five remedy pages, one per `ModuleAccessReason`:

| Reason | Page | What it does |
|---|---|---|
| `wrong_tenant` | `<SwitchTenantPrompt />` | "This link belongs to **{tenant}**. Switch?" + active membership picker. No matching membership → "Sign in with a different account." |
| `domain_off` | redirect `/dashboard/settings/billing?add={domain}` | Billing page renders with the "Add this product" card promoted. |
| `role` | `<RequestAccessPrompt />` | "Ask **{tenant_admin.email}** to invite you with the right role." Mailto prefilled. |
| `plan` | redirect `/dashboard/settings/billing?promote={module}` | Billing page highlights the upgrade card matching the locked module. |
| `unknown_module` | `<NotFoundPage />` | Fallback for typo'd URLs / removed modules. |

**`<ProtectedRoute>` refactor.** Today takes `requiredRole /
requiredPermissions / requiredDomainCode`. After: takes `moduleCode`;
computes access via the resolver; on deny renders the appropriate
remedy component instead of `<Outlet />`. Legacy props preserved as
deprecation escape hatches.

## Implementation phasing (~9 days, 5 phases)

| Phase | Scope | Effort |
|---|---|---|
| **MV-1** | Extend `DomainManifest` type (pathPrefixes, sidebar, route metadata). Backfill the Markets manifest. Write `resolveModuleAccess` + `resolveActiveDomain`. | ~1.5 d |
| **MV-2** | Build manifests for Logistics + Markets-advisor + AMRO (active self-serve + the one that already has code routes). | ~1.5 d |
| **MV-3** | Refactor `AppSidebar` into tenant-wide + domain-group + module-item layout. Wire `useModuleAccess` + localStorage collapse state. Add "Add a product" footer link. | ~2 d |
| **MV-4** | Refactor `<ProtectedRoute>` to consume `moduleCode`. Build the five `<*Prompt>` remedy pages. Wire the unauthorized fallback into the smart router. | ~2.5 d |
| **MV-5** | Extend `/auth` chrome with per-domain accent + headline derivation (Section 5). Tests + manual E2E checklist runbook. | ~1.5 d |

## Documented graduation paths (deferred)

- **Per-user granular permission grants** — the 5th visibility layer; design Q3-D. Adds a `user_module_grants` table that can override role-based deny for specific (user, module) pairs.
- **Module-level usage metering / per-module pricing** — different from tier-locked access. A future "you've used 80% of your monthly signal quota" model.
- **Custom remedy pages per domain** — e.g., `domain_off` eventually shows the catalog inline instead of redirecting. v1 redirect is good enough.
- **Subdomain routing** (Q2-B from the unified onboarding design) — sidebar / accent code already handles this with a small adjustment to `resolveActiveDomain` (matches `hostname` instead of `pathname` when subdomains are live).

## References

- `docs/plans/2026-05-22-unified-platform-onboarding-design.md` — U0 (the membership / billing / setup-cards foundation this builds on)
- `docs/plans/2026-05-22-platform-brand-architecture-design.md` — BR0 (the chrome / accent system this consumes)
- `src/features/markets/manifest.ts` — the existing manifest, template for the others
- `src/platform/domains/types.ts` — current `DomainManifest` type, extended in MV-1
- `src/components/branding/domainAccents.ts` — `DOMAIN_ACCENT_HEX` map
- `src/components/layout/AppSidebar.tsx` — refactor target for MV-3
- `src/components/auth/ProtectedRoute.tsx` (or wherever it lives) — refactor target for MV-4

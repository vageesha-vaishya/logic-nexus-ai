# Path A — Per-Domain SPA Bundles (Sthira-as-Markets-only)

**Date:** 2026-05-21
**Status:** Plan — agreed direction, not yet executing
**Author:** vimalbahuguna (with Claude)
**Related:**
- `docs/plans/2026-05-20-multi-domain-platform-sequence-design.md` — the multi-domain independence sequence (Phase 0/1/2/3) this realises
- `docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md` — the Sthira mobile brand + UX direction this finally makes coherent

## Context

The Sthira mobile app currently ships *the entire unified SOS Logistics Pro Enterprise SPA bundle* wrapped in a Capacitor shell. That means the phone downloads, parses, and tries to render every desktop-only Markets page (Terminal, Backtests, Strategy Builder, Options Payoff, Scanner, …) plus every non-Markets domain (CRM, AMRO, Logistics, UIM, Quotation, Finance, Compliance, Communications). The user only ever wants the *Markets retail* experience.

This produces three concrete problems:

1. **Crash surface.** Each desktop-trained Markets page contains roughly one "destructure-then-iterate an optional array" pattern that explodes on a partial response. We've patched eight in this session alone (TradingChart, PortfolioAnalyticsPanel, useWebSocketLTP, PortfolioPanel, WatchlistPanel, OptionChainPanel, ScannerPanel, OptionChainTable) and the user is still hitting "Something went wrong" on Terminal. Patching each by hand is a *grind that finishes when we run out of pages*; there are dozens more. Every patch is a Band-Aid on a code path that mobile users should never reach.
2. **Bundle bloat.** The Sthira APK currently bundles every domain's code. Best estimate from `dist/` chunk sizes: ~1.2 MB of JS the phone never executes. Cold-start on the Nord is 2–3s longer than necessary.
3. **Brand confusion.** Routes inside SthiraShell get the Calm Wealth palette + bottom-tab layout; everything else falls back to DashboardLayout with tenant branding + desktop chrome. Users see two visually distinct apps inside one binary.

The proper fix is what the multi-domain design doc called Phase 2 — Functional Independence: ship a *Markets-only* SPA bundle. The Capacitor app loads only the Markets domain's code. Other domains continue to exist on the web build.

## Recommended Approach — Phased

Two phases. The interim bridge (Phase 0.5) is optional but recommended if Phase 0 + 2 take longer than a week to land.

```
Phase 0   → Domain Manifest contract            (~3 days)
Phase 0.5 → Interim mobile route allowlist      (~1 day, optional bridge)
Phase 2.1 → Markets manifest implementation     (~1 day)
Phase 2.2 → Route tree refactor (manifest-driven) (~2 days)
Phase 2.3 → Per-domain Vite entrypoints         (~2 days)
Phase 2.4 → Capacitor wiring                    (~0.5 days)
Phase 2.5 → Cleanup + tests + docs              (~1 day)
                                          Total: ~9.5 days
```

Sequence is strict — each phase depends on the previous landing. Phase 0.5 can run in parallel with Phase 0 if a separate person picks it up.

## Phase 0 — Domain Manifest

Every domain in the codebase (Markets, AMRO, CRM, Logistics, UIM, Quotation, Finance, Compliance, Communications) declares a manifest in a fixed shape. The platform reads manifests, never specific domain modules.

### Manifest Interface

```ts
// src/platform/domains/types.ts

export interface DomainManifest {
  /** Stable identifier matching platform_domains.code. */
  code:        string;                              // 'MARKETS' | 'AMRO' | …
  /** Human-readable name shown in nav, banners, etc. */
  name:        string;                              // 'Retail Investment Platform'
  /** Brand surface tokens — CSS variable names overrideable in tenant theming. */
  brand:       DomainBrand;
  /** Route definitions for this domain. Lazy components — never imported eagerly. */
  routes:      DomainRoute[];
  /** Subset of routes that are mobile-eligible. Drives the Path A bundle. */
  mobileRoutes: string[];                           // route paths
  /** Permissions a user must hold to see any route in this domain. */
  requiredPermissions?: string[];
  /** Default assignment policy for new tenants ('auto' | 'opt-in' | 'trial'). */
  defaultAssignmentPolicy: 'auto' | 'opt-in' | 'trial';
  /** Optional seed migration filename — CI enforces it exists. */
  seedMigration?: string;
  /** Side services this domain owns (worker, api). For docs + ops. */
  services?:   string[];                            // ['markets-worker']
}

export interface DomainRoute {
  path:        string;
  /** Lazy-loaded component. Must default-export a React component. */
  component:   () => Promise<{ default: React.ComponentType<unknown> }>;
  /** Optional sub-routes for nested layouts. */
  children?:   DomainRoute[];
  /** If true, this route is allowed on mobile. Otherwise, mobile guard hides it. */
  mobile?:     boolean;
}

export interface DomainBrand {
  /** CSS variable overrides applied when this domain is active. */
  cssVars:     Record<string, string>;
  /** Sthira-style hybrid: keep tenant theming on top for partner-branded surfaces. */
  hybridWithTenantBranding: boolean;
}
```

### Registry

```ts
// src/platform/domains/registry.ts

import { marketsManifest } from '@/features/markets/manifest';
import { amroManifest }    from '@/features/module-amro/manifest';
// …

export const DOMAIN_MANIFESTS: readonly DomainManifest[] = [
  marketsManifest,
  amroManifest,
  // …
] as const;

export function getActiveManifest(code: string): DomainManifest | null {
  return DOMAIN_MANIFESTS.find(m => m.code === code) ?? null;
}
```

### Enforcement

- `pnpm lint:domain-manifests` — script that walks `src/features/module-*` and `src/features/markets`, asserts each has a `manifest.ts` exporting a `DomainManifest`.
- CI fails the build if a domain in `platform_domains` table lacks a manifest entry.
- Each manifest's `seedMigration` must point to an existing file in `supabase/migrations/`.

**Deliverable:** the contract + lint rule + ten near-empty manifests (one per existing domain), each exporting just `code`, `name`, and a single placeholder route. Routes still live in `App.tsx` for now.

### Validation gate

A manifest exists for every domain. CI green. No behaviour change yet.

---

Does Phase 0 land right so far? Reply or amend before I continue with Phase 0.5.

## Phase 0.5 — Interim Mobile Route Allowlist (optional bridge)

**Goal**: kill the crash surface today without waiting on the bundle refactor. Lands in ~1 day. Can be ripped out once Phase 2 ships.

A `MobileRouteAllowlist` wrapper in `App.tsx`:

```tsx
const MOBILE_ALLOWED = new Set<string>([
  '/dashboard/markets/retail/home',
  '/dashboard/markets/retail/portfolio',
  '/dashboard/markets/retail/signals',
  '/dashboard/markets/retail/goals',
  '/dashboard/markets/retail/more',
  '/dashboard/markets/settings/brokers',
  '/sthira/splash',
  '/sthira/onboarding',
  '/sthira/broker',
  '/auth/login',  // …
]);

function MobileRouteGuard({ children }: { children: React.ReactNode }) {
  const isMobile = useSthiraShell();
  const location = useLocation();
  if (!isMobile) return <>{children}</>;
  // Match the path against allowlist (with route param support)
  if (matchesAllowlist(location.pathname, MOBILE_ALLOWED)) return <>{children}</>;
  return <MobileNotAvailable returnTo="/dashboard/markets/retail/home" />;
}
```

`<MobileNotAvailable>` renders a copper-themed "Open this on desktop" screen with a button back to Home — *not* the FeatureErrorBoundary "Something went wrong" red box.

**Wins**:
- Phone users physically can't reach Terminal / Backtests / Strategy Builder etc., so the dozens of undiscovered undefined-iterate bugs become unreachable.
- The current 8 patched guards can stay (defensive depth) but stop being on the critical path.
- Friendly UX: users see "Open on desktop" instead of error boundary red.

**Limits**:
- Bundle size unchanged — desktop pages still ship.
- Allowlist drift: new mobile-eligible routes need manual addition. Manifest in Phase 2 makes this auto.

Worth doing only if Phase 0/2 land slower than 1 week. If we go straight to Phase 2 the allowlist work is wasted.

---

## Phase 2.1 — Markets Manifest

Concrete manifest for the Markets domain. The first real implementation of the contract from Phase 0.

```ts
// src/features/markets/manifest.ts

import { lazy } from 'react';

export const marketsManifest: DomainManifest = {
  code:  'MARKETS',
  name:  'Retail Investment Platform',
  brand: {
    cssVars: {
      // Sthira "Calm Wealth" palette (already in index.css)
      '--primary':      'var(--sthira-copper)',
      '--background':   'var(--sthira-cream)',
      // …
    },
    hybridWithTenantBranding: true,
  },
  routes: [
    { path: '/dashboard/markets/retail',          component: () => import('./pages/RetailModePage'), mobile: true,
      children: [
        { path: 'home',      component: () => import('./retail/pages/RetailHome'),     mobile: true },
        { path: 'portfolio', component: () => import('./retail/pages/RetailPortfolio'), mobile: true },
        { path: 'signals',   component: () => import('./retail/pages/RetailSignals'),  mobile: true },
        { path: 'goals',     component: () => import('./retail/pages/RetailGoals'),    mobile: true },
        { path: 'more',      component: () => import('./retail/pages/RetailMore'),     mobile: true },
      ],
    },
    { path: '/dashboard/markets/settings/brokers', component: () => import('./pages/BrokerConnectionsPage'), mobile: true },
    { path: '/dashboard/markets/terminal',         component: () => import('./pages/TerminalPage'),          mobile: false },
    { path: '/dashboard/markets/backtests',        component: () => import('./pages/BacktestsPage'),         mobile: false },
    // … all other Markets pages, mobile flag set per route
    // Sthira shell-specific routes:
    { path: '/sthira/splash',     component: () => import('./sthira/SthiraSplashRoute'),     mobile: true },
    { path: '/sthira/onboarding', component: () => import('./sthira/SthiraOnboardingRoute'), mobile: true },
    { path: '/sthira/broker',     component: () => import('./sthira/SthiraBrokerRoute'),     mobile: true },
  ],
  mobileRoutes: undefined, // derived from `route.mobile === true` walk
  requiredPermissions: ['MARKETS_USER'],
  defaultAssignmentPolicy: 'opt-in',
  seedMigration: '20260520150000_seed_markets_domain_and_assignments.sql',
  services: ['markets-worker'],
};
```

Other domains get equally-explicit manifests but only their own routes need `mobile: true` flags (most will be all-false initially).

---

## Phase 2.2 — Route Tree Refactor

`App.tsx`'s 200+ `<Route>` lines become a single loop over manifests:

```tsx
function buildRouteTree(manifests: readonly DomainManifest[], isMobile: boolean): RouteObject[] {
  return manifests.flatMap(m =>
    m.routes
      .filter(r => isMobile ? r.mobile : true)
      .map(r => ({
        path: r.path,
        element: <Suspense fallback={<DomainLoading />}><LazyRoute load={r.component} /></Suspense>,
        children: r.children?.filter(c => isMobile ? c.mobile : true).map(c => ({ … })),
      })),
  );
}

function App() {
  const isMobile = useSthiraShell();
  const routes = useMemo(() => buildRouteTree(DOMAIN_MANIFESTS, isMobile), [isMobile]);
  return <RouterProvider router={createBrowserRouter(routes)} />;
}
```

Behaviour: on mobile, routes with `mobile: false` simply don't exist in the router. Navigating to them produces React Router's normal not-found behaviour (which we configure to render `<MobileNotAvailable>`).

**Risk**: every existing `<Route>` line in `App.tsx` needs to be re-expressed. Some have wrapping `<ProtectedRoute>` or `requiredDomainCode` props — those wrap into the manifest's route definition. ~200 lines of route JSON, ~1 day of careful translation.

---

## Phase 2.3 — Per-Domain Vite Entrypoints

This is where the bundle actually shrinks. Two changes:

1. **A new entrypoint per domain**: `src/entrypoints/markets.tsx` imports *only* the Markets manifest, builds a router from it, mounts.

   ```tsx
   // src/entrypoints/markets.tsx
   import { marketsManifest } from '@/features/markets/manifest';
   import { mountSPA } from '@/platform/mount';
   mountSPA([marketsManifest]);
   ```

2. **Vite multi-input config**:

   ```ts
   // vite.config.ts
   export default defineConfig(({ mode }) => {
     const domain = process.env.VITE_DOMAIN; // 'markets' | undefined
     const input = domain
       ? { [domain]: `src/entrypoints/${domain}.tsx` }
       : { unified: 'src/entrypoints/unified.tsx' };
     return {
       build: { rollupOptions: { input } },
       // …
     };
   });
   ```

3. **Two npm scripts**:

   ```json
   "build:web":     "vite build",                                    // unified, all domains
   "mobile:build":  "VITE_DOMAIN=markets vite build && cap sync android",
   ```

Vite tree-shakes the unselected manifests because they're never imported in the Markets entrypoint. The CRM, AMRO, etc. code stops shipping to the Capacitor APK.

**Expected bundle reduction**: from ~3.5 MB current Markets-shipped-with-everything to ~1.5–2 MB Markets-only. Concrete number is "we'll see when it lands"; conservative is 30% off.

---

## Phase 2.4 — Capacitor Wiring

Minimal:

- `capacitor.config.ts` `webDir` already points to `dist`. `vite build` with `VITE_DOMAIN=markets` writes to the same `dist`. No config change needed.
- The HTML entry served by Capacitor must load the markets entrypoint's JS. Easiest: have `index.html` (or generated `markets.html`) reference the markets-domain script tag. Vite handles this automatically if we tell it which `input` is the HTML root.

Net: ~half-day of getting the rollup output paths matching what Capacitor's sync expects.

---

## Phase 2.5 — Cleanup + Tests + Docs

- Delete the patches from this session that become unreachable in the mobile build (the 8 undefined-iterate guards in Terminal panels etc.) — *or* keep them as defensive depth. Recommendation: keep, they cost nothing.
- Tests: a smoke test per manifest that asserts every route's lazy component actually exists.
- Update `docs/plans/2026-05-20-multi-domain-platform-sequence-design.md` to mark Phase 2 done.
- Memory note: per-domain Vite entrypoint pattern (so future domain rollouts don't reinvent).

---

## Alternatives Considered and Rejected

- **Wrap every non-Markets route in a `DomainGuard` that 404s on mobile.** Solves crash surface but not bundle size. Phase 0.5 *is* this, kept as bridge. Rejected as the long-term answer because it leaves the bloat problem unsolved.

- **Single bundle with runtime "mobile-only routes" filter.** What we already half-have via SthiraMobileGuard. Doesn't tree-shake, so bundle stays big. Same critique as above.

- **Two completely separate codebases (Sthira app + web SOS).** Maximally clean per-domain isolation. Rejected because shared components (auth, layout primitives, hooks) would have to be duplicated or extracted to a third package; that's a much bigger lift than Phase 2 with very little additional benefit.

- **Server-side per-domain HTML generation.** Pre-render an index.html per domain that loads only its bundle. Over-engineering for our scale.

---

## Risks

- **Route translation errors.** Phase 2.2 hand-translates 200+ routes; one typo and a user hits a 404 they didn't have before. Mitigation: a script that diffs the manifest-derived route tree against the pre-refactor `App.tsx` route list and fails CI on mismatches.
- **Permission wrappers.** Many existing routes wrap in `<ProtectedRoute requiredPermissions={…}>`. The manifest needs to declare per-route permissions, and the route-builder needs to wrap appropriately. If a route loses its protection in the migration, that's a real security regression. Mitigation: codify the wrapping logic in `buildRouteTree`, audit a sample of routes by hand post-migration.
- **Lazy import paths.** `() => import('./pages/TerminalPage')` paths break if files move. Mitigation: a build-time check that every manifest import resolves.
- **Tenant theming layering.** The hybrid Sthira-on-top-of-tenant-theming design (from the mobile UX design doc) means manifests' `brand.cssVars` *override* tenant branding. We need to be careful that tenant-branded surfaces inside Markets (e.g. an advisor-branded portfolio detail page) still get tenant CSS. Decide and document per-route in the manifest.
- **The Markets module itself has internal desktop-only pages** (Terminal, Backtests, …) that we'd flag `mobile: false` in the manifest. That means we *still* need to do the work of identifying which surfaces are mobile-ready. The flag is the easy part; the audit is the work.

---

## Open Questions

1. Do we ship Phase 0.5 (interim allowlist) as a bridge, or is the user OK staring at "Terminal crashes" for a week while we land Phase 2 properly?
2. Should the manifest be a `.ts` file or a `.json` file? `.ts` allows lazy imports inline; `.json` is more "data-like" but needs a separate route-component-map.
3. What's the rollback story if Phase 2.3 breaks production? Vite multi-input config affects every build. Suggest: feature-flag the manifest-driven router behind `VITE_USE_DOMAIN_MANIFESTS=true` for the first sprint so we can revert without a build-system rollback.
4. Memory note coverage: do we want a single "Path A complete" memory entry, or per-phase notes?

---

## Next Actions

- Sign-off on the phased plan above.
- Decide Phase 0.5 in/out.
- Start Phase 0 in a fresh worktree (`path-a-phase-0` or similar).
- Open a tracking issue / project board to keep the 5–7 phases visible.

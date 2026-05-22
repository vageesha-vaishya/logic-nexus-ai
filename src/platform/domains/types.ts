/**
 * DomainManifest — the contract every domain in the platform declares.
 *
 * Phase 0 of the multi-domain independence sequence. The platform reads
 * manifests, never specific domain modules. This is what enables:
 *   - Phase 1: commercial-independence (per-domain SKU, opt-in defaults)
 *   - Phase 2: functional-independence (per-domain SPA bundles — Sthira)
 *   - Phase 3: deployment-independence (per-domain ops + scaling)
 *
 * Each domain (Markets, AMRO, CRM, Logistics, …) lives at
 * `src/features/{module-,}<key>/manifest.ts` and default-exports a
 * `DomainManifest`. The registry at `./registry.ts` imports all of them.
 *
 * See:
 *   docs/plans/2026-05-20-multi-domain-platform-sequence-design.md
 *   docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */

import type { LazyExoticComponent, ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/** What a domain's "primary tenant subscription policy" looks like. */
export type DomainAssignmentPolicy = "auto" | "opt-in" | "trial";

/** Plan tier names — match the subscription_tier enum + planLimits keys. */
export type PlanTier = "free" | "basic" | "starter" | "business" | "professional" | "enterprise";

/** App role names — match the public.app_role Postgres enum. */
export type DomainAppRole =
  | "platform_admin"
  | "tenant_admin"
  | "franchise_admin"
  | "user"
  | "viewer"
  | "sales_manager"
  | "platform_domain_admin";

/** A single route owned by a domain. */
export interface DomainRoute {
  /** React Router path. May include params (`:id`). */
  path: string;
  /**
   * Lazy import of the route's React component. Always wrapped in
   * React.lazy at consumption time so the platform never eagerly loads
   * any domain's code.
   */
  component: () => Promise<{ default: ComponentType<unknown> }>;
  /**
   * Whether this route is allowed on the mobile (Sthira-style) shell.
   * The mobile route builder (Phase 2) filters by this flag — desktop
   * is unaffected.
   */
  mobile?: boolean;
  /** Optional child routes for nested layouts. */
  children?: DomainRoute[];
  /**
   * Required permissions to access. Maps to ProtectedRoute's
   * requiredPermissions prop during route construction.
   */
  requiredPermissions?: string[];

  // ─── MV-1 additions (all optional, backward-compatible) ─────────────────
  /**
   * Stable identifier for this module — used by
   * `subscription_plans.limits.modules` to flip per-module access. Format:
   * `<domain>.<feature>` (e.g. "markets.signals", "crm.invoices"). Omit
   * for nested / utility routes that don't represent a top-level module
   * the user thinks of as a thing.
   */
  moduleCode?: string;
  /**
   * Human-readable label for the sidebar. Omit to hide this route from
   * the sidebar entirely (e.g. deep-nested detail pages).
   */
  label?: string;
  /** Sidebar icon. Lucide component. */
  icon?: LucideIcon;
  /**
   * Roles allowed to access this module. If the active membership's
   * role isn't in this list, `resolveModuleAccess` returns reason='role'.
   * Omit to allow all roles (subject to permission + plan checks).
   */
  requiredRole?: DomainAppRole | readonly DomainAppRole[];
  /**
   * Lower-bound plan tier that unlocks this module. Combined with
   * `subscription_plans.limits.modules[moduleCode]` — the limits map can
   * deny a module even when the tier passes (explicit false), but cannot
   * grant it when the tier fails (security default).
   */
  minPlanTier?: PlanTier;
}

/** Sidebar grouping metadata for a domain. */
export interface DomainSidebar {
  /** Section header text in the sidebar (e.g. "Markets Advisor"). */
  label: string;
  /** Icon next to the section header — Lucide component. */
  icon: LucideIcon;
  /** Default expanded state when the user hasn't interacted yet. */
  collapsedByDefault?: boolean;
}

/** Brand surface for a domain — CSS variable overrides applied when active. */
export interface DomainBrand {
  /**
   * CSS custom-property overrides. Keys are var names without `--`, e.g.
   * `"primary": "var(--sthira-copper)"` becomes `--primary` at runtime.
   */
  cssVars: Record<string, string>;
  /**
   * If true, tenant theming (from TenantBrandingContext) layers on top of
   * this domain's brand for partner-branded surfaces. Sthira chose true:
   * domain brand sets the chrome, tenant brand colours partner sections.
   */
  hybridWithTenantBranding: boolean;
}

export interface DomainManifest {
  /**
   * Stable identifier matching `platform_domains.code` in the DB.
   * Uppercase by convention ("MARKETS", "AMRO", "CRM").
   */
  code: string;
  /** Human-readable name shown in nav, banners, audit logs. */
  name: string;
  /** Short description for admin tenant-assignment UI. */
  description?: string;
  /** Brand tokens applied when this domain is active. */
  brand: DomainBrand;
  /** All routes this domain owns. */
  routes: DomainRoute[];

  // ─── MV-1 additions (all optional, backward-compatible) ─────────────────
  /**
   * URL path prefixes this domain owns. The `resolveActiveDomain` resolver
   * walks every manifest and picks the first whose prefix matches the
   * current pathname. Order matters within the array but not across
   * manifests (manifest iteration order is the registry order).
   *
   * Typical pattern: `["/dashboard/{code}"]` for the dashboard surface +
   * any per-domain mobile shell paths (e.g. Sthira adds "/sthira" to
   * the markets manifest because retail uses that URL prefix).
   *
   * If omitted, this domain participates in no sidebar grouping and
   * the resolver never matches its URLs (treated as "tenant-wide" or
   * legacy routes).
   */
  pathPrefixes?: readonly string[];
  /**
   * Sidebar grouping metadata. Omit to exclude this domain from the
   * tenant-wide grouped sidebar (the sidebar still uses individual
   * routes' `label` to render them).
   */
  sidebar?: DomainSidebar;
  /**
   * Default assignment policy when a new tenant signs up.
   * - 'auto':  domain is auto-assigned (e.g. CRM as a baseline)
   * - 'opt-in': tenant must purchase / enable (e.g. Markets, AMRO)
   * - 'trial': enabled with a time-bound grace period
   */
  defaultAssignmentPolicy: DomainAssignmentPolicy;
  /**
   * Required permissions a user must hold to see any of the domain's
   * routes (in addition to per-route requirements). If a user lacks
   * these the domain is hidden from nav entirely.
   */
  requiredPermissions?: string[];
  /**
   * Optional seed migration filename. CI enforces it exists under
   * `supabase/migrations/`. Phase 0 doesn't enforce this yet; Phase 1
   * adds the check.
   */
  seedMigration?: string;
  /**
   * Names of side services this domain owns. For docs + ops + the
   * "what's running for this domain" telemetry dashboard.
   */
  services?: string[];
  /**
   * Default landing route for a tenant whose ONLY assignment is this
   * domain. `DomainShellRouter` redirects `/dashboard` to this path so
   * a single-domain tenant sees a domain-shaped app instead of the
   * generic Command Center dashboard. Multi-domain tenants and
   * platform admins ignore this field. Omit to opt out — those
   * tenants stay on the generic dashboard.
   *
   * Phase 2 of the multi-domain independence sequence.
   */
  defaultRoute?: string;
}

/**
 * Type guard for runtime validation — used by the lint script that walks
 * manifests at build time.
 */
export function isDomainManifest(value: unknown): value is DomainManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<DomainManifest>;
  return (
    typeof m.code === "string" &&
    m.code.length > 0 &&
    typeof m.name === "string" &&
    Array.isArray(m.routes) &&
    typeof m.brand === "object" &&
    m.brand !== null &&
    typeof m.brand.cssVars === "object" &&
    typeof m.brand.hybridWithTenantBranding === "boolean" &&
    typeof m.defaultAssignmentPolicy === "string"
  );
}

/** Lazy alias for documentation clarity — same as DomainRoute['component']. */
export type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

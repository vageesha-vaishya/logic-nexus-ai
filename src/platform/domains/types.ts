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

/** What a domain's "primary tenant subscription policy" looks like. */
export type DomainAssignmentPolicy = "auto" | "opt-in" | "trial";

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

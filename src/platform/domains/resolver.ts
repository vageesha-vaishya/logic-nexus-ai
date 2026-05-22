/**
 * Domain + module-access resolvers — the single decision functions for
 * "which domain is the user in?" and "can the user access this module?".
 *
 * The sidebar render, ProtectedRoute, useFeatureGate, and the smart
 * unauthorized-fallback pages all consume these. Keeping them in one
 * file ensures every layer of the app applies the same access logic.
 *
 * See docs/plans/2026-05-22-module-visibility-and-domain-login-design.md
 * §"Module access resolution".
 */
import { DOMAIN_MANIFESTS } from "./registry";
import type {
  DomainAppRole,
  DomainManifest,
  DomainRoute,
  PlanTier,
} from "./types";

// ─── Plan-tier ordering (free < basic < starter < business < professional < enterprise) ─

const PLAN_TIER_ORDER: Readonly<Record<PlanTier, number>> = {
  free:         0,
  basic:        1,
  starter:      2,
  business:     3,
  professional: 4,
  enterprise:   5,
};

function tierAtLeast(have: PlanTier | null | undefined, need: PlanTier | undefined): boolean {
  if (!need) return true;
  if (!have) return false;
  return PLAN_TIER_ORDER[have] >= PLAN_TIER_ORDER[need];
}

// ─── Public types ──────────────────────────────────────────────────────────

export type ModuleAccessReason =
  | "ok"
  | "wrong_tenant"
  | "domain_off"
  | "role"
  | "plan"
  | "unknown_module";

export type RemedyKind =
  | "request_access"
  | "upgrade"
  | "add_product"
  | "switch_tenant"
  | "not_found";

export interface ModuleAccessRemedy {
  kind:          RemedyKind;
  /** Path to navigate to, when the remedy can be auto-routed. */
  targetPath?:   string;
  /** Tenant to suggest switching to (for wrong_tenant cases). */
  targetTenant?: string;
}

export interface ModuleAccess {
  allowed: boolean;
  reason:  ModuleAccessReason;
  remedy?: ModuleAccessRemedy;
}

// ─── Inputs the resolver consumes ──────────────────────────────────────────

export interface ResolverActiveMembership {
  /** Active user_roles row id. */
  membershipId: string;
  /** Tenant the membership belongs to. */
  tenantId: string;
  /** Role for this membership. */
  role: DomainAppRole;
  /** Whether this is the special Sthira retail membership. */
  isRetail?: boolean;
}

export interface ResolverDomainAssignment {
  /** tenant_domain_assignments.id */
  id: string;
  tenantId: string;
  domainCode: string;
  status: "active" | "trialing" | "past_due" | "cancelled";
  planId: string | null;
}

export interface ResolverPlanLimits {
  /** Plan tier the assignment is on. */
  tier: PlanTier;
  /**
   * Per-module overrides. A `false` entry denies the module even when
   * the tier passes. Missing entries mean "no per-module restriction"
   * — the tier check decides.
   */
  modules?: Readonly<Record<string, boolean>>;
}

export interface ResolveModuleAccessInput {
  moduleCode:    string;
  /** The route this module came from — needed for requiredRole + minPlanTier. */
  route?:        DomainRoute;
  manifest?:     DomainManifest;
  /** Current active membership. Null when signed-out. */
  membership:    ResolverActiveMembership | null;
  /**
   * Assignment that owns the module's domain — must match
   * `manifest.code === assignment.domainCode`. Null if the tenant has
   * no assignment for this domain.
   */
  assignment:    ResolverDomainAssignment | null;
  planLimits:    ResolverPlanLimits | null;
}

// ─── resolveActiveDomain ───────────────────────────────────────────────────

/**
 * Match `pathname` against every registered domain's `pathPrefixes` and
 * return the first manifest that owns it. Returns null for tenant-wide
 * paths (`/dashboard/settings/*`, `/dashboard/profile`, etc.) and for
 * pre-auth surfaces where no domain context applies.
 *
 * Iteration order is the manifest-registry order. To make matches
 * deterministic when prefixes overlap (e.g. `/dashboard` vs.
 * `/dashboard/markets`), put the more-specific manifest first in the
 * registry array.
 */
export function resolveActiveDomain(
  pathname: string,
  manifests: readonly DomainManifest[] = DOMAIN_MANIFESTS,
): DomainManifest | null {
  if (!pathname) return null;
  for (const m of manifests) {
    if (!m.pathPrefixes || m.pathPrefixes.length === 0) continue;
    for (const prefix of m.pathPrefixes) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        return m;
      }
    }
  }
  return null;
}

/**
 * Find the DomainRoute in a manifest by moduleCode. Walks children
 * recursively so nested routes are reachable.
 */
export function findRouteByModuleCode(
  manifest: DomainManifest,
  moduleCode: string,
): DomainRoute | null {
  function walk(routes: readonly DomainRoute[]): DomainRoute | null {
    for (const r of routes) {
      if (r.moduleCode === moduleCode) return r;
      if (r.children) {
        const found = walk(r.children);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(manifest.routes);
}

// ─── resolveModuleAccess ───────────────────────────────────────────────────

/**
 * The single access-decision function. Returns the first failing layer
 * so the unauthorized page can route to the exact remedy without
 * ambiguity. Decision order:
 *
 *   1. signed-out             → wrong_tenant (with switch-account remedy)
 *   2. assignment missing     → domain_off
 *   3. assignment cancelled   → domain_off
 *   4. route requiredRole     → role
 *   5. route minPlanTier      → plan
 *   6. limits.modules deny    → plan
 *   7. ok
 */
export function resolveModuleAccess(input: ResolveModuleAccessInput): ModuleAccess {
  const { moduleCode, route, manifest, membership, assignment, planLimits } = input;

  if (!moduleCode) {
    return { allowed: false, reason: "unknown_module", remedy: { kind: "not_found" } };
  }

  // (1) No membership → user is signed-out or has no role in any tenant.
  if (!membership) {
    return {
      allowed: false,
      reason:  "wrong_tenant",
      remedy:  { kind: "switch_tenant" },
    };
  }

  // (2) Tenant doesn't own the domain.
  if (!assignment) {
    return {
      allowed: false,
      reason:  "domain_off",
      remedy:  {
        kind:       "add_product",
        targetPath: manifest
          ? `/dashboard/settings/billing?add=${manifest.code}`
          : "/dashboard/settings/billing",
      },
    };
  }

  // (3) Tenant owns the domain but the assignment is cancelled.
  if (assignment.status === "cancelled") {
    return {
      allowed: false,
      reason:  "domain_off",
      remedy:  {
        kind:       "add_product",
        targetPath: manifest
          ? `/dashboard/settings/billing?add=${manifest.code}`
          : "/dashboard/settings/billing",
      },
    };
  }

  // (4) Role check.
  if (route?.requiredRole) {
    const allowed = Array.isArray(route.requiredRole)
      ? route.requiredRole.includes(membership.role)
      : route.requiredRole === membership.role;
    if (!allowed) {
      return {
        allowed: false,
        reason:  "role",
        remedy:  { kind: "request_access" },
      };
    }
  }

  // (5) Plan-tier minimum.
  if (route?.minPlanTier && !tierAtLeast(planLimits?.tier ?? null, route.minPlanTier)) {
    return {
      allowed: false,
      reason:  "plan",
      remedy:  {
        kind:       "upgrade",
        targetPath: `/dashboard/settings/billing?promote=${encodeURIComponent(moduleCode)}`,
      },
    };
  }

  // (6) Explicit per-module deny in limits.
  if (planLimits?.modules && planLimits.modules[moduleCode] === false) {
    return {
      allowed: false,
      reason:  "plan",
      remedy:  {
        kind:       "upgrade",
        targetPath: `/dashboard/settings/billing?promote=${encodeURIComponent(moduleCode)}`,
      },
    };
  }

  return { allowed: true, reason: "ok" };
}

import { describe, expect, it } from "vitest";

import {
  findRouteByModuleCode,
  resolveActiveDomain,
  resolveModuleAccess,
  type ResolverActiveMembership,
  type ResolverDomainAssignment,
  type ResolverPlanLimits,
} from "./resolver";
import { DOMAIN_MANIFESTS } from "./registry";
import type { DomainManifest, DomainRoute } from "./types";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const stubRoute = (overrides: Partial<DomainRoute> = {}): DomainRoute => ({
  path:      "/dashboard/markets/feature",
  component: () => Promise.resolve({ default: () => null }),
  ...overrides,
});

const stubManifest = (overrides: Partial<DomainManifest> = {}): DomainManifest => ({
  code:        "MARKETS",
  name:        "Markets",
  brand:       { cssVars: {}, hybridWithTenantBranding: false },
  routes:      [],
  defaultAssignmentPolicy: "opt-in",
  pathPrefixes: ["/dashboard/markets", "/sthira"],
  ...overrides,
});

const membership: ResolverActiveMembership = {
  membershipId: "m1",
  tenantId:     "t1",
  role:         "tenant_admin",
};

const activeAssignment: ResolverDomainAssignment = {
  id:         "a1",
  tenantId:   "t1",
  domainCode: "MARKETS",
  status:     "active",
  planId:     "p1",
};

const proLimits: ResolverPlanLimits = { tier: "professional" };
const freeLimits: ResolverPlanLimits = { tier: "free" };

// ─── resolveActiveDomain ───────────────────────────────────────────────────

describe("resolveActiveDomain", () => {
  const markets = stubManifest({ code: "MARKETS", pathPrefixes: ["/dashboard/markets", "/sthira"] });
  const logistics = stubManifest({ code: "LOGISTICS", pathPrefixes: ["/dashboard/logistics"] });
  const all = [markets, logistics];

  it("matches the first prefix that owns the pathname", () => {
    expect(resolveActiveDomain("/dashboard/markets/retail/home", all)?.code).toBe("MARKETS");
    expect(resolveActiveDomain("/dashboard/logistics/leads", all)?.code).toBe("LOGISTICS");
  });

  it("matches the secondary prefix for a domain (Sthira mobile shell)", () => {
    expect(resolveActiveDomain("/sthira/onboarding", all)?.code).toBe("MARKETS");
  });

  it("returns null for tenant-wide paths (no domain owns them)", () => {
    expect(resolveActiveDomain("/dashboard/settings/billing", all)).toBeNull();
    expect(resolveActiveDomain("/dashboard/settings/team",    all)).toBeNull();
    expect(resolveActiveDomain("/auth",                       all)).toBeNull();
  });

  it("returns null for empty pathname", () => {
    expect(resolveActiveDomain("", all)).toBeNull();
  });

  it("requires prefix to be a full segment (no partial matches)", () => {
    // "/dashboard/marketsabc" should NOT match "/dashboard/markets"
    expect(resolveActiveDomain("/dashboard/marketsabc", all)).toBeNull();
  });

  it("matches the exact prefix as well as nested paths", () => {
    expect(resolveActiveDomain("/dashboard/markets", all)?.code).toBe("MARKETS");
  });

  it("skips manifests without pathPrefixes", () => {
    const legacy = stubManifest({ code: "LEGACY", pathPrefixes: undefined });
    expect(resolveActiveDomain("/dashboard/legacy/foo", [legacy])).toBeNull();
  });
});

// ─── Integration against the real registry (MV-2 manifest backfill) ───────

describe("resolveActiveDomain (real registry — MV-1 + MV-2)", () => {
  it("matches /dashboard/markets/* to MARKETS", () => {
    expect(resolveActiveDomain("/dashboard/markets/retail/home")?.code).toBe("MARKETS");
  });

  it("matches /sthira/* to MARKETS (retail mobile shell shares the domain)", () => {
    expect(resolveActiveDomain("/sthira/onboarding")?.code).toBe("MARKETS");
  });

  it("matches /dashboard/logistics/* and CRM-style routes to LOGISTICS", () => {
    expect(resolveActiveDomain("/dashboard/leads")?.code).toBe("LOGISTICS");
    expect(resolveActiveDomain("/dashboard/opportunities/pipeline")?.code).toBe("LOGISTICS");
    expect(resolveActiveDomain("/dashboard/quotations")?.code).toBe("LOGISTICS");
    expect(resolveActiveDomain("/dashboard/accounts/new")?.code).toBe("LOGISTICS");
  });

  it("matches /dashboard/amro/* to AMRO", () => {
    expect(resolveActiveDomain("/dashboard/amro/work-orders")?.code).toBe("AMRO");
  });

  it("returns null for tenant-wide paths (settings / welcome / auth)", () => {
    expect(resolveActiveDomain("/dashboard/settings/billing")).toBeNull();
    expect(resolveActiveDomain("/dashboard/settings/team")).toBeNull();
    expect(resolveActiveDomain("/welcome")).toBeNull();
    expect(resolveActiveDomain("/auth")).toBeNull();
  });

  it("registry invariant — every pathPrefix is non-empty and slash-rooted", () => {
    for (const m of DOMAIN_MANIFESTS) {
      if (m.pathPrefixes) {
        for (const p of m.pathPrefixes) {
          expect(p.length).toBeGreaterThan(0);
          expect(p.startsWith("/")).toBe(true);
        }
      }
    }
  });
});

// ─── findRouteByModuleCode ────────────────────────────────────────────────

describe("findRouteByModuleCode", () => {
  const route = stubRoute({
    moduleCode: "markets.retail",
    children: [
      stubRoute({ path: "signals", moduleCode: "markets.signals" }),
      stubRoute({ path: "goals" }), // no moduleCode
    ],
  });
  const manifest = stubManifest({ routes: [route] });

  it("finds a top-level route by moduleCode", () => {
    expect(findRouteByModuleCode(manifest, "markets.retail")).toBe(route);
  });

  it("finds a nested-child route by moduleCode", () => {
    expect(findRouteByModuleCode(manifest, "markets.signals")?.path).toBe("signals");
  });

  it("returns null for unknown moduleCode", () => {
    expect(findRouteByModuleCode(manifest, "markets.nope")).toBeNull();
  });
});

// ─── resolveModuleAccess ───────────────────────────────────────────────────

describe("resolveModuleAccess — decision order", () => {
  it("unknown_module when no moduleCode given", () => {
    const r = resolveModuleAccess({
      moduleCode: "",
      membership,
      assignment: activeAssignment,
      planLimits: proLimits,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("unknown_module");
    expect(r.remedy?.kind).toBe("not_found");
  });

  it("wrong_tenant when signed-out (no membership)", () => {
    const r = resolveModuleAccess({
      moduleCode: "markets.signals",
      membership: null,
      assignment: activeAssignment,
      planLimits: proLimits,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("wrong_tenant");
    expect(r.remedy?.kind).toBe("switch_tenant");
  });

  it("domain_off when tenant has no assignment for this domain", () => {
    const r = resolveModuleAccess({
      moduleCode: "markets.signals",
      manifest: stubManifest({ code: "MARKETS" }),
      membership,
      assignment: null,
      planLimits: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("domain_off");
    expect(r.remedy?.kind).toBe("add_product");
    expect(r.remedy?.targetPath).toContain("MARKETS");
  });

  it("domain_off when the assignment is cancelled", () => {
    const r = resolveModuleAccess({
      moduleCode: "markets.signals",
      manifest: stubManifest({ code: "MARKETS" }),
      membership,
      assignment: { ...activeAssignment, status: "cancelled" },
      planLimits: proLimits,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("domain_off");
  });

  it("role when route.requiredRole excludes the user's role", () => {
    const route = stubRoute({
      moduleCode:   "markets.live_trading",
      requiredRole: ["platform_admin"],
    });
    const r = resolveModuleAccess({
      moduleCode: "markets.live_trading",
      route,
      membership: { ...membership, role: "user" },
      assignment: activeAssignment,
      planLimits: proLimits,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("role");
    expect(r.remedy?.kind).toBe("request_access");
  });

  it("allows when role matches a single-value requiredRole", () => {
    const route = stubRoute({
      moduleCode:   "markets.live_trading",
      requiredRole: "tenant_admin",
    });
    const r = resolveModuleAccess({
      moduleCode: "markets.live_trading",
      route,
      membership,
      assignment: activeAssignment,
      planLimits: proLimits,
    });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("ok");
  });

  it("plan when route.minPlanTier exceeds the assignment's tier", () => {
    const route = stubRoute({
      moduleCode:  "markets.signals",
      minPlanTier: "professional",
    });
    const r = resolveModuleAccess({
      moduleCode: "markets.signals",
      route,
      membership,
      assignment: activeAssignment,
      planLimits: freeLimits,  // tier=free, needs professional
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("plan");
    expect(r.remedy?.kind).toBe("upgrade");
    expect(r.remedy?.targetPath).toContain("promote=markets.signals");
  });

  it("plan when limits.modules explicitly denies the moduleCode (even with passing tier)", () => {
    const r = resolveModuleAccess({
      moduleCode: "markets.live_money",
      route:      stubRoute({ moduleCode: "markets.live_money" }),
      membership,
      assignment: activeAssignment,
      planLimits: { tier: "enterprise", modules: { "markets.live_money": false } },
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("plan");
  });

  it("ok when all checks pass", () => {
    const route = stubRoute({
      moduleCode:   "markets.signals",
      minPlanTier:  "starter",
      requiredRole: ["tenant_admin", "user"],
    });
    const r = resolveModuleAccess({
      moduleCode: "markets.signals",
      route,
      membership,
      assignment: activeAssignment,
      planLimits: { tier: "professional", modules: { "markets.signals": true } },
    });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("ok");
  });

  it("ok when no route metadata is given (minimal allow-by-default)", () => {
    const r = resolveModuleAccess({
      moduleCode: "markets.signals",
      membership,
      assignment: activeAssignment,
      planLimits: proLimits,
    });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("ok");
  });
});

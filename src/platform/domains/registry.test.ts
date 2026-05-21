import { describe, expect, it } from "vitest";

import { DOMAIN_MANIFESTS, getDomainManifest, visibleManifests } from "./registry";
import { isDomainManifest } from "./types";

describe("DOMAIN_MANIFESTS registry", () => {
  it("registers at least the eight code-side domains", () => {
    expect(DOMAIN_MANIFESTS.length).toBeGreaterThanOrEqual(8);
  });

  it("every registered entry passes structural validation", () => {
    for (const m of DOMAIN_MANIFESTS) {
      expect(isDomainManifest(m), `manifest ${m.code} should be valid`).toBe(true);
    }
  });

  it("every manifest has a unique code", () => {
    const codes = DOMAIN_MANIFESTS.map((m) => m.code.toUpperCase());
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("includes the MARKETS manifest with mobile routes", () => {
    const markets = getDomainManifest("MARKETS");
    expect(markets).not.toBeNull();
    expect(markets!.code).toBe("MARKETS");
    const mobileRoutes = markets!.routes.filter((r) => r.mobile);
    expect(mobileRoutes.length).toBeGreaterThan(0);
  });

  it("code lookup is case-insensitive", () => {
    expect(getDomainManifest("markets")?.code).toBe("MARKETS");
    expect(getDomainManifest("Markets")?.code).toBe("MARKETS");
    expect(getDomainManifest("AMRO")?.code).toBe("AMRO");
  });

  it("returns null for unknown codes", () => {
    expect(getDomainManifest("NOPE")).toBeNull();
  });
});

describe("visibleManifests", () => {
  it("hides manifests whose requiredPermissions the user lacks", () => {
    // Inject a permission requirement so we test the gate itself, not
    // any specific manifest's policy. Markets no longer declares
    // requiredPermissions — domain assignment is the only check in
    // production (Path A Phase 2.4 fix).
    const gated = DOMAIN_MANIFESTS.map((m) =>
      m.code === "MARKETS" ? { ...m, requiredPermissions: ["markets.view"] } : m,
    );
    const visible = visibleManifests(gated, new Set());
    expect(visible.find((m) => m.code === "MARKETS")).toBeUndefined();
  });

  it("shows manifests whose requirements the user has", () => {
    // Inject the same gate; user holds the matching permission, so
    // Markets should now be visible. AMRO/CRM have no requirements
    // declared in the real manifests so they always show.
    const gated = DOMAIN_MANIFESTS.map((m) =>
      m.code === "MARKETS" ? { ...m, requiredPermissions: ["markets.view"] } : m,
    );
    const visible = visibleManifests(
      gated,
      new Set(["markets.view", "amro.view", "crm.view"]),
    );
    expect(visible.find((m) => m.code === "MARKETS")).toBeDefined();
    expect(visible.find((m) => m.code === "AMRO")).toBeDefined();
    expect(visible.find((m) => m.code === "CRM")).toBeDefined();
  });

  it("returns all manifests when none declare requirements", () => {
    const noReqs = DOMAIN_MANIFESTS.map((m) => ({ ...m, requiredPermissions: undefined }));
    const visible = visibleManifests(noReqs, new Set());
    expect(visible.length).toBe(DOMAIN_MANIFESTS.length);
  });
});

describe("Markets manifest — Path A mobile routing contract", () => {
  const markets = getDomainManifest("MARKETS")!;

  it("declares the Sthira shell routes as mobile-eligible", () => {
    const mobilePaths = markets.routes.filter((r) => r.mobile).map((r) => r.path);
    expect(mobilePaths).toContain("/sthira/splash");
    expect(mobilePaths).toContain("/sthira/onboarding");
    expect(mobilePaths).toContain("/sthira/broker");
  });

  it("flags Terminal + Backtests as desktop-only (the historical crash sites)", () => {
    const terminal = markets.routes.find((r) => r.path === "/dashboard/markets/terminal");
    const backtests = markets.routes.find((r) => r.path === "/dashboard/markets/backtests");
    expect(terminal?.mobile).toBe(false);
    expect(backtests?.mobile).toBe(false);
  });

  it("retail dashboard child routes inherit mobile eligibility", () => {
    const retail = markets.routes.find((r) => r.path === "/dashboard/markets/retail");
    expect(retail).toBeDefined();
    expect(retail!.children?.every((c) => c.mobile === true)).toBe(true);
  });
});

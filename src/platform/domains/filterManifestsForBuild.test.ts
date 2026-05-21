import { describe, expect, it } from "vitest";

import { filterManifestsForBuild } from "./buildDomainRoutes";
import { DOMAIN_MANIFESTS } from "./registry";

describe("filterManifestsForBuild", () => {
  it("returns the full list when no domainOnly is provided", () => {
    expect(filterManifestsForBuild(DOMAIN_MANIFESTS, "").length).toBe(
      DOMAIN_MANIFESTS.length,
    );
  });

  it("returns only the named manifest when domainOnly matches", () => {
    const filtered = filterManifestsForBuild(DOMAIN_MANIFESTS, "markets");
    expect(filtered.length).toBe(1);
    expect(filtered[0].code).toBe("MARKETS");
  });

  it("matches case-insensitively", () => {
    expect(filterManifestsForBuild(DOMAIN_MANIFESTS, "MARKETS").length).toBe(1);
    expect(filterManifestsForBuild(DOMAIN_MANIFESTS, "Markets").length).toBe(1);
    expect(filterManifestsForBuild(DOMAIN_MANIFESTS, "amro").length).toBe(1);
  });

  it("returns an empty list for an unknown domain code", () => {
    expect(filterManifestsForBuild(DOMAIN_MANIFESTS, "no-such-domain").length).toBe(0);
  });

  it("trims whitespace before matching", () => {
    expect(filterManifestsForBuild(DOMAIN_MANIFESTS, "  markets  ").length).toBe(1);
  });
});

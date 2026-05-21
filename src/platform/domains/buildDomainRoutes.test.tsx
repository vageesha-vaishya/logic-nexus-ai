import { describe, expect, it, vi } from "vitest";
import { isValidElement, Children, type ReactElement } from "react";

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children, requiredDomainCode, requiredPermissions }: any) => (
    <div
      data-protected
      data-domain={requiredDomainCode ?? ""}
      data-perms={(requiredPermissions ?? []).join(",")}
    >
      {children}
    </div>
  ),
}));

import { buildDomainRoutes, buildAllDomainRoutes } from "./buildDomainRoutes";
import { marketsManifest } from "@/features/markets/manifest";
import { amroManifest } from "@/features/module-amro/manifest";
import type { DomainManifest } from "./types";

function collectRoutes(nodes: ReactElement[]): { path: string; mobile?: boolean }[] {
  const out: { path: string }[] = [];
  for (const n of nodes) {
    if (!isValidElement(n)) continue;
    const props = n.props as { path?: string; children?: React.ReactNode };
    if (props.path) out.push({ path: props.path });
    if (props.children) {
      const kids = Children.toArray(props.children).filter(isValidElement);
      out.push(...collectRoutes(kids as ReactElement[]));
    }
  }
  return out;
}

describe("buildDomainRoutes — Markets manifest", () => {
  it("emits one top-level Route element per top-level manifest route", () => {
    const elements = buildDomainRoutes(marketsManifest);
    expect(elements.length).toBe(marketsManifest.routes.length);
    elements.forEach((el) => expect(isValidElement(el)).toBe(true));
  });

  it("preserves the per-route path values verbatim", () => {
    const elements = buildDomainRoutes(marketsManifest);
    const paths = elements.map((el) => (el.props as { path: string }).path);
    expect(paths).toContain("/sthira/splash");
    expect(paths).toContain("/dashboard/markets/retail");
    expect(paths).toContain("/dashboard/markets/terminal");
  });

  it("emits child routes nested inside their parent", () => {
    const elements = buildDomainRoutes(marketsManifest);
    const all = collectRoutes(elements);
    const allPaths = all.map((r) => r.path);
    expect(allPaths).toContain("/dashboard/markets/retail");
    expect(allPaths).toContain("home");
    expect(allPaths).toContain("portfolio");
    expect(allPaths).toContain("signals");
  });

  it("filters to mobile-only when opts.mobile is true", () => {
    const all = buildDomainRoutes(marketsManifest);
    const mobile = buildDomainRoutes(marketsManifest, { mobile: true });
    expect(mobile.length).toBeLessThan(all.length);
    const mobilePaths = mobile.map((el) => (el.props as { path: string }).path);
    expect(mobilePaths).toContain("/sthira/splash");
    expect(mobilePaths).not.toContain("/dashboard/markets/terminal");
  });
});

describe("buildAllDomainRoutes", () => {
  it("flattens routes from multiple manifests into a single list", () => {
    const manifests: DomainManifest[] = [marketsManifest, amroManifest];
    const elements = buildAllDomainRoutes(manifests);
    // amroManifest is a stub with empty routes, so total equals Markets count.
    expect(elements.length).toBe(marketsManifest.routes.length);
  });

  it("respects mobile filter across all manifests", () => {
    const elements = buildAllDomainRoutes([marketsManifest, amroManifest], { mobile: true });
    const paths = elements.map((el) => (el.props as { path: string }).path);
    // AMRO has no mobile routes; Markets has several. So result is Markets-only mobile.
    expect(paths.every((p) => p.startsWith("/sthira") || p.includes("/markets/retail") || p.includes("/markets/settings/brokers")))
      .toBe(true);
  });

  it("returns an empty array when no manifests have routes", () => {
    expect(buildAllDomainRoutes([amroManifest]).length).toBe(0);
  });
});

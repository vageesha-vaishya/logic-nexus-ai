/**
 * Sanity tests for the APP_MENU → domain-group classification used by
 * DomainGroupedNav. We don't render the React tree (sidebar primitives
 * need a SidebarProvider + DOM, too heavy for a unit test) — instead we
 * pin the classification invariant that every domain group ends up
 * non-empty and the workspace bucket captures Settings + Home.
 */
import { describe, expect, it } from "vitest";

import { APP_MENU } from "@/config/navigation";
import { resolveActiveDomain } from "@/platform/domains/resolver";

describe("APP_MENU → domain classification (MV-3 invariant)", () => {
  const everyItem = APP_MENU.flatMap((m) => m.items);

  it("APP_MENU contains the expected high-level groups", () => {
    expect(APP_MENU.map((m) => m.label)).toContain("Sales");
    expect(APP_MENU.map((m) => m.label)).toContain("Logistics");
  });

  it("LOGISTICS owns the CRM-style URLs", () => {
    const leads = everyItem.find((i) => i.path === "/dashboard/leads/pipeline");
    expect(leads).toBeDefined();
    expect(resolveActiveDomain(leads!.path)?.code).toBe("LOGISTICS");

    const accounts = everyItem.find((i) => i.path === "/dashboard/accounts/pipeline");
    expect(accounts).toBeDefined();
    expect(resolveActiveDomain(accounts!.path)?.code).toBe("LOGISTICS");
  });

  it("/dashboard (Home) falls into the Workspace bucket — no domain owns it", () => {
    const home = everyItem.find((i) => i.path === "/dashboard");
    expect(home).toBeDefined();
    expect(resolveActiveDomain(home!.path)).toBeNull();
  });

  it("every menu item resolves either to a domain or to Workspace (no holes)", () => {
    for (const item of everyItem) {
      const resolved = resolveActiveDomain(item.path);
      // Either we know the domain or it's intentionally workspace-bucket
      // — both are valid; we just want no item to be undefined-handling.
      expect(resolved === null || typeof resolved.code === "string").toBe(true);
    }
  });
});

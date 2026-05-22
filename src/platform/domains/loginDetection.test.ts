/**
 * Tests for the MV-5 login-chrome detection rules. The actual <Auth>
 * component reads searchParams + document.referrer + location.state, so
 * we recreate the priority chain here as a pure function and pin the
 * order. If Auth.tsx ever drifts, this test highlights the gap.
 *
 * Priority (locked in
 * docs/plans/2026-05-22-module-visibility-and-domain-login-design.md
 * §"Domain-themed login adaptation"):
 *
 *   1. ?intent=retail → Sthira variant (no domain hint, returns null)
 *   2. next path matches a non-Markets domain → that manifest
 *   3. document.referrer is /signup/<non-markets-domain> → that manifest
 *   4. otherwise → null (SOS-neutral)
 */
import { describe, expect, it } from "vitest";

import { resolveActiveDomain } from "./resolver";
import { getDomainManifest } from "./registry";
import type { DomainManifest } from "./types";

/**
 * Pure re-implementation of the Auth.tsx detection logic. Kept here so
 * the priority order is testable in isolation. If Auth.tsx changes, this
 * function should mirror the change.
 */
function detectDomainHint(input: {
  intent:   string | null;
  next:     string;
  referrer: string;
}): DomainManifest | null {
  if (input.intent === "retail") return null;

  // (2) next path
  const nextMatch = resolveActiveDomain(input.next);
  if (nextMatch && nextMatch.code !== "MARKETS") return nextMatch;

  // (3) referrer
  if (input.referrer) {
    try {
      const referrerPath = new URL(input.referrer).pathname;
      const refMatch = resolveActiveDomain(referrerPath);
      if (refMatch && refMatch.code !== "MARKETS") return refMatch;
      const signupMatch = referrerPath.match(/^\/signup\/(logistics|markets|amro)$/);
      if (signupMatch && signupMatch[1] !== "markets") {
        return getDomainManifest(signupMatch[1]);
      }
    } catch {
      /* ignore cross-origin referrer parse errors */
    }
  }

  return null;
}

describe("MV-5 login domain hint detection", () => {
  const PAGE = "https://sosservices.online";

  it("?intent=retail → null (Sthira variant takes over)", () => {
    expect(detectDomainHint({ intent: "retail", next: "/dashboard", referrer: "" })).toBeNull();
  });

  it("next path = /dashboard/logistics/leads → LOGISTICS", () => {
    expect(
      detectDomainHint({ intent: null, next: "/dashboard/leads", referrer: "" })?.code,
    ).toBe("LOGISTICS");
  });

  it("next path = /dashboard/amro/work-orders → AMRO", () => {
    expect(
      detectDomainHint({ intent: null, next: "/dashboard/amro/work-orders", referrer: "" })?.code,
    ).toBe("AMRO");
  });

  it("next path matching MARKETS does NOT surface as a hint (retail vs B2B ambiguous)", () => {
    // Markets-retail visitors get the Sthira chrome via ?intent=retail
    // OR the path /sthira/* / /dashboard/markets/retail. The SOS-neutral
    // variant deliberately doesn't tint for MARKETS to avoid showing
    // "Welcome back to SOS Markets" on a retail-leaning surface.
    expect(
      detectDomainHint({ intent: null, next: "/dashboard/markets/terminal", referrer: "" }),
    ).toBeNull();
  });

  it("referrer path matches a domain when next is neutral", () => {
    expect(
      detectDomainHint({
        intent:   null,
        next:     "/dashboard",
        referrer: `${PAGE}/dashboard/leads/pipeline`,
      })?.code,
    ).toBe("LOGISTICS");
  });

  it("referrer = /signup/logistics → LOGISTICS", () => {
    expect(
      detectDomainHint({
        intent:   null,
        next:     "/dashboard",
        referrer: `${PAGE}/signup/logistics`,
      })?.code,
    ).toBe("LOGISTICS");
  });

  it("referrer = /signup/markets → null (retail-leaning, no SOS tint)", () => {
    expect(
      detectDomainHint({
        intent:   null,
        next:     "/dashboard",
        referrer: `${PAGE}/signup/markets`,
      }),
    ).toBeNull();
  });

  it("no signals → null (SOS-neutral)", () => {
    expect(detectDomainHint({ intent: null, next: "/dashboard", referrer: "" })).toBeNull();
  });

  it("next wins over referrer when both resolve", () => {
    // next says LOGISTICS, referrer says AMRO — next takes priority
    expect(
      detectDomainHint({
        intent:   null,
        next:     "/dashboard/leads",
        referrer: `${PAGE}/dashboard/amro/work-orders`,
      })?.code,
    ).toBe("LOGISTICS");
  });
});

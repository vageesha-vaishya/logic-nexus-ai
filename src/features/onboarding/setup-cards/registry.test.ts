import { describe, expect, it } from "vitest";

import { SETUP_CARDS, setupCardsForDomain } from "./registry";

describe("setup-cards registry", () => {
  it("ships 10 cards total — 5 per domain", () => {
    expect(SETUP_CARDS).toHaveLength(10);
    expect(setupCardsForDomain("logistics")).toHaveLength(5);
    expect(setupCardsForDomain("markets")).toHaveLength(5);
  });

  it("has the expected keys per design doc §Setup cards", () => {
    const logisticsKeys = setupCardsForDomain("logistics").map((c) => c.key).sort();
    const marketsKeys   = setupCardsForDomain("markets").map((c) => c.key).sort();

    expect(logisticsKeys).toEqual([
      "add_gst", "connect_lead_channels", "import_shipments", "invite_team", "take_tour",
    ]);
    expect(marketsKeys).toEqual([
      "add_pan_business", "connect_broker", "invite_advisors", "sebi_sub_broker_reg", "take_tour",
    ]);
  });

  it("on_action cards match the design's gated set", () => {
    const onAction = SETUP_CARDS
      .filter((c) => c.trigger === "on_action")
      .map((c) => `${c.domain}:${c.key}`)
      .sort();
    expect(onAction).toEqual([
      "logistics:add_gst",
      "markets:add_pan_business",
      "markets:sebi_sub_broker_reg",
    ]);
  });

  it("every always card has a ctaLabel and either ctaTo or is Mark-done", () => {
    for (const c of SETUP_CARDS) {
      expect(c.ctaLabel.trim().length).toBeGreaterThan(0);
      // ctaTo is optional — when omitted the card surfaces "Mark done" only.
      if (c.ctaTo) expect(c.ctaTo.startsWith("/")).toBe(true);
    }
  });

  it("orders are unique within a domain (deterministic panel ordering)", () => {
    for (const domain of ["logistics", "markets"] as const) {
      const orders = setupCardsForDomain(domain).map((c) => c.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });
});

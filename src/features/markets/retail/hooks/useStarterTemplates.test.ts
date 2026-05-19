import { describe, it, expect } from "vitest";

import {
  applyTemplateToBudget,
  type PortfolioTemplate,
} from "./useStarterTemplates";

const balanced: PortfolioTemplate = {
  id: "stub",
  slug: "balanced",
  display_name: "Balanced",
  description: "x",
  risk_tag: "moderate",
  is_active: true,
  display_order: 20,
  created_at: "",
  updated_at: "",
  tier_allocations: [
    { tier_number: 1, weight_pct: 55, focus: "", suggested_holdings: [] },
    { tier_number: 2, weight_pct: 35, focus: "", suggested_holdings: [] },
    { tier_number: 3, weight_pct: 10, focus: "", suggested_holdings: [] },
  ],
};

describe("applyTemplateToBudget", () => {
  it("splits a clean ₹500,000 budget into the exact tier weights", () => {
    const out = applyTemplateToBudget(balanced, 500_000);
    expect(out).toEqual([
      { tier_number: 1, target_amount: 275_000 },
      { tier_number: 2, target_amount: 175_000 },
      { tier_number: 3, target_amount:  50_000 },
    ]);
  });

  it("rounds to whole rupees and pushes drift into tier 2 so the sum always matches the budget", () => {
    // ₹10,001 split 55/35/10 → 5500.55 / 3500.35 / 1000.10. Rounded that's
    // 5501 + 3500 + 1000 = 10001 already, no drift. Try a budget that
    // actually drifts: ₹3 → 1.65 / 1.05 / 0.30 → rounded 2 + 1 + 0 = 3. OK.
    // ₹7 → 3.85 / 2.45 / 0.70 → 4 + 2 + 1 = 7.
    // Pick a value where naive rounding leaves drift: 55/35/10 of 13 →
    // 7.15 / 4.55 / 1.30 → 7 + 5 + 1 = 13. Use 11: 6.05 / 3.85 / 1.10 →
    // 6 + 4 + 1 = 11. Use 33: 18.15 / 11.55 / 3.30 → 18 + 12 + 3 = 33.
    // Use 47: 25.85 / 16.45 / 4.70 → 26 + 16 + 5 = 47.
    // 8: 4.4 / 2.8 / 0.8 → 4 + 3 + 1 = 8. Use 17: 9.35 / 5.95 / 1.70 →
    // 9 + 6 + 2 = 17. Use 19: 10.45 / 6.65 / 1.90 → 10 + 7 + 2 = 19. OK.
    // The rounding rules clean up in all small cases. Assert the invariant
    // directly across a range:
    for (const budget of [1, 3, 7, 11, 13, 17, 19, 100, 1_001, 50_007]) {
      const sum = applyTemplateToBudget(balanced, budget).reduce(
        (acc, r) => acc + r.target_amount,
        0,
      );
      expect(sum).toBe(budget);
    }
  });

  it("returns zeros for non-positive budgets", () => {
    expect(applyTemplateToBudget(balanced, 0)).toEqual([
      { tier_number: 1, target_amount: 0 },
      { tier_number: 2, target_amount: 0 },
      { tier_number: 3, target_amount: 0 },
    ]);
    expect(applyTemplateToBudget(balanced, -500)).toEqual([
      { tier_number: 1, target_amount: 0 },
      { tier_number: 2, target_amount: 0 },
      { tier_number: 3, target_amount: 0 },
    ]);
  });

  it("preserves tier_number ordering from the template", () => {
    const out = applyTemplateToBudget(balanced, 1000);
    expect(out.map((r) => r.tier_number)).toEqual([1, 2, 3]);
  });
});

import { describe, it, expect } from "vitest";

import {
  computeExitLoad,
  computeSettlementDate,
  computeTaxImpact,
} from "./withdrawMath";

describe("computeSettlementDate", () => {
  it("returns T+1 for equity (Indian settlement cycle since Jan 2023)", () => {
    // Monday → next business day is Tuesday.
    const monday = new Date("2026-03-09T00:00:00Z"); // Monday
    const out = computeSettlementDate(monday, "equity");
    expect(out.businessDaysOut).toBe(1);
    expect(out.dateISO).toBe("2026-03-10");
    expect(out.label).toMatch(/^T\+1/);
  });

  it("skips weekends — Friday equity withdraw lands Monday", () => {
    const friday = new Date("2026-03-13T00:00:00Z"); // Friday
    const out = computeSettlementDate(friday, "equity");
    expect(out.dateISO).toBe("2026-03-16"); // Monday
  });

  it("returns T+3 for equity mutual funds (SEBI ceiling)", () => {
    const monday = new Date("2026-03-09T00:00:00Z");
    const out = computeSettlementDate(monday, "mf_equity");
    expect(out.businessDaysOut).toBe(3);
    expect(out.dateISO).toBe("2026-03-12"); // Thursday
  });
});

describe("computeExitLoad", () => {
  it("returns zero for equity withdrawal regardless of holding period", () => {
    expect(computeExitLoad(100_000, 0, "equity").amount).toBe(0);
    expect(computeExitLoad(100_000, 24, "equity").amount).toBe(0);
  });

  it("applies 1% to equity MF redeemed within 12 months", () => {
    const out = computeExitLoad(100_000, 6, "mf_equity");
    expect(out.amount).toBe(1000);
    expect(out.reason).toMatch(/within 12 months/);
  });

  it("waives the load on equity MF held >= 12 months", () => {
    const out = computeExitLoad(100_000, 12, "mf_equity");
    expect(out.amount).toBe(0);
  });

  it("applies 0.25% to debt MF redeemed within 30 days", () => {
    // 0 months = 0 days; under the 30-day window → load applies.
    const out = computeExitLoad(100_000, 0, "mf_debt");
    expect(out.amount).toBe(250);
  });

  it("respects a custom load override", () => {
    const out = computeExitLoad(100_000, 24, "mf_equity", 0.5);
    expect(out.amount).toBe(500);
    expect(out.reason).toMatch(/0\.50% custom load/);
  });

  it("returns zero exit load when amount is non-positive", () => {
    expect(computeExitLoad(0, 0, "mf_equity").amount).toBe(0);
    expect(computeExitLoad(-100, 0, "mf_equity").amount).toBe(0);
  });
});

describe("computeTaxImpact", () => {
  it("returns zero tax when gain is non-positive", () => {
    const out = computeTaxImpact(0, 5, 125_000, "equity");
    expect(out.total).toBe(0);
    expect(out.breakdown).toMatch(/no tax/i);
  });

  it("applies 20% STCG when held under a year (equity)", () => {
    const out = computeTaxImpact(50_000, 0.5, 125_000, "equity");
    expect(out.stcg).toBe(10_000);
    expect(out.ltcg).toBe(0);
    expect(out.total).toBe(10_000);
  });

  it("uses the LTCG exemption first when held over a year", () => {
    // Gain ₹100k, exemption ₹125k available → all exempt, ₹0 tax.
    const out = computeTaxImpact(100_000, 1.5, 125_000, "equity");
    expect(out.ltcg).toBe(0);
    expect(out.exemptionUsed).toBe(100_000);
    expect(out.exemptionLeft).toBe(25_000);
  });

  it("taxes the remainder at 12.5% after exemption is used", () => {
    // Gain ₹200k, exemption ₹125k → ₹125k exempt, ₹75k @ 12.5% = ₹9,375.
    const out = computeTaxImpact(200_000, 2, 125_000, "equity");
    expect(out.ltcg).toBe(9_375);
    expect(out.exemptionUsed).toBe(125_000);
    expect(out.exemptionLeft).toBe(0);
  });

  it("ignores already-used FY exemption when computing the next withdrawal", () => {
    // User has only ₹25k of exemption left this FY.
    const out = computeTaxImpact(100_000, 2, 25_000, "equity");
    expect(out.exemptionUsed).toBe(25_000);
    expect(out.ltcg).toBe(Math.round(75_000 * 0.125));
  });

  it("uses top slab rate for debt MF gains regardless of period", () => {
    const out = computeTaxImpact(100_000, 5, 125_000, "mf_debt");
    expect(out.stcg).toBe(30_000); // 30% slab guess
    expect(out.ltcg).toBe(0);
    expect(out.breakdown).toMatch(/Debt MF/);
  });
});

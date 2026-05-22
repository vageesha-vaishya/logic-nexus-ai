import { describe, it, expect } from "vitest";

import { selectHarvestCandidates, splitByExemption, type HarvestCandidate } from "./harvest";

function pos(over: Partial<HarvestCandidate>): HarvestCandidate {
  return {
    symbol:          "TEST",
    asset_class:     "equity",
    qty:             10,
    avg_buy_price:   100,
    current_price:   150,
    unrealized_gain: 500,
    oldest_buy_date: "2024-01-01",
    holding_days:    500,
    gain_type:       "LTCG",
    portfolio_id:    "p1",
    ...over,
  };
}

describe("selectHarvestCandidates", () => {
  it("filters out STCG positions", () => {
    const out = selectHarvestCandidates([
      pos({ symbol: "A", gain_type: "STCG", unrealized_gain: 9000 }),
      pos({ symbol: "B", gain_type: "LTCG", unrealized_gain: 1000 }),
    ]);
    expect(out.map((p) => p.symbol)).toEqual(["B"]);
  });

  it("filters out LTCG positions at a loss", () => {
    const out = selectHarvestCandidates([
      pos({ symbol: "LOSS", gain_type: "LTCG", unrealized_gain: -2000 }),
      pos({ symbol: "GAIN", gain_type: "LTCG", unrealized_gain: 2000 }),
    ]);
    expect(out.map((p) => p.symbol)).toEqual(["GAIN"]);
  });

  it("sorts by gain descending", () => {
    const out = selectHarvestCandidates([
      pos({ symbol: "SMALL", unrealized_gain: 100 }),
      pos({ symbol: "BIG",   unrealized_gain: 10_000 }),
      pos({ symbol: "MED",   unrealized_gain: 1_000 }),
    ]);
    expect(out.map((p) => p.symbol)).toEqual(["BIG", "MED", "SMALL"]);
  });
});

describe("splitByExemption", () => {
  it("places everything within when room is plenty", () => {
    const cs = [pos({ symbol: "A", unrealized_gain: 50_000 })];
    const r = splitByExemption(cs, 125_000);
    expect(r.withinExemption.map((c) => c.symbol)).toEqual(["A"]);
    expect(r.aboveExemption).toEqual([]);
    expect(r.straddle).toBeNull();
    expect(r.totalTaxFreeGain).toBe(50_000);
    expect(r.totalTaxableGain).toBe(0);
  });

  it("places everything above when remaining is zero", () => {
    const cs = [
      pos({ symbol: "A", unrealized_gain: 10_000 }),
      pos({ symbol: "B", unrealized_gain: 5_000 }),
    ];
    const r = splitByExemption(cs, 0);
    expect(r.withinExemption).toEqual([]);
    expect(r.aboveExemption.map((c) => c.symbol)).toEqual(["A", "B"]);
    expect(r.straddle).toBeNull();
    expect(r.totalTaxFreeGain).toBe(0);
    expect(r.totalTaxableGain).toBe(15_000);
  });

  it("splits a straddling position", () => {
    const cs = [
      pos({ symbol: "A", unrealized_gain: 80_000 }),
      pos({ symbol: "B", unrealized_gain: 60_000 }),  // straddles
      pos({ symbol: "C", unrealized_gain: 20_000 }),
    ];
    const r = splitByExemption(cs, 125_000);  // 80k fits, 45k of B fits, 15k of B + all of C above
    expect(r.withinExemption.map((c) => c.symbol)).toEqual(["A"]);
    expect(r.straddle?.position.symbol).toBe("B");
    expect(r.straddle?.gainWithin).toBe(45_000);
    expect(r.straddle?.gainAbove).toBe(15_000);
    expect(r.aboveExemption.map((c) => c.symbol)).toEqual(["C"]);
    expect(r.totalTaxFreeGain).toBe(125_000);
    expect(r.totalTaxableGain).toBe(35_000);
  });

  it("negative remainingExemption is treated as zero", () => {
    const cs = [pos({ symbol: "A", unrealized_gain: 1_000 })];
    const r = splitByExemption(cs, -5_000);
    expect(r.aboveExemption.map((c) => c.symbol)).toEqual(["A"]);
    expect(r.totalTaxFreeGain).toBe(0);
  });

  it("empty candidate list", () => {
    const r = splitByExemption([], 125_000);
    expect(r.withinExemption).toEqual([]);
    expect(r.aboveExemption).toEqual([]);
    expect(r.straddle).toBeNull();
    expect(r.totalTaxFreeGain).toBe(0);
    expect(r.totalTaxableGain).toBe(0);
  });
});

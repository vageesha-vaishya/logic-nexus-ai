/**
 * Aggregation regression for usePortfolioHoldings.
 *
 * The hook itself queries Supabase, so a full integration test is out of
 * scope here. Instead, this file reimplements the same aggregation logic
 * inline (mirrored 1:1 against usePortfolio.ts) and asserts on the
 * properties that matter:
 *   • Two source rows for the same instrument roll up into ONE row
 *     whose qty is the sum and whose avg_cost is the weighted average.
 *   • The resulting AggregatedHolding exposes source_count + sources[]
 *     for the per-broker expand UI.
 *   • Realized P&L sums across sources.
 *   • Single-source rows keep their broker_connection_id at the top level.
 *
 * If the production hook drifts from this shape, update both at once —
 * the test exists to prevent a silent regression where two brokers'
 * holdings get clobbered in the rendered table.
 */
import { describe, expect, it } from "vitest";

import type { AggregatedHolding, HoldingWithPrice } from "../types";

function aggregate(rows: HoldingWithPrice[]): AggregatedHolding[] {
  const byInstrument = new Map<string, HoldingWithPrice[]>();
  for (const row of rows) {
    const bucket = byInstrument.get(row.instrument_id) ?? [];
    bucket.push(row);
    byInstrument.set(row.instrument_id, bucket);
  }
  const out: AggregatedHolding[] = [];
  for (const [iid, group] of byInstrument) {
    group.sort((a, b) => b.qty - a.qty);
    const totalQty = group.reduce((s, r) => s + r.qty, 0);
    const totalCostBasis = group.reduce((s, r) => s + r.qty * r.avg_cost, 0);
    const wAvg = totalQty > 0 ? totalCostBasis / totalQty : 0;
    const sumRealized = group.reduce((s, r) => s + (r.realized_pnl ?? 0), 0);
    const head = group[0];
    out.push({
      id:              head.id,
      instrument_id:   iid,
      qty:             totalQty,
      avg_cost:        wAvg,
      realized_pnl:    sumRealized,
      last_updated_at: head.last_updated_at,
      instrument:      head.instrument,
      last_price:      head.last_price,
      prev_price:      head.prev_price,
      broker_connection_id: group.length === 1 ? head.broker_connection_id ?? null : null,
      source_count:    group.length,
      sources:         group,
    });
  }
  return out;
}

function row(
  instrument_id: string,
  qty: number,
  avg_cost: number,
  broker_connection_id: string | null,
  extras: Partial<HoldingWithPrice> = {},
): HoldingWithPrice {
  return {
    id: `${instrument_id}-${broker_connection_id ?? "manual"}`,
    instrument_id,
    qty,
    avg_cost,
    realized_pnl: 0,
    last_updated_at: "2026-05-26T00:00:00Z",
    instrument: null,
    broker_connection_id,
    last_price: null,
    prev_price: null,
    ...extras,
  };
}

describe("aggregate multi-broker holdings", () => {
  it("rolls up two brokers holding the same symbol into one row", () => {
    const result = aggregate([
      row("reliance", 5, 2500, "conn-zerodha"),
      row("reliance", 5, 2600, "conn-groww"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(10);
    expect(result[0].avg_cost).toBeCloseTo(2550, 2); // weighted: (5*2500+5*2600)/10
    expect(result[0].source_count).toBe(2);
    expect(result[0].sources.map(s => s.broker_connection_id).sort())
      .toEqual(["conn-groww", "conn-zerodha"]);
    // When > 1 source, the rolled-up row exposes no single connection_id.
    expect(result[0].broker_connection_id).toBeNull();
  });

  it("computes weighted average across uneven qtys", () => {
    const result = aggregate([
      row("tcs", 100, 3000, "conn-A"),
      row("tcs", 10,  4000, "conn-B"),
    ]);
    expect(result[0].qty).toBe(110);
    // (100*3000 + 10*4000) / 110 = 340000 / 110 ≈ 3090.91
    expect(result[0].avg_cost).toBeCloseTo(3090.91, 2);
  });

  it("preserves broker_connection_id on single-source rows", () => {
    const result = aggregate([row("infy", 20, 1500, "conn-zerodha")]);
    expect(result).toHaveLength(1);
    expect(result[0].source_count).toBe(1);
    expect(result[0].broker_connection_id).toBe("conn-zerodha");
  });

  it("treats manual entries (null connection) as their own source", () => {
    const result = aggregate([
      row("hdfc", 5, 1600, null),         // manual
      row("hdfc", 5, 1700, "conn-zerodha"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(10);
    expect(result[0].source_count).toBe(2);
    // Two sources, order unspecified — just assert both connection ids are present.
    const ids = result[0].sources.map(s => s.broker_connection_id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids)).toEqual(new Set([null, "conn-zerodha"]));
  });

  it("sums realized P&L across sources", () => {
    const result = aggregate([
      row("itc", 10, 400, "conn-A", { realized_pnl: 50 }),
      row("itc", 10, 410, "conn-B", { realized_pnl: 75 }),
    ]);
    expect(result[0].realized_pnl).toBe(125);
  });

  it("returns one row per instrument when no symbols overlap", () => {
    const result = aggregate([
      row("a", 1, 100, "conn-A"),
      row("b", 2, 200, "conn-A"),
      row("c", 3, 300, "conn-B"),
    ]);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.source_count)).toEqual([1, 1, 1]);
  });

  it("handles bonus shares (avg_cost = 0) correctly in weighted average", () => {
    const result = aggregate([
      row("bonus", 10, 100, "conn-A"),
      row("bonus", 10, 0,   "conn-A"),   // bonus shares
    ]);
    // weighted avg: (10*100 + 10*0) / 20 = 50
    expect(result[0].qty).toBe(20);
    expect(result[0].avg_cost).toBe(50);
  });
});

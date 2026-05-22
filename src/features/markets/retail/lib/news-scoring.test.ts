import { describe, it, expect } from "vitest";

import { rankHoldingsNews, reasonLabel } from "./news-scoring";
import type { HoldingsNewsItem, HoldingsNewsResponse } from "../hooks/useHoldingsNews";

const AS_OF = "2026-05-22T10:00:00Z";

function item(over: Partial<HoldingsNewsItem> & { id: string; tsHoursAgo?: number }): HoldingsNewsItem {
  const tsHoursAgo = over.tsHoursAgo ?? 1;
  const ts = new Date(new Date(AS_OF).getTime() - tsHoursAgo * 3_600_000).toISOString();
  return {
    id:              over.id,
    ts,
    source:          over.source          ?? "reuters",
    title:           over.title           ?? `Story ${over.id}`,
    sentiment_score: over.sentiment_score ?? 0,
    raw_url:         over.raw_url         ?? null,
  };
}

function payload(over: Partial<HoldingsNewsResponse>): HoldingsNewsResponse {
  return {
    as_of:          AS_OF,
    lookback_hours: 72,
    holdings:       [],
    market_context: [],
    ...over,
  };
}

describe("rankHoldingsNews", () => {
  it("ranks top-holding news above small-holding news at equal sentiment + freshness", () => {
    const out = rankHoldingsNews(payload({
      holdings: [
        { symbol: "RELIANCE", value: 800_000, news: [item({ id: "a" })] },
        { symbol: "SMALLCAP", value:  10_000, news: [item({ id: "b" })] },
      ],
    }));
    expect(out.map((r) => r.news.id)).toEqual(["a", "b"]);
    expect(out[0].reason).toBe("top_holding");
  });

  it("tags bullish / bearish at strong sentiment; falls through to recent when weight + sentiment are both low", () => {
    // X is 10% of the portfolio so weight is below the top_holding cutoff —
    // the sentiment branch fully determines the chip.
    const out = rankHoldingsNews(payload({
      holdings: [
        { symbol: "PAD", value: 900_000, news: [] },
        { symbol: "X",   value: 100_000, news: [
          item({ id: "bull", sentiment_score:  0.8 }),
          item({ id: "bear", sentiment_score: -0.7 }),
          item({ id: "meh",  sentiment_score:  0.1 }),
        ]},
      ],
    }));
    const byId = new Map(out.map((r) => [r.news.id, r]));
    expect(byId.get("bull")!.reason).toBe("bullish");
    expect(byId.get("bear")!.reason).toBe("bearish");
    expect(byId.get("meh")!.reason).toBe("recent");
  });

  it("sentiment beats top_holding chip — bearish on biggest holding still labelled bearish", () => {
    const out = rankHoldingsNews(payload({
      holdings: [{
        symbol: "BIG", value: 1_000_000,
        news: [item({ id: "bad", sentiment_score: -0.9 })],
      }],
    }));
    expect(out[0].reason).toBe("bearish");
  });

  it("dedupes by news id across buckets", () => {
    const shared = item({ id: "dup" });
    const out = rankHoldingsNews(payload({
      holdings: [
        { symbol: "A", value: 100_000, news: [shared] },
        { symbol: "B", value:  50_000, news: [shared] },  // same item, second bucket
      ],
    }));
    expect(out.length).toBe(1);
    expect(out[0].symbol).toBe("A");  // first encounter wins; A had higher weight
  });

  it("ranks fresh negative news on big holding above stale bullish news on tiny holding", () => {
    const out = rankHoldingsNews(payload({
      holdings: [
        { symbol: "BIG",   value: 900_000, news: [item({ id: "fresh-bad",  sentiment_score: -0.6, tsHoursAgo:  2 })] },
        { symbol: "TINY",  value:  50_000, news: [item({ id: "stale-good", sentiment_score:  0.9, tsHoursAgo: 70 })] },
      ],
    }));
    expect(out[0].news.id).toBe("fresh-bad");
  });

  it("market_context appears in the feed with reason='market_context'", () => {
    const out = rankHoldingsNews(payload({
      holdings:       [{ symbol: "X", value: 100_000, news: [item({ id: "h" })] }],
      market_context: [item({ id: "m", sentiment_score: 0.4 })],
    }));
    const m = out.find((r) => r.news.id === "m");
    expect(m).toBeDefined();
    expect(m!.reason).toBe("market_context");
    expect(m!.symbol).toBeNull();
  });

  it("returns empty list when no news anywhere", () => {
    const out = rankHoldingsNews(payload({ holdings: [{ symbol: "X", value: 1, news: [] }] }));
    expect(out).toEqual([]);
  });
});

describe("reasonLabel", () => {
  it("maps every chip to a short label", () => {
    expect(reasonLabel("top_holding")).toBe("Top holding");
    expect(reasonLabel("bullish")).toBe("Bullish");
    expect(reasonLabel("bearish")).toBe("Bearish");
    expect(reasonLabel("market_context")).toBe("Market");
    expect(reasonLabel("recent")).toBe("Recent");
  });
});

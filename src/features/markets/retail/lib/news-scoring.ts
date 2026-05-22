/**
 * News scoring + flattening for the retail "For your portfolio" feed (T20).
 *
 * Inputs: the `/v1/retail/holdings-news` response (already bucketed per
 * top-3 holding, sorted by holding value descending) + an `asOf` clock.
 * Output: a flat list of items ranked by composite relevance, each tagged
 * with a one-line reason chip the UI can render verbatim.
 *
 * No worker change. All scoring lives here so the heuristic is testable
 * and editable without redeploying Python.
 */

import type {
  HoldingsNewsBucket,
  HoldingsNewsItem,
  HoldingsNewsResponse,
} from "../hooks/useHoldingsNews";

export type ReasonChip =
  | "top_holding"
  | "bullish"
  | "bearish"
  | "market_context"
  | "recent";

export interface RankedNewsItem {
  /** Same shape the carousel already consumes. */
  news:            HoldingsNewsItem;
  /** Originating symbol — null only for `market_context` items. */
  symbol:          string | null;
  /** Fraction of total portfolio value held in this symbol (0..1). 0 for market context. */
  portfolioWeight: number;
  /** Composite relevance score in [0,1] used for sorting. */
  score:           number;
  /** UI-facing reason this item ranks where it does. */
  reason:          ReasonChip;
}

interface ScoreOpts {
  /** ISO timestamp the worker stamped on the response. Falls back to now. */
  asOf:           string;
  /** Lookback the worker used — clamps the freshness curve. */
  lookbackHours:  number;
  /** Sum of all bucket values — used to compute portfolio weight. */
  totalValue:     number;
}

const WEIGHT_PORTFOLIO   = 0.5;
const WEIGHT_SENTIMENT   = 0.3;
const WEIGHT_FRESHNESS   = 0.2;
const TOP_HOLDING_CUTOFF = 0.2;   // >20% of portfolio → "top holding" chip
const STRONG_SENTIMENT   = 0.5;   // |sentiment| above this → bullish/bearish chip

function freshness(item: HoldingsNewsItem, opts: ScoreOpts): number {
  const itemMs = new Date(item.ts).getTime();
  const asOfMs = new Date(opts.asOf).getTime();
  if (!Number.isFinite(itemMs) || !Number.isFinite(asOfMs)) return 0;
  const ageHours = Math.max(0, (asOfMs - itemMs) / 3_600_000);
  const window   = Math.max(1, opts.lookbackHours);
  return Math.max(0, 1 - ageHours / window);
}

function magnitudeSentiment(item: HoldingsNewsItem): number {
  const s = item.sentiment_score;
  if (s === null || s === undefined || !Number.isFinite(s)) return 0;
  return Math.min(1, Math.abs(s));
}

function reasonFor(
  weight:        number,
  item:          HoldingsNewsItem,
  isMarketCtx:   boolean,
): ReasonChip {
  if (isMarketCtx) return "market_context";
  // Sentiment beats top_holding — a bearish story on your biggest holding
  // is the most actionable signal, so surface it as "Bearish" not "Top
  // holding". The portfolio-weight contribution to the *score* still
  // ranks top-holding items first; the chip only changes the labelling.
  const s = item.sentiment_score;
  if (s !== null && s !== undefined && Number.isFinite(s)) {
    if (s >=  STRONG_SENTIMENT) return "bullish";
    if (s <= -STRONG_SENTIMENT) return "bearish";
  }
  if (weight >= TOP_HOLDING_CUTOFF) return "top_holding";
  return "recent";
}

/**
 * Walk the bucketed payload, score each headline, return a single flat
 * list ranked by score descending. Caller decides how many to render.
 */
export function rankHoldingsNews(
  payload: HoldingsNewsResponse,
): RankedNewsItem[] {
  const totalValue = payload.holdings.reduce((acc, h) => acc + (h.value || 0), 0);
  const opts: ScoreOpts = {
    asOf:          payload.as_of,
    lookbackHours: payload.lookback_hours,
    totalValue,
  };

  const out: RankedNewsItem[] = [];
  const seen = new Set<string>();  // dedupe headlines that appear in multiple buckets

  const push = (
    item:        HoldingsNewsItem,
    symbol:      string | null,
    weight:      number,
    isMarketCtx: boolean,
  ) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);

    const score =
      WEIGHT_PORTFOLIO * weight +
      WEIGHT_SENTIMENT * magnitudeSentiment(item) +
      WEIGHT_FRESHNESS * freshness(item, opts);

    out.push({
      news:            item,
      symbol,
      portfolioWeight: weight,
      score,
      reason:          reasonFor(weight, item, isMarketCtx),
    });
  };

  for (const bucket of payload.holdings) {
    const weight = totalValue > 0 ? (bucket.value || 0) / totalValue : 0;
    for (const item of bucket.news) {
      push(item, bucket.symbol, weight, false);
    }
  }

  // Market-context items get a small floor — present but always below
  // anything tied to actual holdings unless they're freshly published.
  for (const item of payload.market_context ?? []) {
    push(item, null, 0, true);
  }

  return out.sort((a, b) => b.score - a.score);
}

export function reasonLabel(reason: ReasonChip): string {
  switch (reason) {
    case "top_holding":    return "Top holding";
    case "bullish":        return "Bullish";
    case "bearish":        return "Bearish";
    case "market_context": return "Market";
    case "recent":         return "Recent";
  }
}

/** Used by tests + the bucket-finder when explaining "you hold X% of this". */
export function bucketByIdSet(payload: HoldingsNewsResponse): Map<string, HoldingsNewsBucket> {
  const m = new Map<string, HoldingsNewsBucket>();
  for (const b of payload.holdings) m.set(b.symbol, b);
  return m;
}

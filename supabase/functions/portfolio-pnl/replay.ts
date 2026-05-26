/**
 * Pure-functional transactions-replay used by the portfolio-pnl edge function.
 *
 * Ported from services/markets-worker/src/markets_worker/routers/portfolio_pnl.py
 * (lines 156-336 + the `_pnl_response` helper at line 123). Same algorithm,
 * same rounding, same edge-case behaviour:
 *
 *   - Walks each price-history date in ascending order.
 *   - Applies every transaction whose txn_date <= that date before computing
 *     the day's NAV (so a trade booked mid-month shows up on its trade date).
 *   - Tracks per-instrument holdings as {qty, total_cost, realized_pnl} and
 *     splits realized vs unrealized using a weighted-average cost basis.
 *   - Treats {buy, sip, transfer_in, bonus} as buys and {sell, redemption,
 *     transfer_out} as sells (the txn_type taxonomy in markets.transactions).
 *   - When no close price exists on a given date for a held instrument, the
 *     average cost is used as a fallback so the series doesn't drop a day
 *     (matches Python — NAV == invested on those points, zero PnL).
 *   - Emits a series row only on days with open positions.
 *
 * Kept pure so the same vitest cases that cover the Python version (see
 * services/markets-worker/tests/test_portfolio_pnl.py) can be re-used as
 * a TS test surface later.
 */

export const BUY_TYPES  = new Set(['buy', 'sip', 'transfer_in', 'bonus']);
export const SELL_TYPES = new Set(['sell', 'redemption', 'transfer_out']);

export interface RawTxn {
  txn_date:      string | Date;
  instrument_id: string | null;
  txn_type:      string | null;
  qty:           number | string | null;
  price:         number | string | null;
  charges:       number | string | null;
}

export interface PriceRow {
  instrument_id: string;
  ts:            string;
  close:         number | string;
}

export interface PnLPoint {
  date:     string;
  nav:      number;
  invested: number;
  pnl:      number;
  pnl_pct:  number;
}

export interface PnLSummary {
  current_nav:    number;
  total_invested: number;
  total_pnl:      number;
  pnl_pct:        number;
  realized_pnl:   number;
  unrealized_pnl: number;
}

export interface PnLData {
  portfolio_id: string;
  series:       PnLPoint[];
  summary:      PnLSummary;
}

interface Holding {
  qty:          number;
  total_cost:   number;
  realized_pnl: number;
}

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function emptyResponse(portfolio_id: string): PnLData {
  return {
    portfolio_id,
    series: [],
    summary: {
      current_nav:    0,
      total_invested: 0,
      total_pnl:      0,
      pnl_pct:        0,
      realized_pnl:   0,
      unrealized_pnl: 0,
    },
  };
}

export function buildPnLResponse(
  portfolio_id: string,
  series: PnLPoint[],
  realizedTotal: number,
): PnLData {
  if (series.length === 0) return emptyResponse(portfolio_id);
  const last = series[series.length - 1];
  const unrealized = last.pnl - realizedTotal;
  return {
    portfolio_id,
    series,
    summary: {
      current_nav:    last.nav,
      total_invested: last.invested,
      total_pnl:      last.pnl,
      pnl_pct:        last.pnl_pct,
      realized_pnl:   r4(realizedTotal),
      unrealized_pnl: r4(unrealized),
    },
  };
}

export function replayPnL(
  portfolio_id: string,
  txns: RawTxn[],
  priceRows: PriceRow[],
): PnLData {
  if (txns.length === 0) return emptyResponse(portfolio_id);

  // 1. Pre-parse + sort transactions by date (ascending).
  const parsedTxns = txns.map(t => ({
    txn_date:      typeof t.txn_date === 'string' ? t.txn_date.slice(0, 10)
                  : new Date(t.txn_date as any).toISOString().slice(0, 10),
    instrument_id: t.instrument_id ?? '',
    txn_type:      (t.txn_type ?? '').toLowerCase(),
    qty:           Number(t.qty)     || 0,
    price:         Number(t.price)   || 0,
    charges:       Number(t.charges) || 0,
  }));
  parsedTxns.sort((a, b) => a.txn_date.localeCompare(b.txn_date));

  // 2. Build price lookup: "instrument_id|YYYY-MM-DD" → close.
  const priceDict = new Map<string, number>();
  const priceDateSet = new Set<string>();
  for (const row of priceRows) {
    const ts = String(row.ts).slice(0, 10);
    priceDict.set(`${row.instrument_id}|${ts}`, Number(row.close));
    priceDateSet.add(ts);
  }
  if (priceDateSet.size === 0) return emptyResponse(portfolio_id);
  const priceDates = Array.from(priceDateSet).sort();

  // 3. Replay day by day.
  const holdings = new Map<string, Holding>();
  let txnIdx = 0;
  const series: PnLPoint[] = [];
  let totalRealized = 0;

  for (const priceDate of priceDates) {
    while (txnIdx < parsedTxns.length && parsedTxns[txnIdx].txn_date <= priceDate) {
      const t = parsedTxns[txnIdx++];
      const iid = t.instrument_id;
      if (!iid) continue;

      let h = holdings.get(iid);
      if (!h) { h = { qty: 0, total_cost: 0, realized_pnl: 0 }; holdings.set(iid, h); }

      if (BUY_TYPES.has(t.txn_type)) {
        h.qty        += t.qty;
        h.total_cost += t.qty * t.price + t.charges;
      } else if (SELL_TYPES.has(t.txn_type) && h.qty > 0) {
        const qtySold = Math.min(t.qty, h.qty);
        const avg = h.qty > 0 ? h.total_cost / h.qty : 0;
        const realized = qtySold * (t.price - avg) - t.charges;
        h.realized_pnl += realized;
        totalRealized  += realized;
        h.total_cost   -= qtySold * avg;
        h.qty          -= qtySold;
        if (h.qty <= 0) { h.qty = 0; h.total_cost = 0; }
      }
    }

    if (holdings.size === 0) continue;

    let nav = 0, invested = 0, realizedSum = 0, hasPosition = false;
    for (const [iid, h] of holdings) {
      if (h.qty <= 0) continue;
      let close = priceDict.get(`${iid}|${priceDate}`);
      if (close == null) {
        close = h.qty > 0 ? h.total_cost / h.qty : 0;
      }
      nav         += h.qty * close;
      invested    += h.total_cost;
      realizedSum += h.realized_pnl;
      hasPosition = true;
    }
    if (!hasPosition) continue;

    const pnl    = nav - invested + realizedSum;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    series.push({
      date:     priceDate,
      nav:      r4(nav),
      invested: r4(invested),
      pnl:      r4(pnl),
      pnl_pct:  r4(pnlPct),
    });
  }

  return buildPnLResponse(portfolio_id, series, totalRealized);
}

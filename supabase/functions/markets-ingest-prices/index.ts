// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-prices — fetches EOD OHLCV from Yahoo Finance for all
// active equity/ETF/index instruments and upserts into markets.price_history.
//
// POST { range?: "5d"|"30d"|"90d"|"1y", symbols?: string[] }
//   range    — Yahoo Finance chart range (default "5d" for daily cron)
//   symbols  — restrict to these NSE/BSE symbols (default: all active)
//
// Auth: service-role OR admin (same as other ingest functions).
//
// Yahoo Finance v8 chart API — free, no key needed.
//   NSE equities/ETFs → {SYMBOL}.NS
//   BSE equities      → {SYMBOL}.BO
//   NSE/BSE indices   → special tickers (^NSEI, ^BSESN, etc.)
//
// Timestamps are normalised to midnight IST (00:00:00+05:30) so every
// data source produces the same ts for the same trading day, making the
// (instrument_id, ts) unique constraint a reliable dedup key.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Yahoo Finance tickers for indices (no exchange suffix applies).
// Tickers marked null are not available on YF — those instruments are skipped.
const INDEX_YF_MAP: Record<string, string | null> = {
  "NIFTY 50":          "^NSEI",
  "NIFTY BANK":        "^NSEBANK",
  "NIFTY IT":          "^CNXIT",
  "NIFTY AUTO":        "^CNXAUTO",
  "NIFTY FMCG":        "^CNXFMCG",
  "NIFTY PHARMA":      "^CNXPHARMA",
  "NIFTY MIDCAP 100":  null,   // no stable YF ticker found
  "NIFTY NEXT 50":     null,   // no stable YF ticker found
  "NIFTY SMALLCAP 100":null,   // no stable YF ticker found
  "SENSEX":            "^BSESN",
  "BANKEX":            null,   // BSE sector index, not on YF
};

// NSE/BSE symbols whose Yahoo Finance ticker differs from the exchange symbol.
const SYMBOL_YF_OVERRIDE: Record<string, string> = {
  // Add overrides as discovered, e.g. "OLDNAME": "NEWNAME.NS"
};

// Symbols skipped without counting as failure (unavailable on Yahoo Finance).
// LTIM       — LTIMindtree has no Yahoo Finance listing under any tested ticker.
// TATAMOTORS — both TATAMOTORS.NS and TATAMOTOR.NS return Not Found from edge IPs.
const SYMBOL_YF_SKIP = new Set(["LTIM", "TATAMOTORS"]);

const BATCH_SIZE = 10;           // parallel fetches per batch
const DEFAULT_RANGE = "5d";
const VALID_RANGES = new Set(["5d", "30d", "90d", "1y"]);

interface InstrumentRow { id: string; symbol: string; exchange: string; instrument_type: string; }

interface PriceRow {
  instrument_id: string;
  ts: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: string;
}

interface IngestResult {
  fetched_instruments: number;
  skipped_no_ticker: number;
  inserted_rows: number;
  failed_symbols: string[];
  duration_ms: number;
}

// Maps a DB instrument to a Yahoo Finance ticker string.
// Returns null for instruments with no known YF mapping.
function toYfTicker(symbol: string, exchange: string, instrumentType: string): string | null {
  if (SYMBOL_YF_SKIP.has(symbol)) return null;
  if (SYMBOL_YF_OVERRIDE[symbol]) return SYMBOL_YF_OVERRIDE[symbol];
  if (instrumentType === "index") return INDEX_YF_MAP[symbol] ?? null;
  // Encode special characters that break URLs (& in M&M)
  const safe = symbol.replace(/&/g, "%26");
  return safe + (exchange === "BSE" ? ".BO" : ".NS");
}

// Normalize a Unix-second timestamp to midnight IST as an ISO string.
// Using a fixed anchor ensures every source emits the same ts for the
// same trading day, so (instrument_id, ts) deduplication works reliably.
function toIstMidnight(unixSeconds: number): string {
  // Shift to IST (UTC+5:30 = +330 min), extract Y-M-D, anchor to 00:00:00+05:30
  const ist = new Date((unixSeconds + 330 * 60) * 1000);
  const y  = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}T00:00:00+05:30`;
}

// Fetch one ticker from Yahoo Finance v8 chart API.
// Returns an array of price rows (instrument_id left empty; caller fills it).
// Returns null on any error (logged by caller).
async function fetchYfChart(ticker: string, range: string): Promise<Omit<PriceRow, "instrument_id">[] | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}&includePrePost=false`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SOS-Nexus markets-ingest-prices/1.0; +https://sos-nexus.example)",
        "Accept": "application/json",
      },
    });
  } catch {
    return null;
  }

  if (!resp.ok) return null;

  let json: any;
  try { json = await resp.json(); } catch { return null; }

  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[]       = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const opens:   (number | null)[] = q.open   ?? [];
  const highs:   (number | null)[] = q.high   ?? [];
  const lows:    (number | null)[] = q.low    ?? [];
  const closes:  (number | null)[] = q.close  ?? [];
  const volumes: (number | null)[] = q.volume ?? [];

  if (timestamps.length === 0) return null;

  return timestamps
    .map((ts, i) => {
      const c = closes[i];
      if (c == null) return null;          // skip candles with no close (holiday/weekend leak)
      return {
        ts: toIstMidnight(ts),
        open:   opens[i]   != null ? Math.round(opens[i]!   * 100) / 100 : null,
        high:   highs[i]   != null ? Math.round(highs[i]!   * 100) / 100 : null,
        low:    lows[i]    != null ? Math.round(lows[i]!    * 100) / 100 : null,
        close:  Math.round(c * 100) / 100,
        volume: volumes[i] != null ? Math.round(volumes[i]!)           : null,
        source: "yahoo_finance",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const t0 = Date.now();

  try {
    const auth = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: jsonHeaders });
    }

    // ─── Parse request ────────────────────────────────────────────────
    let range = DEFAULT_RANGE;
    let requestedSymbols: string[] | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.range === "string" && VALID_RANGES.has(body.range)) range = body.range;
        if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
          requestedSymbols = body.symbols.filter((s: unknown) => typeof s === "string");
        }
      } catch { /* no body → defaults */ }
    }

    // ─── Load instruments ─────────────────────────────────────────────
    let q = (supabaseAdmin as any)
      .schema("markets")
      .from("instruments")
      .select("id, symbol, exchange, instrument_type")
      .eq("is_active", true)
      .in("instrument_type", ["equity", "etf", "index"]);

    if (requestedSymbols?.length) q = q.in("symbol", requestedSymbols);

    const { data: instruments, error: instrErr } = await q;
    if (instrErr) {
      logger.error("instruments load failed", { error: instrErr.message });
      return new Response(JSON.stringify({ error: instrErr.message }), { status: 500, headers: jsonHeaders });
    }

    const rows: InstrumentRow[] = instruments ?? [];
    logger.info("markets-ingest-prices start", { count: rows.length, range });

    // ─── Batch-fetch from Yahoo Finance ───────────────────────────────
    const failed: string[] = [];
    let skipped = 0;
    let insertedTotal = 0;

    const batches: InstrumentRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchRows = await Promise.all(
        batch.map(async (inst): Promise<PriceRow[]> => {
          const ticker = toYfTicker(inst.symbol, inst.exchange, inst.instrument_type);
          if (!ticker) { skipped++; return []; }

          const prices = await fetchYfChart(ticker, range);
          if (!prices || prices.length === 0) {
            failed.push(inst.symbol);
            logger.warn("yf fetch failed or empty", { symbol: inst.symbol, ticker });
            return [];
          }

          return prices.map(p => ({ ...p, instrument_id: inst.id }));
        }),
      );

      const allRows = batchRows.flat();
      if (allRows.length === 0) continue;

      const { data: inserted, error: upsertErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("price_history")
        .upsert(allRows, { onConflict: "instrument_id,ts", ignoreDuplicates: false })
        .select("instrument_id");

      if (upsertErr) {
        logger.error("price upsert batch failed", { error: upsertErr.message, rows: allRows.length });
      } else {
        insertedTotal += (inserted ?? []).length;
      }
    }

    const result: IngestResult = {
      fetched_instruments: rows.length - skipped - failed.length,
      skipped_no_ticker: skipped,
      inserted_rows: insertedTotal,
      failed_symbols: failed,
      duration_ms: Date.now() - t0,
    };

    logger.info("markets-ingest-prices done", result);
    return new Response(JSON.stringify(result), { headers: jsonHeaders });
  } catch (e: any) {
    logger.error("markets-ingest-prices unhandled", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-ingest-prices");

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-prices — multi-provider EOD price ingestion.
//
// POST {
//   range?:    "5d" | "30d" | "90d" | "1y"  (default "5d")
//   provider?: "auto" | "nse" | "yahoo"       (default "auto")
//   symbols?:  string[]                        (default: all active)
// }
//
// Provider priority (auto mode):
//   1. NSE Bhav copy  — official NSE EOD data, free, no auth.
//                        One CSV per trading day covers all ~2000 NSE equities.
//                        Available ~18:00 IST each trading day.
//                        URL: nsearchives.nseindia.com/products/content/sec_bhavdata_full_DDMMYYYY.csv
//   2. Yahoo Finance  — fallback for BSE-only instruments, indices, and any
//                        symbol not found in the NSE Bhav on a given day.
//
// The source column in price_history records which provider populated each row.
// Timestamps are normalised to midnight IST (00:00:00+05:30) for idempotent upserts.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ─── Provider config ──────────────────────────────────────────────────────────

type ProviderChoice = "auto" | "nse" | "yahoo";
const VALID_PROVIDERS = new Set<ProviderChoice>(["auto", "nse", "yahoo"]);
const VALID_RANGES    = new Set(["5d", "30d", "90d", "1y"]);
const DEFAULT_RANGE   = "5d";
const NSE_BATCH_SIZE  = 5;   // parallel Bhav CSV fetches
const YF_BATCH_SIZE   = 10;  // parallel Yahoo Finance fetches

// Yahoo Finance index tickers for NSE/BSE indices
const INDEX_YF_MAP: Record<string, string | null> = {
  "NIFTY 50":          "^NSEI",
  "NIFTY BANK":        "^NSEBANK",
  "NIFTY IT":          "^CNXIT",
  "NIFTY AUTO":        "^CNXAUTO",
  "NIFTY FMCG":        "^CNXFMCG",
  "NIFTY PHARMA":      "^CNXPHARMA",
  "NIFTY MIDCAP 100":  null,
  "NIFTY NEXT 50":     null,
  "NIFTY SMALLCAP 100":null,
  "SENSEX":            "^BSESN",
  "BANKEX":            null,
};

// Symbols with no reliable Yahoo Finance data from edge-function IPs.
const YF_SKIP = new Set(["LTIM", "TATAMOTORS"]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstrumentRow {
  id: string;
  symbol: string;
  exchange: string;
  instrument_type: string;
}

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

interface BhavEntry {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IngestResult {
  provider_used: string;
  fetched_instruments: number;
  skipped_no_data: number;
  inserted_rows: number;
  failed_symbols: string[];
  duration_ms: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalise any Unix-second timestamp to midnight IST for consistent dedup.
function toIstMidnight(unixSeconds: number): string {
  const ist = new Date((unixSeconds + 330 * 60) * 1000);
  const y  = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}T00:00:00+05:30`;
}

// Normalise a Date object (already IST-aware) to midnight IST string.
function dateToIstMidnight(date: Date): string {
  const y  = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}T00:00:00+05:30`;
}

// Return the last N weekday dates in IST (most recent first).
// We work in IST by biasing the current UTC time by +330 minutes.
function recentTradingDays(n: number): Date[] {
  const days: Date[] = [];
  // Current IST date as a UTC midnight
  const nowIst = new Date(Date.now() + 330 * 60 * 1000);
  const cur = new Date(Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate(),
  ));
  let scanned = 0;
  while (days.length < n && scanned < n * 3) {
    const dow = cur.getUTCDay(); // 0=Sun, 6=Sat
    if (dow >= 1 && dow <= 5) days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() - 1);
    scanned++;
  }
  return days;
}

// Convert "5d" → 5, "30d" → 30, "90d" → 90, "1y" → 252 (trading days).
function rangeToDays(range: string): number {
  if (range === "1y") return 252;
  return parseInt(range, 10);
}

// ─── NSE Bhav provider ────────────────────────────────────────────────────────

// Build the Bhav copy URL for a given IST date.
function nseBhavUrl(date: Date): string {
  const dd   = String(date.getUTCDate()).padStart(2, "0");
  const mm   = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`;
}

// Parse the sec_bhavdata_full CSV.
// Columns: SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE,
//          LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, ...
// We keep only SERIES = "EQ" (main equity series; ETFs also use "EQ").
function parseBhavCsv(csv: string): Map<string, BhavEntry> {
  const result = new Map<string, BhavEntry>();
  const lines = csv.split("\n");
  if (lines.length < 2) return result;

  // Parse header to get column indices robustly
  const header = lines[0].split(",").map(h => h.trim().toUpperCase());
  const col = (name: string) => header.indexOf(name);
  const iSym   = col("SYMBOL");
  const iSer   = col("SERIES");
  const iOpen  = col("OPEN_PRICE");
  const iHigh  = col("HIGH_PRICE");
  const iLow   = col("LOW_PRICE");
  const iClose = col("CLOSE_PRICE");
  const iVol   = col("TTL_TRD_QNTY");

  if (iSym < 0 || iClose < 0) return result; // unrecognised format

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    const series = cols[iSer]?.trim();
    if (series !== "EQ") continue;        // equity series only
    const symbol = cols[iSym]?.trim();
    if (!symbol) continue;
    const open  = parseFloat(cols[iOpen]  ?? "");
    const high  = parseFloat(cols[iHigh]  ?? "");
    const low   = parseFloat(cols[iLow]   ?? "");
    const close = parseFloat(cols[iClose] ?? "");
    const vol   = parseFloat(cols[iVol]   ?? "");
    if (!isFinite(close)) continue;
    result.set(symbol, {
      open:   isFinite(open)  ? Math.round(open  * 100) / 100 : close,
      high:   isFinite(high)  ? Math.round(high  * 100) / 100 : close,
      low:    isFinite(low)   ? Math.round(low   * 100) / 100 : close,
      close:  Math.round(close * 100) / 100,
      volume: isFinite(vol)   ? Math.round(vol)                : 0,
    });
  }
  return result;
}

// Fetch a single NSE Bhav copy. Returns null for 404 (holiday/future date).
async function fetchNseBhavDay(date: Date): Promise<Map<string, BhavEntry> | null> {
  const url = nseBhavUrl(date);
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SOS-Nexus markets-ingest-prices/2.0)",
        "Accept":     "text/csv,text/plain,*/*",
        "Referer":    "https://www.nseindia.com",
      },
    });
  } catch { return null; }

  if (resp.status === 404) return null;  // holiday / not yet published
  if (!resp.ok) return null;

  const text = await resp.text().catch(() => null);
  if (!text) return null;
  return parseBhavCsv(text);
}

// Fetch NSE Bhav data for the last `days` trading days.
// Returns a map of date ISO strings → symbol → BhavEntry.
async function fetchNseBhavRange(
  days: number,
): Promise<Map<string, Map<string, BhavEntry>>> {
  const tradingDays = recentTradingDays(days);
  const result = new Map<string, Map<string, BhavEntry>>();

  // Process in batches to avoid overwhelming NSE servers
  for (let i = 0; i < tradingDays.length; i += NSE_BATCH_SIZE) {
    const batch = tradingDays.slice(i, i + NSE_BATCH_SIZE);
    const fetched = await Promise.all(
      batch.map(async (d) => ({ date: d, bhav: await fetchNseBhavDay(d) })),
    );
    for (const { date, bhav } of fetched) {
      if (bhav && bhav.size > 0) {
        result.set(dateToIstMidnight(date), bhav);
      }
    }
  }
  return result;
}

// ─── Yahoo Finance provider ───────────────────────────────────────────────────

function toYfTicker(symbol: string, exchange: string, instrumentType: string): string | null {
  if (YF_SKIP.has(symbol)) return null;
  if (instrumentType === "index") return INDEX_YF_MAP[symbol] ?? null;
  const safe = symbol.replace(/&/g, "%26");
  return safe + (exchange === "BSE" ? ".BO" : ".NS");
}

async function fetchYfChart(ticker: string, range: string): Promise<Omit<PriceRow, "instrument_id">[] | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}&includePrePost=false`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SOS-Nexus markets-ingest-prices/2.0)",
        "Accept":     "application/json",
      },
    });
  } catch { return null; }
  if (!resp.ok) return null;
  let json: any;
  try { json = await resp.json(); } catch { return null; }
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const timestamps: number[]       = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const opens:  (number | null)[] = q.open   ?? [];
  const highs:  (number | null)[] = q.high   ?? [];
  const lows:   (number | null)[] = q.low    ?? [];
  const closes: (number | null)[] = q.close  ?? [];
  const vols:   (number | null)[] = q.volume ?? [];
  return timestamps
    .map((ts, i) => {
      const c = closes[i];
      if (c == null) return null;
      return {
        ts:     toIstMidnight(ts),
        open:   opens[i]  != null ? Math.round(opens[i]!  * 100) / 100 : null,
        high:   highs[i]  != null ? Math.round(highs[i]!  * 100) / 100 : null,
        low:    lows[i]   != null ? Math.round(lows[i]!   * 100) / 100 : null,
        close:  Math.round(c * 100) / 100,
        volume: vols[i]   != null ? Math.round(vols[i]!)           : null,
        source: "yahoo_finance",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const t0 = Date.now();

  try {
    const auth = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: jsonHeaders });
    }

    // ─── Parse request ──────────────────────────────────────────────────
    let range: string = DEFAULT_RANGE;
    let provider: ProviderChoice = "auto";
    let requestedSymbols: string[] | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.range === "string" && VALID_RANGES.has(body.range)) range = body.range;
        if (typeof body?.provider === "string" && VALID_PROVIDERS.has(body.provider as ProviderChoice)) {
          provider = body.provider as ProviderChoice;
        }
        if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
          requestedSymbols = body.symbols.filter((s: unknown) => typeof s === "string");
        }
      } catch { /* defaults */ }
    }

    // ─── Load instruments ───────────────────────────────────────────────
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

    const allInstruments: InstrumentRow[] = instruments ?? [];
    logger.info("markets-ingest-prices start", { count: allInstruments.length, range, provider });

    const failed: string[] = [];
    let skipped = 0;
    let insertedTotal = 0;
    const providerUsed: string[] = [];

    // Separate NSE equity/ETF instruments from others (indices, BSE-only)
    const nseInstruments = allInstruments.filter(
      i => i.exchange === "NSE" && i.instrument_type !== "index",
    );
    const otherInstruments = allInstruments.filter(
      i => !(i.exchange === "NSE" && i.instrument_type !== "index"),
    );

    const allPriceRows: PriceRow[] = [];
    const nseSymbolsFetched = new Set<string>();

    // ─── Pass 1: NSE Bhav copy ──────────────────────────────────────────
    if (provider !== "yahoo" && nseInstruments.length > 0) {
      const days = rangeToDays(range);
      logger.info("fetching NSE Bhav copies", { trading_days: days });

      const bhavByDate = await fetchNseBhavRange(days);
      const datesLoaded = bhavByDate.size;

      if (datesLoaded > 0) {
        providerUsed.push("nse_bhav");
        for (const [ts, dayBhav] of bhavByDate) {
          for (const inst of nseInstruments) {
            const entry = dayBhav.get(inst.symbol);
            if (!entry) continue;
            allPriceRows.push({
              instrument_id: inst.id,
              ts,
              open:   entry.open,
              high:   entry.high,
              low:    entry.low,
              close:  entry.close,
              volume: entry.volume,
              source: "nse_bhav",
            });
            nseSymbolsFetched.add(inst.symbol);
          }
        }
        logger.info("NSE Bhav loaded", { dates: datesLoaded, rows: allPriceRows.length });
      } else {
        logger.warn("no NSE Bhav data available (not yet published?); falling back to Yahoo Finance");
      }
    }

    // ─── Pass 2: Yahoo Finance fallback ────────────────────────────────
    // Covers: (a) indices, (b) BSE-only instruments, (c) NSE instruments
    // not found in Bhav (new listings, provider=yahoo override)
    const yfTargets = [
      ...otherInstruments,
      // NSE instruments that Bhav didn't return data for
      ...(provider !== "yahoo"
        ? nseInstruments.filter(i => !nseSymbolsFetched.has(i.symbol))
        : nseInstruments),
    ];

    if (yfTargets.length > 0) {
      if (!providerUsed.includes("yahoo_finance")) providerUsed.push("yahoo_finance");
      const batches: InstrumentRow[][] = [];
      for (let i = 0; i < yfTargets.length; i += YF_BATCH_SIZE) {
        batches.push(yfTargets.slice(i, i + YF_BATCH_SIZE));
      }

      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (inst): Promise<PriceRow[]> => {
            const ticker = toYfTicker(inst.symbol, inst.exchange, inst.instrument_type);
            if (!ticker) { skipped++; return []; }
            const rows = await fetchYfChart(ticker, range);
            if (!rows || rows.length === 0) {
              failed.push(inst.symbol);
              return [];
            }
            return rows.map(r => ({ ...r, instrument_id: inst.id }));
          }),
        );
        allPriceRows.push(...results.flat());
      }
    }

    // ─── Upsert all collected rows ──────────────────────────────────────
    if (allPriceRows.length > 0) {
      // Upsert in chunks of 500 to avoid PostgREST body size limits
      const CHUNK = 500;
      for (let i = 0; i < allPriceRows.length; i += CHUNK) {
        const chunk = allPriceRows.slice(i, i + CHUNK);
        const { data: inserted, error: upsertErr } = await (supabaseAdmin as any)
          .schema("markets")
          .from("price_history")
          .upsert(chunk, { onConflict: "instrument_id,ts", ignoreDuplicates: false })
          .select("instrument_id");

        if (upsertErr) {
          logger.error("price upsert failed", { error: upsertErr.message, chunk_size: chunk.length });
        } else {
          insertedTotal += (inserted ?? []).length;
        }
      }
    }

    const result: IngestResult = {
      provider_used:       providerUsed.join("+") || "none",
      fetched_instruments: allInstruments.length - skipped - failed.length,
      skipped_no_data:     skipped,
      inserted_rows:       insertedTotal,
      failed_symbols:      failed,
      duration_ms:         Date.now() - t0,
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

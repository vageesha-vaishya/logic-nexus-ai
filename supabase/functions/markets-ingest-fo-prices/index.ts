// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-fo-prices
//
// Fetches the NSE F&O Bhav copy CSV and upserts to:
//   markets.instruments  (futures + options as distinct rows)
//   markets.price_history (settle price as close)
//
// NSE F&O Bhav URL:
//   https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_DDMMYYYY_F_0000.csv
//
// CSV columns:
//   INSTRUMENT, SYMBOL, EXPIRY_DT, STRIKE_PR, OPTION_TYP,
//   OPEN, HIGH, LOW, CLOSE, SETTLE_PR, CONTRACTS, VAL_INLAKH,
//   OPEN_INT, CHG_IN_OI, TIMESTAMP
//
// INSTRUMENT types included:
//   FUTIDX  → index futures          (all)
//   FUTSTK  → stock futures          (all)
//   OPTIDX  → index options          (all — liquid)
//   OPTSTK  → individual stock opts  (skipped — too many ~100k contracts)
//
// Cron: daily 13:05 UTC (18:35 IST) — same window as equity Bhav.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const NSE_ARCHIVE = "https://nsearchives.nseindia.com/content/fo";
const CHUNK       = 300;

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; logic-nexus-fo/1.0)",
  "Accept": "text/csv,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.nseindia.com/",
  "Origin": "https://www.nseindia.com",
};

// ── Helpers ──────────────────────────────────────────────────────────────
function recentTradingDays(n: number): Date[] {
  const days: Date[] = [];
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const d = new Date(ist);
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(d));
  }
  return days;
}

function pad2(n: number): string { return n.toString().padStart(2, "0"); }

function toNseDateStr(d: Date): string {
  const dd   = pad2(d.getDate());
  const mm   = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

// "27-Feb-2025" → "2025-02-27"
const MON_MAP: Record<string, string> = {
  Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
  Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
};
function parseExpiry(s: string): string | null {
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${MON_MAP[m[2]] ?? "01"}-${m[1]}`;
}

// Build the instrument symbol used as unique identifier
// e.g. NIFTY_27FEB2025_FUT  or  NIFTY_27FEB2025_22000_CE
function foBhavSymbol(symbol: string, expiry: string, strike: number, optType: string): string {
  const expPart = expiry.replace(/-/g, "").slice(2); // "20250227" → "250227"
  if (optType === "-" || optType === "XX") {
    return `${symbol}_${expPart}_FUT`;
  }
  return `${symbol}_${expPart}_${Math.round(strike)}_${optType}`;
}

function toIstMidnight(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`;
}

async function fetchFoBhavDay(date: Date): Promise<string | null> {
  const ds = toNseDateStr(date);
  const url = `${NSE_ARCHIVE}/BhavCopy_NSE_FO_0_0_0_${ds}_F_0000.csv`;
  try {
    const res = await fetch(url, { headers: NSE_HEADERS });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

type FoRow = {
  instrument: string; symbol: string; expiry: string;
  strike: number; optType: string;
  open: number; high: number; low: number; close: number; settle: number;
  oi: number; contracts: number;
  ts: string; expiryDate: string;
};

function parseFoCsv(csv: string, dateStr: string): FoRow[] {
  const rows: FoRow[] = [];
  const lines = csv.split("\n");
  // Header line varies — find it
  let dataStart = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].trim().toUpperCase().startsWith("INSTRUMENT")) {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < lines.length; i++) {
    const parts = lines[i].trim().split(",");
    if (parts.length < 14) continue;

    const instrument = parts[0].trim().toUpperCase();
    // Only FUTIDX, FUTSTK, OPTIDX — skip OPTSTK (too many contracts)
    if (!["FUTIDX","FUTSTK","OPTIDX"].includes(instrument)) continue;

    const symbol   = parts[1].trim().toUpperCase();
    const expiryRaw = parts[2].trim();
    const strikeRaw = parts[3].trim();
    const optType   = parts[4].trim().toUpperCase(); // CE, PE, or XX/-

    const expiryDate = parseExpiry(expiryRaw);
    if (!expiryDate) continue;

    const strike  = parseFloat(strikeRaw) || 0;
    const open    = parseFloat(parts[5])  || 0;
    const high    = parseFloat(parts[6])  || 0;
    const low     = parseFloat(parts[7])  || 0;
    const close   = parseFloat(parts[8])  || 0;
    const settle  = parseFloat(parts[9])  || close;
    const oi      = parseInt(parts[12])   || 0;
    const contracts = parseInt(parts[10]) || 0;

    if (settle <= 0 && close <= 0) continue;

    rows.push({
      instrument, symbol, expiry: expiryDate,
      strike, optType, open, high, low, close, settle, oi, contracts,
      ts: toIstMidnight(dateStr), expiryDate,
    });
  }
  return rows;
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { authorized, status, error: authErr } =
    await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
  if (!authorized)
    return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const jsonH = { ...corsHeaders, "Content-Type": "application/json" };

  let body: any = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { /* ok */ }

  const rangeDays = typeof body?.range === "number" ? Math.min(body.range, 30) : 5;

  try {
    const marketsAdmin = (supabaseAdmin as any).schema("markets");

    // Build a lookup: symbol → instrument_id for underlying indices/stocks
    const { data: underlyings } = await marketsAdmin
      .from("instruments")
      .select("id, symbol, exchange")
      .in("instrument_type", ["equity","index","etf"])
      .eq("is_active", true);

    const underlyingMap: Record<string, string> = {};
    for (const u of (underlyings ?? []) as any[]) {
      underlyingMap[`${u.exchange}:${u.symbol}`] = u.id;
      underlyingMap[`NSE:${u.symbol}`] = underlyingMap[`NSE:${u.symbol}`] ?? u.id;
    }

    const tradingDays = recentTradingDays(rangeDays);
    let instrUpserted = 0, priceUpserted = 0, daysProcessed = 0;

    for (const day of tradingDays) {
      const dateStr = `${day.getFullYear()}-${pad2(day.getMonth()+1)}-${pad2(day.getDate())}`;
      const csv = await fetchFoBhavDay(day);
      if (!csv) { logger.info(`FO bhav not found: ${dateStr} (holiday?)`); continue; }

      const rows = parseFoCsv(csv, dateStr);
      if (rows.length === 0) continue;
      daysProcessed++;

      logger.info(`FO bhav parsed: ${dateStr}`, { rows: rows.length });

      // ── Upsert instruments ──────────────────────────────────────────
      const instrRows = rows.map((r) => {
        const foSym     = foBhavSymbol(r.symbol, r.expiryDate, r.strike, r.optType);
        const isFuture  = r.optType === "-" || r.optType === "XX";
        const isIndex   = r.instrument === "FUTIDX" || r.instrument === "OPTIDX";
        const instrType = isFuture
          ? (isIndex ? "index_futures"  : "equity_futures")
          : (isIndex ? "index_options"  : "equity_options");

        return {
          symbol:          foSym,
          exchange:        "NSE_FO",
          instrument_type: instrType,
          asset_class:     "derivative",
          expiry:          r.expiryDate,
          strike:          r.strike > 0 ? r.strike : null,
          option_type:     isFuture ? null : r.optType,
          underlying_id:   underlyingMap[`NSE:${r.symbol}`] ?? null,
          currency_code:   "INR",
          exchange_mic:    "XNSE",
          country_code:    "IN",
          is_active:       true,
          metadata:        { oi: r.oi, contracts: r.contracts, underlying_symbol: r.symbol },
        };
      });

      for (let i = 0; i < instrRows.length; i += CHUNK) {
        const chunk = instrRows.slice(i, i + CHUNK);
        const { error } = await marketsAdmin.from("instruments")
          .upsert(chunk, { onConflict: "exchange,symbol,expiry,strike", ignoreDuplicates: false })
          .catch(() => ({ error: { message: "upsert conflict" } }));
        if (error) logger.warn("FO instruments upsert", { error: error.message });
        else instrUpserted += chunk.length;
      }

      // Re-fetch instrument IDs for price_history
      const foSymbols = rows.map((r) => foBhavSymbol(r.symbol, r.expiryDate, r.strike, r.optType));
      const { data: instrData } = await marketsAdmin
        .from("instruments")
        .select("id, symbol")
        .eq("exchange", "NSE_FO")
        .in("symbol", foSymbols);

      const idByFoSym: Record<string, string> = {};
      for (const r of (instrData ?? []) as any[]) idByFoSym[r.symbol] = r.id;

      // ── Upsert price_history ────────────────────────────────────────
      const priceRows = rows
        .filter((r) => {
          const sym = foBhavSymbol(r.symbol, r.expiryDate, r.strike, r.optType);
          return Boolean(idByFoSym[sym]);
        })
        .map((r) => {
          const sym = foBhavSymbol(r.symbol, r.expiryDate, r.strike, r.optType);
          return {
            instrument_id: idByFoSym[sym],
            ts:            r.ts,
            open:          r.open || r.settle,
            high:          r.high || r.settle,
            low:           r.low  || r.settle,
            close:         r.settle,     // settle price is the authoritative close for F&O
            volume:        r.contracts,
            source:        "nse_fo_bhav",
          };
        });

      for (let i = 0; i < priceRows.length; i += CHUNK) {
        const { error } = await marketsAdmin.from("price_history")
          .upsert(priceRows.slice(i, i + CHUNK), { onConflict: "instrument_id,ts", ignoreDuplicates: false });
        if (error) logger.warn("FO price_history upsert", { error: error.message });
        else priceUpserted += priceRows.slice(i, i + CHUNK).length;
      }
    }

    const summary = { daysProcessed, instrUpserted, priceUpserted };
    logger.info("FO ingest complete", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), { headers: jsonH });

  } catch (e: any) {
    logger.error("markets-ingest-fo-prices error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: jsonH });
  }
}, "markets-ingest-fo-prices");

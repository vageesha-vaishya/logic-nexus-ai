// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-commodity-prices
//
// Primary source: MCX Bhav copy CSV
//   https://www.mcxindia.com/BackEnd/GetBhavCopyData?date=DDMMYYYY
//   CSV: SYMBOL,EXPIRY,OPEN,HIGH,LOW,CLOSE,PREV_CLOSE,VOLUME,VALUE,OI,TIMESTAMP
//
// Fallback (if MCX is blocked): Yahoo Finance international commodity futures
//   GC=F (Gold), SI=F (Silver), CL=F (Crude), NG=F (Nat Gas),
//   HG=F (Copper), ALI=F (Aluminium), ZNC=F (Zinc)
//   Prices in USD → convert to INR via markets.fx_rates
//
// Cron: daily 18:05 UTC (23:35 IST) — MCX closes at 23:30 IST.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const MCX_BASE = "https://www.mcxindia.com/BackEnd/GetBhavCopyData";
const YF_BASE  = "https://query2.finance.yahoo.com/v8/finance/chart";
const CHUNK    = 200;

// Yahoo Finance proxy symbols for commodities (USD-denominated)
const YF_COMMODITY_MAP: Record<string, { yfSym: string; currency: string; unit: string }> = {
  GOLD:       { yfSym: "GC=F",  currency: "USD", unit: "oz" },
  SILVER:     { yfSym: "SI=F",  currency: "USD", unit: "oz" },
  CRUDEOIL:   { yfSym: "CL=F",  currency: "USD", unit: "barrel" },
  NATURALGAS: { yfSym: "NG=F",  currency: "USD", unit: "mmbtu" },
  COPPER:     { yfSym: "HG=F",  currency: "USD", unit: "lb" },
  ALUMINIUM:  { yfSym: "ALI=F", currency: "USD", unit: "lb" },
  ZINC:       { yfSym: "ZNC=F", currency: "USD", unit: "lb" },
};

// ── Helpers ──────────────────────────────────────────────────────────────
function pad2(n: number): string { return n.toString().padStart(2, "0"); }
function toMcxDate(d: Date): string {
  return `${pad2(d.getDate())}${pad2(d.getMonth()+1)}${d.getFullYear()}`;
}
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function toIstMidnight(ds: string): string { return `${ds}T00:00:00+05:30`; }

function recentTradingDays(n: number): Date[] {
  const days: Date[] = [];
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const d = new Date(ist);
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d));
  }
  return days;
}

const MON_MAP: Record<string, string> = {
  Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
  Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
};
function parseExpiry(s: string): string | null {
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${MON_MAP[m[2]] ?? "01"}-${m[1]}`;
}

function mcxFutSymbol(symbol: string, expiry: string): string {
  const expPart = expiry.replace(/-/g, "").slice(2); // 20250228 → 250228
  return `${symbol}_${expPart}_FUT`;
}

// ── MCX Bhav fetch ────────────────────────────────────────────────────────
async function fetchMcxBhav(date: Date): Promise<string | null> {
  const ds = toMcxDate(date);
  const url = `${MCX_BASE}?date=${ds}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; logic-nexus-commodity/1.0)",
        "Accept": "text/csv,text/plain,application/json,*/*",
        "Referer": "https://www.mcxindia.com/",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // MCX sometimes returns JSON error messages
    if (text.trim().startsWith("{") || text.trim().startsWith("[")) return null;
    return text;
  } catch {
    return null;
  }
}

type McxRow = {
  symbol: string; expiry: string; expiryDate: string;
  open: number; high: number; low: number; close: number;
  volume: number; oi: number; ts: string;
};

function parseMcxCsv(csv: string, dateStr: string): McxRow[] {
  const rows: McxRow[] = [];
  const lines = csv.split("\n");
  let dataStart = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (/symbol|instrument/i.test(lines[i])) { dataStart = i + 1; break; }
  }

  for (let i = dataStart; i < lines.length; i++) {
    const parts = lines[i].trim().split(",");
    if (parts.length < 7) continue;

    const symbol    = parts[0].trim().toUpperCase();
    const expiryRaw = parts[1].trim();
    const expiryDate = parseExpiry(expiryRaw);
    if (!expiryDate || !symbol) continue;

    const open   = parseFloat(parts[2]) || 0;
    const high   = parseFloat(parts[3]) || 0;
    const low    = parseFloat(parts[4]) || 0;
    const close  = parseFloat(parts[5]) || 0;
    if (close <= 0) continue;

    const volume = parseInt(parts[7] ?? "0") || 0;
    const oi     = parseInt(parts[9] ?? "0") || 0;

    rows.push({ symbol, expiry: expiryRaw, expiryDate, open, high, low, close, volume, oi, ts: toIstMidnight(dateStr) });
  }
  return rows;
}

// ── Yahoo Finance fallback ────────────────────────────────────────────────
async function fetchYfSpot(yfSym: string): Promise<{ close: number; date: string } | null> {
  const url = `${YF_BASE}/${encodeURIComponent(yfSym)}?range=5d&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; logic-nexus/1.0)", "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const closes     = result.indicators?.quote?.[0]?.close ?? [];
    const timestamps = result.timestamps ?? result.timestamp ?? [];
    const last = closes.length - 1;
    if (last < 0 || !closes[last]) return null;
    const date = new Date((timestamps[last] ?? 0) * 1000).toISOString().split("T")[0];
    return { close: closes[last], date };
  } catch {
    return null;
  }
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

    // Fetch commodity spot instrument IDs (MCX exchange)
    const { data: spotInstrs } = await marketsAdmin
      .from("instruments")
      .select("id, symbol")
      .eq("exchange", "MCX")
      .eq("instrument_type", "commodity_spot");

    const spotIdBySymbol: Record<string, string> = {};
    for (const s of (spotInstrs ?? []) as any[]) spotIdBySymbol[s.symbol] = s.id;

    // Latest USD→INR rate for Yahoo Finance fallback
    const { data: fxRow } = await marketsAdmin
      .from("fx_rates")
      .select("rate")
      .eq("base_ccy", "USD")
      .eq("quote_ccy", "INR")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    const usdToInr: number = (fxRow as any)?.rate ?? 83.5;

    let instrUpserted = 0, priceUpserted = 0, daysProcessed = 0, usedFallback = false;

    const tradingDays = recentTradingDays(rangeDays);

    for (const day of tradingDays) {
      const dateStr = toIsoDate(day);
      const csv = await fetchMcxBhav(day);

      if (csv) {
        // ── MCX primary path ──────────────────────────────────────────
        const rows = parseMcxCsv(csv, dateStr);
        if (rows.length === 0) continue;
        daysProcessed++;

        logger.info(`MCX bhav parsed: ${dateStr}`, { rows: rows.length });

        const instrRows = rows.map((r) => ({
          symbol:          mcxFutSymbol(r.symbol, r.expiryDate),
          exchange:        "MCX",
          instrument_type: "commodity_futures",
          asset_class:     "commodity",
          expiry:          r.expiryDate,
          underlying_id:   spotIdBySymbol[r.symbol] ?? null,
          currency_code:   "INR",
          exchange_mic:    "XMCX",
          country_code:    "IN",
          is_active:       true,
          metadata:        { oi: r.oi, underlying_symbol: r.symbol },
        }));

        for (let i = 0; i < instrRows.length; i += CHUNK) {
          const { error } = await marketsAdmin.from("instruments")
            .upsert(instrRows.slice(i, i + CHUNK), { onConflict: "exchange,symbol,expiry,strike", ignoreDuplicates: false })
            .catch(() => ({ error: { message: "upsert conflict" } }));
          if (!error) instrUpserted += instrRows.slice(i, i + CHUNK).length;
        }

        // Re-fetch IDs for price_history
        const futSymbols = rows.map((r) => mcxFutSymbol(r.symbol, r.expiryDate));
        const { data: iData } = await marketsAdmin.from("instruments")
          .select("id, symbol").eq("exchange", "MCX").in("symbol", futSymbols);
        const idByFut: Record<string, string> = {};
        for (const r of (iData ?? []) as any[]) idByFut[r.symbol] = r.id;

        const priceRows = rows
          .filter((r) => idByFut[mcxFutSymbol(r.symbol, r.expiryDate)])
          .map((r) => ({
            instrument_id: idByFut[mcxFutSymbol(r.symbol, r.expiryDate)],
            ts: r.ts, open: r.open, high: r.high, low: r.low, close: r.close,
            volume: r.volume, source: "mcx_bhav",
          }));

        for (let i = 0; i < priceRows.length; i += CHUNK) {
          const { error } = await marketsAdmin.from("price_history")
            .upsert(priceRows.slice(i, i + CHUNK), { onConflict: "instrument_id,ts", ignoreDuplicates: false });
          if (!error) priceUpserted += priceRows.slice(i, i + CHUNK).length;
        }

      } else {
        // ── Yahoo Finance fallback (spot prices for today only) ───────
        if (daysProcessed > 0) continue; // only do fallback for latest day
        usedFallback = true;
        logger.warn(`MCX bhav unavailable for ${dateStr} — using Yahoo Finance fallback`);

        const yfResults = await Promise.all(
          Object.entries(YF_COMMODITY_MAP).map(async ([mcxSym, cfg]) => {
            const result = await fetchYfSpot(cfg.yfSym);
            return { mcxSym, cfg, result };
          })
        );

        const spotPriceRows = yfResults
          .filter(({ result }) => result !== null)
          .map(({ mcxSym, cfg, result }) => {
            const instrId = spotIdBySymbol[mcxSym];
            if (!instrId || !result) return null;
            // Convert USD price to INR
            const priceInr = result.close * usdToInr;
            return {
              instrument_id: instrId,
              ts:            toIstMidnight(result.date),
              open: priceInr, high: priceInr, low: priceInr, close: priceInr,
              volume: 0, source: "yahoo_finance_fallback",
            };
          })
          .filter(Boolean);

        if (spotPriceRows.length > 0) {
          const { error } = await marketsAdmin.from("price_history")
            .upsert(spotPriceRows, { onConflict: "instrument_id,ts", ignoreDuplicates: true });
          if (!error) { priceUpserted += spotPriceRows.length; daysProcessed++; }
        }
      }
    }

    const summary = { daysProcessed, instrUpserted, priceUpserted, usedFallback };
    logger.info("commodity ingest complete", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), { headers: jsonH });

  } catch (e: any) {
    logger.error("markets-ingest-commodity-prices error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: jsonH });
  }
}, "markets-ingest-commodity-prices");

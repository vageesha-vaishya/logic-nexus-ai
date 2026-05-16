// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-mf-nav
// Fetches the AMFI NAVAll flat file (~2 MB, single request) and upserts:
//   • markets.instruments  — one row per MF scheme (instrument_type = mf_*)
//   • markets.mf_schemes   — AMFI metadata per scheme
//   • markets.price_history — NAV as close price for today
//
// Cron: daily 16:00 UTC (21:30 IST) — AMFI publishes by 9 PM IST.
//
// AMFI flat-file format:
//   Open Ended Schemes(Category Name)
//   <blank>
//   Scheme Code;ISIN Payout;ISIN Reinvest;Scheme Name;NAV;Repurchase;Sale;Date
//   <data rows>
//   <blank>
//   Closed Ended Schemes...

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const AMFI_URL  = "https://portal.amfiindia.com/spages/NAVAll.txt";
const CHUNK     = 400;   // upsert rows per batch

// ── Category → instrument_type mapping ──────────────────────────────────
function toInstrumentType(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("index fund") || c.includes("index scheme")) return "mf_index";
  if (c.includes("etf"))               return "etf";
  if (c.includes("fund of fund"))      return "mf_fof";
  if (c.includes("equity scheme"))     return "mf_equity";
  if (c.includes("debt scheme"))       return "mf_debt";
  if (c.includes("hybrid scheme"))     return "mf_hybrid";
  if (c.includes("solution oriented")) return "mf_hybrid";
  if (c.includes("liquid"))            return "mf_debt";
  if (c.includes("money market"))      return "mf_debt";
  return "mf_equity"; // safe fallback
}

// ── Plan & option detection from scheme name ─────────────────────────────
function detectPlan(name: string): "direct" | "regular" {
  return /direct/i.test(name) ? "direct" : "regular";
}
function detectOption(name: string): "growth" | "idcw" | "bonus" {
  if (/bonus/i.test(name))                              return "bonus";
  if (/idcw|dividend|payout|reinvest/i.test(name))     return "idcw";
  return "growth";
}

// ── Parse "14-May-2026" → ISO date ───────────────────────────────────────
const MON: Record<string, string> = {
  Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
  Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
};
function parseAmfiDate(s: string): string | null {
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${MON[m[2]] ?? "01"}-${m[1]}`;
}

// ── Ingest ────────────────────────────────────────────────────────────────
serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { authorized, status, error: authErr } =
    await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
  if (!authorized) {
    return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const jsonH = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    logger.info("Fetching AMFI NAVAll.txt");
    const resp = await fetch(AMFI_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; logic-nexus-mf-nav/1.0)" },
    });
    if (!resp.ok) throw new Error(`AMFI fetch failed: ${resp.status}`);
    const raw = await resp.text();

    // ── Parse flat file ─────────────────────────────────────────────────
    type SchemeRow = {
      amfiCode: string; isinGrowth: string | null; isinIdcw: string | null;
      name: string; nav: number; navDate: string;
      category: string; instrumentType: string;
      planType: "direct"|"regular"; optionType: "growth"|"idcw"|"bonus";
    };

    const schemes: SchemeRow[] = [];
    let currentCategory = "Equity Scheme";
    let inHeader = false;

    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) { inHeader = false; continue; }

      // Section header: "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
      const catMatch = t.match(/Open Ended Schemes\((.+?)\)|Closed Ended Schemes\((.+?)\)|Interval Schemes\((.+?)\)/);
      if (catMatch) {
        currentCategory = catMatch[1] ?? catMatch[2] ?? catMatch[3] ?? currentCategory;
        inHeader = true;
        continue;
      }
      // Column header line
      if (inHeader && t.startsWith("Scheme Code")) { inHeader = false; continue; }

      const parts = t.split(";");
      if (parts.length < 6) continue;

      // New AMFI format (6 cols): Code;ISIN_Growth;ISIN_IDCW;Name;NAV;Date
      // Old format (8 cols) had Repurchase;Sale between NAV and Date — stripped by AMFI in 2025.
      const [code, isin1, isin2, name, navStr, dateStr] = parts.length >= 8
        ? [parts[0], parts[1], parts[2], parts[3], parts[4], parts[7]]
        : parts;
      const nav = parseFloat(navStr);
      if (!code || isNaN(nav) || nav <= 0) continue;
      const navDate = parseAmfiDate(dateStr ?? "");
      if (!navDate) continue;

      schemes.push({
        amfiCode:       code.trim(),
        isinGrowth:     isin1?.trim() || null,
        isinIdcw:       isin2?.trim() || null,
        name:           name.trim(),
        nav,
        navDate,
        category:       currentCategory,
        instrumentType: toInstrumentType(currentCategory),
        planType:       detectPlan(name),
        optionType:     detectOption(name),
      });
    }

    logger.info(`Parsed ${schemes.length} MF schemes from AMFI`);
    if (schemes.length === 0) {
      return new Response(JSON.stringify({ error: "No schemes parsed — check AMFI URL" }),
        { status: 422, headers: jsonH });
    }

    // ── Upsert in chunks ────────────────────────────────────────────────
    let instrUpserted = 0, navUpserted = 0, mfMetaUpserted = 0;

    for (let i = 0; i < schemes.length; i += CHUNK) {
      const batch = schemes.slice(i, i + CHUNK);

      // 1. Upsert instruments (symbol = AMFI code, exchange = AMFI)
      const instrRows = batch.map(s => ({
        symbol:          s.amfiCode,
        exchange:        "AMFI",
        isin:            s.isinGrowth ?? s.isinIdcw,
        instrument_type: s.instrumentType,
        asset_class:     "mutual_fund",
        country_code:    "IN",
        currency_code:   "INR",
        exchange_mic:    "XBOM",
        is_active:       true,
        metadata:        { amfi_code: s.amfiCode, scheme_name: s.name },
      }));

      const { error: iErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("instruments")
        .upsert(instrRows, { onConflict: "symbol,exchange", ignoreDuplicates: false });
      if (iErr) { logger.warn("instruments upsert error", { error: iErr.message }); continue; }
      instrUpserted += batch.length;

      // 2. Fetch the instrument IDs we just created
      const codes = batch.map(s => s.amfiCode);
      const { data: instrData, error: fetchErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("instruments")
        .select("id, symbol")
        .eq("exchange", "AMFI")
        .in("symbol", codes);
      if (fetchErr || !instrData) continue;

      const idByCode: Record<string, string> = {};
      for (const r of instrData as any[]) idByCode[r.symbol] = r.id;

      // 3. Upsert price_history (NAV → close price)
      const priceRows = batch
        .filter(s => idByCode[s.amfiCode])
        .map(s => ({
          instrument_id: idByCode[s.amfiCode],
          ts:            `${s.navDate}T00:00:00+05:30`,
          open: s.nav, high: s.nav, low: s.nav, close: s.nav,
          volume: 0,
          source: "amfi",
        }));

      if (priceRows.length > 0) {
        const { error: pErr } = await (supabaseAdmin as any)
          .schema("markets")
          .from("price_history")
          .upsert(priceRows, { onConflict: "instrument_id,ts", ignoreDuplicates: false });
        if (pErr) logger.warn("price_history upsert error", { error: pErr.message });
        else navUpserted += priceRows.length;
      }

      // 4. Upsert mf_schemes metadata
      const mfRows = batch
        .filter(s => idByCode[s.amfiCode])
        .map(s => ({
          instrument_id: idByCode[s.amfiCode],
          amfi_code:     s.amfiCode,
          isin_growth:   s.isinGrowth,
          isin_idcw:     s.isinIdcw,
          category:      s.category,
          plan_type:     s.planType,
          option_type:   s.optionType,
          updated_at:    new Date().toISOString(),
        }));

      if (mfRows.length > 0) {
        const { error: mErr } = await (supabaseAdmin as any)
          .schema("markets")
          .from("mf_schemes")
          .upsert(mfRows, { onConflict: "instrument_id", ignoreDuplicates: false });
        if (mErr) logger.warn("mf_schemes upsert error", { error: mErr.message });
        else mfMetaUpserted += mfRows.length;
      }
    }

    logger.info("MF NAV ingest complete", { instrUpserted, navUpserted, mfMetaUpserted });
    return new Response(
      JSON.stringify({ success: true, schemes_parsed: schemes.length, instrUpserted, navUpserted, mfMetaUpserted }),
      { headers: jsonH },
    );

  } catch (e: any) {
    logger.error("markets-ingest-mf-nav error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: jsonH });
  }
}, "markets-ingest-mf-nav");

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-corporate-actions
//
// Fetches dividend and split history from Yahoo Finance for every NSE/BSE
// equity instrument in markets.instruments, then upserts into
// markets.corporate_actions.
//
// Yahoo Finance endpoint:
//   https://query2.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS
//     ?events=div,split&range=2y&interval=1d
//
// Response shape (events block):
//   dividends: { "<unix_ts>": { amount: number, date: number } }
//   splits:    { "<unix_ts>": { numerator: number, denominator: number, date: number } }
//
// POST body (optional):
//   { symbols?: string[], range?: "1y"|"2y"|"5y" }
//
// Cron: daily 08:05 IST (02:35 UTC) — runs before market open, picks up
//       ex-dates that were announced after previous close.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const YF_BASE   = "https://query2.finance.yahoo.com/v8/finance/chart";
const BATCH     = 8;    // parallel Yahoo fetches per round
const MAX_SYMS  = 500;  // cap to avoid edge-fn timeout
const CHUNK_DB  = 200;  // upsert rows per batch

// Suffix map — try .NS first, fall back to .BO
const EXCHANGE_SUFFIX: Record<string, string> = {
  NSE: ".NS",
  BSE: ".BO",
};

type YfEvent = { amount?: number; numerator?: number; denominator?: number; date: number };

async function fetchYfEvents(
  symbol: string,
  suffix: string,
  range: string,
): Promise<{ dividends: YfEvent[]; splits: YfEvent[] } | null> {
  const url = `${YF_BASE}/${encodeURIComponent(symbol + suffix)}?events=div%2Csplit&range=${range}&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; logic-nexus/1.0)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const ev = result.events ?? {};
    const dividends: YfEvent[] = Object.values(ev.dividends ?? {}) as YfEvent[];
    const splits:    YfEvent[] = Object.values(ev.splits    ?? {}) as YfEvent[];
    return { dividends, splits };
  } catch {
    return null;
  }
}

function unixToIsoDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split("T")[0];
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

  const range = (body?.range === "5y" || body?.range === "1y") ? body.range : "2y";

  try {
    const marketsAdmin = (supabaseAdmin as any).schema("markets");

    // ── Fetch instruments to process ────────────────────────────────────
    let query = marketsAdmin
      .from("instruments")
      .select("id, symbol, exchange")
      .in("instrument_type", ["equity", "etf"])
      .eq("is_active", true)
      .limit(MAX_SYMS);

    if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
      query = query.in("symbol", body.symbols);
    }

    const { data: instruments, error: instErr } = await query;
    if (instErr) throw new Error(`instruments fetch failed: ${instErr.message}`);

    logger.info("corp-actions: processing instruments", { count: instruments?.length ?? 0, range });

    const corpActionRows: any[] = [];
    let fetched = 0, skipped = 0;

    // ── Batch fetch Yahoo Finance events ────────────────────────────────
    for (let i = 0; i < (instruments ?? []).length; i += BATCH) {
      const batch = (instruments as any[]).slice(i, i + BATCH);

      await Promise.all(batch.map(async (instr: any) => {
        const suffix = EXCHANGE_SUFFIX[instr.exchange] ?? ".NS";
        const events = await fetchYfEvents(instr.symbol, suffix, range);
        if (!events) { skipped++; return; }
        fetched++;

        // Dividends
        for (const d of events.dividends) {
          if (!d.amount || !d.date) continue;
          corpActionRows.push({
            instrument_id: instr.id,
            action_type:   "dividend",
            ex_date:       unixToIsoDate(d.date),
            dividend_amt:  d.amount,
            source:        "yahoo_finance",
            raw_data:      { amount: d.amount, unix_date: d.date },
          });
        }

        // Splits
        for (const s of events.splits) {
          if (!s.numerator || !s.denominator || !s.date) continue;
          // ratio = new_shares / old_shares  (e.g. 5:1 split → ratio=5)
          const ratio = s.numerator / s.denominator;
          corpActionRows.push({
            instrument_id: instr.id,
            action_type:   "split",
            ex_date:       unixToIsoDate(s.date),
            ratio,
            source:        "yahoo_finance",
            raw_data:      { numerator: s.numerator, denominator: s.denominator, unix_date: s.date },
          });
        }
      }));

      // Small delay to be polite to Yahoo
      if (i + BATCH < (instruments ?? []).length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // ── Upsert corporate actions ─────────────────────────────────────────
    let upserted = 0;
    for (let i = 0; i < corpActionRows.length; i += CHUNK_DB) {
      const chunk = corpActionRows.slice(i, i + CHUNK_DB);
      const { error } = await marketsAdmin
        .from("corporate_actions")
        .upsert(chunk, { onConflict: "instrument_id,action_type,ex_date", ignoreDuplicates: true });
      if (error) logger.warn("corporate_actions upsert partial error", { error: error.message });
      else upserted += chunk.length;
    }

    const summary = {
      instruments_processed: fetched,
      instruments_skipped:   skipped,
      rows_parsed:           corpActionRows.length,
      rows_upserted:         upserted,
    };
    logger.info("corp-actions ingest complete", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), { headers: jsonH });

  } catch (e: any) {
    logger.error("markets-ingest-corporate-actions error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: jsonH });
  }
}, "markets-ingest-corporate-actions");

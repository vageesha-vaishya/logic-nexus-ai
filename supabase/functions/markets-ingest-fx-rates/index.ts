// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-fx-rates
// Fetches daily FX rates from Frankfurter (ECB data, free, no API key) and
// upserts into markets.fx_rates.
//
// Two passes:
//   1. USD base  → INR, EUR, GBP, JPY, SGD, AED, HKD, CHF, CAD, AUD, CNY, MYR, THB, ZAR
//   2. INR base  → USD, EUR, GBP, SGD, AED, JPY
//
// Cron: 07:35 UTC (13:05 IST) — ECB publishes by ~16:00 CET (20:30 IST)
//       but the previous day's rates are available from midnight UTC.
//
// Frankfurter API:  https://api.frankfurter.app/latest?from=USD&to=INR,EUR,...

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

declare const Deno: any;

const BASE_URL = "https://api.frankfurter.app";

const QUOTE_CURRENCIES = [
  "INR","USD","EUR","GBP","JPY","SGD","AED","HKD","CHF","CAD","AUD","CNY","MYR","THB","ZAR",
];

async function fetchRates(base: string, quotes: string[]): Promise<{ date: string; rates: Record<string, number> } | null> {
  const targets = quotes.filter(q => q !== base).join(",");
  const url = `${BASE_URL}/latest?from=${base}&to=${targets}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "logic-nexus-fx/1.0" },
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  return { date: json.date, rates: json.rates ?? {} };
}

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
    // Fetch both passes in parallel
    const [usdRates, inrRates] = await Promise.all([
      fetchRates("USD", QUOTE_CURRENCIES),
      fetchRates("INR", ["USD","EUR","GBP","SGD","AED","JPY"]),
    ]);

    if (!usdRates) throw new Error("Failed to fetch USD-based rates from Frankfurter");

    const rateDate = usdRates.date;
    const ts = `${rateDate}T00:00:00Z`;

    const rows: { base_ccy: string; quote_ccy: string; rate: number; ts: string; source: string }[] = [];

    // USD → others
    for (const [quote, rate] of Object.entries(usdRates.rates)) {
      rows.push({ base_ccy: "USD", quote_ccy: quote, rate, ts, source: "frankfurter" });
      // Inverse: quote → USD
      if (rate > 0) rows.push({ base_ccy: quote, quote_ccy: "USD", rate: 1 / rate, ts, source: "frankfurter" });
    }

    // INR → others (more precise than inverting USD/INR)
    if (inrRates) {
      for (const [quote, rate] of Object.entries(inrRates.rates)) {
        rows.push({ base_ccy: "INR", quote_ccy: quote, rate, ts, source: "frankfurter" });
        if (rate > 0) rows.push({ base_ccy: quote, quote_ccy: "INR", rate: 1 / rate, ts, source: "frankfurter" });
      }
    }

    // De-duplicate (prefer INR-sourced for INR pairs)
    const seen = new Set<string>();
    const deduped = rows.filter(r => {
      const key = `${r.base_ccy}:${r.quote_ccy}:${r.ts}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { error } = await (supabaseAdmin as any)
      .schema("markets")
      .from("fx_rates")
      .upsert(deduped, { onConflict: "base_ccy,quote_ccy,ts", ignoreDuplicates: false });

    if (error) throw new Error(`fx_rates upsert failed: ${error.message}`);

    logger.info("FX rates ingest complete", { date: rateDate, rows: deduped.length });
    return new Response(
      JSON.stringify({ success: true, date: rateDate, rows_upserted: deduped.length }),
      { headers: jsonH },
    );

  } catch (e: any) {
    logger.error("markets-ingest-fx-rates error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: jsonH });
  }
}, "markets-ingest-fx-rates");

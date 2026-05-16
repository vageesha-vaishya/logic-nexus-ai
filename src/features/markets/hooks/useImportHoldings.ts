/**
 * Markets — holdings import hook + broker CSV parsers.
 *
 * Supported formats:
 *   generic      — our own template
 *   zerodha      — Zerodha Console Holdings CSV
 *   groww        — Groww Holdings CSV
 *   icici_direct — ICICI Direct (auto-detects column variant)
 *   hdfc         — HDFC Securities Holdings CSV
 *   angel        — Angel One Holdings CSV
 *   upstox       — Upstox Holdings CSV
 *   kotak        — Kotak Securities / Kotak Neo Holdings Excel/CSV
 *   cams_mf      — CAMS MF CAS (CASParser CSV or camsonline.com flat CSV)
 *   cdsl         — CDSL Consolidated Account Statement (equity, no avg cost)
 *   nsdl         — NSDL IDeAS Holdings Statement (equity, no avg cost)
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────

export type ImportFormat =
  | "generic" | "zerodha" | "groww" | "hdfc" | "angel" | "upstox"
  | "icici_direct" | "kotak" | "cams_mf" | "cdsl" | "nsdl";

export interface ImportRow {
  symbol:        string;
  exchange?:     string;
  isin?:         string;
  qty:           number;
  avg_cost:      number;
  purchase_date?: string;   // YYYY-MM-DD
  asset_class?:  string;
  notes?:        string;
  folio_number?: string;
  currency?:     string;
  // display only
  _name?:        string;
  _raw_row?:     number;
}

export interface ImportResult {
  imported: number;
  skipped:  number;
  errors:   Array<{ row: number; symbol: string; reason: string }>;
}

export type ImportTxnType = "buy" | "transfer_in";

// ── Scope helper ───────────────────────────────────────────────────────────

function useActiveScope() {
  const { roles, user } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return { tenantId: active?.tenant_id ?? null, franchiseId: active?.franchise_id ?? null, userId: user?.id ?? null };
}

// ── CSV utility ────────────────────────────────────────────────────────────

/** Parse a CSV string → array of row-objects keyed by normalised header. */
function parseCsvToObjects(raw: string): Record<string, string>[] {
  // Strip BOM, normalise line endings
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Simple quoted-field CSV parser
  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitRow(lines[i]);
    if (values.every((v) => !v)) continue; // blank row
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] ?? "").trim(); });
    rows.push(obj);
  }
  return rows;
}

/** Remove currency symbols and commas from numeric strings. */
function parseNum(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[₹$,\s]/g, "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ── Broker parsers ─────────────────────────────────────────────────────────

/**
 * Generic template:
 * symbol, exchange, qty, avg_cost, purchase_date, asset_class, notes, isin, folio_number
 */
function parseGeneric(csv: string): ImportRow[] {
  return parseCsvToObjects(csv).map((r, i) => ({
    symbol:        (r.symbol ?? "").toUpperCase(),
    exchange:      (r.exchange ?? "").toUpperCase() || undefined,
    isin:          r.isin || undefined,
    qty:           parseNum(r.qty),
    avg_cost:      parseNum(r.avg_cost),
    purchase_date: r.purchase_date || undefined,
    asset_class:   r.asset_class   || undefined,
    notes:         r.notes         || undefined,
    folio_number:  r.folio_number  || undefined,
    _name:         r.name          || r.symbol,
    _raw_row:      i + 2,
  })).filter((r) => r.symbol && r.qty > 0);
}

/**
 * Zerodha Console Holdings export:
 * Instrument, ISIN, Qty, Avg. cost, LTP, Cur. val, P&L, Net chg., Day chg.
 */
function parseZerodha(csv: string): ImportRow[] {
  return parseCsvToObjects(csv).map((r, i) => {
    const sym = (r.instrument ?? r.tradingsymbol ?? "").replace(/-EQ$/i, "").toUpperCase();
    return {
      symbol:    sym,
      exchange:  "NSE",
      isin:      r.isin || undefined,
      qty:       parseNum(r.qty ?? r.quantity),
      avg_cost:  parseNum(r.avg__cost ?? r.avg_cost ?? r.average_price),
      asset_class: "equity",
      _name:     r.instrument ?? sym,
      _raw_row:  i + 2,
    };
  }).filter((r) => r.symbol && r.qty > 0);
}

/**
 * Groww Holdings export:
 * Name, Symbol, ISIN, Quantity, Average Price, Investment Value, Current Value, Returns, Returns %
 */
function parseGroww(csv: string): ImportRow[] {
  return parseCsvToObjects(csv).map((r, i) => ({
    symbol:     (r.symbol ?? "").toUpperCase(),
    exchange:   "NSE",
    isin:       r.isin || undefined,
    qty:        parseNum(r.quantity ?? r.qty),
    avg_cost:   parseNum(r.average_price ?? r.avg_price ?? r.avg_cost),
    asset_class: "equity",
    _name:       r.name ?? r.symbol,
    _raw_row:    i + 2,
  })).filter((r) => r.symbol && r.qty > 0);
}

/**
 * HDFC Securities Holdings export:
 * Sr. No., Scrip Name, Market, ISIN, Qty., Avg. Price, Market Price, Current Value, Unrealized P&L
 */
function parseHdfc(csv: string): ImportRow[] {
  return parseCsvToObjects(csv).map((r, i) => {
    const rawSym = (r.scrip_name ?? r.symbol ?? "").toUpperCase();
    // HDFC sometimes uses "RELIANCE INDS" — extract first word as symbol fallback
    const sym = rawSym.split(/\s+/)[0];
    return {
      symbol:     sym,
      exchange:   (r.market ?? "NSE").toUpperCase(),
      isin:       r.isin || r.isin_code || undefined,
      qty:        parseNum(r.qty_ ?? r.qty ?? r.quantity),
      avg_cost:   parseNum(r.avg__price ?? r.avg_price ?? r.average_price),
      asset_class: "equity",
      _name:      rawSym,
      _raw_row:   i + 2,
    };
  }).filter((r) => r.symbol && r.qty > 0);
}

/**
 * Angel One Holdings export:
 * Symbol Name, Token, Buy Qty, Buy Price, (sometimes Exchange)
 */
function parseAngel(csv: string): ImportRow[] {
  return parseCsvToObjects(csv).map((r, i) => {
    const sym = (r.symbol_name ?? r.symbol ?? r.scrip ?? "").replace(/-EQ$/i, "").toUpperCase();
    return {
      symbol:     sym,
      exchange:   (r.exchange ?? "NSE").toUpperCase(),
      qty:        parseNum(r.buy_qty ?? r.qty ?? r.quantity),
      avg_cost:   parseNum(r.buy_price ?? r.avg_price ?? r.average_price),
      asset_class: "equity",
      _name:      sym,
      _raw_row:   i + 2,
    };
  }).filter((r) => r.symbol && r.qty > 0);
}

/**
 * Upstox Holdings export:
 * symbol, quantity, buy_price, last_price, exchange
 */
function parseUpstox(csv: string): ImportRow[] {
  return parseCsvToObjects(csv).map((r, i) => {
    const sym = (r.symbol ?? r.instrument ?? "").replace(/:.*$/, "").toUpperCase();
    return {
      symbol:     sym,
      exchange:   (r.exchange ?? "NSE").toUpperCase(),
      qty:        parseNum(r.quantity ?? r.qty),
      avg_cost:   parseNum(r.buy_price ?? r.avg_price ?? r.average_price),
      asset_class: "equity",
      _name:      sym,
      _raw_row:   i + 2,
    };
  }).filter((r) => r.symbol && r.qty > 0);
}

/**
 * ICICI Direct Holdings export — flexible multi-variant parser.
 *
 * ICICI Direct column names vary by account type and have changed over time.
 * This parser tries several known header aliases for each field.
 *
 * Two sub-formats handled automatically:
 *
 * A) Demat / holdings snapshot (e.g. 8500608300_Demat.csv):
 *    Stock Name, Stock (short code), ISIN, Allocated Quantity, ...
 *    → one row per current holding, no Action column
 *
 * B) Transaction history (e.g. 8500608300_PortFolioEqtAll.csv):
 *    Stock Symbol, Company Name, ISIN Code, Action (Buy/Sell), Quantity,
 *    Transaction Price, ..., Transaction Date (DD-Mon-YYYY), Exchange
 *    → multiple rows per stock; grouped by symbol, net qty computed
 *
 * Format is auto-detected by presence of the "action" column.
 */

const _MONTH: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};
function _parseDdMonYyyy(s: string): string | undefined {
  const m = s?.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return undefined;
  const mo = _MONTH[m[2].toLowerCase()];
  if (!mo) return undefined;
  return `${m[3]}-${mo}-${m[1].padStart(2, "0")}`;
}

function parseIciciDirect(csv: string): ImportRow[] {
  const text  = csv.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const headerKeywords = /symbol|scrip|isin|qty|quantity|rate|price|nse|bse|action/i;
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (headerKeywords.test(lines[i])) { headerIdx = i; break; }
  }

  const rows = parseCsvToObjects(lines.slice(headerIdx).join("\n"));
  if (rows.length === 0) return [];

  const pick = (obj: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== "" && v !== "NA") return v;
    }
    return undefined;
  };

  const sample = rows[0];
  const isTxnHistory = "action" in sample || "transaction_price" in sample;

  if (isTxnHistory) {
    // ── Transaction history format ────────────────────────────────────────
    // Group by (symbol, exchange), compute net qty + weighted avg cost from buys.
    type Group = { sym: string; exch: string; isin?: string; name: string;
                   buyQty: number; buyCost: number; sellQty: number; lastBuyDate?: string; };
    const groups = new Map<string, Group>();

    for (const r of rows) {
      const sym = (
        pick(r, "stock_symbol", "nse_code", "nse_symbol", "symbol", "trading_symbol", "stock",
             "scrip_code", "scrip_name", "script_name", "security_name", "company_name") ?? ""
      ).replace(/\s+/g, "").toUpperCase();
      if (!sym) continue;

      const exch = (pick(r, "exchange", "market") ?? "NSE").toUpperCase().split(/[^A-Z]/)[0] || "NSE";
      const key  = `${sym}::${exch}`;

      if (!groups.has(key)) {
        groups.set(key, {
          sym, exch,
          isin: pick(r, "isin_code", "isin", "isin_no") || undefined,
          name: pick(r, "company_name", "security_name", "scrip_name") ?? sym,
          buyQty: 0, buyCost: 0, sellQty: 0,
        });
      }
      const g = groups.get(key)!;

      const action = (pick(r, "action") ?? "buy").toLowerCase();
      const qty    = parseNum(pick(r, "quantity", "qty"));
      const price  = parseNum(pick(r, "transaction_price", "price", "rate"));
      const date   = _parseDdMonYyyy(pick(r, "transaction_date", "date") ?? "");

      if (action === "buy" || action === "b") {
        g.buyQty  += qty;
        g.buyCost += qty * price;
        if (date && (!g.lastBuyDate || date > g.lastBuyDate)) g.lastBuyDate = date;
      } else if (action === "sell" || action === "s") {
        g.sellQty += qty;
      }
    }

    const result: ImportRow[] = [];
    let rowNum = 2;
    for (const g of groups.values()) {
      const netQty = g.buyQty - g.sellQty;
      if (netQty <= 0) continue;
      const avgCost = g.buyQty > 0 ? g.buyCost / g.buyQty : 0;
      result.push({
        symbol:        g.sym,
        exchange:      g.exch,
        isin:          g.isin,
        qty:           netQty,
        avg_cost:      Math.round(avgCost * 100) / 100,
        purchase_date: g.lastBuyDate,
        asset_class:   "equity",
        _name:         g.name,
        _raw_row:      rowNum++,
      });
    }
    return result;
  }

  // ── Demat / snapshot format ───────────────────────────────────────────────
  return rows.map((r, i) => {
    const sym = (
      pick(r, "stock_symbol", "nse_code", "nse_symbol", "symbol", "trading_symbol", "stock",
           "scrip_code", "script_name", "scrip_name", "security_name", "stock_name",
           "company_name", "scrip") ?? ""
    ).replace(/\s+/g, "").toUpperCase();

    const exch = (pick(r, "exchange", "market", "segment") ?? "NSE")
      .toUpperCase().replace(/\s/g, "");

    const isin = pick(r, "isin", "isin_code", "isin_no");

    const qty = parseNum(
      pick(r, "qty", "quantity", "allocated_quantity", "balance_qty", "net_qty",
          "current_qty", "holding_qty", "balance", "units")
    );

    const avgCost = parseNum(
      pick(r, "avg__rate", "avg_rate", "average_price", "avg_cost", "cost_price",
          "avg_buy_price", "purchase_price", "buy_price", "rate", "buy_avg",
          "average_rate", "average_buy_price", "avg_buy_rate")
    );

    return {
      symbol:      sym,
      exchange:    exch || "NSE",
      isin:        isin || undefined,
      qty,
      avg_cost:    avgCost,
      asset_class: "equity",
      _name:       pick(r, "company_name", "security_name", "scrip_name", "script_name") ?? sym,
      _raw_row:    i + headerIdx + 2,
    };
  }).filter((r) => r.symbol && r.qty > 0);
}

/**
 * Kotak Securities / Kotak Neo Holdings — Excel/CSV export.
 *
 * Kotak has had several formats across its old platform and the new Neo app.
 * All known column variants are handled here.
 *
 * Kotak Neo (new app):
 *   symbol | exchange | isin | quantity | average_price | ltp | current_value
 * Kotak Securities (older portal):
 *   stock_name | nse_code | bse_code | isin | qty | buy_price | cmp
 * Kotak Neo API JSON → flattened CSV:
 *   displaysymbol | averageprice | quantity | exchangesegment | holdingcost
 */
function parseKotak(csv: string): ImportRow[] {
  // Skip preamble rows (account info) — find the header
  const text  = csv.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const headerKeywords = /symbol|scrip|isin|qty|quantity|price|nse|stock|holding/i;
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (headerKeywords.test(lines[i])) { headerIdx = i; break; }
  }

  const rows = parseCsvToObjects(lines.slice(headerIdx).join("\n"));

  return rows.map((r, i) => {
    const pick = (obj: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) { const v = obj[k]; if (v !== undefined && v !== "") return v; }
      return undefined;
    };

    // Symbol: prefer NSE symbol over full name
    const rawSym = pick(r,
      "symbol", "nse_code", "nse_symbol", "displaysymbol", "trading_symbol",
      "scripid", "scrip_id", "stock_name", "scrip_name", "security_name",
    ) ?? "";
    // Strip trailing "-EQ" that Kotak Neo sometimes adds
    const sym = rawSym.replace(/-EQ$/i, "").replace(/\s+/g, "").toUpperCase();

    const exch = (pick(r, "exchange", "exchangesegment", "market") ?? "NSE")
      .toUpperCase().replace(/nse_cm/i, "NSE").replace(/bse_cm/i, "BSE").split("_")[0];

    const qty = parseNum(
      pick(r, "quantity", "qty", "sellable_quantity", "balance_qty", "holding_qty")
    );

    const avgCost = parseNum(
      pick(r,
        "average_price", "averageprice", "avg_cost", "avg__rate",
        "buy_price", "cost_price", "holdingcost",
      )
    );

    return {
      symbol:     sym,
      exchange:   exch || "NSE",
      isin:       pick(r, "isin", "isin_code") || undefined,
      qty,
      avg_cost:   avgCost,
      asset_class: "equity",
      _name:      pick(r, "stock_name", "scrip_name", "security_name") ?? sym,
      _raw_row:   i + headerIdx + 2,
    };
  }).filter(r => r.symbol && r.qty > 0);
}

/**
 * CAMS / MF Central — Consolidated Account Statement (mutual funds).
 *
 * Two sub-formats handled:
 *
 * A) CASParser CSV output (from the popular open-source CASParser tool):
 *    folio, scheme, isin, open_units, close_units, cost, value, nav, gain, amc, type
 *    → Units = close_units; avg_cost = cost / close_units
 *
 * B) camsonline.com Portfolio download (flat CSV):
 *    AMC Name, Scheme Name, Folio No., Plan, Option, ISIN, Units, Avg. Cost Price, Current NAV, Current Value
 *
 * Both formats are detected automatically by checking header names.
 *
 * How to get the file:
 *   CASParser: pip install casparser → casparser <cas.pdf> -o output.csv
 *   camsonline.com: Login → Portfolio → Download → CSV
 */
function parseCamsMf(csv: string): ImportRow[] {
  const text = csv.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Find the header row
  const headerKeywords = /scheme|folio|isin|units|nav|amc|fund/i;
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (headerKeywords.test(lines[i])) { headerIdx = i; break; }
  }

  const rows = parseCsvToObjects(lines.slice(headerIdx).join("\n"));
  if (rows.length === 0) return [];

  // Detect format by header presence
  const sample     = rows[0];
  const isCasParse = "close_units" in sample || "open_units" in sample;

  return rows.map((r, i) => {
    const pick = (obj: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) { const v = obj[k]; if (v !== undefined && v !== "") return v; }
      return undefined;
    };

    const isin     = pick(r, "isin", "isin_code") ?? "";
    const schemeName = pick(r, "scheme", "scheme_name", "fund_name", "plan") ?? "";
    const folio    = pick(r, "folio", "folio_no_", "folio_no", "folio_number") ?? "";
    const amcName  = pick(r, "amc", "amc_name", "fund_house") ?? "";

    let units: number;
    let avgCostPerUnit: number;

    if (isCasParse) {
      // CASParser format: cost = total invested, close_units = current units
      units        = parseNum(pick(r, "close_units", "units"));
      const totalCost = parseNum(pick(r, "cost"));
      avgCostPerUnit = units > 0 ? totalCost / units : 0;
    } else {
      // camsonline.com flat format: has direct avg cost per unit
      units          = parseNum(pick(r, "units", "balance_units", "units_held", "qty"));
      avgCostPerUnit = parseNum(pick(r, "avg__cost_price", "avg_cost_price", "average_cost", "cost_price", "purchase_price", "avg_price"));
    }

    if (!isin && !schemeName) return null;
    if (units <= 0) return null;

    // Use ISIN as symbol for MF (AMFI instruments are seeded by ISIN)
    // Fallback: use first word of scheme name if no ISIN
    const symbol = isin || schemeName.split(" ").slice(0, 3).join("_").toUpperCase();

    return {
      symbol,
      exchange:      "AMFI",
      isin:          isin || undefined,
      qty:           units,
      avg_cost:      avgCostPerUnit,
      asset_class:   "mutual_fund",
      folio_number:  folio || undefined,
      notes:         [amcName, schemeName].filter(Boolean).join(" — ") || undefined,
      _name:         schemeName || isin,
      _raw_row:      i + headerIdx + 2,
    };
  }).filter(Boolean) as ImportRow[];
}

/**
 * CDSL Consolidated Account Statement — Equity / Demat holdings.
 *
 * ⚠️ CDSL CAS does NOT include purchase price — only current qty.
 *    avg_cost will be set to 0; update transactions manually or via
 *    the CDSL transaction statement.
 *
 * How to download:
 *   web.cdslindia.com → Login → Transactions → Holding Statement → Excel
 *
 * Typical Excel columns (varies slightly by DP):
 *   Scrip Name | ISIN | Balance Qty | Free Qty | Locked Qty | Market Price | Market Value
 *
 * Also handles:
 *   Company Name | ISIN | Quantity | Face Value | Market Price
 */
function parseCdsl(csv: string): ImportRow[] {
  const text = csv.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Skip rows until we find the data header (look for ISIN keyword)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (/isin/i.test(lines[i]) && /qty|quantity|balance/i.test(lines[i])) {
      headerIdx = i; break;
    }
  }

  const rows = parseCsvToObjects(lines.slice(headerIdx).join("\n"));

  return rows.map((r, i) => {
    const pick = (obj: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) { const v = obj[k]; if (v !== undefined && v !== "") return v; }
      return undefined;
    };

    const isin  = pick(r, "isin", "isin_no", "isin_code") ?? "";
    const name  = pick(r, "scrip_name", "company_name", "security_description", "company___security_description", "security_name", "scrip") ?? "";
    const qty   = parseNum(pick(r, "balance_qty", "free_qty", "quantity", "closing_balance", "net_qty", "holding_qty") ?? "0");

    if (!isin || qty <= 0) return null;

    // CDSL gives company name, not trading symbol — extract from ISIN or use name
    // Trading symbol will be resolved server-side via ISIN matching
    const sym = isin; // Use ISIN as symbol — server resolves to trading symbol

    return {
      symbol:     sym,
      exchange:   "NSE",        // default; server will correct via ISIN lookup
      isin,
      qty,
      avg_cost:   0,            // Not available in CDSL CAS holdings section
      asset_class: "equity",
      notes:      name || undefined,
      _name:      name || isin,
      _raw_row:   i + headerIdx + 2,
    };
  }).filter(Boolean) as ImportRow[];
}

/**
 * NSDL IDeAS Holdings Statement — Equity / Demat holdings.
 *
 * ⚠️ Like CDSL, NSDL CAS does NOT include purchase price.
 *    avg_cost will be set to 0.
 *
 * How to download:
 *   eservices.nsdl.com → IDeAS → Holdings → Download Excel
 *   OR: NSDL Demat app → Statement → Holdings → Export
 *
 * Typical Excel/CSV columns:
 *   Company Name | ISIN | Category | Balance Qty (Free) | LTP | Market Value
 *
 * Also handles the NSDL CAS email attachment format:
 *   Sr No | Scrip Name | ISIN | Quantity | Category
 */
function parseNsdl(csv: string): ImportRow[] {
  const text = csv.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (/isin/i.test(lines[i]) && /(qty|quantity|balance|holding)/i.test(lines[i])) {
      headerIdx = i; break;
    }
  }

  const rows = parseCsvToObjects(lines.slice(headerIdx).join("\n"));

  return rows.map((r, i) => {
    const pick = (obj: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) { const v = obj[k]; if (v !== undefined && v !== "") return v; }
      return undefined;
    };

    const isin  = pick(r, "isin", "isin_code", "isin_no") ?? "";
    const name  = pick(r, "company_name", "scrip_name", "security_name", "company___security_name", "description") ?? "";
    const qty   = parseNum(pick(r, "balance_qty__free_", "balance_qty", "free_qty", "quantity", "net_qty", "holding_quantity") ?? "0");
    const category = (pick(r, "category", "instrument_type", "type") ?? "EQ").toUpperCase();

    if (!isin || qty <= 0) return null;

    // Determine asset class from NSDL category code
    const isDebt = /bond|gsec|gov|tbill|ncd|debenture/i.test(category);
    const isMF   = /mf|mfund|mutual/i.test(category);
    const assetClass = isMF ? "mutual_fund" : isDebt ? "fixed_income" : "equity";

    return {
      symbol:      isin,    // ISIN used as key; server resolves to trading symbol
      exchange:    isMF ? "AMFI" : "NSE",
      isin,
      qty,
      avg_cost:    0,
      asset_class: assetClass,
      notes:       name || undefined,
      _name:       name || isin,
      _raw_row:    i + headerIdx + 2,
    };
  }).filter(Boolean) as ImportRow[];
}

// ── Parser registry ────────────────────────────────────────────────────────

const PARSERS: Record<ImportFormat, (csv: string) => ImportRow[]> = {
  generic:      parseGeneric,
  zerodha:      parseZerodha,
  groww:        parseGroww,
  hdfc:         parseHdfc,
  angel:        parseAngel,
  upstox:       parseUpstox,
  icici_direct: parseIciciDirect,
  kotak:        parseKotak,
  cams_mf:      parseCamsMf,
  cdsl:         parseCdsl,
  nsdl:         parseNsdl,
};

export function parseHoldingsCsv(csv: string, format: ImportFormat): ImportRow[] {
  try {
    return PARSERS[format](csv);
  } catch {
    return [];
  }
}

// ── Template CSV download ──────────────────────────────────────────────────

export const GENERIC_TEMPLATE_CSV = [
  "symbol,exchange,qty,avg_cost,purchase_date,asset_class,notes,isin,folio_number",
  "RELIANCE,NSE,10,2500.00,2024-01-15,equity,,INE002A01018,",
  "GOLDBEES,NSE,50,45.50,2024-02-01,etf,,,",
  "NIFTYBEES,NSE,100,200.00,2024-03-01,etf,,,",
  "120503,AMFI,500,72.50,2024-01-10,mutual_fund,HDFC Top 100 Growth,,12345678",
  "GOLD,MCX,10,5800.00,2024-01-20,commodity,Gold 995 purity,,",
].join("\n");

export function downloadTemplate() {
  const blob = new Blob([GENERIC_TEMPLATE_CSV], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "holdings_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import hook ────────────────────────────────────────────────────────────

export function useImportHoldings(portfolioId: string | undefined) {
  const queryClient  = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<ImportResult, Error, { rows: ImportRow[]; txnType: ImportTxnType }>({
    mutationFn: async ({ rows, txnType }) => {
      if (!tenantId)     throw new Error("No active tenant");
      if (!portfolioId)  throw new Error("No portfolio selected");
      if (rows.length === 0) throw new Error("No rows to import");

      const headers: Record<string, string> = { "x-tenant-id": tenantId };
      if (franchiseId) headers["x-franchise-id"] = franchiseId;

      const { data, error } = await supabase.functions.invoke<ImportResult>(
        "markets-import-holdings",
        {
          method: "POST",
          headers,
          body: { portfolio_id: portfolioId, rows, txn_type: txnType },
        },
      );
      if (error) {
        // Try to extract the real server error from the context body
        const ctx = (error as any).context;
        if (ctx instanceof Response) {
          try {
            const body = await ctx.json();
            throw new Error(body?.error ?? error.message ?? "Import failed");
          } catch {
            throw new Error(error.message ?? "Import failed");
          }
        }
        throw new Error(error.message ?? "Import failed");
      }
      if (!data) throw new Error("No response from server");
      return data;
    },
    onSuccess: () => {
      if (portfolioId) {
        queryClient.invalidateQueries({ queryKey: ["markets", "transactions", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["markets", "portfolios", "detail", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["markets", "portfolios", "detail", portfolioId, "holdings"] });
      }
    },
  });
}

/**
 * Markets — holdings import hook + broker CSV parsers.
 *
 * Supported formats:
 *   generic   — our own template (symbol, exchange, qty, avg_cost, …)
 *   zerodha   — Zerodha Console Holdings CSV
 *   groww     — Groww Holdings CSV
 *   hdfc      — HDFC Securities Holdings CSV
 *   angel     — Angel One Holdings CSV
 *   upstox    — Upstox Holdings CSV
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────

export type ImportFormat =
  | "generic" | "zerodha" | "groww" | "hdfc" | "angel" | "upstox";

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
  return { tenantId: active?.tenant_id ?? null, userId: user?.id ?? null };
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

// ── Parser registry ────────────────────────────────────────────────────────

const PARSERS: Record<ImportFormat, (csv: string) => ImportRow[]> = {
  generic: parseGeneric,
  zerodha: parseZerodha,
  groww:   parseGroww,
  hdfc:    parseHdfc,
  angel:   parseAngel,
  upstox:  parseUpstox,
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
  const { tenantId } = useActiveScope();

  return useMutation<ImportResult, Error, { rows: ImportRow[]; txnType: ImportTxnType }>({
    mutationFn: async ({ rows, txnType }) => {
      if (!tenantId)     throw new Error("No active tenant");
      if (!portfolioId)  throw new Error("No portfolio selected");
      if (rows.length === 0) throw new Error("No rows to import");

      const { data, error } = await supabase.functions.invoke<ImportResult>(
        "markets-import-holdings",
        {
          method: "POST",
          headers: { "x-tenant-id": tenantId },
          body: { portfolio_id: portfolioId, rows, txn_type: txnType },
        },
      );
      if (error) throw new Error(error.message ?? "Import failed");
      if (!data)  throw new Error("No response from server");
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

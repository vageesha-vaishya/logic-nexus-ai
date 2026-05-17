/**
 * SPAN Margin Calculator hook.
 *
 * Calls POST /v1/span/calculate on the markets-worker.
 * Returns per-position margins and a portfolio-level summary.
 */

import { useMutation } from "@tanstack/react-query";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SpanPosition {
  symbol: string;
  exchange: string;
  instrument_type: "future" | "call" | "put";
  expiry?: string;
  strike?: number;
  qty: number;
  direction: "buy" | "sell";
  /** Caller-supplied market price — used when not in LTP cache */
  ltp_override?: number;
  /** Premium for options (defaults to ltp_override) */
  premium?: number;
}

export interface SpanPositionResult extends SpanPosition {
  contract_value: number;
  span_margin: number;
  exposure_margin: number;
  total_margin: number;
  lot_size: number;
  total_qty: number;
  ltp_used: number;
}

export interface SpanSummary {
  span_margin: number;
  exposure_margin: number;
  total_margin: number;
  portfolio_offset: number;
  net_margin: number;
}

export interface SpanResult {
  positions: SpanPositionResult[];
  summary: SpanSummary;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCalculateSpan() {
  return useMutation<SpanResult, Error, SpanPosition[]>({
    mutationFn: async (positions) => {
      const res = await fetch(`${WORKER_URL}/v1/span/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => String(res.status));
        throw new Error(`SPAN calculation failed (${res.status}): ${text}`);
      }
      return res.json() as Promise<SpanResult>;
    },
  });
}

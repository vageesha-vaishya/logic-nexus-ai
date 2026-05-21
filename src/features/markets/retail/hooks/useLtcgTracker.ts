import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "../../hooks/queryKeys";

/**
 * Indian FY ("YYYY-YY") containing the given date — defaults to today.
 * FY starts April 1 and ends March 31 of the following year, so anything
 * in Jan–Mar belongs to the FY whose first segment is `year - 1`.
 */
export function currentIndianFy(today: Date = new Date()): string {
  const m = today.getMonth(); // 0-indexed; 0=Jan, 3=Apr
  const startYear = m >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const endTwo = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endTwo}`;
}

export interface LtcgSummary {
  equity_stcg:           number;
  equity_ltcg:           number;
  equity_ltcg_exempt:    number;  // typically 125000
  equity_ltcg_taxable:   number;  // ltcg above exemption
  equity_ltcg_remaining: number;  // tax-free room left
  equity_stcg_tax_est:   number;
  equity_ltcg_tax_est:   number;
  total_tax_est:         number;
  total_realized_gain:   number;
  other_stcg:            number;
  other_ltcg:            number;
}

export interface LtcgRealizedTrade {
  symbol:        string;
  asset_class:   string;
  buy_date:      string;
  sell_date:     string;
  qty:           number;
  buy_price:     number;
  sell_price:    number;
  gain:          number;
  holding_days:  number;
  gain_type:     "LTCG" | "STCG";
  tax_rate_pct:  number;
  portfolio_id:  string;
}

export interface LtcgTrackerResponse {
  user_id:              string;
  fy:                   string;
  fy_start:             string;
  fy_end:               string;
  as_of:                string;
  portfolio_count:      number;
  summary:              LtcgSummary;
  realized_trades:      LtcgRealizedTrade[];
  available_fy_options: string[];
}

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

/**
 * Phase 1 addendum T15 — LTCG exemption tracker.
 *
 * Fetches the aggregate realized LTCG across all of the authed user's
 * portfolios for the given (or current) Indian FY. Worker applies the
 * ₹1.25 L LTCG exemption at the user level so summing client-side is
 * wrong — always defer to summary.equity_ltcg_remaining for the
 * headline "tax-free room left" number.
 *
 * Skips when there's no live session so the public landing path doesn't
 * fire a doomed 401.
 */
export function useLtcgTracker(fy?: string) {
  const resolvedFy = fy ?? currentIndianFy();
  return useQuery<LtcgTrackerResponse, Error>({
    queryKey:  marketsKeys.retail.ltcg(resolvedFy),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${WORKER_URL}/v1/tax/user/pnl?fy=${encodeURIComponent(resolvedFy)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        throw new Error(`LTCG tracker fetch failed: ${resp.status}`);
      }
      return resp.json();
    },
  });
}

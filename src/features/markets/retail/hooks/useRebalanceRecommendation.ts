import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { marketsKeys } from "../../hooks/queryKeys";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RebalanceOrder {
  action:     "buy" | "sell";
  symbol:     string | null;
  exchange?:  string;
  name:       string;
  tier_to?:   number;
  tier_from?: number;
  amount_inr: number;
}

export interface RebalanceDriftRow {
  tier_number: number;
  target_pct:  number;
  actual_pct:  number;
  drift_pct:   number;
}

export interface RebalancePayload {
  reason:               string;
  orders:               RebalanceOrder[];
  net_cash_impact:      number;
  estimated_brokerage:  number;
  drifts:               RebalanceDriftRow[];
  threshold_pct:        number;
}

export type RebalanceStatus =
  | "pending"
  | "executed"
  | "dismissed"
  | "expired"
  | "partially_executed";

export interface RebalanceRecommendation {
  id:              string;
  user_id:         string;
  generated_at:    string;
  expires_at:      string;
  status:          RebalanceStatus;
  payload:         RebalancePayload;
  executed_at:     string | null;
  confirm_method:  "biometric" | "password" | "web" | null;
  created_at:      string;
  updated_at:      string;
}

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Latest pending rebalance recommendation for the current user.
 *
 * The endpoint runs the drift detector on demand and persists a new row when
 * drift is found; otherwise it returns null. We give it a generous 10-minute
 * staleTime because the detector hits portfolio_snapshots which only updates
 * once a day.
 */
export function usePendingRebalance() {
  return useQuery<RebalanceRecommendation | null, Error>({
    queryKey: marketsKeys.retail.rebalance(),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const headers = await authHeader();
      const resp = await fetch(`${WORKER_URL}/v1/retail/rebalance/pending`, { headers });
      if (!resp.ok) {
        let detail = "";
        try {
          const body = await resp.json();
          if (typeof body?.detail === "string") detail = ` — ${body.detail}`;
        } catch {
          // non-JSON body — ignore
        }
        throw new Error(`rebalance/pending: ${resp.status}${detail}`);
      }
      const body = await resp.json();
      return body as RebalanceRecommendation | null;
    },
  });
}

interface MutationOpts {
  onSuccess?: (rec: RebalanceRecommendation) => void;
}

/**
 * Dismiss a pending recommendation. Server marks it dismissed; we invalidate
 * the pending query so the card disappears, and the risk score so the Home
 * tab re-fetches (dismiss alone doesn't change the underlying drift but the
 * user has explicitly said "not now" — surface that decision consistently).
 */
export function useDismissRebalance(opts: MutationOpts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recId: string): Promise<RebalanceRecommendation> => {
      const headers = await authHeader();
      const resp = await fetch(
        `${WORKER_URL}/v1/retail/rebalance/${encodeURIComponent(recId)}/dismiss`,
        { method: "POST", headers },
      );
      if (!resp.ok) throw new Error(`dismiss: ${resp.status}`);
      return (await resp.json()) as RebalanceRecommendation;
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: marketsKeys.retail.rebalance() });
      qc.invalidateQueries({ queryKey: marketsKeys.retail.riskScore() });
      opts.onSuccess?.(rec);
    },
  });
}

/**
 * Execute a pending recommendation. Records the SEBI audit trail server-side
 * (timestamp + confirm_method); the actual broker submission stays in T10's
 * order path and picks up rows by status='executed'.
 */
export function useExecuteRebalance(opts: MutationOpts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recId: string;
      confirmMethod?: "biometric" | "password" | "web";
    }): Promise<RebalanceRecommendation> => {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const resp = await fetch(
        `${WORKER_URL}/v1/retail/rebalance/${encodeURIComponent(input.recId)}/execute`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ confirm_method: input.confirmMethod ?? "web" }),
        },
      );
      if (!resp.ok) throw new Error(`execute: ${resp.status}`);
      return (await resp.json()) as RebalanceRecommendation;
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: marketsKeys.retail.rebalance() });
      qc.invalidateQueries({ queryKey: marketsKeys.retail.riskScore() });
      qc.invalidateQueries({ queryKey: marketsKeys.retail.tiers() });
      opts.onSuccess?.(rec);
    },
  });
}

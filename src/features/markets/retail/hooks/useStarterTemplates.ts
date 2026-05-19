import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "../../hooks/queryKeys";

// ── Types ────────────────────────────────────────────────────────────────────
// Mirror of markets.portfolio_templates seed. Kept in TS so the picker UI can
// render with strong types without a Supabase codegen pass.

export interface SuggestedHolding {
  symbol: string;
  exchange: string;
  name: string;
  /** Weight of this holding inside its tier, NOT of the whole portfolio. */
  weight_pct: number;
}

export interface TemplateTierAllocation {
  tier_number: 1 | 2 | 3;
  /** Weight of this tier in the portfolio. The three tier weights sum to 100. */
  weight_pct: number;
  focus: string;
  suggested_holdings: SuggestedHolding[];
}

export interface PortfolioTemplate {
  id: string;
  slug: "conservative" | "balanced" | "growth";
  display_name: string;
  description: string;
  risk_tag: "conservative" | "moderate" | "aggressive";
  tier_allocations: TemplateTierAllocation[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Returns the active starter templates ordered by `display_order`.
 *
 * Templates are public-read (no user_id on the row) so we hit Supabase
 * directly rather than going through the markets-worker. The RLS policy on
 * the table restricts to `authenticated`, so unauthenticated callers will
 * see an empty array — the UI can fall back to a "log in to see templates"
 * affordance if that ever matters.
 */
export function useStarterTemplates() {
  return useQuery({
    queryKey: marketsKeys.retail.starterTemplates(),
    // Templates change rarely — long stale to avoid refetch noise during
    // onboarding navigation.
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<PortfolioTemplate[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("portfolio_templates")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as PortfolioTemplate[]) ?? [];
    },
  });
}

/**
 * Splits a total ₹ budget across the three tier slots per a template's weights.
 * Pure function — tested in isolation. Returns whole rupees, with rounding
 * leftover added to tier 2 (the largest bucket in most templates) so the sum
 * always equals `totalBudget`.
 */
export function applyTemplateToBudget(
  template: PortfolioTemplate,
  totalBudget: number,
): Array<{ tier_number: 1 | 2 | 3; target_amount: number }> {
  if (totalBudget <= 0) {
    return template.tier_allocations.map((a) => ({
      tier_number:   a.tier_number,
      target_amount: 0,
    }));
  }

  const raw = template.tier_allocations.map((a) => ({
    tier_number: a.tier_number,
    amount:      (totalBudget * a.weight_pct) / 100,
  }));
  const rounded = raw.map((r) => ({
    tier_number:   r.tier_number,
    target_amount: Math.round(r.amount),
  }));
  const sum = rounded.reduce((acc, r) => acc + r.target_amount, 0);
  const drift = totalBudget - sum;
  if (drift !== 0) {
    // Push the rounding remainder into tier 2 — typically the largest bucket
    // and the one users tweak last. Falls back to tier 1 if 2 isn't present.
    const target = rounded.find((r) => r.tier_number === 2) ?? rounded[0];
    if (target) target.target_amount += drift;
  }
  return rounded;
}

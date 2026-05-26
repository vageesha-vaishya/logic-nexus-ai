/**
 * usePlanGate — Plan/trial feature enforcement hook.
 *
 * Reads the current tenant's subscription directly from Supabase
 * (not via edge function) for low-latency gating.
 *
 * Returns a PlanGateResult with:
 *   - allowed: whether the feature is permitted
 *   - limit:   -1 = unlimited, 0 = blocked, N = capped
 *   - reason:  human-readable block reason
 *   - planName / upgradeSlug: for upgrade prompts
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCRM } from "./useCRM";
import { logger } from "@/lib/logger";

// ── Public types ──────────────────────────────────────────────────────────────

export type PlanFeature =
  | "broker_connections"
  | "live_trading"
  | "fno_access"
  | "mf_orders"
  | "ai_briefs_daily"
  | "markets_module";

export interface PlanGateResult {
  allowed:      boolean;
  limit:        number;    // -1 = unlimited, 0 = blocked
  reason?:      string;    // human-readable why it's blocked
  planName?:    string;    // current plan name
  upgradeSlug?: string;    // slug of the next plan to upgrade to
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Limits applied when no subscription exists (implicit free/trial). */
const DEFAULT_TRIAL_LIMITS: Record<PlanFeature, number | boolean> = {
  // -1 = unlimited. Trial users can connect every broker they actually
  // own; the friction we're protecting against (live_trading, fno_access,
  // mf_orders) is the trade-execution surface, not the read-only sync
  // surface. Capping broker count was an artificial gate that blocked
  // legitimate multi-broker users from validating the platform before
  // they upgraded.
  broker_connections: -1,
  live_trading:       false,
  fno_access:         false,
  mf_orders:          false,
  ai_briefs_daily:    3,
  markets_module:     true,
};

/** Boolean features — presence in this set determines evaluation path. */
const BOOLEAN_FEATURES = new Set<PlanFeature>([
  "live_trading",
  "fno_access",
  "mf_orders",
  "markets_module",
]);

// ── Upgrade slug logic ────────────────────────────────────────────────────────

function nextUpgradeSlug(currentSlug: string | null | undefined): string | undefined {
  if (!currentSlug || currentSlug.includes("trial")) return "lnai-starter";
  if (currentSlug.includes("starter"))               return "lnai-pro";
  if (currentSlug.includes("pro") || currentSlug.includes("professional")) return "lnai-enterprise";
  return undefined;
}

// ── Core evaluation ───────────────────────────────────────────────────────────

function evaluateFeature(
  feature:     PlanFeature,
  limits:      Record<string, unknown>,
  planName:    string | undefined,
  planSlug:    string | null | undefined,
): PlanGateResult {
  const rawValue = limits[feature];
  const upgradeSlug = nextUpgradeSlug(planSlug) ?? undefined;

  if (BOOLEAN_FEATURES.has(feature)) {
    const allowed = rawValue === true;
    return allowed
      ? { allowed: true,  limit: -1, planName }
      : { allowed: false, limit: 0,  planName, upgradeSlug, reason: "Upgrade your plan to unlock this feature" };
  }

  // Numeric feature
  const n = rawValue == null ? 0 : Number(rawValue);
  if (n === -1) return { allowed: true,  limit: -1, planName };
  if (n === 0)  return { allowed: false, limit: 0,  planName, upgradeSlug, reason: "Upgrade to unlock" };
  return         { allowed: true,  limit: n,  planName };
}

// ── DB row shape ──────────────────────────────────────────────────────────────

interface SubscriptionRow {
  status:         string;
  trial_ends_at:  string | null;
  subscription_plans: {
    name:   string;
    slug:   string;
    tier:   string | null;
    limits: Record<string, unknown>;
  } | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePlanGate(feature: PlanFeature): PlanGateResult & { isLoading: boolean } {
  const { context } = useCRM();
  const tenantId = context.tenantId;

  const query = useQuery<SubscriptionRow | null>({
    queryKey: ["plan-gate", tenantId],
    enabled:  Boolean(tenantId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("status, trial_ends_at, subscription_plans(name, slug, tier, limits)")
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (error) {
        logger.warn("[usePlanGate] subscription fetch failed:", error.message);
        return null;
      }
      return data as SubscriptionRow | null;
    },
  });

  // ── Resolve limits from query result ──────────────────────────────────────

  const isLoading = query.isLoading;

  // No subscription at all → default trial limits
  if (!query.data) {
    const raw = DEFAULT_TRIAL_LIMITS;
    const result = evaluateFeature(feature, raw as Record<string, unknown>, undefined, null);
    return { ...result, isLoading };
  }

  const row = query.data;

  // Trial expired → all features blocked
  if (row.status === "trial") {
    if (row.trial_ends_at && new Date(row.trial_ends_at) < new Date()) {
      return {
        allowed:     false,
        limit:       0,
        isLoading,
        reason:      "Your trial has expired. Upgrade to continue.",
        upgradeSlug: nextUpgradeSlug(row.subscription_plans?.slug) ?? undefined,
        planName:    row.subscription_plans?.name,
      };
    }
    // Active trial → use default trial limits
    const raw = DEFAULT_TRIAL_LIMITS;
    const result = evaluateFeature(feature, raw as Record<string, unknown>, row.subscription_plans?.name, null);
    return { ...result, isLoading };
  }

  // Active/paid plan
  const plan   = row.subscription_plans;
  const limits = plan?.limits ?? {};
  const result = evaluateFeature(feature, limits, plan?.name, plan?.slug);
  return { ...result, isLoading };
}

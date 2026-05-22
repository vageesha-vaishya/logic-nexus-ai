/**
 * usePlanCatalog — fetch the subscription_plans rows for a domain.
 *
 * Plans are filtered by the active tenant's domain_id so we never show
 * Markets-advisor plans on a Logistics tenant (the 2026-05-22 fix). Rows
 * come back sorted ascending by price_monthly so the free plan leads.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionPlan {
  id:            string;
  slug:          string;
  name:          string;
  description:   string | null;
  tier:          string;
  price_monthly: number;
  price_annual:  number | null;
  currency:      string;
  features:      string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  limits:        Record<string, any>;
  is_active:     boolean;
  domain_id:     string;
}

export function usePlanCatalog(domainId: string | undefined) {
  return useQuery({
    queryKey: ["plan-catalog", domainId],
    enabled:  Boolean(domainId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, slug, name, description, tier, price_monthly, price_annual, currency, features, limits, is_active, domain_id")
        .eq("domain_id", domainId!)
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      if (error) throw error;
      return (data as SubscriptionPlan[] | null) ?? [];
    },
  });
}

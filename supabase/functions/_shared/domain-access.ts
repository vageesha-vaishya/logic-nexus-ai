// Deno-side parallel of src/lib/db/access.ts checkDomainAccess()
// Queries public.tenant_domain_assignments + public.platform_domains.

import { SupabaseClient } from "@supabase/supabase-js";

export const PlatformDomains = {
  AMRO: "amro",
  LOGISTICS: "logistics",
  MARKETS: "markets",
  CRM: "crm",
  FINANCE: "finance",
  TRADING: "trading",
  INSURANCE: "insurance",
  CUSTOMS: "customs",
  BANKING: "banking",
  ECOMMERCE: "ecommerce",
  TELECOM: "telecom",
  HEALTHCARE: "healthcare",
  REAL_ESTATE: "real_estate",
} as const;

export type PlatformDomainKey = typeof PlatformDomains[keyof typeof PlatformDomains];

const ACTIVE_SUBSCRIPTION_STATES = new Set(["active", "trialing", "grace_period"]);

export interface DomainAccessResult {
  allowed: boolean;
  subscriptionStatus?: string;
  graceUntil?: string | null;
  domainStatus?: string;
  reason?: string;
}

/**
 * Authorization-layer check: does this tenant have the named domain enabled?
 * Callers typically use the service-role client so the check itself isn't
 * RLS-gated; the user's data access remains RLS-enforced.
 * No caching — T1.5 (markets-doc §16.8 P2) introduces Redis caching for these.
 *
 * Case-insensitivity: the `PlatformDomains` constants are lowercase, but
 * legacy seed migrations (notably MARKETS, AMRO) stored uppercase codes in
 * `platform_domains.code`. A case-sensitive `.eq()` made the check fail
 * silently for any tenant whose row used the wrong casing → 403 from every
 * function that gates with this helper. We match case-insensitively so a
 * single canonical casing isn't required at the schema layer. Domain codes
 * don't contain SQL LIKE wildcards (`%`, `_`), so `.ilike()` is exact-match
 * here.
 */
export async function checkDomainAccess(
  supabase: SupabaseClient,
  tenantId: string,
  domain: PlatformDomainKey,
): Promise<DomainAccessResult> {
  const { data, error } = await supabase
    .from("tenant_domain_assignments")
    .select(
      "is_active, subscription_status, grace_until, platform_domains!inner(code, status, is_active)",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .ilike("platform_domains.code", domain)
    .eq("platform_domains.is_active", true)
    .maybeSingle();

  if (error) {
    return { allowed: false, reason: `domain_lookup_error: ${error.message ?? "unknown"}` };
  }
  if (!data) {
    return { allowed: false, reason: "no_assignment" };
  }

  const subStatus: string = (data as any).subscription_status;
  if (!ACTIVE_SUBSCRIPTION_STATES.has(subStatus)) {
    return { allowed: false, subscriptionStatus: subStatus, reason: `subscription_${subStatus}` };
  }

  if (subStatus === "grace_period" && (data as any).grace_until) {
    const graceUntil = new Date((data as any).grace_until);
    if (Number.isFinite(graceUntil.getTime()) && graceUntil < new Date()) {
      return {
        allowed: false,
        subscriptionStatus: subStatus,
        graceUntil: (data as any).grace_until,
        reason: "grace_period_expired",
      };
    }
  }

  return {
    allowed: true,
    subscriptionStatus: subStatus,
    graceUntil: (data as any).grace_until ?? null,
    domainStatus: (data as any).platform_domains?.status,
  };
}

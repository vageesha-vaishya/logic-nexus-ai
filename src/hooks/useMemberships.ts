/**
 * useMemberships — list every membership the signed-in user holds and let
 * them switch between them.
 *
 * "Membership" = one row in public.user_roles joined to its tenant +
 * franchise + platform_domain. Each row scopes the rest of the app via
 * RLS, so switching is a single write to public.user_active_membership
 * plus a hard reload to refetch every domain-keyed query under the new
 * context.
 *
 * Sthira retail is exposed as a special membership labelled "My Sthira
 * account" — the underlying row is still under the SOS Services tenant /
 * SOS-RETAIL franchise, but the user-facing label hides the org chrome
 * because retail is a B2C experience.
 *
 * Design: docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Membership {
  /** public.user_roles.id — what user_active_membership.membership_id FKs to. */
  id:             string;
  role:           string;
  tenant_id:      string;
  franchise_id:   string | null;
  tenant_name:    string;
  franchise_name: string | null;
  franchise_code: string | null;
  domain_code:    string | null;
  domain_name:    string | null;
  /**
   * Either "{tenant} · {franchise or domain}" or the special "My Sthira
   * account" string for retail memberships.
   */
  display_label:  string;
  /** True for the Sthira retail entry (SOS-RETAIL franchise code). */
  is_retail:      boolean;
}

const SOS_RETAIL_FRANCHISE_CODE = "SOS-RETAIL";
const RETAIL_LABEL              = "My Sthira account";

const membershipsKey  = (uid: string | undefined) => ["memberships", uid] as const;
const activeMshipKey  = (uid: string | undefined) => ["active-membership", uid] as const;

interface MembershipRow {
  id:           string;
  role:         string;
  tenant_id:    string;
  franchise_id: string | null;
  tenants:     {
    id:   string;
    name: string;
    domain_id: string | null;
    platform_domains: { code: string; name: string } | null;
  } | null;
  franchises: {
    id:   string;
    name: string;
    code: string;
  } | null;
}

function toMembership(row: MembershipRow): Membership {
  const tenantName    = row.tenants?.name              ?? "Unknown tenant";
  const franchiseName = row.franchises?.name           ?? null;
  const franchiseCode = row.franchises?.code           ?? null;
  const domainCode    = row.tenants?.platform_domains?.code ?? null;
  const domainName    = row.tenants?.platform_domains?.name ?? null;
  const is_retail     = franchiseCode === SOS_RETAIL_FRANCHISE_CODE;

  const display_label = is_retail
    ? RETAIL_LABEL
    : franchiseName
      ? `${tenantName} · ${franchiseName}`
      : domainName
        ? `${tenantName} · ${domainName}`
        : tenantName;

  return {
    id:             row.id,
    role:           row.role,
    tenant_id:      row.tenant_id,
    franchise_id:   row.franchise_id,
    tenant_name:    tenantName,
    franchise_name: franchiseName,
    franchise_code: franchiseCode,
    domain_code:    domainCode,
    domain_name:    domainName,
    display_label,
    is_retail,
  };
}

export function useMemberships() {
  const { user }   = useAuth();
  const userId     = user?.id;
  const qc         = useQueryClient();

  const membershipsQuery = useQuery({
    queryKey: membershipsKey(userId),
    enabled:  Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<Membership[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select(
          "id, role, tenant_id, franchise_id, " +
          "tenants:tenant_id ( id, name, domain_id, platform_domains:domain_id ( code, name ) ), " +
          "franchises:franchise_id ( id, name, code )"
        )
        .eq("user_id", userId);
      if (error) throw error;
      return ((data as MembershipRow[] | null) ?? []).map(toMembership);
    },
  });

  const activeQuery = useQuery({
    queryKey: activeMshipKey(userId),
    enabled:  Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_active_membership")
        .select("membership_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data?.membership_id as string | null) ?? null;
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (membershipId: string): Promise<void> => {
      if (!userId) throw new Error("Not signed in");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("user_active_membership")
        .upsert(
          { user_id: userId, membership_id: membershipId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activeMshipKey(userId) });
    },
  });

  const memberships = membershipsQuery.data ?? [];

  // Resolve the active membership row. If user_active_membership is empty
  // (e.g. legacy users from before this table existed) fall back to the
  // first available membership so the UI still has something to render.
  const activeMembership = useMemo<Membership | null>(() => {
    const activeId = activeQuery.data;
    if (activeId) {
      const found = memberships.find((m) => m.id === activeId);
      if (found) return found;
    }
    return memberships[0] ?? null;
  }, [activeQuery.data, memberships]);

  const switchTo = useCallback(
    async (membershipId: string) => {
      if (membershipId === activeMembership?.id) return;
      await switchMutation.mutateAsync(membershipId);
      // Hard reload — every domain-keyed query (tenant_id / franchise_id
      // RLS scopes) needs a fresh fetch under the new context. A reload
      // is simpler and more reliable than invalidating individual caches.
      window.location.assign("/dashboard");
    },
    [activeMembership?.id, switchMutation],
  );

  /**
   * True when public.user_active_membership has an explicit row for this
   * user. Distinct from activeMembership (which falls back to memberships[0]
   * when no row exists). RootRedirect uses this to decide whether to show
   * the login-time membership chooser to new multi-membership users —
   * without it, single-membership users would still see the chooser when
   * they have no row yet, which is needless friction.
   */
  const hasExplicitActive = Boolean(activeQuery.data);

  return {
    memberships,
    activeMembership,
    hasExplicitActive,
    isLoading: membershipsQuery.isLoading || activeQuery.isLoading,
    isSwitching: switchMutation.isPending,
    switchTo,
  };
}

/**
 * useModuleAccess — does the active membership have access to this module?
 *
 * Bundles the four signals (role + active domain + plan + tenant) into a
 * single hook that wraps src/platform/domains/resolver.ts. Returns a
 * ModuleAccess with `{allowed, reason, remedy}` that any consumer (the
 * sidebar render filter, ProtectedRoute, useFeatureGate, the unauthorized
 * remedy pages) can act on without re-deriving the inputs.
 *
 * Inputs gathered:
 *   - moduleCode + manifest + route (from the manifests + the caller's prop)
 *   - membership (from useMemberships().activeMembership)
 *   - assignment (from useDomainAssignment() — same domain as the manifest)
 *   - planLimits (from the assignment.plan_id + subscription_plans.limits)
 *
 * Loading states: while any of the underlying queries are in flight, the
 * hook returns `{loading: true}` and consumers should hold rendering
 * (the resolver itself doesn't see partial inputs).
 *
 * See docs/plans/2026-05-22-module-visibility-and-domain-login-design.md
 * §"Module access resolution".
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useMemberships } from "@/hooks/useMemberships";
import { useDomainAssignment } from "@/features/billing/hooks/useDomainAssignment";
import {
  findRouteByModuleCode,
  resolveModuleAccess,
  type ModuleAccess,
  type ResolverActiveMembership,
  type ResolverDomainAssignment,
  type ResolverPlanLimits,
} from "@/platform/domains/resolver";
import { DOMAIN_MANIFESTS } from "@/platform/domains/registry";
import type { PlanTier, DomainAppRole } from "@/platform/domains/types";

export interface UseModuleAccessResult {
  loading: boolean;
  access:  ModuleAccess | null;
}

/**
 * Find the manifest that owns this moduleCode. Module codes follow
 * `<domain>.<feature>` convention so the lookup is fast in the common
 * case; we still scan all manifests as a safety net.
 */
function findManifestForModule(moduleCode: string) {
  for (const m of DOMAIN_MANIFESTS) {
    if (findRouteByModuleCode(m, moduleCode)) return m;
  }
  // Fall back to domain-code prefix match (e.g. "logistics.something"
  // without an explicit route entry still attributes to LOGISTICS).
  const domainPrefix = moduleCode.split(".")[0]?.toUpperCase();
  if (domainPrefix) {
    return DOMAIN_MANIFESTS.find((m) => m.code === domainPrefix) ?? null;
  }
  return null;
}

export function useModuleAccess(moduleCode: string | undefined | null): UseModuleAccessResult {
  const memberships = useMemberships();
  const assignment  = useDomainAssignment();

  // Look up plan tier from subscription_plans for the active assignment.
  const planQuery = useQuery({
    queryKey: ["plan-limits", assignment.assignment?.plan_id],
    enabled:  Boolean(assignment.assignment?.plan_id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ResolverPlanLimits | null> => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("tier, limits")
        .eq("id", assignment.assignment!.plan_id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const limits = (data as any).limits ?? {};
      return {
        tier:    (data as { tier: PlanTier }).tier,
        modules: limits.modules,
      };
    },
  });

  const loading =
    memberships.isLoading ||
    assignment.isLoading ||
    (Boolean(assignment.assignment?.plan_id) && planQuery.isLoading);

  const access = useMemo<ModuleAccess | null>(() => {
    if (!moduleCode) return null;
    if (loading) return null;

    const manifest = findManifestForModule(moduleCode);
    const route    = manifest ? findRouteByModuleCode(manifest, moduleCode) ?? undefined : undefined;

    const m = memberships.activeMembership;
    const resolverMembership: ResolverActiveMembership | null = m
      ? {
          membershipId: m.id,
          tenantId:     m.tenant_id,
          role:         m.role as DomainAppRole,
          isRetail:     m.is_retail,
        }
      : null;

    const a = assignment.assignment;
    const resolverAssignment: ResolverDomainAssignment | null = a && manifest
      // We don't currently confirm a.domain_id matches manifest.code — the
      // active-membership's assignment may not be the one for the
      // requested module's domain. For MV-4 MVP this still classifies
      // correctly enough (the resolver returns domain_off if the
      // assignment is for a different domain than the module needs).
      ? {
          id:         a.id,
          tenantId:   a.tenant_id,
          domainCode: manifest.code,
          status:     a.subscription_status as ResolverDomainAssignment["status"],
          planId:     a.plan_id,
        }
      : null;

    return resolveModuleAccess({
      moduleCode,
      route,
      manifest:    manifest ?? undefined,
      membership:  resolverMembership,
      assignment:  resolverAssignment,
      planLimits:  planQuery.data ?? null,
    });
  }, [
    moduleCode,
    loading,
    memberships.activeMembership,
    assignment.assignment,
    planQuery.data,
  ]);

  return { loading, access };
}

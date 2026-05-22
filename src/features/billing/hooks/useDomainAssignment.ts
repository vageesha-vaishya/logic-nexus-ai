/**
 * useDomainAssignment — read + mutate the active membership's
 * tenant_domain_assignments row.
 *
 * The single source of truth for what plan the active tenant is on for
 * the active domain. Trial state (status='trialing', trial_ends_at) and
 * paid-conversion state (razorpay_subscription_id) all live here.
 *
 * Companion writes:
 *   - startTrial(planId)     — flip to status='trialing' + 14-day expiry
 *   - cancelTrial()          — flip back to status='active' + freemium plan
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md
 * §"Package catalog + trial mechanics".
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useMemberships } from "@/hooks/useMemberships";

const TRIAL_DAYS = 14;

export type AssignmentStatus = "active" | "trialing" | "past_due" | "cancelled";

export interface DomainAssignment {
  id:                       string;
  tenant_id:                string;
  domain_id:                string;
  plan_id:                  string | null;
  subscription_status:      AssignmentStatus;
  trial_ends_at:            string | null;
  activated_at:             string;
  razorpay_subscription_id: string | null;
}

export interface DomainAssignmentDerived {
  /** Days until trial_ends_at (negative if expired). NaN if not trialing. */
  trialDaysRemaining: number;
  isTrialing:         boolean;
  isPaidActive:       boolean;
  isFreemium:         boolean;
}

const assignmentKey = (tenantId: string | undefined, domainId: string | undefined) =>
  ["tenant-domain-assignment", tenantId, domainId] as const;

function deriveStatus(a: DomainAssignment | null): DomainAssignmentDerived {
  if (!a) {
    return { trialDaysRemaining: NaN, isTrialing: false, isPaidActive: false, isFreemium: false };
  }
  const isTrialing = a.subscription_status === "trialing";
  const isPaidActive = a.subscription_status === "active" && Boolean(a.razorpay_subscription_id);
  const isFreemium = a.subscription_status === "active" && !a.razorpay_subscription_id;
  let trialDaysRemaining = NaN;
  if (isTrialing && a.trial_ends_at) {
    const ms = new Date(a.trial_ends_at).getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
  return { trialDaysRemaining, isTrialing, isPaidActive, isFreemium };
}

export function useDomainAssignment() {
  const { activeMembership } = useMemberships();
  const qc = useQueryClient();

  const tenantId = activeMembership?.tenant_id;
  // domain_id isn't on the membership directly — we infer via the tenant.
  // Cheap: select tenants.domain_id once per active context.
  const tenantDomainIdQuery = useQuery({
    queryKey: ["tenant-domain-id", tenantId],
    enabled:  Boolean(tenantId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("domain_id")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.domain_id as string | null) ?? null;
    },
  });

  const domainId = tenantDomainIdQuery.data ?? undefined;

  const assignmentQuery = useQuery({
    queryKey: assignmentKey(tenantId, domainId ?? undefined),
    enabled:  Boolean(tenantId && domainId),
    staleTime: 30_000,
    queryFn: async (): Promise<DomainAssignment | null> => {
      const { data, error } = await supabase
        .from("tenant_domain_assignments")
        .select("id, tenant_id, domain_id, plan_id, subscription_status, trial_ends_at, activated_at, razorpay_subscription_id")
        .eq("tenant_id", tenantId!)
        .eq("domain_id", domainId!)
        .maybeSingle();
      if (error) throw error;
      return (data as DomainAssignment | null) ?? null;
    },
  });

  const startTrialMutation = useMutation({
    mutationFn: async (planId: string): Promise<void> => {
      if (!assignmentQuery.data?.id) throw new Error("No domain assignment for active tenant");
      const trial_ends_at = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("tenant_domain_assignments")
        .update({
          plan_id:             planId,
          subscription_status: "trialing",
          trial_ends_at,
          updated_at:          new Date().toISOString(),
        })
        .eq("id", assignmentQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentKey(tenantId, domainId ?? undefined) });
    },
  });

  const cancelTrialMutation = useMutation({
    mutationFn: async (freemiumPlanId: string): Promise<void> => {
      if (!assignmentQuery.data?.id) throw new Error("No domain assignment for active tenant");
      const { error } = await supabase
        .from("tenant_domain_assignments")
        .update({
          plan_id:             freemiumPlanId,
          subscription_status: "active",
          trial_ends_at:       null,
          updated_at:          new Date().toISOString(),
        })
        .eq("id", assignmentQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentKey(tenantId, domainId ?? undefined) });
    },
  });

  const derived = useMemo(() => deriveStatus(assignmentQuery.data ?? null), [assignmentQuery.data]);

  return {
    assignment:  assignmentQuery.data ?? null,
    domainId,
    derived,
    isLoading:   tenantDomainIdQuery.isLoading || assignmentQuery.isLoading,
    isMutating:  startTrialMutation.isPending || cancelTrialMutation.isPending,
    startTrial:  startTrialMutation.mutateAsync,
    cancelTrial: cancelTrialMutation.mutateAsync,
    TRIAL_DAYS,
  };
}

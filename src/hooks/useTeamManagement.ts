/**
 * useTeamManagement — list members + pending invites for the active tenant,
 * create new invitations, revoke pending ones, copy the magic-link URL.
 *
 * Source of truth lives in public.user_roles + public.invitations; we lean
 * on RLS to keep the scope honest. Caller must be a tenant_admin /
 * franchise_admin of the active tenant for writes.
 *
 * The active tenant is taken from useMemberships().activeMembership, so
 * switching contexts in the topbar switcher updates this view automatically.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemberships } from "@/hooks/useMemberships";

export interface TeamMember {
  user_role_id:  string;
  user_id:       string;
  email:         string;
  first_name:    string | null;
  last_name:     string | null;
  role:          string;
  franchise_id:  string | null;
  is_self:       boolean;
}

export interface TeamInvite {
  id:           string;
  email:        string;
  role:         string;
  status:       "pending" | "accepted" | "revoked" | "expired";
  expires_at:   string;
  token:        string;
  created_at:   string;
  franchise_id: string | null;
}

interface CreateInviteInput {
  email:        string;
  role:         "tenant_admin" | "franchise_admin" | "user" | "viewer";
  franchise_id?: string | null;
}

const membersKey = (tenantId: string | undefined) => ["team-members", tenantId] as const;
const invitesKey = (tenantId: string | undefined) => ["team-invites", tenantId] as const;

interface RoleRow {
  id:           string;
  role:         string;
  franchise_id: string | null;
  user_id:      string;
  profiles: {
    id:         string;
    email:      string | null;
    first_name: string | null;
    last_name:  string | null;
  } | null;
}

export function useTeamManagement() {
  const { user } = useAuth();
  const { activeMembership } = useMemberships();
  const qc = useQueryClient();

  const tenantId = activeMembership?.tenant_id;

  const membersQuery = useQuery({
    queryKey: membersKey(tenantId),
    enabled:  Boolean(tenantId),
    staleTime: 30_000,
    queryFn: async (): Promise<TeamMember[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("id, role, franchise_id, user_id, profiles:user_id ( id, email, first_name, last_name )")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return ((data as RoleRow[] | null) ?? []).map((r) => ({
        user_role_id: r.id,
        user_id:      r.user_id,
        email:        r.profiles?.email ?? "unknown",
        first_name:   r.profiles?.first_name ?? null,
        last_name:    r.profiles?.last_name  ?? null,
        role:         r.role,
        franchise_id: r.franchise_id,
        is_self:      r.user_id === user?.id,
      }));
    },
  });

  const invitesQuery = useQuery({
    queryKey: invitesKey(tenantId),
    enabled:  Boolean(tenantId),
    staleTime: 30_000,
    queryFn: async (): Promise<TeamInvite[]> => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, expires_at, token, created_at, franchise_id")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as TeamInvite[] | null) ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateInviteInput): Promise<TeamInvite> => {
      if (!user?.id || !tenantId) throw new Error("Not signed in or no active tenant");
      // Token is server-generated via gen_random_uuid()::text — we ask
      // Postgres for it through a default expression in the column, but
      // the existing column has no default. Generate client-side instead.
      const token = crypto.randomUUID();
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("invitations")
        .insert({
          tenant_id:    tenantId,
          franchise_id: input.franchise_id ?? activeMembership?.franchise_id ?? null,
          email:        input.email.toLowerCase().trim(),
          role:         input.role,
          token,
          expires_at,
          invited_by:   user.id,
          status:       "pending",
        })
        .select("id, email, role, status, expires_at, token, created_at, franchise_id")
        .single();
      if (error) throw error;
      return data as TeamInvite;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitesKey(tenantId) });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitesKey(tenantId) });
    },
  });

  const inviteLinkFor = useCallback(
    (invite: TeamInvite): string =>
      `${window.location.origin}/invite/${invite.token}`,
    [],
  );

  const pendingInvites = useMemo(
    () => (invitesQuery.data ?? []).filter((i) => i.status === "pending"),
    [invitesQuery.data],
  );

  return {
    activeTenantId: tenantId,
    members:         membersQuery.data  ?? [],
    invites:         invitesQuery.data  ?? [],
    pendingInvites,
    isLoading:       membersQuery.isLoading || invitesQuery.isLoading,
    isMutating:      createMutation.isPending || revokeMutation.isPending,
    create:          createMutation.mutateAsync,
    revoke:          revokeMutation.mutateAsync,
    inviteLinkFor,
  };
}

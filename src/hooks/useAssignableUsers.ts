import { useCallback } from "react";
import { useCRM } from "../hooks/useCRM";

export type AssignableUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type FetchOptions = {
  search?: string;
  limit?: number;
};

/**
 * Hook to fetch assignable users scoped by the current user's role.
 * - Platform admins: global search across all tenants/franchises
 * - Tenant admins: users in their tenant (all franchises within tenant)
 * - Franchise admins & users: users in their franchise only
 */
export function useAssignableUsers() {
  const { context, supabase } = useCRM();

  const fetchAssignableUsers = useCallback(
    async (opts: FetchOptions = {}) => {
      const { search, limit = 25 } = opts;
      const like = search ? `%${search}%` : undefined;

      if (!supabase) return { data: [] as AssignableUser[], error: null };

      // Platform admins: query profiles globally
      if (context?.isPlatformAdmin) {
        let query = supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .limit(limit);

        if (like) {
          // Match first_name OR last_name OR email
          query = query.or(
            `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`
          );
        }

        const { data, error } = await query;
        return { data: (data ?? []) as AssignableUser[], error };
      }

      // For tenant admin or franchise admin/users, find user_ids via user_roles then fetch profiles
      const isTenantScope = !!context?.isTenantAdmin;
      const scopeKey = isTenantScope ? "tenant_id" : "franchise_id";
      const scopeValue = isTenantScope ? context?.tenantId : context?.franchiseId;

      if (!scopeValue) return { data: [] as AssignableUser[], error: null };

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq(scopeKey, scopeValue)
        .limit(1000);

      if (rolesError) return { data: [] as AssignableUser[], error: rolesError };
      const ids = (roles ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (ids.length === 0) return { data: [] as AssignableUser[], error: null };

      let pQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids)
        .limit(limit);

      if (like) {
        pQuery = pQuery.or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`
        );
      }

      const { data, error } = await pQuery;
      return { data: (data ?? []) as AssignableUser[], error };
    },
    [supabase, context]
  );

  const formatLabel = (u: AssignableUser) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    return name ? `${name} (${u.email ?? ""})` : u.email ?? u.id;
  };

  return { fetchAssignableUsers, formatLabel };
}
/**
 * useCoreAccess — thin React-Query bindings for the Phase 1 Slice E
 * authoritative access helpers in the `core` schema:
 *
 *   - core.user_has_domain_access(p_user_id uuid, p_domain_code text)  → bool
 *   - core.has_module_access     (p_tenant_id uuid, p_module_code text,
 *                                 p_action text DEFAULT 'read')         → bool
 *
 * These are intended to become the single backing for ProtectedRoute's
 * domain + module gates (per master design §8.2.2). For Phase 1 Part 2
 * they run *alongside* the existing local checks (shadow mode) so we
 * can validate parity before flipping enforcement. See the
 * ProtectedRoute consumer for that wiring.
 *
 * Hook contract — both return `{ loading, allowed }`:
 *   - `loading=true` → query in flight; consumer must hold rendering.
 *   - `allowed=null` → required input missing (no user / no tenant /
 *     empty code). Consumers should treat this as "no opinion" — the
 *     RPC was never asked.
 *   - `allowed=boolean` → authoritative result from the core helper.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase }       from "@/integrations/supabase/client";
import { useAuth }         from "@/hooks/useAuth";
import { useMemberships }  from "@/hooks/useMemberships";

export interface CoreAccessResult {
  loading: boolean;
  /** `null` = not asked (missing input). `boolean` = RPC answer. */
  allowed: boolean | null;
}

/**
 * Does the calling user have access to the given platform domain?
 * Backs `<ProtectedRoute requiredDomainCode="…">`.
 */
export function useCoreDomainAccess(
  domainCode: string | undefined | null,
): CoreAccessResult {
  const { user } = useAuth();
  const userId   = user?.id ?? null;
  const code     = domainCode?.trim().toUpperCase() ?? "";

  const enabled = Boolean(userId) && code.length > 0;

  const q = useQuery({
    queryKey:  ["core.user_has_domain_access", userId, code],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      // RPCs live in the `core` schema; supabase.rpc defaults to public,
      // so we hop schemas for this call.
      const { data, error } = await supabase
        .schema("core")
        .rpc("user_has_domain_access", {
          p_user_id:     userId!,
          p_domain_code: code,
        });
      if (error) throw error;
      return Boolean(data);
    },
  });

  return {
    loading: enabled && q.isLoading,
    allowed: enabled ? (q.data ?? null) : null,
  };
}

/**
 * Does the active membership's tenant have access to the given module?
 * Backs `<ProtectedRoute moduleCode="…">` and the new
 * `<ProtectedRoute requiredModule="…">` (per master design §8.2.2).
 */
export function useCoreModuleAccess(
  moduleCode: string | undefined | null,
  action: "read" | "write" | "delete" = "read",
): CoreAccessResult {
  const memberships = useMemberships();
  const tenantId    = memberships.activeMembership?.tenant_id ?? null;
  const code        = moduleCode?.trim() ?? "";

  const enabled = Boolean(tenantId) && code.length > 0;

  const q = useQuery({
    queryKey:  ["core.has_module_access", tenantId, code, action],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .schema("core")
        .rpc("has_module_access", {
          p_tenant_id:   tenantId!,
          p_module_code: code,
          p_action:      action,
        });
      if (error) throw error;
      return Boolean(data);
    },
  });

  return {
    loading: enabled && (memberships.isLoading || q.isLoading),
    allowed: enabled ? (q.data ?? null) : null,
  };
}

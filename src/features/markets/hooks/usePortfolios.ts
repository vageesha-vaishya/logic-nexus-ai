/**
 * Markets — portfolios hooks (full CRUD).
 *
 * Edge function contract (supabase/functions/markets-portfolios/index.ts):
 *   GET    /markets-portfolios                      → list
 *   POST   /markets-portfolios { …fields }          → create
 *   PATCH  /markets-portfolios { id, …fields }      → update
 *   DELETE /markets-portfolios { id }               → delete
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type {
  CreatePortfolioInput,
  CrmContactSearchResult,
  Portfolio,
  PortfoliosListResponse,
  PortfolioMutationResponse,
} from "../types";

export type UpdatePortfolioInput = Partial<CreatePortfolioInput> & { id: string };

/** Prefer the most-scoped role: franchise_admin > tenant_admin > any. */
function useActiveScope() {
  const { roles, user } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId:   active?.tenant_id   ?? null,
    franchiseId: active?.franchise_id ?? null,
    userId:     user?.id            ?? null,
  };
}

// ── List ─────────────────────────────────────────────────────────────────

export function usePortfolios() {
  const { tenantId } = useActiveScope();

  return useQuery({
    queryKey: marketsKeys.portfolios.list({ tenantId }),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<Portfolio[]> => {
      if (!tenantId) throw new Error("No active tenant");
      const { data, error } = await supabase.functions.invoke<PortfoliosListResponse>(
        "markets-portfolios",
        { method: "GET", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Failed to fetch portfolios");
      return data?.data ?? [];
    },
  });
}

// ── Create ───────────────────────────────────────────────────────────────

export function useCreatePortfolio() {
  const queryClient  = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<Portfolio, Error, CreatePortfolioInput>({
    mutationFn: async (input) => {
      if (!tenantId || !franchiseId) throw new Error("Cannot create portfolio without tenant/franchise context");
      if (!input.name?.trim()) throw new Error("Portfolio name is required");

      const { data, error } = await supabase.functions.invoke<PortfolioMutationResponse>(
        "markets-portfolios",
        {
          method: "POST",
          headers: { "x-tenant-id": tenantId, "x-franchise-id": franchiseId },
          body: {
            name:          input.name.trim(),
            description:   input.description  ?? null,
            mode:          input.mode         ?? "paper",
            base_currency: input.base_currency ?? "INR",
            holder_type:   input.holder_type  ?? "self_directed",
            contact_id:    input.contact_id   ?? null,
            account_id:    input.account_id   ?? null,
          },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to create portfolio");
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: (created) => {
      queryClient.setQueriesData<Portfolio[]>(
        { queryKey: marketsKeys.portfolios.all() },
        (prev) => (prev ? [created, ...prev] : [created]),
      );
      queryClient.invalidateQueries({ queryKey: marketsKeys.portfolios.all() });
    },
  });
}

// ── Update ───────────────────────────────────────────────────────────────

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();

  return useMutation<Portfolio, Error, UpdatePortfolioInput>({
    mutationFn: async (input) => {
      if (!tenantId) throw new Error("No active tenant");
      if (!input.id)  throw new Error("Portfolio id is required");

      const { data, error } = await supabase.functions.invoke<PortfolioMutationResponse>(
        "markets-portfolios",
        {
          method: "PATCH",
          headers: { "x-tenant-id": tenantId },
          body: input,
        },
      );
      if (error) throw new Error(error.message ?? "Failed to update portfolio");
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: (updated) => {
      // Replace the stale item in every list slice
      queryClient.setQueriesData<Portfolio[]>(
        { queryKey: marketsKeys.portfolios.all() },
        (prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? [updated],
      );
      // Also update the detail cache if it exists
      queryClient.setQueryData(marketsKeys.portfolios.detail(updated.id), updated);
    },
  });
}

// ── Delete ───────────────────────────────────────────────────────────────

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      if (!tenantId) throw new Error("No active tenant");
      const { error } = await supabase.functions.invoke(
        "markets-portfolios",
        {
          method: "DELETE",
          headers: { "x-tenant-id": tenantId },
          body: { id },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to delete portfolio");
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData<Portfolio[]>(
        { queryKey: marketsKeys.portfolios.all() },
        (prev) => prev?.filter((p) => p.id !== deletedId) ?? [],
      );
      queryClient.removeQueries({ queryKey: marketsKeys.portfolios.detail(deletedId) });
    },
  });
}

// ── CRM contact search ───────────────────────────────────────────────────

export function useCrmContactSearch(query: string) {
  const debounced    = useDebounce(query.trim(), 300);
  const { userId }   = useActiveScope();

  return useQuery<CrmContactSearchResult[]>({
    // Don't include tenantId in the key — RLS handles scoping
    queryKey: ["crm", "contacts", "search", debounced],
    enabled:  Boolean(userId) && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<CrmContactSearchResult[]> => {
      // No explicit tenant_id filter — RLS on the contacts table scopes results
      // correctly for every role (platform_admin sees all, tenant/franchise admins
      // see only their own). Adding a client-side filter would break platform admins
      // whose active-scope tenant differs from the tenant that owns the contacts.
      const { data, error } = await (supabase as any)
        .from("contacts")
        .select("id, first_name, last_name, email, account_id, account:accounts(name)")
        .or(`first_name.ilike.%${debounced}%,last_name.ilike.%${debounced}%,email.ilike.%${debounced}%`)
        .limit(20);

      if (error) throw new Error(error.message);
      return ((data ?? []) as any[]).map((c: any) => ({
        id:           c.id,
        first_name:   c.first_name,
        last_name:    c.last_name,
        email:        c.email,
        account_id:   c.account_id,
        account_name: c.account?.name ?? "—",
      }));
    },
  });
}

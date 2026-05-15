/**
 * Markets — transaction hooks.
 * Wraps markets-transactions edge function (GET / POST / PATCH / DELETE).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  AssetClass,
  CreateTransactionInput,
  Transaction,
  TransactionsListResponse,
} from "../types";

// ── Scope helper (same pattern as usePortfolios) ─────────────────────────
function useActiveScope() {
  const { roles, user } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return { tenantId: active?.tenant_id ?? null, userId: user?.id ?? null };
}

const txnKeys = {
  all:    (portfolioId: string) => ["markets","transactions", portfolioId] as const,
  list:   (portfolioId: string, assetClass?: AssetClass) =>
            [...txnKeys.all(portfolioId), assetClass ?? "all"] as const,
};

// ── List transactions for a portfolio ────────────────────────────────────
export function useTransactions(portfolioId: string | undefined, assetClass?: AssetClass) {
  const { tenantId } = useActiveScope();

  return useQuery({
    queryKey: txnKeys.list(portfolioId ?? "", assetClass),
    enabled:  Boolean(portfolioId) && Boolean(tenantId),
    staleTime: 30_000,
    queryFn: async (): Promise<Transaction[]> => {
      const params = new URLSearchParams({ portfolio_id: portfolioId!, limit: "200" });
      if (assetClass) params.set("asset_class", assetClass);

      const { data, error } = await supabase.functions.invoke<TransactionsListResponse>(
        `markets-transactions?${params.toString()}`,
        { method: "GET", headers: { "x-tenant-id": tenantId! } },
      );
      if (error) throw new Error(error.message ?? "Failed to fetch transactions");
      return data?.data ?? [];
    },
  });
}

// ── Create a transaction ──────────────────────────────────────────────────
export function useCreateTransaction(portfolioId: string | undefined) {
  const queryClient  = useQueryClient();
  const { tenantId } = useActiveScope();

  return useMutation<Transaction, Error, CreateTransactionInput>({
    mutationFn: async (input) => {
      if (!tenantId) throw new Error("No active tenant");
      if (!portfolioId) throw new Error("No portfolio selected");

      const { data, error } = await supabase.functions.invoke<{ data: Transaction }>(
        "markets-transactions",
        {
          method: "POST",
          headers: { "x-tenant-id": tenantId },
          body: { ...input, portfolio_id: portfolioId },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to create transaction");
      if (!data?.data) throw new Error("No data returned");
      return data.data;
    },
    onSuccess: () => {
      if (portfolioId) {
        queryClient.invalidateQueries({ queryKey: txnKeys.all(portfolioId) });
        // Also invalidate holdings since they update after a transaction
        queryClient.invalidateQueries({ queryKey: ["markets", "portfolios", "detail", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["markets", "portfolios", "detail", portfolioId, "holdings"] });
      }
    },
  });
}

// ── Delete a transaction ──────────────────────────────────────────────────
export function useDeleteTransaction(portfolioId: string | undefined) {
  const queryClient  = useQueryClient();
  const { tenantId } = useActiveScope();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      if (!tenantId) throw new Error("No active tenant");
      const { error } = await supabase.functions.invoke(
        "markets-transactions",
        {
          method: "DELETE",
          headers: { "x-tenant-id": tenantId },
          body: { id },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to delete transaction");
    },
    onSuccess: () => {
      if (portfolioId) {
        queryClient.invalidateQueries({ queryKey: txnKeys.all(portfolioId) });
        queryClient.invalidateQueries({ queryKey: ["markets", "portfolios", "detail", portfolioId, "holdings"] });
      }
    },
  });
}

// ── Instrument search for the transaction picker ─────────────────────────
// Uses markets-watchlists GET ?path=search-instruments&q=<query>
export function useInstrumentSearch(query: string) {
  const { tenantId } = useActiveScope();
  const q = query.trim();

  return useQuery({
    queryKey: ["markets", "instruments", "search", q],
    enabled:  Boolean(tenantId) && q.length >= 1,
    staleTime: 60_000,
    queryFn: async (): Promise<Array<{ id: string; symbol: string; exchange: string; instrument_type: string; isin: string | null }>> => {
      const { data, error } = await supabase.functions.invoke<{
        data: Array<{ id: string; symbol: string; exchange: string; instrument_type: string; isin: string | null }>
      }>(`markets-watchlists?path=search-instruments&q=${encodeURIComponent(q)}&limit=20`, {
        method: "GET",
        headers: { "x-tenant-id": tenantId! },
      });
      if (error) return [];
      return data?.data ?? [];
    },
  });
}

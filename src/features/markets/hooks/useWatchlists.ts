/**
 * Markets — watchlists hooks.
 *
 * Wraps the `markets-watchlists` edge function. Same RLS + domain-access
 * pattern as portfolios: owner_user_id = auth.uid() at the row level,
 * tenant_domain_assignments at the function level.
 *
 * Endpoints (see supabase/functions/markets-watchlists/index.ts):
 *   GET    /markets-watchlists                            → list (with item_count)
 *   GET    /markets-watchlists?id=<uuid>                  → detail + items
 *   POST   /markets-watchlists { name, is_default? }      → create
 *   PATCH  /markets-watchlists?id=<uuid> { ... }          → update
 *   DELETE /markets-watchlists?id=<uuid>                  → delete (cascades)
 *   POST   /markets-watchlists?id=<uuid>&path=items       → add item
 *   DELETE /markets-watchlists?id=<uuid>&item_id=<uuid>   → remove item
 *   GET    /markets-watchlists?path=search-instruments&q  → instrument search
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type {
  AddWatchlistItemInput,
  CreateWatchlistInput,
  Instrument,
  InstrumentDetail,
  UpdateWatchlistInput,
  Watchlist,
  WatchlistDetail,
} from "../types";

function useActiveScope(): { tenantId: string | null; franchiseId: string | null } {
  const { roles } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped = roles.find((r) => Boolean(r.tenant_id));
  const active = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId: active?.tenant_id ?? null,
    franchiseId: active?.franchise_id ?? null,
  };
}

// ─── List ──────────────────────────────────────────────────────────────

export function useWatchlists() {
  const { tenantId } = useActiveScope();
  return useQuery({
    queryKey: marketsKeys.watchlists.list({ tenantId }),
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<Watchlist[]> => {
      if (!tenantId) throw new Error("No active tenant");
      const { data, error } = await supabase.functions.invoke<{ data: Watchlist[]; count: number }>(
        "markets-watchlists",
        { method: "GET", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Failed to load watchlists");
      return data?.data ?? [];
    },
    staleTime: 30_000,
  });
}

// ─── Detail (watchlist + items) ────────────────────────────────────────

export function useWatchlist(id: string | undefined) {
  const { tenantId } = useActiveScope();
  return useQuery({
    queryKey: marketsKeys.watchlists.detail(id ?? ""),
    enabled: Boolean(id && tenantId),
    queryFn: async (): Promise<WatchlistDetail> => {
      if (!id || !tenantId) throw new Error("Missing id or tenant");
      const { data, error } = await supabase.functions.invoke<{ data: WatchlistDetail }>(
        `markets-watchlists?id=${encodeURIComponent(id)}`,
        { method: "GET", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Failed to load watchlist");
      if (!data?.data) throw new Error("Watchlist not found");
      return data.data;
    },
    staleTime: 15_000,
  });
}

// ─── Create ────────────────────────────────────────────────────────────

export function useCreateWatchlist() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();
  return useMutation<Watchlist, Error, CreateWatchlistInput>({
    mutationFn: async (input) => {
      if (!tenantId || !franchiseId) {
        throw new Error("Cannot create watchlist without tenant/franchise context");
      }
      if (!input.name?.trim()) throw new Error("Name is required");
      const { data, error } = await supabase.functions.invoke<{ data: Watchlist }>(
        "markets-watchlists",
        {
          method: "POST",
          headers: { "x-tenant-id": tenantId, "x-franchise-id": franchiseId },
          body: { name: input.name.trim(), is_default: Boolean(input.is_default) },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to create watchlist");
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.all() });
    },
  });
}

// ─── Update ────────────────────────────────────────────────────────────

export function useUpdateWatchlist() {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();
  return useMutation<Watchlist, Error, { id: string; patch: UpdateWatchlistInput }>({
    mutationFn: async ({ id, patch }) => {
      if (!tenantId) throw new Error("No tenant in context");
      const { data, error } = await supabase.functions.invoke<{ data: Watchlist }>(
        `markets-watchlists?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "x-tenant-id": tenantId },
          body: patch,
        },
      );
      if (error) throw new Error(error.message ?? "Failed to update watchlist");
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.all() });
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.detail(id) });
    },
  });
}

// ─── Delete ────────────────────────────────────────────────────────────

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      if (!tenantId) throw new Error("No tenant in context");
      const { error } = await supabase.functions.invoke(
        `markets-watchlists?id=${encodeURIComponent(id)}`,
        { method: "DELETE", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Failed to delete watchlist");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.all() });
    },
  });
}

// ─── Add item ──────────────────────────────────────────────────────────

export function useAddWatchlistItem(watchlistId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();
  return useMutation<unknown, Error, AddWatchlistItemInput>({
    mutationFn: async (input) => {
      if (!watchlistId) throw new Error("No watchlist id");
      if (!tenantId || !franchiseId) throw new Error("Missing tenant/franchise context");
      if (!input.instrument_id) throw new Error("instrument_id is required");
      const { data, error } = await supabase.functions.invoke(
        `markets-watchlists?id=${encodeURIComponent(watchlistId)}&path=items`,
        {
          method: "POST",
          headers: { "x-tenant-id": tenantId, "x-franchise-id": franchiseId },
          body: { instrument_id: input.instrument_id, note: input.note ?? null },
        },
      );
      if (error) {
        // 409 = already on the list. Surface a nicer message.
        const msg = error.message ?? "";
        if (msg.toLowerCase().includes("duplicate") || msg.includes("23505")) {
          throw new Error("That instrument is already on this watchlist.");
        }
        throw new Error(msg || "Failed to add item");
      }
      return data;
    },
    onSuccess: () => {
      if (!watchlistId) return;
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.detail(watchlistId) });
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.all() });
    },
  });
}

// ─── Remove item ───────────────────────────────────────────────────────

export function useRemoveWatchlistItem(watchlistId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();
  return useMutation<void, Error, string>({
    mutationFn: async (itemId) => {
      if (!watchlistId) throw new Error("No watchlist id");
      if (!tenantId) throw new Error("No tenant in context");
      const { error } = await supabase.functions.invoke(
        `markets-watchlists?id=${encodeURIComponent(watchlistId)}&item_id=${encodeURIComponent(itemId)}`,
        { method: "DELETE", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Failed to remove item");
    },
    onSuccess: () => {
      if (!watchlistId) return;
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.detail(watchlistId) });
      queryClient.invalidateQueries({ queryKey: marketsKeys.watchlists.all() });
    },
  });
}

// ─── Instrument detail (metadata + on-watchlists + news + sentiment) ──

export function useInstrumentDetail(instrumentId: string | undefined) {
  const { tenantId } = useActiveScope();
  return useQuery({
    queryKey: ["markets", "instrument_detail", instrumentId ?? ""] as const,
    enabled: Boolean(instrumentId && tenantId),
    queryFn: async (): Promise<InstrumentDetail> => {
      if (!instrumentId || !tenantId) throw new Error("Missing id or tenant");
      const { data, error } = await supabase.functions.invoke<{ data: InstrumentDetail }>(
        `markets-watchlists?path=instrument-detail&instrument_id=${encodeURIComponent(instrumentId)}`,
        { method: "GET", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Failed to load instrument");
      if (!data?.data) throw new Error("Instrument not found");
      return data.data;
    },
    staleTime: 30_000,
  });
}

// ─── Instrument search (autocomplete) ──────────────────────────────────

export function useInstrumentSearch(query: string) {
  const { tenantId } = useActiveScope();
  const q = query.trim();
  return useQuery({
    queryKey: ["markets", "instrument_search", q] as const,
    enabled: Boolean(tenantId) && q.length > 0,
    queryFn: async (): Promise<Instrument[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke<{ data: Instrument[] }>(
        `markets-watchlists?path=search-instruments&q=${encodeURIComponent(q)}&limit=15`,
        { method: "GET", headers: { "x-tenant-id": tenantId } },
      );
      if (error) throw new Error(error.message ?? "Search failed");
      return data?.data ?? [];
    },
    staleTime: 60_000,
  });
}

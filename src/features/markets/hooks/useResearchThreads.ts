import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type {
  CreateThreadInput, ResearchMessage, ResearchThread, SendMessageInput,
} from "../types";

function useScope() {
  const { roles } = useAuth();
  const r = roles.find(x => x.franchise_id && x.tenant_id) ?? roles.find(x => x.tenant_id) ?? roles[0];
  return { tenantId: r?.tenant_id ?? null, franchiseId: r?.franchise_id ?? null };
}

function headers(tenantId: string, franchiseId?: string | null) {
  const h: Record<string, string> = { "x-tenant-id": tenantId };
  if (franchiseId) h["x-franchise-id"] = franchiseId;
  return h;
}

// ── Thread list ───────────────────────────────────────────────────────────

export function useResearchThreads() {
  const { tenantId, franchiseId } = useScope();

  return useQuery({
    queryKey: marketsKeys.threads.list(),
    enabled:  Boolean(tenantId),
    queryFn:  async (): Promise<ResearchThread[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke<{ data: ResearchThread[] }>(
        "markets-research?path=threads",
        { method: "GET", headers: headers(tenantId, franchiseId) },
      );
      if (error) throw new Error(error.message ?? "Failed to load research threads");
      return data?.data ?? [];
    },
    staleTime: 30_000,
  });
}

// ── Thread messages ───────────────────────────────────────────────────────

export function useResearchMessages(threadId: string | undefined) {
  const { tenantId, franchiseId } = useScope();

  return useQuery({
    queryKey: threadId ? marketsKeys.threads.messages(threadId) : ["noop"],
    enabled:  Boolean(threadId && tenantId),
    queryFn:  async (): Promise<ResearchMessage[]> => {
      if (!threadId || !tenantId) return [];
      const { data, error } = await supabase.functions.invoke<{ data: ResearchMessage[] }>(
        `markets-research?path=messages&thread_id=${threadId}`,
        { method: "GET", headers: headers(tenantId, franchiseId) },
      );
      if (error) throw new Error(error.message ?? "Failed to load messages");
      return data?.data ?? [];
    },
    staleTime: 10_000,
  });
}

// ── Create thread ─────────────────────────────────────────────────────────

export function useCreateThread() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useScope();

  return useMutation<ResearchThread, Error, CreateThreadInput>({
    mutationFn: async (input) => {
      if (!tenantId) throw new Error("Missing tenant context");
      const { data, error } = await supabase.functions.invoke<{ data: ResearchThread }>(
        "markets-research?path=threads",
        { method: "POST", headers: headers(tenantId, franchiseId), body: input },
      );
      if (error) throw new Error(error.message ?? "Failed to create thread");
      if (!data?.data) throw new Error("No data returned");
      return data.data;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<ResearchThread[]>(
        marketsKeys.threads.list(),
        (prev) => prev ? [created, ...prev] : [created],
      );
    },
  });
}

// ── Send message ──────────────────────────────────────────────────────────

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useScope();

  return useMutation<
    ResearchMessage,
    Error,
    SendMessageInput,
    { optimisticId: string }
  >({
    // Add optimistic user message before the AI responds
    onMutate: async (input) => {
      const key = marketsKeys.threads.messages(input.thread_id);
      await queryClient.cancelQueries({ queryKey: key });

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: ResearchMessage = {
        id:            optimisticId,
        role:          "user",
        content:       input.content,
        citations:     null,
        sequence_num:  null,
        is_error:      false,
        llm_model:     null,
        input_tokens:  null,
        output_tokens: null,
        cost_usd:      null,
        created_at:    new Date().toISOString(),
      };
      queryClient.setQueryData<ResearchMessage[]>(key, (prev) =>
        prev ? [...prev, optimisticMsg] : [optimisticMsg],
      );
      return { optimisticId };
    },

    mutationFn: async (input) => {
      if (!tenantId) throw new Error("Missing tenant context");
      const { data, error } = await supabase.functions.invoke<{ data: ResearchMessage }>(
        "markets-research?path=message",
        { method: "POST", headers: headers(tenantId, franchiseId), body: input },
      );
      if (error) throw new Error(error.message ?? "Failed to send message");
      if (!data?.data) throw new Error("No response received");
      return data.data;
    },

    onSuccess: (assistantMsg, input) => {
      // Append real assistant message; invalidate to get server-authoritative sequence_nums
      const key = marketsKeys.threads.messages(input.thread_id);
      queryClient.setQueryData<ResearchMessage[]>(key, (prev) => {
        if (!prev) return [assistantMsg];
        // Remove any stale optimistic messages for this thread
        const withoutOptimistic = prev.filter(m => !m.id.startsWith("optimistic-"));
        return [...withoutOptimistic, assistantMsg];
      });
      // Update thread list last_message_at
      queryClient.setQueryData<ResearchThread[]>(marketsKeys.threads.list(), (prev) =>
        prev?.map(t => t.id === input.thread_id
          ? { ...t, last_message_at: assistantMsg.created_at, message_count: t.message_count + 2 }
          : t,
        ) ?? prev,
      );
    },

    onError: (_err, input, ctx) => {
      // Roll back optimistic user message
      const key = marketsKeys.threads.messages(input.thread_id);
      if (ctx?.optimisticId) {
        queryClient.setQueryData<ResearchMessage[]>(key, (prev) =>
          prev?.filter(m => m.id !== ctx.optimisticId) ?? prev,
        );
      }
    },
  });
}

// ── Rename / archive thread ───────────────────────────────────────────────

export function useUpdateThread() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useScope();

  return useMutation<
    ResearchThread,
    Error,
    { id: string; title?: string; status?: "active" | "archived" }
  >({
    mutationFn: async (input) => {
      if (!tenantId) throw new Error("Missing tenant context");
      const { data, error } = await supabase.functions.invoke<{ data: ResearchThread }>(
        "markets-research?path=threads",
        { method: "PATCH", headers: headers(tenantId, franchiseId), body: input },
      );
      if (error) throw new Error(error.message ?? "Failed to update thread");
      if (!data?.data) throw new Error("No data returned");
      return data.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ResearchThread[]>(marketsKeys.threads.list(), (prev) =>
        prev
          ?.map(t => t.id === updated.id ? { ...t, ...updated } : t)
          .filter(t => t.status === "active") ?? prev,
      );
    },
  });
}

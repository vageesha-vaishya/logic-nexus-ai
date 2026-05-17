/**
 * Markets — AI Chat hooks
 *
 * Provides TanStack Query wrappers for:
 *   - useChatSessions()      list sessions, refetch on window focus
 *   - useCreateSession()     create session, invalidate list
 *   - useDeleteSession()     delete session, invalidate list
 *   - useChatMessages(id)    list messages for a session
 *
 * Streaming is handled directly in the component via fetch + ReadableStream.
 * Per ADR-025: server state via react-query only.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL =
  import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ── Query keys ─────────────────────────────────────────────────────────────

export const aiChatKeys = {
  all: ["ai-chat"] as const,
  sessions: () => [...aiChatKeys.all, "sessions"] as const,
  messages: (sessionId: string) =>
    [...aiChatKeys.all, "messages", sessionId] as const,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function useAuthToken(): string | undefined {
  const { session } = useAuth() as any;
  return session?.access_token as string | undefined;
}

async function apiFetch<T>(
  path: string,
  token: string | undefined,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── useChatSessions ────────────────────────────────────────────────────────

export function useChatSessions() {
  const token = useAuthToken();
  return useQuery<Session[]>({
    queryKey: aiChatKeys.sessions(),
    queryFn: () => apiFetch<Session[]>("/v1/chat/sessions", token),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

// ── useCreateSession ────────────────────────────────────────────────────────

export function useCreateSession() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  return useMutation<Session, Error, { title?: string } | undefined>({
    mutationFn: (body) =>
      apiFetch<Session>("/v1/chat/sessions", token, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() });
    },
  });
}

// ── useDeleteSession ────────────────────────────────────────────────────────

export function useDeleteSession() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/v1/chat/sessions/${id}`, token, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() });
    },
  });
}

// ── useChatMessages ────────────────────────────────────────────────────────

export function useChatMessages(sessionId: string | null) {
  const token = useAuthToken();
  return useQuery<Message[]>({
    queryKey: sessionId ? aiChatKeys.messages(sessionId) : ["ai-chat", "messages", "__none__"],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const res = await apiFetch<{ data: Message[] }>(
        `/v1/chat/sessions/${sessionId}/messages`,
        token,
      );
      return res.data ?? [];
    },
    staleTime: 15_000,
  });
}

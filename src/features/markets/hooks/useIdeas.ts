import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

export interface IdeaItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  symbol?: string;
  direction: "bullish" | "bearish" | "neutral";
  timeframe?: string;
  target_price?: number;
  stop_loss?: number;
  entry_price?: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  reaction_counts: { like: number; fire: number; bookmark: number };
  comment_count: number;
  my_reactions: string[];
}

export interface Comment {
  id: string;
  idea_id: string;
  user_id: string;
  body: string;
  parent_comment_id?: string;
  created_at: string;
}

interface IdeasFeedResponse {
  data: IdeaItem[];
  next_cursor: string | null;
  total_count: number;
}

interface CommentListResponse {
  data: Comment[];
}

interface UserProfile {
  user_id: string;
  follower_count: number;
  following_count: number;
  idea_count: number;
  is_following: boolean;
}

interface IdeasFeedParams {
  feed?: "all" | "following";
  symbol?: string;
  direction?: string;
}

async function getToken(): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const ideasKeys = {
  all: ["markets", "ideas"] as const,
  feed: (params: IdeasFeedParams) => [...ideasKeys.all, "feed", params] as const,
  detail: (id: string) => [...ideasKeys.all, "detail", id] as const,
  comments: (ideaId: string) => [...ideasKeys.all, "comments", ideaId] as const,
  userProfile: (userId: string) => [...ideasKeys.all, "profile", userId] as const,
};

export function useIdeasFeed(params: IdeasFeedParams) {
  return useInfiniteQuery({
    queryKey: ideasKeys.feed(params),
    staleTime: 30_000,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<IdeasFeedResponse> => {
      const qs = new URLSearchParams();
      if (params.feed) qs.set("feed", params.feed);
      if (params.symbol) qs.set("symbol", params.symbol);
      if (params.direction && params.direction !== "all") qs.set("direction", params.direction);
      qs.set("limit", "20");
      if (pageParam) qs.set("cursor", pageParam);
      return apiFetch<IdeasFeedResponse>(`/v1/ideas?${qs.toString()}`);
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useIdea(id: string) {
  return useQuery({
    queryKey: ideasKeys.detail(id),
    staleTime: 15_000,
    enabled: Boolean(id),
    queryFn: () => apiFetch<IdeaItem>(`/v1/ideas/${id}`),
  });
}

export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<IdeaItem, "id" | "user_id" | "view_count" | "created_at" | "updated_at" | "reaction_counts" | "comment_count" | "my_reactions">) =>
      apiFetch<IdeaItem>("/v1/ideas", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ideasKeys.all }),
  });
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<IdeaItem> & { id: string }) =>
      apiFetch<IdeaItem>(`/v1/ideas/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ideasKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: ideasKeys.all });
    },
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/ideas/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ideasKeys.all }),
  });
}

export function useToggleReaction(ideaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reaction_type: "like" | "fire" | "bookmark") =>
      apiFetch<void>(`/v1/ideas/${ideaId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ reaction_type }),
      }),
    onMutate: async (reaction_type) => {
      await qc.cancelQueries({ queryKey: ideasKeys.detail(ideaId) });
      const prev = qc.getQueryData<IdeaItem>(ideasKeys.detail(ideaId));
      if (prev) {
        const has = prev.my_reactions.includes(reaction_type);
        qc.setQueryData<IdeaItem>(ideasKeys.detail(ideaId), {
          ...prev,
          my_reactions: has
            ? prev.my_reactions.filter((r) => r !== reaction_type)
            : [...prev.my_reactions, reaction_type],
          reaction_counts: {
            ...prev.reaction_counts,
            [reaction_type]: prev.reaction_counts[reaction_type] + (has ? -1 : 1),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ideasKeys.detail(ideaId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ideasKeys.detail(ideaId) }),
  });
}

export function useIdeaComments(ideaId: string) {
  return useQuery({
    queryKey: ideasKeys.comments(ideaId),
    staleTime: 15_000,
    enabled: Boolean(ideaId),
    queryFn: async () => {
      const res = await apiFetch<CommentListResponse>(`/v1/ideas/${ideaId}/comments`);
      return res.data;
    },
  });
}

export function useAddComment(ideaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; parent_comment_id?: string }) =>
      apiFetch<Comment>(`/v1/ideas/${ideaId}/comments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ideasKeys.comments(ideaId) }),
  });
}

export function useDeleteComment(ideaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiFetch<void>(`/v1/ideas/${ideaId}/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ideasKeys.comments(ideaId) }),
  });
}

export function useFollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/v1/users/${userId}/follow`, { method: "POST" }),
    onSuccess: (_data, userId) =>
      qc.invalidateQueries({ queryKey: ideasKeys.userProfile(userId) }),
  });
}

export function useUnfollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/v1/users/${userId}/follow`, { method: "DELETE" }),
    onSuccess: (_data, userId) =>
      qc.invalidateQueries({ queryKey: ideasKeys.userProfile(userId) }),
  });
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ideasKeys.userProfile(userId),
    staleTime: 60_000,
    enabled: Boolean(userId),
    queryFn: () => apiFetch<UserProfile>(`/v1/users/${userId}/profile`),
  });
}

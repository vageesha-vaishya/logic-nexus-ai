/**
 * useNotifications
 *
 * In-app notifications backed by markets.notifications + Supabase Realtime.
 *
 * Delivery is in-app only — a backgrounded mobile app will NOT receive these
 * until it is reopened (system push would require FCM/APNs, deliberately
 * deferred). Designs depending on backgrounded delivery should not rely on
 * this hook.
 *
 *   useNotificationsRealtime()  — side-effect: subscribes globally and toasts
 *                                 on new inserts. Mount once in the layout.
 *   useNotifications()          — data + mutations for the bell popover.
 */

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { NotificationRow, NotificationSeverity } from '../types';

const RECENT_LIMIT = 30;
const NOTIFICATIONS_KEY = (userId: string) => ['notifications', userId];

// ── Realtime subscription (side-effect only) ──────────────────────────────────

function toastFor(row: NotificationRow): void {
  const action = row.link_url
    ? {
        label: 'View',
        onClick: () => {
          window.location.href = row.link_url as string;
        },
      }
    : undefined;
  const opts = { description: row.body, duration: 8000, action };
  switch (row.severity satisfies NotificationSeverity) {
    case 'critical':
      toast.error(row.title, opts);
      break;
    case 'warning':
      toast.warning(row.title, opts);
      break;
    case 'success':
      toast.success(row.title, opts);
      break;
    case 'info':
    default:
      toast.info(row.title, opts);
      break;
  }
}

export function useNotificationsRealtime(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'markets',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow | undefined;
          if (!row?.id || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);

          toastFor(row);

          // Refresh the bell's data without a follow-up fetch.
          queryClient.setQueryData<NotificationRow[]>(
            NOTIFICATIONS_KEY(user.id),
            (prev) => {
              const next = [row, ...(prev ?? [])];
              return next.slice(0, RECENT_LIMIT);
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

// ── Data + mutations for the bell ─────────────────────────────────────────────

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';

  const query = useQuery<NotificationRow[]>({
    queryKey: NOTIFICATIONS_KEY(userId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .schema('markets')
        .from('notifications')
        .select('id, user_id, category, severity, title, body, data, link_url, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT);
      return (data ?? []) as NotificationRow[];
    },
    enabled: !!userId,
    // Realtime keeps this fresh; the interval is a safety net for missed events.
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema('markets')
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null);
      if (error) throw new Error(error.message ?? 'Failed to mark notification as read');
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<NotificationRow[]>(NOTIFICATIONS_KEY(userId), (prev) =>
        (prev ?? []).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema('markets')
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) throw new Error(error.message ?? 'Failed to mark notifications as read');
    },
    onSuccess: () => {
      const now = new Date().toISOString();
      queryClient.setQueryData<NotificationRow[]>(NOTIFICATIONS_KEY(userId), (prev) =>
        (prev ?? []).map((n) => (n.read_at ? n : { ...n, read_at: now })),
      );
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}

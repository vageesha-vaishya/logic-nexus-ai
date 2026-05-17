/**
 * useAlertRealtime
 *
 * Subscribes to Supabase Realtime postgres_changes for the current user's
 * price_alerts rows in the `markets` schema. Whenever a row transitions to
 * status='triggered', a Sonner toast is shown automatically.
 *
 * This is a side-effect-only hook — it has no return value. Mount it once at
 * a high level (DashboardLayout) so it stays active across all pages.
 *
 * Requirements:
 *   - REPLICA IDENTITY FULL must be set on markets.price_alerts (already done)
 *   - Supabase Realtime must have the `markets` schema enabled for the project
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAlertRealtime(): void {
  const { user } = useAuth();
  // Track alert IDs we have already toasted so we never fire twice for the
  // same row even if Realtime delivers a duplicate event.
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('price-alerts-triggered')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'markets',
          table: 'price_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;

          // Only act on newly-triggered alerts
          if (row.status !== 'triggered') return;

          const id = String(row.id ?? '');
          if (!id || seenIds.current.has(id)) return;
          seenIds.current.add(id);

          const symbol = String(row.symbol ?? '');
          const condition = String(row.condition ?? '');
          const triggerPrice = Number(row.trigger_price ?? 0);
          const triggeredPrice = Number(row.triggered_price ?? triggerPrice);
          const direction = condition === 'above' ? 'risen above' : 'fallen below';

          toast.success(`Alert: ${symbol}`, {
            description: `${symbol} has ${direction} ₹${triggerPrice.toLocaleString('en-IN')} — now at ₹${triggeredPrice.toLocaleString('en-IN')}`,
            duration: 8000,
            action: {
              label: 'View Alerts',
              onClick: () => {
                window.location.href = '/dashboard/markets/alerts';
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
}

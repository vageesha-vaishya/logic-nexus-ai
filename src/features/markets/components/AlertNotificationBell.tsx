/**
 * AlertNotificationBell
 *
 * A notification bell icon for the Markets header. Shows a red badge with
 * the count of "unread" triggered alerts (triggered in the last 24 h and not
 * yet acknowledged locally via localStorage).
 *
 * Clicking the bell opens a Popover with:
 *   - A list of recently triggered alerts (up to 10)
 *   - "Mark all read" button — writes IDs to localStorage
 *   - "View all alerts" link
 *   - Empty state when nothing has triggered
 *
 * Read state is stored in localStorage under 'lnai_read_alerts' as a JSON
 * array of alert ID strings, keyed per-user via a separate key derived from
 * the user ID.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TriggeredAlert {
  id: string;
  symbol: string;
  condition: string;
  trigger_price: number;
  triggered_price: number | null;
  triggered_at: string | null;
}

interface Props {
  className?: string;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function storageKey(userId: string) {
  return `lnai_read_alerts_${userId}`;
}

function getReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // corrupted — ignore
  }
  return new Set();
}

function saveReadIds(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    // storage quota exceeded — ignore
  }
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertNotificationBell({ className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Re-render trigger for read state — toggled when user marks all read
  const [readVersion, setReadVersion] = useState(0);

  // Fetch recently triggered alerts
  const { data: alerts = [] } = useQuery<TriggeredAlert[]>({
    queryKey: ['markets', 'alerts', 'triggered', user?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .schema('markets' as any)
        .from('price_alerts' as any)
        .select('id, symbol, condition, trigger_price, triggered_price, triggered_at')
        .eq('user_id', user!.id)
        .eq('status', 'triggered')
        .order('triggered_at', { ascending: false })
        .limit(10);
      return (data ?? []) as TriggeredAlert[];
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  // Compute unread count: triggered alerts in the last 24h whose IDs are not
  // in the localStorage read set
  const { unreadCount, readIds } = useMemo(() => {
    const userId = user?.id ?? '';
    const ids = getReadIds(userId);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const count = alerts.filter((a) => {
      if (ids.has(a.id)) return false;
      const ts = a.triggered_at ? new Date(a.triggered_at).getTime() : 0;
      return ts >= cutoff;
    }).length;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void readVersion; // dependency to force re-compute after marking read
    return { unreadCount: count, readIds: ids };
  }, [alerts, user?.id, readVersion]);

  const handleOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  const handleMarkAllRead = () => {
    if (!user?.id) return;
    const allIds = alerts.map((a) => a.id);
    // Merge with any existing read IDs so we don't lose previously-read ones
    const merged = Array.from(new Set([...Array.from(readIds), ...allIds]));
    saveReadIds(user.id, merged);
    setReadVersion((v) => v + 1);
  };

  const hasAlerts = alerts.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread price alert${unreadCount === 1 ? '' : 's'}`
              : 'Price alert notifications'
          }
          title="Price alert notifications"
        >
          <span className="relative inline-flex">
            {unreadCount > 0 ? (
              <BellRing className="h-4 w-4 text-amber-500" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Triggered Alerts</span>
            {hasAlerts && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {alerts.length}
              </span>
            )}
          </div>
          {hasAlerts && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Alert list */}
        {!hasAlerts ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Bell className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No triggered alerts</p>
            <Link
              to="/dashboard/markets/alerts"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Manage alerts
            </Link>
          </div>
        ) : (
          <div className="max-h-[360px] divide-y overflow-y-auto">
            {alerts.map((alert) => {
              const isRead = readIds.has(alert.id);
              const isAbove = alert.condition === 'above';
              const triggerPrice = alert.trigger_price;
              const triggeredPrice = alert.triggered_price ?? triggerPrice;

              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    isRead ? 'opacity-60' : 'bg-amber-50/40 dark:bg-amber-950/10'
                  }`}
                >
                  {/* Direction icon */}
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isAbove
                        ? 'bg-emerald-100 dark:bg-emerald-950'
                        : 'bg-rose-100 dark:bg-rose-950'
                    }`}
                  >
                    {isAbove ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{alert.symbol}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          isAbove
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                        }`}
                      >
                        {isAbove ? 'above' : 'below'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      Target ₹{triggerPrice.toLocaleString('en-IN')} · Hit ₹{triggeredPrice.toLocaleString('en-IN')}
                    </p>
                    {alert.triggered_at && (
                      <p className="text-[10px] text-muted-foreground/70">
                        {relativeTime(alert.triggered_at)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="border-t px-4 py-2.5">
          <Link
            to="/dashboard/markets/alerts"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all alerts
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

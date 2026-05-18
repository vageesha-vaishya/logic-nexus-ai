/**
 * InAppNotificationBell
 *
 * Header bell that surfaces in-app notifications from markets.notifications
 * across every category (price alerts, order fills, SIP, risk, rebalance,
 * system). Listens to Supabase Realtime via useNotifications().
 *
 * In-app only — backgrounded mobile apps will not receive these. The bell
 * lights up only when the app is open or after the user reopens it.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Info,
  ListChecks,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '../hooks/useNotifications';
import type { NotificationCategory, NotificationRow, NotificationSeverity } from '../types';

interface Props {
  className?: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function categoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'alert':       return TrendingUp;
    case 'order_fill':  return ListChecks;
    case 'sip':         return PiggyBank;
    case 'risk':        return ShieldAlert;
    case 'rebalance':   return AlertTriangle;
    case 'system':      return Sparkles;
    default:            return Info;
  }
}

function severityClasses(severity: NotificationSeverity): { ring: string; icon: string; row: string } {
  switch (severity) {
    case 'critical':
      return {
        ring: 'bg-rose-100 dark:bg-rose-950',
        icon: 'text-rose-600 dark:text-rose-400',
        row:  'bg-rose-50/40 dark:bg-rose-950/10',
      };
    case 'warning':
      return {
        ring: 'bg-amber-100 dark:bg-amber-950',
        icon: 'text-amber-600 dark:text-amber-400',
        row:  'bg-amber-50/40 dark:bg-amber-950/10',
      };
    case 'success':
      return {
        ring: 'bg-emerald-100 dark:bg-emerald-950',
        icon: 'text-emerald-600 dark:text-emerald-400',
        row:  'bg-emerald-50/30 dark:bg-emerald-950/10',
      };
    case 'info':
    default:
      return {
        ring: 'bg-sky-100 dark:bg-sky-950',
        icon: 'text-sky-600 dark:text-sky-400',
        row:  'bg-sky-50/30 dark:bg-sky-950/10',
      };
  }
}

function NotificationItem({
  row,
  onClick,
}: {
  row: NotificationRow;
  onClick: () => void;
}) {
  const Icon = categoryIcon(row.category);
  const sev = severityClasses(row.severity);
  const unread = !row.read_at;

  const content = (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
        unread ? sev.row : 'opacity-60'
      }`}
      onClick={onClick}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${sev.ring}`}
      >
        <Icon className={`h-3.5 w-3.5 ${sev.icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight">{row.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{row.body}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          {relativeTime(row.created_at)}
        </p>
      </div>
      {unread && (
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="unread" />
      )}
    </div>
  );

  if (row.link_url) {
    return (
      <Link to={row.link_url} className="block hover:bg-muted/40">
        {content}
      </Link>
    );
  }
  return <div className="cursor-pointer hover:bg-muted/40">{content}</div>;
}

export function InAppNotificationBell({ className }: Props) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const hasAny = notifications.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'Notifications'
          }
          title="Notifications"
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

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Notifications</span>
            {hasAny && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {notifications.length}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => markAllRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {!hasAny ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Bell className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="px-4 text-[11px] text-muted-foreground/80">
              Price alerts, order fills, SIPs, and risk events show up here when they happen.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] divide-y overflow-y-auto">
            {notifications.map((row) => (
              <NotificationItem
                key={row.id}
                row={row}
                onClick={() => {
                  if (!row.read_at) markRead(row.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        )}

        <div className="border-t px-4 py-2.5">
          <Link
            to="/dashboard/markets/alerts"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            Manage price alerts
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

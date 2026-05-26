/**
 * WatchlistsCard — Watchlists summary on the retail Signals tab.
 *
 * Three states:
 *   - Loading           → skeleton
 *   - No watchlists     → empty-state card with "Create one" CTA
 *   - Has watchlists    → count + total items + "View all" navigation
 *
 * Tapping the card navigates to /dashboard/markets/watchlists, which is
 * allow-listed for retail and renders the Sthira-shell variant (no
 * DashboardLayout chrome).
 */
import { Link } from "react-router-dom";
import { ChevronRight, Eye } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useWatchlists } from "../../hooks/useWatchlists";

const WATCHLISTS_HUB = "/dashboard/markets/watchlists";

export function WatchlistsCard() {
  const watchlists = useWatchlists();

  if (watchlists.isPending) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  const lists = watchlists.data ?? [];
  const totalItems = lists.reduce((sum, w) => sum + (w.item_count ?? 0), 0);
  const hasLists = lists.length > 0;

  if (!hasLists) {
    return (
      <Link
        to={WATCHLISTS_HUB}
        className="block rounded-lg border bg-card p-5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper"
      >
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-sthira-copper mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h3 className="font-sthiraSerif italic text-base">Watchlists</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Track stocks and funds you&apos;re considering — live quotes, no obligation.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={WATCHLISTS_HUB}
      className="block rounded-lg border bg-card p-5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-sthiraSerif italic text-base">Watchlists</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lists.length} {lists.length === 1 ? "list" : "lists"} · {totalItems} {totalItems === 1 ? "instrument" : "instruments"} tracked
          </p>
        </div>
        <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}

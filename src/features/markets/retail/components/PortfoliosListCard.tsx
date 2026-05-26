/**
 * PortfoliosListCard — entry-point card on the retail Portfolio tab
 * that lists each of the user's portfolios with a quick-jump to the
 * mobile detail page (RetailPortfolioDetailPage).
 *
 * Surfaces:
 *   - portfolio name + mode badge
 *   - holdings count (from usePortfolios.holdings_count if present,
 *     otherwise via cached usePortfolioHoldings)
 *   - NAV (cached if the user has already opened the detail page;
 *     otherwise just the name+mode, deferring the heavy fetch)
 *
 * Reachability: tapping Portfolio in the bottom nav lands on
 * RetailPortfolioPage which renders this card at the top. From here
 * one tap reaches all the Slice-1..4 work (summary strip, holdings
 * list, brief, charts, actions menu).
 *
 * Hidden when the user has zero portfolios — caller renders a
 * dedicated empty state instead.
 */
import { Link } from "react-router-dom";
import { ChevronRight, FolderOpen } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { usePortfolios } from "../../hooks/usePortfolios";

export function PortfoliosListCard() {
  const { data: portfolios = [], isLoading } = usePortfolios();

  if (isLoading) {
    return (
      <section aria-label="Your portfolios" className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your portfolios
        </h2>
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </section>
    );
  }

  if (portfolios.length === 0) return null;

  return (
    <section aria-label="Your portfolios" className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your portfolios ({portfolios.length})
      </h2>
      <ul className="space-y-1.5">
        {portfolios.map((p) => (
          <li key={p.id}>
            <Link
              to={`/dashboard/markets/retail/portfolio/${p.id}`}
              className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span
                    className={
                      p.mode === "paper"
                        ? "rounded-full bg-amber-500/15 px-1.5 py-0 text-[9px] font-medium uppercase text-amber-700 dark:text-amber-400"
                        : "rounded-full bg-emerald-500/15 px-1.5 py-0 text-[9px] font-medium uppercase text-emerald-700 dark:text-emerald-400"
                    }
                  >
                    {p.mode}
                  </span>
                </span>
                {p.description && (
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {p.description}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

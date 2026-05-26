/**
 * MfHoldingsCard — Mutual Funds summary that lives on the retail Portfolio
 * tab. Parallel to the 3-tier model (Safety Net / Core / Experimental)
 * per the v1 audience decision.
 *
 * Three states:
 *   - Loading           → skeleton
 *   - No holdings       → empty-state card with "Browse funds" CTA
 *   - Has holdings      → fund count + invested/current + return badge
 *
 * Tapping the card (or the CTA) navigates to /dashboard/markets/mf,
 * which is allow-listed for retail and renders the Sthira-shell variant
 * (no DashboardLayout chrome).
 */
import { Link } from "react-router-dom";
import { ChevronRight, PiggyBank } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useMfPortfolio } from "../../hooks/useMf";
import { WhyButton } from "../glossary";

const MF_HUB = "/dashboard/markets/mf";

function fmtINR(value: number | null | undefined): string {
  const n = value ?? 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function MfHoldingsCard() {
  const portfolio = useMfPortfolio();

  if (portfolio.isPending) {
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

  const summary  = portfolio.data?.summary;
  const holdings = portfolio.data?.holdings ?? [];
  const hasFunds = holdings.length > 0;

  if (!hasFunds) {
    return (
      <Link
        to={MF_HUB}
        className="block rounded-lg border bg-card p-5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper"
      >
        <div className="flex items-start gap-3">
          <PiggyBank className="h-5 w-5 text-sthira-copper mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h3 className="flex items-center gap-1.5 font-sthiraSerif italic text-base">
              Mutual Funds
              <WhyButton term="mf" srLabel="What is a mutual fund?" />
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Direct plans, live NAV. SIPs from ₹500/month.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </Link>
    );
  }

  const gain     = summary?.total_gain ?? 0;
  const returnPct = summary?.return_pct ?? 0;
  const positive = gain >= 0;

  return (
    <Link
      to={MF_HUB}
      className="block rounded-lg border bg-card p-5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-sthiraSerif italic text-base">Mutual Funds</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {holdings.length} {holdings.length === 1 ? "fund" : "funds"} · invested {fmtINR(summary?.total_invested)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 tabular-nums">
        <span className="font-sthiraSerif text-2xl">{fmtINR(summary?.total_current)}</span>
        <span className={cn(
          "text-[11px]",
          positive ? "text-sthira-sage" : "text-sthira-terracotta",
        )}>
          {positive ? "+" : ""}{fmtINR(gain)} · {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
        </span>
      </div>
    </Link>
  );
}

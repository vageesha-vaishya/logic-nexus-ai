/**
 * PortfolioPanel — compact holdings summary panel for the terminal workspace.
 * Shows holdings from the currently-active portfolio. When the user owns
 * more than one portfolio, an inline picker lets them switch — the choice
 * is persisted in localStorage via useActivePortfolio().
 */

import { useActivePortfolio } from "../../hooks/useActivePortfolio";
import { usePortfolioHoldings } from "../../hooks/usePortfolio";
import { ActivePortfolioPicker } from "../../components/ActivePortfolioPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function fmtINR(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function FirstPortfolioHoldings({ portfolioId }: { portfolioId: string }) {
  const { data, isLoading } = usePortfolioHoldings(portfolioId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  // Defensive: some broker-sync states return data without holdings array.
  const { nav, todayPnl, sinceInceptionPct } = data;
  const holdings = Array.isArray(data.holdings) ? data.holdings : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5 bg-muted/30 rounded-md mx-1 mb-1 shrink-0">
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground uppercase">NAV</div>
          <div className="text-xs font-mono font-semibold">₹{fmtINR(nav)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Today P&L</div>
          <div
            className={cn(
              "text-xs font-mono font-semibold",
              todayPnl >= 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {todayPnl >= 0 ? "+" : ""}₹{fmtINR(todayPnl)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Return</div>
          <div
            className={cn(
              "text-xs font-mono font-semibold",
              sinceInceptionPct >= 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {fmtPct(sinceInceptionPct)}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1 px-2 pb-0.5 shrink-0">
        <span className="text-[9px] text-muted-foreground font-medium">SYMBOL</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-12">QTY</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-20">AVG COST</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-16">P&L</span>
      </div>

      {/* Holdings rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {holdings.length === 0 && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            No holdings in this portfolio
          </div>
        )}
        {holdings.map((h) => {
          const symbol = h.instrument?.symbol ?? h.instrument_id.slice(0, 8);
          const unrealizedPnl =
            h.last_price != null ? (h.last_price - h.avg_cost) * h.qty : null;
          const isUp = unrealizedPnl != null && unrealizedPnl >= 0;

          return (
            <div
              key={h.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1 px-2 py-0.5 hover:bg-muted/30 rounded transition-colors"
            >
              <span className="text-xs font-mono truncate">{symbol}</span>
              <span className="text-xs font-mono tabular-nums text-right w-12">{h.qty}</span>
              <span className="text-xs font-mono tabular-nums text-right w-20">
                ₹{fmtINR(h.avg_cost)}
              </span>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums text-right w-16",
                  unrealizedPnl == null
                    ? "text-muted-foreground"
                    : isUp
                    ? "text-emerald-500"
                    : "text-red-500",
                )}
              >
                {unrealizedPnl == null
                  ? "—"
                  : `${isUp ? "+" : ""}₹${fmtINR(unrealizedPnl)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PortfolioPanel() {
  const { activePortfolio, hasMultiple, isLoading } = useActivePortfolio();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!activePortfolio) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
        No portfolios found. Create one in Portfolios.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center px-2 pb-1 shrink-0 gap-2">
        {hasMultiple ? (
          <ActivePortfolioPicker className="h-6 text-[10px] w-auto min-w-[110px]" />
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {activePortfolio.name}
          </span>
        )}
        <span
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
            activePortfolio.mode === "paper"
              ? "bg-amber-500/15 text-amber-600"
              : "bg-emerald-500/15 text-emerald-600",
          )}
        >
          {activePortfolio.mode}
        </span>
      </div>
      <FirstPortfolioHoldings portfolioId={activePortfolio.id} />
    </div>
  );
}

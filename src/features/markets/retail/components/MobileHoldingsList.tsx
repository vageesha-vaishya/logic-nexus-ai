/**
 * MobileHoldingsList — card-per-holding renderer for the mobile
 * portfolio detail page.
 *
 * Replaces the desktop 13-column HoldingsTable. One card per
 * aggregated symbol; tap to expand and reveal:
 *   - per-broker sources (qty, avg cost, broker label)
 *   - day-P&L vs overall-P&L breakdown
 *
 * Consumes `AggregatedHolding[]` from usePortfolioHoldings which
 * already rolls up sources across broker_connection_id. We resolve
 * broker_connection_id → display_name via useBrokerConnections so
 * each source row shows the broker name rather than the UUID.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Numeric } from "@/components/system/Numeric";
import { cn } from "@/lib/utils";

import { useBrokerConnections } from "../../hooks/useBrokerConnections";
import type { AggregatedHolding } from "../../types";

export interface MobileHoldingsListProps {
  holdings: AggregatedHolding[];
  /** ISO currency code from the parent portfolio. */
  currency?: string;
}

export function MobileHoldingsList({ holdings, currency = "INR" }: MobileHoldingsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const connectionsQuery = useBrokerConnections();

  const brokerLabel = useMemo(() => {
    const conns = connectionsQuery.data ?? [];
    const byId  = new Map(conns.map((c) => [c.id, c]));
    return (connId: string | null | undefined): string => {
      if (!connId) return "Manual entry";
      const c = byId.get(connId);
      return c?.display_name ?? c?.broker ?? `${connId.slice(0, 8)}…`;
    };
  }, [connectionsQuery.data]);

  if (holdings.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
        No holdings yet. Connect a broker or import a statement to populate this portfolio.
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Holdings">
      {holdings.map((h) => {
        const isExpanded = expandedId === h.id;
        const symbol     = h.instrument?.symbol ?? "—";
        const exchange   = h.instrument?.exchange ?? "";
        const ltp        = h.last_price ?? h.avg_cost;
        const prev       = h.prev_price ?? ltp;
        const mktVal     = h.qty * ltp;
        const dayChange  = prev > 0 ? (ltp - prev) / prev : 0;
        const overallPnl = h.qty * (ltp - h.avg_cost);
        const overallPct = h.avg_cost > 0 ? (ltp - h.avg_cost) / h.avg_cost : 0;
        const daysPnl    = h.qty * (ltp - prev);

        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : h.id)}
              className="w-full rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={isExpanded}
            >
              {/* Row 1: symbol + day-change badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="font-mono text-sm font-semibold">{symbol}</span>
                  {exchange && (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {exchange}
                    </span>
                  )}
                  {h.source_count > 1 && (
                    <span className="ml-1 inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {h.source_count} brokers
                    </span>
                  )}
                </div>
                <Numeric
                  value={dayChange}
                  format="percent"
                  colorBySign
                  withArrow
                  className="text-xs font-medium tabular-nums"
                  placeholder="—"
                />
              </div>

              {/* Row 2: qty · avg cost · CMP */}
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>{h.qty} sh · avg <Numeric as="span" value={h.avg_cost} format="currency" currency={currency} /></span>
                <span>
                  CMP <Numeric as="span" value={h.last_price} format="currency" currency={currency} placeholder="—" />
                </span>
              </div>

              {/* Row 3: market value · overall P&L */}
              <div className="mt-1 flex items-center justify-between text-sm tabular-nums">
                <Numeric value={mktVal} format="currency" currency={currency} className="font-semibold" />
                <span className="flex items-baseline gap-1.5">
                  <Numeric value={overallPnl} format="pnl"     currency={currency} colorBySign className="text-xs" />
                  <Numeric value={overallPct} format="percent" colorBySign className="text-[11px] font-medium" />
                </span>
              </div>

              {/* Expand affordance */}
              <div className="mt-1.5 flex items-center justify-end text-[10px] text-muted-foreground">
                {h.source_count > 1
                  ? <>tap for per-broker breakdown {isExpanded ? <ChevronDown className="ml-0.5 h-3 w-3" /> : <ChevronRight className="ml-0.5 h-3 w-3" />}</>
                  : <>tap for day P&amp;L details {isExpanded ? <ChevronDown className="ml-0.5 h-3 w-3" /> : <ChevronRight className="ml-0.5 h-3 w-3" />}</>}
              </div>
            </button>

            {isExpanded && (
              <div className="mt-1.5 ml-2 mr-2 rounded-md border-l-2 border-muted bg-muted/20 p-2.5 space-y-2 text-xs">
                {/* Day's P&L row */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Today's P&amp;L</span>
                  <Numeric value={daysPnl} format="pnl" currency={currency} colorBySign withArrow
                    className="font-medium" placeholder="—" />
                </div>

                {/* Per-broker breakdown */}
                {h.source_count > 1 && (
                  <div className="space-y-1 border-t pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Per-broker sources
                    </div>
                    <ul className="space-y-1">
                      {h.sources.map((s, i) => (
                        <li key={s.id ?? i} className={cn(
                          "flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5",
                        )}>
                          <span className="min-w-0 truncate text-xs">
                            {brokerLabel(s.broker_connection_id)}
                          </span>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {s.qty} sh · avg <Numeric as="span" value={s.avg_cost} format="currency" currency={currency} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

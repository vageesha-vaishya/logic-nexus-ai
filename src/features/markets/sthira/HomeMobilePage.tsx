/**
 * HomeMobilePage — the Sthira mobile Home tab.
 *
 * Layout (top to bottom):
 *   1. Greeting + risk badge
 *   2. Three tier cards (Safety Net / Core / Experimental) — each shows
 *      target, taglines, and a copper progress bar
 *   3. Latest signals preview (max 3, copper bar)
 *   4. Brokers card with sync count + Sync Now action
 *
 * Pull-to-refresh re-fetches tiers, signals, and broker connections in
 * parallel. Everything lives inside MobileShell so the bottom tab bar +
 * FAB slot is consistent across PR 3/4 screens.
 *
 * Per design: brand copy comes from `./copy.ts` so a single edit retunes
 * voice everywhere.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, RefreshCw } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useRiskProfile } from "@/features/markets/retail/hooks/useRiskProfile";
import { usePortfolioTiers } from "@/features/markets/retail/hooks/usePortfolioTiers";
import { useBrokerConnections, useTriggerBrokerSync } from "@/features/markets/hooks/useBrokerConnections";
import { useRetailSignals } from "@/features/markets/retail/hooks/useRetailSignals";
import { TIER_DEFAULTS } from "@/features/markets/retail/types";
import { marketsKeys } from "@/features/markets/hooks/queryKeys";

import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { STHIRA_COPY } from "./copy";
import { usePullToRefresh } from "./usePullToRefresh";
import { useTierValuations } from "./useTierValuations";
import { SthiraTradeSheet } from "./SthiraTradeSheet";
import { SthiraBrokerStatusBanner } from "./SthiraBrokerStatusBanner";

function formatINR(value: number | null | undefined): string {
  const n = value ?? 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function HomeMobilePage() {
  const { user, profile } = useAuth();
  const riskProfile = useRiskProfile();
  const tiers = usePortfolioTiers();
  const connections = useBrokerConnections();
  const signals = useRetailSignals({ limit: 3 });
  const triggerSync = useTriggerBrokerSync();
  const { valuations, refetch: refetchValuations } = useTierValuations();
  const qc = useQueryClient();

  // Trade FAB shows when at least one broker is can_trade=true.
  const [tradeOpen, setTradeOpen] = useState(false);
  const canTradeBroker = (connections.data ?? []).find((c) => c.status === "active" && c.can_trade);

  const onRefresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() }),
      qc.invalidateQueries({ queryKey: marketsKeys.retail.tiers() }),
      qc.invalidateQueries({ queryKey: marketsKeys.brokers.connections() }),
      qc.invalidateQueries({ queryKey: marketsKeys.retail.signals?.() ?? [] }),
      refetchValuations(),
    ]);
  };

  const ptr = usePullToRefresh({ onRefresh });

  const firstName =
    profile?.first_name ??
    (user?.email ? user.email.split("@")[0] : null);

  // Map tier_number -> persisted tier row, fall back to defaults for the
  // slots the user hasn't named yet.
  const tierRows = TIER_DEFAULTS.map((d) => {
    const persisted = tiers.data?.find((t) => t.tier_number === d.tier_number);
    return { def: d, row: persisted };
  });

  const connList = connections.data ?? [];
  const activeBrokerCount = connList.filter((c) => c.status === "active").length;
  const lastSync = connList
    .map((c) => c.last_synced_at)
    .filter((s): s is string => Boolean(s))
    .sort()
    .at(-1);

  return (
    <MobileShell
      activeTab="home"
      showTradeFab={Boolean(canTradeBroker)}
      onTradePress={() => setTradeOpen(true)}
    >
      <div
        {...ptr.containerProps}
        className="px-5 pt-6 space-y-6 select-none"
        style={{ transform: `translateY(${Math.min(ptr.pullOffsetPx * 0.6, 60)}px)` }}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-sthiraSerif text-2xl text-sthira-ink">
              {STHIRA_COPY.greeting(firstName)}
            </h1>
            <p className="mt-0.5 text-xs text-sthira-fog">
              Self-directed investor
            </p>
          </div>
          {riskProfile.data?.risk_tag && (
            <span className="rounded-full border border-sthira-navy/15 px-3 py-1 text-[11px] font-medium tracking-wide text-sthira-ink/80">
              {STHIRA_COPY.risk.badge(riskProfile.data.risk_tag)}
            </span>
          )}
        </header>

        {/* Broker status banner — visible only when ≥1 broker has status
            error/expired. Productizes the option-A daily-refresh approach. */}
        <SthiraBrokerStatusBanner />

        {/* Tier cards */}
        <section className="space-y-3" aria-label="Your portfolio tiers">
          {tiers.isPending && (
            <div className="rounded-xl border border-sthira-navy/10 bg-white/40 p-5 text-sm text-sthira-fog">
              Loading…
            </div>
          )}
          {!tiers.isPending && tierRows.map(({ def, row }) => {
            const target = row?.target_amount ?? 0;
            const v = valuations[def.tier_number];
            const current = v?.current_value ?? 0;
            const pnl     = v?.pnl ?? 0;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const portfolioId = row?.portfolio_id;
            const cardClassName = cn(
              "block rounded-xl border border-sthira-navy/15 bg-white/60 p-5 transition-colors",
              portfolioId
                ? "hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper"
                : "cursor-default",
            );
            const cardBody = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-sthiraSerif italic text-lg text-sthira-ink">
                      {def.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-sthira-fog">{def.description}</p>
                  </div>
                  {portfolioId && (
                    <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-sthira-fog" aria-hidden="true" />
                  )}
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 tabular-nums">
                  <div>
                    <span className="font-sthiraSerif text-2xl text-sthira-ink">
                      {formatINR(current)}
                    </span>
                    {pnl !== 0 && (
                      <p className={cn(
                        "text-[11px] mt-0.5",
                        pnl > 0 ? "text-sthira-sage" : "text-sthira-terracotta",
                      )}>
                        {pnl > 0 ? "+" : ""}{formatINR(pnl)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-sthira-fog">
                    {target > 0 ? `target ${formatINR(target)}` : "target not set"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-sthira-navy/10 overflow-hidden">
                  <div
                    className="h-full bg-sthira-copper transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] tracking-wide uppercase text-sthira-fog">
                  {pct}% funded
                </p>
              </>
            );
            return portfolioId ? (
              <Link
                key={def.tier_number}
                to={`/dashboard/markets/portfolios/${portfolioId}`}
                className={cardClassName}
              >
                {cardBody}
              </Link>
            ) : (
              <div key={def.tier_number} className={cardClassName} aria-disabled="true">
                {cardBody}
              </div>
            );
          })}
        </section>

        {/* Signals preview */}
        <section aria-label="Latest signals">
          <header className="flex items-baseline justify-between mb-2">
            <h2 className="font-sthiraSerif text-base text-sthira-ink">
              {STHIRA_COPY.signals.sectionTitle}
            </h2>
            <Link
              to="/dashboard/markets/retail/signals"
              className="text-xs text-sthira-copper hover:underline"
            >
              {STHIRA_COPY.signals.seeAll}
            </Link>
          </header>
          {signals.isPending && (
            <p className="text-xs text-sthira-fog">Loading…</p>
          )}
          {!signals.isPending && (signals.data?.length ?? 0) === 0 && (
            <p className="text-xs text-sthira-fog">{STHIRA_COPY.signals.none}</p>
          )}
          {!signals.isPending && signals.data && signals.data.length > 0 && (
            <ul className="rounded-xl border border-sthira-navy/15 bg-white/60 divide-y divide-sthira-navy/10">
              {signals.data.slice(0, 3).map((sig) => (
                <li key={sig.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-sthiraSerif text-sm tabular-nums">
                      {sig.instrument?.symbol ?? "—"}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-sthira-fog">
                      {sig.signal_type}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-medium tabular-nums",
                    sig.signal_type === "buy"
                      ? "text-sthira-sage"
                      : sig.signal_type === "sell"
                        ? "text-sthira-terracotta"
                        : "text-sthira-fog",
                  )}>
                    {STHIRA_COPY.signals.confidenceFmt(Math.round((sig.confidence ?? 0) * 100))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Brokers card */}
        <section aria-label="Brokers">
          <header className="mb-2">
            <h2 className="font-sthiraSerif text-base text-sthira-ink">
              {STHIRA_COPY.brokers.sectionTitle}
            </h2>
          </header>
          <div className="rounded-xl border border-sthira-navy/15 bg-white/60 p-4">
            {connList.length === 0 ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-sthira-fog">{STHIRA_COPY.brokers.addCta}</p>
                <Button asChild size="sm" className="bg-sthira-copper text-sthira-cream hover:bg-sthira-copper/90">
                  <Link to="/sthira/broker">Connect</Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-sthira-ink">
                    {STHIRA_COPY.brokers.connectedCount(activeBrokerCount)}
                  </p>
                  {lastSync && (
                    <p className="text-[11px] text-sthira-fog">
                      {STHIRA_COPY.brokers.syncedAgo(formatDistanceToNow(new Date(lastSync), { addSuffix: true }))}
                    </p>
                  )}
                </div>
                {connList.length === 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerSync.mutate(connList[0].id)}
                    disabled={triggerSync.isPending}
                    className="border-sthira-navy/20 gap-1.5"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", triggerSync.isPending && "animate-spin")} aria-hidden="true" />
                    {STHIRA_COPY.brokers.syncNow}
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Pull-to-refresh indicator (visual only — gesture is on the container) */}
        {(ptr.pullProgress > 0 || ptr.isRefreshing) && (
          <div
            className="fixed top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            aria-hidden="true"
          >
            <div className={cn(
              "h-8 w-8 rounded-full border-2 border-sthira-copper border-t-transparent",
              ptr.isRefreshing && "animate-spin",
            )} style={{ opacity: Math.max(ptr.pullProgress, ptr.isRefreshing ? 1 : 0) }} />
          </div>
        )}
      </div>
      <SthiraTradeSheet open={tradeOpen} onClose={() => setTradeOpen(false)} />
    </MobileShell>
  );
}

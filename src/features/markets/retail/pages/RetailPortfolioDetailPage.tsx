/**
 * RetailPortfolioDetailPage — mobile-first per-portfolio detail surface.
 *
 * Replaces the desktop PortfolioDetailPage as the destination for retail
 * users tapping "View Portfolio" on a broker connection. Lives inside the
 * /dashboard/markets/retail subtree so the 5-tab bottom nav comes from
 * RetailNavLayout — the user can switch tabs without leaving via the
 * Android back button.
 *
 * Slice 1 (this commit): summary strip + holdings list with multi-broker
 * expand. Subsequent slices add Brief, Charts modal, action menu.
 * See docs/plans/2026-05-26-broker-portfolio-routing-design.md and
 * the session-level mobile-portfolio analysis for the contract.
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { ErrorState, SkeletonCard } from "@/design-system";
import { Numeric } from "@/components/system/Numeric";

import { MobileHoldingsList } from "../components/MobileHoldingsList";
import { usePortfolio, usePortfolioHoldings } from "../../hooks/usePortfolio";

export default function RetailPortfolioDetailPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate         = useNavigate();
  const portfolio        = usePortfolio(portfolioId);
  const holdings         = usePortfolioHoldings(portfolioId);

  if (portfolio.isPending || holdings.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (portfolio.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <ErrorState
          title="Failed to load portfolio"
          message={portfolio.error?.message ?? "Unknown error"}
          onRetry={() => portfolio.refetch()}
        />
      </div>
    );
  }

  if (!portfolio.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Portfolio not found. It may have been deleted or you don't have access.
        </p>
        <Link
          to="/dashboard/markets/retail/portfolio"
          className="inline-block rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Back to portfolios
        </Link>
      </div>
    );
  }

  const p   = portfolio.data;
  const h   = holdings.data;
  const cur = p.base_currency ?? "INR";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* Back nav — uses navigate(-1) when there's history so the
          back path matches how the user arrived (from broker card,
          from tier view, etc.) */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{p.name}</h1>
          <span
            className={
              p.mode === "paper"
                ? "rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                : "rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
            }
          >
            {p.mode}
          </span>
        </div>
        {p.description && (
          <p className="text-xs text-muted-foreground">{p.description}</p>
        )}
      </header>

      {/* Summary strip — three big numbers */}
      <section
        aria-label="Portfolio summary"
        className="grid grid-cols-3 gap-2 rounded-md border bg-card p-3"
      >
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Value
          </div>
          <Numeric
            value={h?.nav ?? 0}
            format="currency"
            currency={cur}
            className="text-base font-semibold"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Today
          </div>
          <Numeric
            value={h?.todayPnl ?? 0}
            format="pnl"
            currency={cur}
            colorBySign
            withArrow
            className="text-base font-semibold"
            placeholder="—"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Overall
          </div>
          <Numeric
            value={h?.sinceInceptionPct ?? 0}
            format="percent"
            colorBySign
            withArrow
            className="text-base font-semibold"
            placeholder="—"
          />
        </div>
      </section>

      {/* Invested + bonus mini-row */}
      {(h?.investedValue ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground tabular-nums">
          <span>
            Invested <Numeric as="span" value={h?.investedValue ?? 0} format="currency" currency={cur} />
          </span>
          {(h?.bonusValue ?? 0) > 0 && (
            <span>
              Bonus shares <Numeric as="span" value={h?.bonusValue ?? 0} format="currency" currency={cur} />
            </span>
          )}
        </div>
      )}

      {/* Holdings list */}
      <section aria-label="Holdings" className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Holdings ({h?.holdings.length ?? 0})
        </h2>
        {holdings.isError ? (
          <ErrorState
            title="Couldn't load holdings"
            message={holdings.error?.message ?? "Unknown error"}
            onRetry={() => holdings.refetch()}
          />
        ) : (
          <MobileHoldingsList holdings={h?.holdings ?? []} currency={cur} />
        )}
      </section>
    </div>
  );
}

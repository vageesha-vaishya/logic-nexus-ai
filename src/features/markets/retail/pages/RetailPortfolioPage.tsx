import { PortfolioTierView } from "../dashboard/PortfolioTierView";
import { WhyButton } from "../glossary";

/**
 * Portfolio tab — three-tier view with link/unlink flow.
 *
 * Sub-pages mounted here in later addendum tasks:
 *   • Stop-loss manager (T17 risk trio extension)
 *   • LTCG tracker (T15)
 *   • Per-holding detail sheet
 */
export default function RetailPortfolioPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          Portfolio
          <WhyButton term="portfolio tier" srLabel="What are portfolio tiers?" />
        </h2>
        <p className="text-xs text-muted-foreground">
          Group your investments into three risk tiers so each one matches its
          job.
        </p>
      </header>
      <PortfolioTierView />
    </div>
  );
}

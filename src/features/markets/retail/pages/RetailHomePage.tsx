import { useMemo } from "react";

import { usePortfolioPnL } from "../../hooks/usePortfolioPnL";
import { BehavioralAlertBanner } from "../behavioral/BehavioralAlertBanner";
import { useDrawdownState } from "../behavioral/useDrawdownAlerts";
import { RebalanceCard } from "../dashboard/RebalanceCard";
import { RetailDashboard } from "../dashboard/RetailDashboard";
import { RiskScoreCard } from "../dashboard/RiskScoreCard";
import { usePortfolioTiers } from "../hooks/usePortfolioTiers";
import { useRiskProfile } from "../hooks/useRiskProfile";

/**
 * Home tab — overview of the user's portfolio + non-blocking drawdown banner.
 * Subsequent Addendum tasks (T17 Risk Score, T19 Diagnostic, T20 Holdings news,
 * T21 Rebalance card) will be appended to this page rather than fan out into
 * new tabs.
 */
export default function RetailHomePage() {
  const { data: profile } = useRiskProfile();
  const { data: tiers = [] } = usePortfolioTiers();
  const coreTier = useMemo(() => tiers.find((t) => t.tier_number === 2), [tiers]);
  const corePnL = usePortfolioPnL(coreTier?.portfolio_id ?? undefined, 365);
  const drawdown = useDrawdownState(corePnL.data);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <RetailDashboard profile={profile} />
      <RebalanceCard />
      <RiskScoreCard />
      {coreTier && drawdown.alertTier && drawdown.alertTier !== "red" && (
        <BehavioralAlertBanner
          alertTier={drawdown.alertTier}
          drawdownPct={drawdown.drawdownPct}
          portfolioId={coreTier.portfolio_id ?? ""}
        />
      )}
    </div>
  );
}

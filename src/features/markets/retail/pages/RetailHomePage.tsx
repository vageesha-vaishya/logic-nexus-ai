import { useMemo } from "react";

import { usePortfolioPnL } from "../../hooks/usePortfolioPnL";
import { BehavioralAlertBanner } from "../behavioral/BehavioralAlertBanner";
import { useDrawdownState } from "../behavioral/useDrawdownAlerts";
import { HoldingsNewsCarousel } from "../dashboard/HoldingsNewsCarousel";
import { RebalanceCard } from "../dashboard/RebalanceCard";
import { RetailDashboard } from "../dashboard/RetailDashboard";
import { RiskScoreCard } from "../dashboard/RiskScoreCard";
import { usePortfolioTiers } from "../hooks/usePortfolioTiers";
import { useRiskProfile } from "../hooks/useRiskProfile";

/**
 * Home tab — overview of the user's portfolio + non-blocking drawdown banner.
 * Subsequent Addendum tasks (T19 Diagnostic) append here. T17 Risk Score
 * (with T18 Stress Test reached from it) and T20 Holdings News are live.
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
      <HoldingsNewsCarousel />
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

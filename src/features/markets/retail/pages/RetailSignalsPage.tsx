import { useMemo } from "react";

import { usePortfolioPnL } from "../../hooks/usePortfolioPnL";
import {
  getSeenEducationIds,
  useBehavioralEvents,
} from "../behavioral/useBehavioralEvents";
import { useDrawdownState } from "../behavioral/useDrawdownAlerts";
import { useMarketStress } from "../behavioral/useMarketStress";
import { RetailSignalFeed } from "../feed/RetailSignalFeed";
import { usePortfolioTiers } from "../hooks/usePortfolioTiers";
import { useRiskProfile } from "../hooks/useRiskProfile";

/**
 * Signals tab — the filtered signal feed with execution bottom-sheet.
 *
 * Behavioral context (market stress, seen education IDs, core-tier drawdown)
 * is computed here and threaded into the feed so each SignalCard can choose
 * the right per-card education trigger.
 */
export default function RetailSignalsPage() {
  const { data: profile } = useRiskProfile();
  const { data: tiers = [] } = usePortfolioTiers();
  const coreTier = useMemo(
    () => tiers.find((t) => t.tier_number === 2),
    [tiers],
  );
  const corePnL = usePortfolioPnL(coreTier?.portfolio_id ?? undefined, 365);
  const drawdown = useDrawdownState(corePnL.data);

  const { isHighStress } = useMarketStress();
  const { data: behavioralEvents = [] } = useBehavioralEvents();
  const seenEducationIds = useMemo(
    () => getSeenEducationIds(behavioralEvents),
    [behavioralEvents],
  );

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <RetailSignalFeed
        experienceLevel={profile.experience_level}
        isHighStress={isHighStress}
        seenEducationIds={seenEducationIds}
        coreDrawdownTier={drawdown.alertTier}
        coreDrawdownPct={drawdown.drawdownPct}
        corePortfolioId={coreTier?.portfolio_id ?? ""}
      />
    </div>
  );
}

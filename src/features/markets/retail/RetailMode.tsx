import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { marketsKeys } from '../hooks/queryKeys';
import { usePortfolioPnL } from '../hooks/usePortfolioPnL';
import { BehavioralAlertBanner } from './behavioral/BehavioralAlertBanner';
import {
  useBehavioralEvents,
  getSeenEducationIds,
} from './behavioral/useBehavioralEvents';
import { useDrawdownState } from './behavioral/useDrawdownAlerts';
import { useMarketStress } from './behavioral/useMarketStress';
import { RetailDashboard } from './dashboard/RetailDashboard';
import { RetailSignalFeed } from './feed/RetailSignalFeed';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { usePortfolioTiers } from './hooks/usePortfolioTiers';
import { useRiskProfile } from './hooks/useRiskProfile';

/**
 * Retail-mode entry point.
 *
 *   loading        → spinner
 *   !hasOnboarded  → 5-step OnboardingWizard
 *   else           → dashboard + Yellow/Orange drawdown banner (Core tier) + signal feed
 *
 * Red-tier drawdown (≥20%) routes to CoolingOffScreen at the sell action site,
 * not here — this banner is a passive non-blocking surface.
 *
 * Market stress + behavioral-event "seen" state flow down into the signal feed
 * so each SignalCard can pick the right per-card education trigger.
 */
export function RetailMode() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, error, hasOnboarded } = useRiskProfile();

  // Behavioral context (cheap when worker is offline — the hooks just stay in their error state).
  const { data: tiers = [] } = usePortfolioTiers();
  const coreTier = useMemo(() => tiers.find((t) => t.tier_number === 2), [tiers]);
  const corePnL  = usePortfolioPnL(coreTier?.portfolio_id ?? undefined, 365);
  const coreDrawdown = useDrawdownState(corePnL.data);

  const { isHighStress } = useMarketStress();

  const { data: behavioralEvents = [] } = useBehavioralEvents();
  const seenEducationIds = useMemo(
    () => getSeenEducationIds(behavioralEvents),
    [behavioralEvents],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your investment profile…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm">
        <p className="text-destructive">
          Couldn&apos;t load your investment profile
          {error instanceof Error ? `: ${error.message}` : '.'}
        </p>
      </div>
    );
  }

  if (!hasOnboarded || !profile) {
    return (
      <OnboardingWizard
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: marketsKeys.retail.profile() });
          queryClient.invalidateQueries({ queryKey: marketsKeys.retail.tiers() });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <RetailDashboard profile={profile} />

      {/*
        Core-tier drawdown banner (Yellow/Orange only). Red is intentionally
        omitted here — that path lives at the sell-action site as a modal.
      */}
      {coreTier && coreDrawdown.alertTier && coreDrawdown.alertTier !== 'red' && (
        <BehavioralAlertBanner
          alertTier={coreDrawdown.alertTier}
          drawdownPct={coreDrawdown.drawdownPct}
          portfolioId={coreTier.portfolio_id ?? ''}
        />
      )}

      <hr className="border-border" />

      <RetailSignalFeed
        experienceLevel={profile.experience_level}
        isHighStress={isHighStress}
        seenEducationIds={seenEducationIds}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { RetailDashboard } from './dashboard/RetailDashboard';
import { RetailSignalFeed } from './feed/RetailSignalFeed';
import { ExecutionBottomSheet } from './feed/ExecutionBottomSheet';
import { AutoExecutionSetup } from './autonomous/AutoExecutionSetup';
import { CommunityHub } from './community/CommunityHub';
import { BehavioralAlertBanner } from './behavioral/BehavioralAlertBanner';
import { useRiskProfile } from './hooks/useRiskProfile';
import { usePortfolioTiers } from './hooks/usePortfolioTiers';
import { usePortfolioPnL } from '../hooks/usePortfolioPnL';
import { useMarketStress } from './behavioral/useMarketStress';
import { useBehavioralEvents } from './behavioral/useBehavioralEvents';
import { useDrawdownState } from './behavioral/useDrawdownAlerts';
import { getSeenEducationIds } from './behavioral/useInlineEducation';
import { marketsKeys } from '../hooks/queryKeys';
import type { RetailSignal } from './types';

export function RetailMode() {
  const { data: profile, isLoading, hasOnboarded } = useRiskProfile();
  const [executing, setExecuting] = useState<RetailSignal | null>(null);
  const qc = useQueryClient();

  // Behavioral context
  const { data: behavioralEvents = [] } = useBehavioralEvents();
  const { isHighStress } = useMarketStress();
  const seenEducationIds = useMemo(
    () => getSeenEducationIds(behavioralEvents),
    [behavioralEvents],
  );

  // Core Portfolio (Tier 2) drawdown for behavioral alert
  const { data: tiers = [] } = usePortfolioTiers();
  const coreTier = tiers.find((t) => t.tier_number === 2);
  const corePnL = usePortfolioPnL(coreTier?.portfolio_id ?? undefined, 365);
  const coreDrawdown = useDrawdownState(corePnL.data);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading your investment profile…
      </div>
    );
  }

  if (!hasOnboarded) {
    return (
      <OnboardingWizard
        onComplete={() => qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() })}
      />
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <RetailDashboard profile={profile} />

      {coreTier && (
        <BehavioralAlertBanner
          alertTier={coreDrawdown.alertTier}
          drawdownPct={coreDrawdown.drawdownPct}
          portfolioId={coreTier.portfolio_id ?? ''}
        />
      )}

      <hr className="border-border" />

      {profile.experience_level === 'self_directed' ? (
        <Tabs defaultValue="feed">
          <TabsList className="w-full">
            <TabsTrigger value="feed" className="flex-1 text-xs">Signals</TabsTrigger>
            <TabsTrigger value="auto" className="flex-1 text-xs">Auto-Execute</TabsTrigger>
            <TabsTrigger value="community" className="flex-1 text-xs">Community</TabsTrigger>
          </TabsList>
          <TabsContent value="feed">
            <RetailSignalFeed
              experienceLevel={profile.experience_level}
              isHighStress={isHighStress}
              seenEducationIds={seenEducationIds}
              onExecute={(signal) => setExecuting(signal)}
            />
          </TabsContent>
          <TabsContent value="auto">
            <AutoExecutionSetup />
          </TabsContent>
          <TabsContent value="community">
            <CommunityHub />
          </TabsContent>
        </Tabs>
      ) : (
        <RetailSignalFeed
          experienceLevel={profile.experience_level}
          isHighStress={isHighStress}
          seenEducationIds={seenEducationIds}
          onExecute={(signal) => setExecuting(signal)}
        />
      )}

      <ExecutionBottomSheet
        signal={executing}
        open={Boolean(executing)}
        onOpenChange={(open) => { if (!open) setExecuting(null); }}
      />
    </div>
  );
}

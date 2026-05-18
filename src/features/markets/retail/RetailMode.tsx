import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { RetailDashboard } from './dashboard/RetailDashboard';
import { RetailSignalFeed } from './feed/RetailSignalFeed';
import { ExecutionBottomSheet } from './feed/ExecutionBottomSheet';
import { useRiskProfile } from './hooks/useRiskProfile';
import { marketsKeys } from '../hooks/queryKeys';
import type { RetailSignal } from './types';

export function RetailMode() {
  const { data: profile, isLoading, hasOnboarded } = useRiskProfile();
  const [executing, setExecuting] = useState<RetailSignal | null>(null);
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading your investment profile…
      </div>
    );
  }

  if (!hasOnboarded) {
    // useUpsertRiskProfile already invalidates the profile query on success,
    // so onComplete just needs to trigger a re-fetch (no page reload needed).
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
      <hr className="border-border" />
      <RetailSignalFeed
        experienceLevel={profile.experience_level}
        onExecute={(signal) => setExecuting(signal)}
      />
      <ExecutionBottomSheet
        signal={executing}
        open={Boolean(executing)}
        onOpenChange={(open) => { if (!open) setExecuting(null); }}
      />
    </div>
  );
}

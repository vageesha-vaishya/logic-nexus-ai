import { useState } from 'react';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { RetailDashboard } from './dashboard/RetailDashboard';
import { RetailSignalFeed } from './feed/RetailSignalFeed';
import { ExecutionBottomSheet } from './feed/ExecutionBottomSheet';
import { useRiskProfile } from './hooks/useRiskProfile';
import type { RetailSignal } from './types';

export function RetailMode() {
  const { data: profile, isLoading, hasOnboarded } = useRiskProfile();
  const [executing, setExecuting] = useState<RetailSignal | null>(null);

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
        onComplete={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <RetailDashboard profile={profile!} />
      <hr className="border-border" />
      <RetailSignalFeed
        experienceLevel={profile!.experience_level}
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

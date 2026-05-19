import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { marketsKeys } from "../hooks/queryKeys";
import { RetailNavLayout } from "./layouts/RetailNavLayout";
import { OnboardingWizard } from "./onboarding/OnboardingWizard";
import { useRiskProfile } from "./hooks/useRiskProfile";

/**
 * Retail-mode shell. Gates onboarding, then hands off to the 5-tab
 * `RetailNavLayout`. Per-tab pages (Home / Portfolio / Signals / Goals /
 * More) live in `./pages` and are mounted via React Router's `<Outlet />`.
 *
 * Behavioural drawdown, market-stress, and seen-education state are computed
 * inside each page that needs them — TanStack Query dedupes the underlying
 * fetches across tabs so there's no perf penalty for that split.
 */
export function RetailMode() {
  const queryClient = useQueryClient();
  const { isLoading, isError, error, hasOnboarded } = useRiskProfile();

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
          {error instanceof Error ? `: ${error.message}` : "."}
        </p>
      </div>
    );
  }

  if (!hasOnboarded) {
    return (
      <OnboardingWizard
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: marketsKeys.retail.profile() });
          queryClient.invalidateQueries({ queryKey: marketsKeys.retail.tiers() });
        }}
      />
    );
  }

  return <RetailNavLayout />;
}

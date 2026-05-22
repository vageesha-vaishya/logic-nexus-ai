import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

import { RetailNavLayout } from "./layouts/RetailNavLayout";
import { usePushRegistration } from "./hooks/usePushRegistration";
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
  const { isLoading, isError, error, hasOnboarded } = useRiskProfile();
  // Kick off FCM registration once per session — no-op on web, prompts
  // permission + posts token to /v1/retail/push/register on Android.
  usePushRegistration();

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

  // Onboarding now owns its own route + 7-step wizard at /onboarding (see
  // src/features/markets/retail/self-onboarding). Redirect rather than
  // rendering inline so the wizard has a single, deep-linkable home.
  if (!hasOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <RetailNavLayout />;
}

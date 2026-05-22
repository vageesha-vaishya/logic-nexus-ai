/**
 * useSthiraOnboardingProgress — what step does this user need next?
 *
 * Drives the Sthira mobile onboarding routing. Returns the next required
 * step based on existing data:
 *   - "auth"     — not signed in
 *   - "risk"     — signed in, risk_profile.onboarding_complete is false
 *   - "complete" — fully onboarded; route to Home (paper portfolio is
 *                  pre-seeded by the post-signup edge function)
 *   - "loading"  — still querying
 *
 * Updated 2026-05-22 for decision A (broker-deferred): a connected broker
 * is no longer required to reach Home. Users start in paper mode and can
 * connect a broker any time from More → Brokers. The "broker" step value
 * is retained for back-compat with old callers but is never returned.
 *
 * See docs/plans/2026-05-21-self-onboarding-wizard-design.md.
 */
import { useAuth } from "@/hooks/useAuth";
import { useRiskProfile } from "@/features/markets/retail/hooks/useRiskProfile";

export type SthiraOnboardingStep =
  | "loading"
  | "auth"
  | "risk"
  | "broker"
  | "complete";

export interface SthiraOnboardingProgress {
  step:           SthiraOnboardingStep;
  hasAuth:        boolean;
  hasRiskProfile: boolean;
}

export function useSthiraOnboardingProgress(): SthiraOnboardingProgress {
  const { user, loading: authLoading } = useAuth();
  const profile = useRiskProfile();

  if (authLoading) {
    return { step: "loading", hasAuth: false, hasRiskProfile: false };
  }

  if (!user?.id) {
    return { step: "auth", hasAuth: false, hasRiskProfile: false };
  }

  if (profile.isPending) {
    return { step: "loading", hasAuth: true, hasRiskProfile: false };
  }

  const hasRiskProfile = profile.hasOnboarded;
  if (!hasRiskProfile) {
    return { step: "risk", hasAuth: true, hasRiskProfile };
  }
  return { step: "complete", hasAuth: true, hasRiskProfile };
}

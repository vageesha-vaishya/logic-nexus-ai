/**
 * useSthiraOnboardingProgress — what step does this user need next?
 *
 * Drives the Sthira mobile onboarding routing. Returns the next required
 * step based on existing data:
 *   - "auth"     — not signed in
 *   - "risk"     — signed in, no risk profile yet
 *   - "broker"   — risk + goals done, no broker connected (skippable)
 *   - "complete" — fully onboarded; route to Home
 *   - "loading"  — still querying
 *
 * "goals" and "risk" are merged into one wizard step in the existing
 * OnboardingWizard — they don't map to separate routes. The design doc
 * lists them separately for human-facing description; here they collapse.
 *
 * See docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md
 */
import { useAuth } from "@/hooks/useAuth";
import { useRiskProfile } from "@/features/markets/retail/hooks/useRiskProfile";
import { useBrokerConnections } from "@/features/markets/hooks/useBrokerConnections";

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
  hasBroker:      boolean;
}

export function useSthiraOnboardingProgress(): SthiraOnboardingProgress {
  const { user, loading: authLoading } = useAuth();
  const profile = useRiskProfile();
  const connections = useBrokerConnections();

  // While we don't know the user's session yet, hold.
  if (authLoading) {
    return { step: "loading", hasAuth: false, hasRiskProfile: false, hasBroker: false };
  }

  // No session → first step is auth.
  if (!user?.id) {
    return { step: "auth", hasAuth: false, hasRiskProfile: false, hasBroker: false };
  }

  // Session resolved but the profile + brokers queries still loading.
  if (profile.isPending || connections.isPending) {
    return { step: "loading", hasAuth: true, hasRiskProfile: false, hasBroker: false };
  }

  const hasRiskProfile = profile.hasOnboarded;
  const hasBroker = (connections.data?.length ?? 0) > 0;

  if (!hasRiskProfile) {
    return { step: "risk", hasAuth: true, hasRiskProfile, hasBroker };
  }
  if (!hasBroker) {
    return { step: "broker", hasAuth: true, hasRiskProfile, hasBroker };
  }
  return { step: "complete", hasAuth: true, hasRiskProfile, hasBroker };
}

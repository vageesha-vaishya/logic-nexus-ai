/**
 * SthiraOnboardingRoute — risk + goals + tiers wizard inside the Sthira shell.
 *
 * Wraps the existing markets retail OnboardingWizard so we get the existing
 * 5-step flow (Experience, Goals, Timeline, Quiz, Tiers) without rebuilding
 * the data layer. The wizard's existing styling will sit inside our cream
 * onboarding shell — Sthira-branded chrome around battle-tested form logic.
 *
 * On completion, navigates to /sthira/broker (the broker connect step).
 *
 * PR 2 deliberately reuses the wizard as-is. Future PRs may restyle each
 * card with the Calm Wealth typography + sliders, but the risk-tag math
 * and persistence already work.
 */
import { useNavigate } from "react-router-dom";
import { OnboardingWizard } from "@/features/markets/retail/onboarding/OnboardingWizard";
import { SthiraOnboardingShell } from "./SthiraOnboardingShell";

export default function SthiraOnboardingRoute() {
  const navigate = useNavigate();
  return (
    <SthiraOnboardingShell
      eyebrow="Step 1 of 2"
      title="Your investing plan"
    >
      <OnboardingWizard
        onComplete={() => navigate("/sthira/broker", { replace: true })}
      />
    </SthiraOnboardingShell>
  );
}

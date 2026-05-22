/**
 * SthiraOnboardingRoute — the 7-screen self-onboarding wizard inside the
 * Sthira shell.
 *
 * As of 2026-05-22 the legacy 5-step OnboardingWizard is superseded by the
 * SelfOnboardingWizard (see docs/plans/2026-05-21-self-onboarding-wizard-design.md).
 * Broker connection is deferred (decision A: broker-deferred onboarding) —
 * on completion we go straight to the retail home; the user can connect a
 * broker later from More → Brokers.
 */
import { useNavigate } from "react-router-dom";

import { SelfOnboardingWizard } from "@/features/markets/retail/self-onboarding";
import { SthiraOnboardingShell } from "./SthiraOnboardingShell";

export default function SthiraOnboardingRoute() {
  const navigate = useNavigate();
  return (
    <SthiraOnboardingShell
      eyebrow="Getting started"
      title="Your investing plan"
    >
      <SelfOnboardingWizard
        onComplete={() =>
          navigate("/dashboard/markets/retail/home", { replace: true })
        }
      />
    </SthiraOnboardingShell>
  );
}

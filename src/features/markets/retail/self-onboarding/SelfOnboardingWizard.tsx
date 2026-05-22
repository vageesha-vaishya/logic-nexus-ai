/**
 * SelfOnboardingWizard — the retail self-onboarding flow.
 *
 * Replaces the legacy 5-step OnboardingWizard. Step screens 2–8 from the
 * design doc; step 1 (signup) lives at /auth, step 9 (first-Home tour)
 * is post-wizard.
 *
 * Architecture:
 *   - Route guard: useOnboardingProvision runs the fallback edge-function
 *     call if retail_profile is missing; while provisioning we show a
 *     spinner. While provisioned but onboarding_complete, we redirect
 *     to the retail home.
 *   - State machine: linear step list, Back/Next controlled by each step.
 *   - Persistence: every Step Continue writes to the canonical DB tables
 *     (risk_profiles, portfolio_tiers, retail_profile) via the existing
 *     mutation hooks. In-flight typing survives reloads via
 *     useOnboardingDraft (localStorage).
 *
 * See docs/plans/2026-05-21-self-onboarding-wizard-design.md.
 */
import { useMemo, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

import { useRiskProfile } from '../hooks/useRiskProfile';
import { usePortfolioTiers } from '../hooks/usePortfolioTiers';

import { useOnboardingProvision } from './useOnboardingProvision';
import { useRetailProfile } from './useRetailProfile';
import { computeResumeStep } from './useResumeStep';
import { STEP_ORDER, STEP_TITLES, type WizardStepId } from './types';

import { StepWelcome } from './steps/StepWelcome';
import { StepRiskQuiz } from './steps/StepRiskQuiz';
import { StepGoals } from './steps/StepGoals';
import { StepTiers } from './steps/StepTiers';
import { StepStarter } from './steps/StepStarter';
import { StepNominee } from './steps/StepNominee';
import { StepSummary } from './steps/StepSummary';

interface SelfOnboardingWizardProps {
  onComplete: () => void;
}

export function SelfOnboardingWizard({ onComplete }: SelfOnboardingWizardProps) {
  const provision     = useOnboardingProvision();
  const riskProfile   = useRiskProfile();
  const retailProfile = useRetailProfile();
  const tiers         = usePortfolioTiers();

  const dataReady =
    provision.status === 'ready' &&
    !riskProfile.isLoading &&
    !retailProfile.isLoading &&
    !tiers.isLoading;

  const resumeStep = useMemo<WizardStepId | null>(() => {
    if (!dataReady) return null;
    return computeResumeStep({
      riskProfile:   riskProfile.data,
      retailProfile: retailProfile.data,
      tiers:         tiers.data,
    });
  }, [dataReady, riskProfile.data, retailProfile.data, tiers.data]);

  // The wizard tracks the *currently visible* step independently of the
  // computed resume step. On first data ready we seed it; subsequent
  // navigation is controlled by Back/Next handlers.
  const [step, setStep] = useState<WizardStepId | null>(null);
  useEffect(() => {
    if (step === null && resumeStep !== null) setStep(resumeStep);
  }, [step, resumeStep]);

  // If we've already finished onboarding by the time the data lands,
  // bail out to the destination immediately.
  useEffect(() => {
    if (dataReady && resumeStep === null) onComplete();
  }, [dataReady, resumeStep, onComplete]);

  if (provision.status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-8 space-y-4">
        <h2 className="text-lg font-semibold">Setup hit a snag</h2>
        <p className="text-sm text-muted-foreground">
          We couldn't finish provisioning your account: {provision.error}
        </p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  if (!dataReady || step === null) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stepIdx  = STEP_ORDER.indexOf(step);
  const progress = ((stepIdx + 1) / STEP_ORDER.length) * 100;

  const goNext = () => {
    const next = STEP_ORDER[stepIdx + 1];
    if (next) setStep(next);
    else onComplete();
  };
  const goBack = () => {
    const prev = STEP_ORDER[stepIdx - 1];
    if (prev) setStep(prev);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {stepIdx + 1} of {STEP_ORDER.length}</span>
          <span>{STEP_TITLES[step]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {step === 'welcome'   && <StepWelcome   onNext={goNext} />}
      {step === 'risk_quiz' && <StepRiskQuiz onNext={goNext} onBack={goBack} />}
      {step === 'goals'     && <StepGoals     onNext={goNext} onBack={goBack} />}
      {step === 'tiers'     && <StepTiers     onNext={goNext} onBack={goBack} />}
      {step === 'starter'   && <StepStarter   onNext={goNext} onBack={goBack} />}
      {step === 'nominee'   && <StepNominee  onNext={goNext} onBack={goBack} />}
      {step === 'summary'   && <StepSummary  onFinish={onComplete} onBack={goBack} />}
    </div>
  );
}

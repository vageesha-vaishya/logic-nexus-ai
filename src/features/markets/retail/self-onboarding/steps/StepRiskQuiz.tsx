/**
 * Step 3 — Wealthfront-grade risk quiz (10 questions). Answers feed three
 * downstream signals on Continue:
 *
 *   - risk_profiles.risk_tag         (conservative / moderate / aggressive)
 *   - risk_profiles.experience_level (beginner / casual / self_directed)
 *   - risk_profiles.behavioral_flags (tends_panic_sell, …)
 *
 * Pre-existing goals + starter_template_slug are preserved across re-runs
 * so backing up to redo the quiz doesn't wipe later answers.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { RiskQuizV2 } from '../RiskQuizV2';
import {
  computeQuizV2RiskTag,
  computeQuizV2Score,
  deriveBehavioralFlags,
  deriveExperienceLevel,
  isQuizV2Complete,
  type QuizAnswers,
} from '../quiz';
import { useRiskProfile, useUpsertRiskProfile } from '../../hooks/useRiskProfile';
import { useOnboardingDraft } from '../useOnboardingState';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepRiskQuiz({ onNext, onBack }: Props) {
  const { draft, merge, clearKeys } = useOnboardingDraft();
  const { data: existing } = useRiskProfile();
  const upsertProfile      = useUpsertRiskProfile();

  // Seed from the in-flight draft first, then from any previously saved
  // answers in the DB — so a fresh device picks up where the user left off.
  const seed: QuizAnswers =
    (draft.quiz_answers as QuizAnswers | undefined) ??
    ((existing?.quiz_answers ?? {}) as QuizAnswers);
  const [answers, setAnswers] = useState<QuizAnswers>(seed);

  const handleChange = (next: QuizAnswers) => {
    setAnswers(next);
    merge({ quiz_answers: next as Record<string, string> });
  };

  const handleContinue = async () => {
    const score   = computeQuizV2Score(answers);
    const riskTag = computeQuizV2RiskTag(score);
    const expLvl  = deriveExperienceLevel(answers);
    const flags   = deriveBehavioralFlags(answers);

    try {
      await upsertProfile.mutateAsync({
        experience_level: expLvl,
        risk_tag:         riskTag,
        // Preserve any goals already picked in step 4; if the user is on
        // first run, goals will be filled in by the next step.
        goals:            existing?.goals ?? [],
        quiz_answers:     answers as Record<string, string>,
        behavioral_flags: flags,
      });
      clearKeys(['quiz_answers']);
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title="Your risk profile"
      description="Ten quick questions so we can match the right portfolio mix to you. No right or wrong answers — be honest, not aspirational."
      canAdvance={isQuizV2Complete(answers)}
      saving={upsertProfile.isPending}
      onPrimary={handleContinue}
      onBack={onBack}
    >
      <RiskQuizV2 answers={answers} onChange={handleChange} />
    </StepShell>
  );
}

/**
 * Step 4 — Goals + priority weighting.
 *
 * Replaces the legacy "checklist + timeline-per-goal" pattern with a single
 * editor that captures goal / horizon / target ₹ / priority rank per
 * design doc §"Step-by-step screen contract". Writes the full Goal[]
 * (including priorities) to risk_profiles.goals jsonb on Continue.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { useRiskProfile, useUpsertRiskProfile } from '../../hooks/useRiskProfile';
import type { Goal } from '../../types';

import { GoalsEditor } from '../GoalsEditor';
import { sortByPriority } from '../goals';
import { useOnboardingDraft } from '../useOnboardingState';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepGoals({ onNext, onBack }: Props) {
  const { data: profile } = useRiskProfile();
  const upsert            = useUpsertRiskProfile();
  const { draft, merge, clearKeys } = useOnboardingDraft();

  // Draft first, then DB. Wraps legacy data (no priorities) so the editor
  // can still present ordered rows.
  const seedRaw: Goal[] =
    (draft.goals as Goal[] | undefined) ??
    (profile?.goals as Goal[] | undefined) ??
    [];
  const seed = sortByPriority(
    seedRaw.map((g, i) => ({ ...g, priority: g.priority ?? i + 1 })),
  );

  const [goals, setGoals] = useState<Goal[]>(seed);

  const handleChange = (next: Goal[]) => {
    setGoals(next);
    merge({ goals: next });
  };

  const handleContinue = async () => {
    if (!profile) {
      toast.error('Risk profile not ready yet — try again in a moment.');
      return;
    }
    if (goals.length === 0) {
      toast.error('Pick at least one goal to continue.');
      return;
    }
    try {
      await upsert.mutateAsync({
        experience_level: profile.experience_level,
        risk_tag:         profile.risk_tag,
        goals:            sortByPriority(goals),
        quiz_answers:     profile.quiz_answers,
        behavioral_flags: profile.behavioral_flags,
      });
      clearKeys(['goals']);
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title="What are you investing for?"
      description="Pick up to three goals, order them by importance, and set a rough horizon and target for each."
      canAdvance={goals.length > 0}
      saving={upsert.isPending}
      onPrimary={handleContinue}
      onBack={onBack}
    >
      <GoalsEditor goals={goals} onChange={handleChange} />
    </StepShell>
  );
}

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { GoalSelector } from './GoalSelector';
import { RiskQuiz, computeQuizScore, isQuizComplete } from './RiskQuiz';
import { TierSetup, type TierDraft } from './TierSetup';
import {
  GOALS,
  TIER_DEFAULTS,
  computeRiskTag,
  type ExperienceLevel,
  type Goal,
} from '../types';
import { useUpsertRiskProfile } from '../hooks/useRiskProfile';
import { useUpsertPortfolioTier } from '../hooks/usePortfolioTiers';

const STEPS = ['Experience', 'Goals', 'Timeline', 'Quiz', 'Tiers'] as const;

const EXPERIENCE_OPTIONS: Array<{
  value: ExperienceLevel;
  label: string;
  desc: string;
}> = [
  { value: 'beginner',      label: 'Beginner',      desc: 'New to investing, want simple guidance' },
  { value: 'casual',        label: 'Casual',        desc: 'Know the basics, want to stay informed' },
  { value: 'self_directed', label: 'Self-directed', desc: 'Experienced, want full details and control' },
];

const goalLabel = (id: string) =>
  GOALS.find((g) => g.id === id)?.label ?? id.replace(/_/g, ' ');

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [experience, setExperience]   = useState<ExperienceLevel>('beginner');
  const [goals, setGoals]             = useState<string[]>([]);
  const [timelines, setTimelines]     = useState<Record<string, number>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<TierDraft[]>(
    TIER_DEFAULTS.map((d) => ({
      tier_number: d.tier_number,
      portfolio_id: null,
      target_amount: null,
    })),
  );

  const upsertProfile = useUpsertRiskProfile();
  const upsertTier    = useUpsertPortfolioTier();
  const saving        = upsertProfile.isPending || upsertTier.isPending;

  const progress = ((step + 1) / STEPS.length) * 100;

  const canAdvance =
    (step === 0) ||
    (step === 1 && goals.length > 0) ||
    (step === 2) ||
    (step === 3 && isQuizComplete(quizAnswers)) ||
    (step === 4);

  const updateTier: React.ComponentProps<typeof TierSetup>['onChange'] = (
    tierNumber,
    field,
    value,
  ) => {
    setTiers((prev) =>
      prev.map((t) =>
        t.tier_number === tierNumber
          ? { ...t, [field]: value as never }
          : t,
      ),
    );
  };

  const handleFinish = async () => {
    const score   = computeQuizScore(quizAnswers);
    const riskTag = computeRiskTag(score);
    const goalObjs: Goal[] = goals.map((g) => ({
      goal: g,
      years: timelines[g] ?? 10,
    }));

    try {
      await upsertProfile.mutateAsync({
        experience_level:    experience,
        risk_tag:            riskTag,
        goals:               goalObjs,
        quiz_answers:        quizAnswers,
        behavioral_flags:    score <= 2 ? { tends_panic_sell: true } : {},
        onboarding_complete: true,
      });

      await Promise.all(
        tiers.map((t) =>
          upsertTier.mutateAsync({
            tier_number:   t.tier_number,
            name:          TIER_DEFAULTS[t.tier_number - 1].name,
            portfolio_id:  t.portfolio_id,
            target_amount: t.target_amount,
          }),
        ),
      );

      toast.success('You\'re all set — welcome to the retail dashboard.');
      onComplete();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Please try again.';
      toast.error(`Setup failed: ${detail}`);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {step === 0 && 'What best describes you?'}
            {step === 1 && 'What are you investing for?'}
            {step === 2 && 'How long is each goal?'}
            {step === 3 && 'Quick risk check'}
            {step === 4 && 'Set up your three tiers'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <RadioGroup
              value={experience}
              onValueChange={(v) => setExperience(v as ExperienceLevel)}
              className="space-y-2"
            >
              {EXPERIENCE_OPTIONS.map(({ value, label, desc }) => (
                <div
                  key={value}
                  className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40 cursor-pointer"
                  onClick={() => setExperience(value)}
                >
                  <RadioGroupItem value={value} id={value} className="mt-0.5" />
                  <Label htmlFor={value} className="cursor-pointer flex-1">
                    <span className="font-medium text-sm">{label}</span>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {step === 1 && (
            <GoalSelector selected={goals} onChange={setGoals} />
          )}

          {step === 2 && (
            goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pick at least one goal in the previous step to set its timeline.
              </p>
            ) : (
              <div className="space-y-6">
                {goals.map((g) => {
                  const years = timelines[g] ?? 10;
                  return (
                    <div key={g} className="space-y-2">
                      <Label className="text-sm">{goalLabel(g)}</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          min={1}
                          max={30}
                          step={1}
                          value={[years]}
                          onValueChange={([v]) =>
                            setTimelines((t) => ({ ...t, [g]: v }))
                          }
                          className="flex-1"
                        />
                        <span className="w-16 text-right text-sm font-medium tabular-nums">
                          {years} yr{years > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {step === 3 && (
            <RiskQuiz answers={quizAnswers} onChange={setQuizAnswers} />
          )}

          {step === 4 && (
            <TierSetup tiers={tiers} onChange={updateTier} />
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
                className="flex-1"
              >
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance}
                className="flex-1"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Saving…' : 'Start Investing'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { GoalSelector } from './GoalSelector';
import { RiskQuiz, computeQuizScore } from './RiskQuiz';
import { TierSetup } from './TierSetup';
import {
  computeRiskTag,
  TIER_DEFAULTS,
  type ExperienceLevel,
  type Goal,
} from '../types';
import { useUpsertRiskProfile } from '../hooks/useRiskProfile';
import { useUpsertPortfolioTier } from '../hooks/usePortfolioTiers';

const STEPS = ['Experience', 'Goals', 'Timeline', 'Quiz', 'Tiers'] as const;

interface TierDraft {
  tier_number: 1 | 2 | 3;
  portfolio_id: string | null;
  target_amount: number | null;
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [goals, setGoals] = useState<string[]>([]);
  const [timelines, setTimelines] = useState<Record<string, number>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<TierDraft[]>(
    TIER_DEFAULTS.map((d) => ({
      tier_number: d.tier_number,
      portfolio_id: null,
      target_amount: null,
    })),
  );

  const upsertProfile = useUpsertRiskProfile();
  const upsertTier = useUpsertPortfolioTier();

  const progress = ((step + 1) / STEPS.length) * 100;
  const canAdvance = step !== 1 || goals.length > 0;

  const updateTier = (
    tierNumber: 1 | 2 | 3,
    field: 'portfolio_id' | 'target_amount',
    value: string | number | null,
  ) => {
    setTiers((prev) =>
      prev.map((t) =>
        t.tier_number === tierNumber ? { ...t, [field]: value } : t,
      ),
    );
  };

  const handleFinish = async () => {
    const score = computeQuizScore(quizAnswers);
    const riskTag = computeRiskTag(score);
    const goalObjs: Goal[] = goals.map((g) => ({
      goal: g,
      years: timelines[g] ?? 10,
    }));

    try {
      await upsertProfile.mutateAsync({
        experience_level: experience,
        risk_tag: riskTag,
        goals: goalObjs,
        quiz_answers: quizAnswers,
        behavioral_flags: score <= 2 ? { tends_panic_sell: true } : {},
        onboarding_complete: true,
      });
      await Promise.all(
        tiers.map((t) =>
          upsertTier.mutateAsync({
            tier_number: t.tier_number,
            name: TIER_DEFAULTS[t.tier_number - 1].name,
            portfolio_id: t.portfolio_id,
            target_amount: t.target_amount,
          }),
        ),
      );
      onComplete();
    } catch {
      toast.error('Setup failed. Please try again.');
    }
  };

  const isSaving = upsertProfile.isPending || upsertTier.isPending;

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
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

          {/* Step 0: Experience level */}
          {step === 0 && (
            <RadioGroup
              value={experience}
              onValueChange={(v) => setExperience(v as ExperienceLevel)}
              className="space-y-3"
            >
              {[
                { value: 'beginner' as const,      label: 'Beginner',      desc: 'New to investing, want simple guidance' },
                { value: 'casual' as const,         label: 'Casual',        desc: 'Know the basics, want to stay informed' },
                { value: 'self_directed' as const,  label: 'Self-directed', desc: 'Experienced, want full details and control' },
              ].map(({ value, label, desc }) => (
                <div
                  key={value}
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExperience(value)}
                >
                  <RadioGroupItem value={value} id={value} className="mt-0.5" />
                  <Label htmlFor={value} className="cursor-pointer">
                    <span className="font-medium text-sm">{label}</span>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Step 1: Goals */}
          {step === 1 && (
            <GoalSelector selected={goals} onChange={setGoals} />
          )}

          {/* Step 2: Timelines */}
          {step === 2 && (
            <div className="space-y-6">
              {goals.map((g) => (
                <div key={g} className="space-y-2">
                  <Label className="capitalize text-sm">
                    {g.replace(/_/g, ' ')}
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      min={1}
                      max={30}
                      step={1}
                      value={[timelines[g] ?? 10]}
                      onValueChange={([v]) =>
                        setTimelines((t) => ({ ...t, [g]: v }))
                      }
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-16 text-right">
                      {timelines[g] ?? 10} yr{(timelines[g] ?? 10) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Quiz */}
          {step === 3 && (
            <RiskQuiz answers={quizAnswers} onChange={setQuizAnswers} />
          )}

          {/* Step 4: Tier setup */}
          {step === 4 && (
            <TierSetup tiers={tiers} onChange={updateTier} />
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
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
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? 'Saving…' : 'Start Investing'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

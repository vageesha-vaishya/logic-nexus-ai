/**
 * Self-onboarding wizard — frame types.
 *
 * Step IDs match the design doc §"End-to-end flow" numbering. Step 1
 * (email/password signup) lives outside the wizard at /auth; the wizard
 * itself runs from step 2 (disclosure) through step 8 (summary).
 *
 * Companion: docs/plans/2026-05-21-self-onboarding-wizard-design.md.
 */
import type { Goal } from '../types';

export type WizardStepId =
  | 'welcome'        // step 2: disclosure + welcome
  | 'risk_quiz'      // step 3: Wealthfront-grade quiz
  | 'goals'          // step 4: multi-goal + priority weighting
  | 'tiers'          // step 5: tier sliders
  | 'starter'        // step 6: starter template confirmation
  | 'nominee'        // step 7: nominee (skippable)
  | 'summary';       // step 8: review + finish

export const STEP_ORDER: readonly WizardStepId[] = [
  'welcome',
  'risk_quiz',
  'goals',
  'tiers',
  'starter',
  'nominee',
  'summary',
] as const;

export const STEP_TITLES: Record<WizardStepId, string> = {
  welcome:   'Welcome',
  risk_quiz: 'Your risk profile',
  goals:     'What you\'re investing for',
  tiers:     'Your three buckets',
  starter:   'Pick a starting template',
  nominee:   'Nominee (optional)',
  summary:   'You\'re all set',
};

/** Draft state captured in localStorage between renders. */
export interface WizardDraft {
  quiz_answers?: Record<string, string>;
  goals?:        Array<Goal & { priority?: number }>;
  tier_targets?: Record<1 | 2 | 3, number | null>;
  starter_slug?: string;
  nominee?: {
    name?:         string;
    relationship?: string;
    pan?:          string;
  };
}

export interface OnboardingProgress {
  step:        WizardStepId;
  completed:   boolean;
  /** Captured from existing DB state on mount; used to skip ahead. */
  resumed_from_step?: WizardStepId;
}

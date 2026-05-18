import type { Signal } from '../types';

export type ExperienceLevel = 'beginner' | 'casual' | 'self_directed';
export type RiskTag = 'conservative' | 'moderate' | 'aggressive';
export type TierName = 'Safety Net' | 'Core Portfolio' | 'Experimental';

export interface Goal {
  goal: string;
  years: number;
}

export interface RiskProfile {
  id: string;
  user_id: string;
  experience_level: ExperienceLevel;
  risk_tag: RiskTag;
  goals: Goal[];
  behavioral_flags: Record<string, boolean>;
  quiz_answers: Record<string, string>;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertRiskProfileInput {
  experience_level: ExperienceLevel;
  risk_tag: RiskTag;
  goals: Goal[];
  behavioral_flags?: Record<string, boolean>;
  quiz_answers?: Record<string, string>;
  onboarding_complete?: boolean;
}

export interface PortfolioTier {
  id: string;
  user_id: string;
  tier_number: 1 | 2 | 3;
  name: TierName;
  portfolio_id: string | null;
  target_amount: number | null;
  goals: string[];
  created_at: string;
  updated_at: string;
}

/** Draft shape used during onboarding before tiers are persisted. */
export interface TierDraft {
  tier_number: 1 | 2 | 3;
  portfolio_id: string | null;
  target_amount: number | null;
}

export interface UpsertTierInput {
  tier_number: 1 | 2 | 3;
  name: TierName;
  portfolio_id?: string | null;
  target_amount?: number | null;
  goals?: string[];
}

export interface SignalExplanations {
  beginner: string;
  casual: string;
  self_directed: string;
}

export interface RetailSignal extends Signal {
  metadata: Signal['metadata'] & {
    explanations?: SignalExplanations;
    horizon?: string;
    entry_price?: number;
    stop_loss?: number;
    target_price?: number;
    confidence_low?: number;
    confidence_high?: number;
    accuracy_historical?: number;
    accuracy_sample_size?: number;
  };
}

/** Maps quiz score to risk tag. Score range 0–10 (4 questions × 0/1/2 points each). */
export function computeRiskTag(score: number): RiskTag {
  if (score <= 4) return 'conservative';
  if (score <= 7) return 'moderate';
  return 'aggressive';
}

export const TIER_DEFAULTS: Array<{
  tier_number: 1 | 2 | 3;
  name: TierName;
  description: string;
  signal_access: string;
}> = [
  {
    tier_number: 1,
    name: 'Safety Net',
    description: 'Capital protected, emergency access',
    signal_access: 'none',
  },
  {
    tier_number: 2,
    name: 'Core Portfolio',
    description: 'Long-term wealth, high conviction signals only',
    signal_access: 'high_conviction',
  },
  {
    tier_number: 3,
    name: 'Experimental',
    description: 'Active signals, play money, separate P&L',
    signal_access: 'all',
  },
];

export const GOALS = [
  { id: 'retirement',     label: 'Retirement' },
  { id: 'emergency_fund', label: 'Emergency Fund / Safety Net' },
  { id: 'wealth_growth',  label: 'Wealth Growth' },
  { id: 'education',      label: "Child's Education" },
  { id: 'home_purchase',  label: 'Home Purchase' },
  { id: 'short_income',   label: 'Short-term Income' },
  { id: 'exploring',      label: 'Just exploring' },
] as const;

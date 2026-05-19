/**
 * Retail investment platform — frontend types.
 *
 * Mirrors markets.risk_profiles and markets.portfolio_tiers (Task 1 migration)
 * plus the RetailSignal view over markets.signals with the explanation layer
 * populated server-side (Task 5).
 */

import type { Signal } from '../types';

export type ExperienceLevel = 'beginner' | 'casual' | 'self_directed';
export type RiskTag         = 'conservative' | 'moderate' | 'aggressive';
export type TierName        = 'Safety Net' | 'Core Portfolio' | 'Experimental';
export type SignalAccess    = 'none' | 'high_conviction' | 'all';

export interface Goal {
  goal: string;             // 'retirement' | 'emergency_fund' | 'wealth_growth' | ...
  years: number;
  target_amount?: number;
}

// ── Risk profile ──────────────────────────────────────────────────────────────

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

// ── Portfolio tier ────────────────────────────────────────────────────────────

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

export interface UpsertTierInput {
  tier_number: 1 | 2 | 3;
  name: TierName;
  portfolio_id?: string | null;
  target_amount?: number | null;
  goals?: string[];
}

// ── Signal explanation layer ──────────────────────────────────────────────────

export interface SignalExplanations {
  beginner: string;
  casual: string;
  self_directed: string;
}

/** A markets.signals row with the retail explanation + execution metadata. */
export interface RetailSignal extends Signal {
  /** Top-level column on markets.signals — the worker's authoritative horizon. */
  horizon?: 'intraday' | 'short_term' | 'medium_term' | 'long_term';
  /** Asset class column (selected by the retail router). */
  asset_class?: string;
  /** Risk params column (stop_loss_pct, target_pct, r_r, …). */
  risk_params?: {
    stop_loss_pct?: number;
    target_pct?: number;
    r_r?: number;
    [k: string]: unknown;
  } | null;
  metadata: Signal['metadata'] & {
    explanations?: SignalExplanations;
    /** Legacy: older signals stashed horizon in metadata. */
    horizon?: 'intraday' | 'short_term' | 'medium_term' | 'long_term' | string;
    entry_price?: number;
    stop_loss?: number;
    target_price?: number;
    confidence_low?: number;
    confidence_high?: number;
    accuracy_historical?: number;
    accuracy_sample_size?: number;
    /** Symbol mirrored into metadata for older signals. */
    symbol?: string;
    /** Asset class mirrored into metadata. */
    asset_class?: string;
  };
}

// ── Quiz scoring ──────────────────────────────────────────────────────────────

/**
 * Map a 0–10 risk score from the onboarding quiz to a risk tag.
 * Each of 4 questions contributes 0–2 points (see RiskQuiz component).
 *   ≤4  → conservative
 *   5–7 → moderate
 *   ≥8  → aggressive
 */
export function computeRiskTag(score: number): RiskTag {
  if (score <= 4) return 'conservative';
  if (score <= 7) return 'moderate';
  return 'aggressive';
}

// ── Tier defaults ─────────────────────────────────────────────────────────────

export interface TierDefault {
  tier_number: 1 | 2 | 3;
  name: TierName;
  description: string;
  signal_access: SignalAccess;
}

export const TIER_DEFAULTS: readonly TierDefault[] = [
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
] as const;

// ── Onboarding goal catalogue ────────────────────────────────────────────────

export const GOALS = [
  { id: 'retirement',     label: 'Retirement' },
  { id: 'emergency_fund', label: 'Emergency Fund / Safety Net' },
  { id: 'wealth_growth',  label: 'Wealth Growth' },
  { id: 'education',      label: "Child's Education" },
  { id: 'home_purchase',  label: 'Home Purchase' },
  { id: 'short_income',   label: 'Short-term Income' },
  { id: 'exploring',      label: 'Just exploring' },
] as const;

export type GoalId = typeof GOALS[number]['id'];

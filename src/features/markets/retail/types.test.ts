import { describe, it, expect } from 'vitest';
import {
  computeRiskTag,
  TIER_DEFAULTS,
  type RiskProfile,
  type PortfolioTier,
  type RetailSignal,
} from './types';

describe('computeRiskTag', () => {
  it('returns conservative for score <= 4', () => {
    expect(computeRiskTag(0)).toBe('conservative');
    expect(computeRiskTag(4)).toBe('conservative');
  });
  it('returns moderate for score 5-7', () => {
    expect(computeRiskTag(5)).toBe('moderate');
    expect(computeRiskTag(7)).toBe('moderate');
  });
  it('returns aggressive for score >= 8', () => {
    expect(computeRiskTag(8)).toBe('aggressive');
    expect(computeRiskTag(10)).toBe('aggressive');
  });
});

describe('TIER_DEFAULTS', () => {
  it('defines 3 tiers with correct names and numbers', () => {
    expect(TIER_DEFAULTS).toHaveLength(3);
    expect(TIER_DEFAULTS[0]).toMatchObject({ tier_number: 1, name: 'Safety Net',     signal_access: 'none' });
    expect(TIER_DEFAULTS[1]).toMatchObject({ tier_number: 2, name: 'Core Portfolio', signal_access: 'high_conviction' });
    expect(TIER_DEFAULTS[2]).toMatchObject({ tier_number: 3, name: 'Experimental',   signal_access: 'all' });
  });
});

// Type-level smoke tests — these only need to compile.
describe('exported types', () => {
  it('compiles RiskProfile, PortfolioTier, RetailSignal shapes', () => {
    const profile: RiskProfile = {
      id: 'p1',
      user_id: 'u1',
      experience_level: 'beginner',
      risk_tag: 'conservative',
      goals: [{ goal: 'retirement', years: 20 }],
      behavioral_flags: { tends_panic_sell: true },
      quiz_answers: { q1: 'a' },
      onboarding_complete: false,
      created_at: '2026-05-18T00:00:00Z',
      updated_at: '2026-05-18T00:00:00Z',
    };
    const tier: PortfolioTier = {
      id: 't1',
      user_id: 'u1',
      tier_number: 1,
      name: 'Safety Net',
      portfolio_id: null,
      target_amount: null,
      goals: [],
      created_at: '2026-05-18T00:00:00Z',
      updated_at: '2026-05-18T00:00:00Z',
    };
    const signal: RetailSignal = {
      id: 's1',
      ts: '2026-05-18T00:00:00Z',
      instrument_id: 'i1',
      strategy_id: null,
      portfolio_id: null,
      signal_type: 'momentum',
      direction: 'long',
      confidence: 0.8,
      score: 0.7,
      rationale: null,
      price_at_signal: 100,
      generated_by: null,
      expires_at: null,
      metadata: {
        explanations: { beginner: 'b', casual: 'c', self_directed: 's' },
        horizon: 'short_term',
      },
      instrument: null,
    };
    expect(profile.risk_tag).toBe('conservative');
    expect(tier.tier_number).toBe(1);
    expect(signal.metadata.explanations?.beginner).toBe('b');
  });
});

import { describe, it, expect } from 'vitest';
import {
  computeRiskTag,
  TIER_DEFAULTS,
} from './types';

describe('computeRiskTag', () => {
  it('returns conservative for score <= 4', () => {
    expect(computeRiskTag(4)).toBe('conservative');
  });
  it('returns moderate for score 5-7', () => {
    expect(computeRiskTag(6)).toBe('moderate');
  });
  it('returns aggressive for score >= 8', () => {
    expect(computeRiskTag(8)).toBe('aggressive');
  });
});

describe('TIER_DEFAULTS', () => {
  it('defines 3 tiers with correct names', () => {
    expect(TIER_DEFAULTS).toHaveLength(3);
    expect(TIER_DEFAULTS[0].name).toBe('Safety Net');
    expect(TIER_DEFAULTS[1].name).toBe('Core Portfolio');
    expect(TIER_DEFAULTS[2].name).toBe('Experimental');
  });
});

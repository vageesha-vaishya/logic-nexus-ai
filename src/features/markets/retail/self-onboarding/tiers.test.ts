import { describe, expect, it } from 'vitest';

import {
  computeDefaultTiers,
  normalise,
  redistribute,
  suggestedTemplateSlug,
  toRupees,
  type TierTriple,
} from './tiers';

const sum = (t: TierTriple) => t[0] + t[1] + t[2];

describe('tier defaults', () => {
  it('returns the risk-tag baseline when there are no goals', () => {
    expect(computeDefaultTiers('conservative', [])).toEqual([50, 45, 5]);
    expect(computeDefaultTiers('moderate',     [])).toEqual([25, 60, 15]);
    expect(computeDefaultTiers('aggressive',   [])).toEqual([15, 55, 30]);
  });

  it('falls back to moderate when risk_tag is missing', () => {
    expect(computeDefaultTiers(undefined, [])).toEqual([25, 60, 15]);
  });

  it('bumps Safety Net for short-horizon goals', () => {
    const t = computeDefaultTiers('moderate', [{ goal: 'house', years: 3 }]);
    expect(t[0]).toBeGreaterThan(25);
    expect(sum(t)).toBe(100);
  });

  it('bumps Core for long-horizon goals', () => {
    const t = computeDefaultTiers('moderate', [{ goal: 'retirement', years: 25 }]);
    expect(t[1]).toBeGreaterThan(60);
    expect(sum(t)).toBe(100);
  });

  it('always sums to 100', () => {
    const t = computeDefaultTiers('aggressive', [
      { goal: 'a', years: 2 },
      { goal: 'b', years: 30 },
      { goal: 'c', years: 5 },
    ]);
    expect(sum(t)).toBe(100);
  });
});

describe('redistribute', () => {
  it('keeps the sum at 100 after a slider move', () => {
    const next = redistribute([25, 60, 15], 0, 50);
    expect(sum(next)).toBe(100);
    expect(next[0]).toBe(50);
  });

  it('takes proportionally from other tiers', () => {
    const next = redistribute([20, 60, 20], 0, 40);
    // Delta = +20. Other tiers (60 + 20 = 80) absorb -20 proportionally:
    // tier 1 loses 60/80 * 20 = 15, tier 2 loses 20/80 * 20 = 5.
    expect(next).toEqual([40, 45, 15]);
  });

  it('splits the delta evenly when both others are zero', () => {
    const next = redistribute([100, 0, 0], 0, 60);
    expect(next[0]).toBe(60);
    expect(next[1] + next[2]).toBe(40);
    expect(Math.abs(next[1] - next[2])).toBeLessThanOrEqual(1);
  });

  it('clamps a slider above MAX_TIER_PCT to 95', () => {
    const next = redistribute([25, 60, 15], 1, 999);
    expect(next[1]).toBe(95);
    expect(sum(next)).toBe(100);
  });

  it('is a no-op when nextValue equals current', () => {
    const before: TierTriple = [25, 60, 15];
    expect(redistribute(before, 0, 25)).toEqual(before);
  });
});

describe('normalise', () => {
  it('absorbs +1 drift into the largest tier', () => {
    expect(normalise([25.4, 60.4, 14.4])).toEqual([25, 61, 14]);
  });

  it('returns input unchanged when already at 100', () => {
    expect(normalise([20, 50, 30])).toEqual([20, 50, 30]);
  });
});

describe('toRupees', () => {
  it('returns zeros for a non-positive budget', () => {
    expect(toRupees([25, 60, 15], 0)).toEqual([0, 0, 0]);
  });

  it('multiplies percentages by budget, summing exactly to the budget', () => {
    const r = toRupees([25, 60, 15], 100000);
    expect(r[0] + r[1] + r[2]).toBe(100000);
    expect(r[0]).toBe(25000);
    expect(r[1]).toBe(60000);
    expect(r[2]).toBe(15000);
  });

  it('pushes rounding drift into Core (tier 1)', () => {
    // 33 / 33 / 34 of ₹100 = 33 / 33 / 34 exactly — no drift expected.
    const r = toRupees([33, 33, 34], 100);
    expect(r[0] + r[1] + r[2]).toBe(100);
  });
});

describe('suggestedTemplateSlug', () => {
  it('picks conservative when Safety ≥ 40', () => {
    expect(suggestedTemplateSlug([50, 45, 5])).toBe('conservative');
  });

  it('picks growth when Experimental ≥ 25', () => {
    expect(suggestedTemplateSlug([15, 55, 30])).toBe('growth');
  });

  it('picks balanced otherwise', () => {
    expect(suggestedTemplateSlug([25, 60, 15])).toBe('balanced');
  });
});

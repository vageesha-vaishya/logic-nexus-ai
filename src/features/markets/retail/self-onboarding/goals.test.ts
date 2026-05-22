import { describe, expect, it } from 'vitest';

import type { Goal } from '../types';
import {
  MAX_GOALS,
  addGoal,
  bumpDown,
  bumpUp,
  priorityLabel,
  removeGoal,
  sortByPriority,
  updateTargetAmount,
  updateYears,
} from './goals';

const ids = (gs: readonly Goal[]) => gs.map((g) => g.goal);
const prios = (gs: readonly Goal[]) => gs.map((g) => g.priority);

describe('goals editor helpers', () => {
  describe('addGoal', () => {
    it('appends with the next priority', () => {
      const out = addGoal(addGoal([], 'retirement'), 'home_purchase');
      expect(ids(out)).toEqual(['retirement', 'home_purchase']);
      expect(prios(out)).toEqual([1, 2]);
    });

    it('no-ops when the goal is already present', () => {
      const after = addGoal([{ goal: 'retirement', years: 10, priority: 1 }], 'retirement');
      expect(after).toHaveLength(1);
    });

    it('no-ops once MAX_GOALS is reached', () => {
      let list: Goal[] = [];
      for (let i = 0; i < MAX_GOALS; i++) list = addGoal(list, `g${i}`);
      const overflow = addGoal(list, 'extra');
      expect(overflow).toHaveLength(MAX_GOALS);
      expect(ids(overflow)).not.toContain('extra');
    });
  });

  describe('removeGoal', () => {
    it('removes and renumbers priorities to stay contiguous', () => {
      const list: Goal[] = [
        { goal: 'a', years: 5, priority: 1 },
        { goal: 'b', years: 5, priority: 2 },
        { goal: 'c', years: 5, priority: 3 },
      ];
      const out = removeGoal(list, 'b');
      expect(ids(out)).toEqual(['a', 'c']);
      expect(prios(out)).toEqual([1, 2]);
    });

    it('is a no-op for a goal that does not exist', () => {
      const list: Goal[] = [{ goal: 'a', years: 5, priority: 1 }];
      const out = removeGoal(list, 'b');
      expect(out).toEqual(list);
    });
  });

  describe('bumpUp / bumpDown', () => {
    const seed: Goal[] = [
      { goal: 'a', years: 5, priority: 1 },
      { goal: 'b', years: 5, priority: 2 },
      { goal: 'c', years: 5, priority: 3 },
    ];

    it('bumpUp swaps with predecessor', () => {
      const out = bumpUp(seed, 'b');
      expect(ids(out)).toEqual(['b', 'a', 'c']);
      expect(prios(out)).toEqual([1, 2, 3]);
    });

    it('bumpUp no-ops at the top', () => {
      expect(bumpUp(seed, 'a')).toEqual(seed);
    });

    it('bumpDown swaps with successor', () => {
      const out = bumpDown(seed, 'b');
      expect(ids(out)).toEqual(['a', 'c', 'b']);
      expect(prios(out)).toEqual([1, 2, 3]);
    });

    it('bumpDown no-ops at the bottom', () => {
      expect(bumpDown(seed, 'c')).toEqual(seed);
    });
  });

  describe('updateYears', () => {
    it('clamps below MIN_YEARS', () => {
      const out = updateYears([{ goal: 'a', years: 5, priority: 1 }], 'a', -3);
      expect(out[0].years).toBe(1);
    });

    it('clamps above MAX_YEARS', () => {
      const out = updateYears([{ goal: 'a', years: 5, priority: 1 }], 'a', 999);
      expect(out[0].years).toBe(40);
    });
  });

  describe('updateTargetAmount', () => {
    it('clears the field for undefined or non-positive', () => {
      const list: Goal[] = [{ goal: 'a', years: 5, priority: 1, target_amount: 100 }];
      expect(updateTargetAmount(list, 'a', undefined)[0].target_amount).toBeUndefined();
      expect(updateTargetAmount(list, 'a', 0)[0].target_amount).toBeUndefined();
      expect(updateTargetAmount(list, 'a', -50)[0].target_amount).toBeUndefined();
    });

    it('stores positive amounts', () => {
      const list: Goal[] = [{ goal: 'a', years: 5, priority: 1 }];
      expect(updateTargetAmount(list, 'a', 250000)[0].target_amount).toBe(250000);
    });
  });

  describe('sortByPriority', () => {
    it('orders by ascending priority and leaves missing at the end', () => {
      const out = sortByPriority([
        { goal: 'c', years: 1, priority: 3 },
        { goal: 'a', years: 1 }, // no priority
        { goal: 'b', years: 1, priority: 1 },
      ]);
      expect(ids(out)).toEqual(['b', 'c', 'a']);
    });
  });

  it('priorityLabel maps 1/2/3 to Primary/2nd/3rd', () => {
    expect(priorityLabel(1)).toBe('Primary');
    expect(priorityLabel(2)).toBe('2nd');
    expect(priorityLabel(3)).toBe('3rd');
    expect(priorityLabel(7)).toBe('#7');
  });
});

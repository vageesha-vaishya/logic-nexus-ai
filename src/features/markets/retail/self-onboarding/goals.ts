/**
 * Pure mutation helpers for the goals editor in step 4 of the self-onboarding
 * wizard. Kept separate from the React component so they can be unit-tested
 * without DOM scaffolding.
 *
 * Invariants:
 *   - Priorities are always contiguous 1..N. Adding a goal appends with
 *     priority N+1; removing renumbers the rest down.
 *   - At most MAX_GOALS goals in the list.
 *   - Reordering swaps priorities; the underlying object identity is
 *     preserved so React keys stay stable.
 */
import type { Goal } from '../types';

export const MAX_GOALS    = 3;
export const MIN_YEARS    = 1;
export const MAX_YEARS    = 40;
export const DEFAULT_YEARS = 10;

/** Add a goal by id. No-op if already present or at the cap. */
export function addGoal(list: readonly Goal[], goalId: string): Goal[] {
  if (list.length >= MAX_GOALS)              return [...list];
  if (list.some((g) => g.goal === goalId))   return [...list];
  return [
    ...list,
    {
      goal:     goalId,
      years:    DEFAULT_YEARS,
      priority: list.length + 1,
    },
  ];
}

/** Remove a goal by id and renumber remaining priorities to stay contiguous. */
export function removeGoal(list: readonly Goal[], goalId: string): Goal[] {
  return list
    .filter((g) => g.goal !== goalId)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map((g, i) => ({ ...g, priority: i + 1 }));
}

/** Bump a goal up (toward priority 1) by swapping with its predecessor. */
export function bumpUp(list: readonly Goal[], goalId: string): Goal[] {
  const sorted = [...list].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const idx = sorted.findIndex((g) => g.goal === goalId);
  if (idx <= 0) return [...list];
  const swapped = [...sorted];
  [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
  return swapped.map((g, i) => ({ ...g, priority: i + 1 }));
}

/** Bump a goal down (away from priority 1) by swapping with its successor. */
export function bumpDown(list: readonly Goal[], goalId: string): Goal[] {
  const sorted = [...list].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const idx = sorted.findIndex((g) => g.goal === goalId);
  if (idx < 0 || idx >= sorted.length - 1) return [...list];
  const swapped = [...sorted];
  [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];
  return swapped.map((g, i) => ({ ...g, priority: i + 1 }));
}

export function updateYears(
  list: readonly Goal[],
  goalId: string,
  years: number,
): Goal[] {
  const clamped = Math.min(MAX_YEARS, Math.max(MIN_YEARS, Math.round(years)));
  return list.map((g) => (g.goal === goalId ? { ...g, years: clamped } : g));
}

export function updateTargetAmount(
  list: readonly Goal[],
  goalId: string,
  amount: number | undefined,
): Goal[] {
  return list.map((g) =>
    g.goal === goalId
      ? { ...g, target_amount: amount === undefined || amount <= 0 ? undefined : amount }
      : g,
  );
}

/** Sort goals by priority ascending, leaving missing priorities at the end. */
export function sortByPriority(list: readonly Goal[]): Goal[] {
  return [...list].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Primary',
  2: '2nd',
  3: '3rd',
};

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? `#${priority}`;
}

import { describe, expect, it } from 'vitest';
import { UX_ROUNDS, activeRoundTasks } from './uxRounds';

describe('uxRounds', () => {
  it('has a valid activeRound pointing at a defined round', () => {
    expect(UX_ROUNDS.rounds[UX_ROUNDS.activeRound]).toBeDefined();
  });

  it('every round has at least one task with a non-empty id and label', () => {
    for (const round of Object.values(UX_ROUNDS.rounds)) {
      expect(round.tasks.length).toBeGreaterThan(0);
      for (const task of round.tasks) {
        expect(task.id.length).toBeGreaterThan(0);
        expect(task.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('task ids are unique within a round', () => {
    for (const round of Object.values(UX_ROUNDS.rounds)) {
      const ids = round.tasks.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('activeRoundTasks() returns the active round\'s tasks', () => {
    expect(activeRoundTasks()).toEqual(UX_ROUNDS.rounds[UX_ROUNDS.activeRound].tasks);
  });
});

import { describe, it, expect } from 'vitest';
import { computePhaseProgress } from '../types';

describe('computePhaseProgress', () => {
  it('paper phase needs 10 trades, shows correct count', () => {
    const p = computePhaseProgress({ current_phase: 'paper', paper_trades_done: 3, micro_trades_done: 0, kill_switch_level: 'none' });
    expect(p.required).toBe(10);
    expect(p.done).toBe(3);
    expect(p.canAdvance).toBe(false);
  });

  it('paper with 10 trades can advance', () => {
    const p = computePhaseProgress({ current_phase: 'paper', paper_trades_done: 10, micro_trades_done: 0, kill_switch_level: 'none' });
    expect(p.canAdvance).toBe(true);
  });

  it('micro phase needs 5 trades', () => {
    const p = computePhaseProgress({ current_phase: 'micro', paper_trades_done: 10, micro_trades_done: 2, kill_switch_level: 'none' });
    expect(p.required).toBe(5);
    expect(p.done).toBe(2);
    expect(p.canAdvance).toBe(false);
  });

  it('full phase has no advancement requirement', () => {
    const p = computePhaseProgress({ current_phase: 'full', paper_trades_done: 20, micro_trades_done: 10, kill_switch_level: 'none' });
    expect(p.canAdvance).toBe(false);
    expect(p.required).toBe(0);
  });
});

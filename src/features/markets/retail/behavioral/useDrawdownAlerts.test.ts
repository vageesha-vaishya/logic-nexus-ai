import { describe, it, expect } from 'vitest';
import { computeDrawdownState } from './useDrawdownAlerts';

describe('computeDrawdownState', () => {
  it('returns null tier when drawdown < 5%', () => {
    const state = computeDrawdownState(97_000, 100_000);
    expect(state.drawdownPct).toBeCloseTo(3, 0);
    expect(state.alertTier).toBeNull();
  });

  it('returns yellow tier at 7% drawdown (5-10% range)', () => {
    const state = computeDrawdownState(93_000, 100_000);
    expect(state.alertTier).toBe('yellow');
  });

  it('returns orange tier at 15% drawdown (10-20% range)', () => {
    const state = computeDrawdownState(85_000, 100_000);
    expect(state.alertTier).toBe('orange');
  });

  it('returns red tier at 22% drawdown (>20%)', () => {
    const state = computeDrawdownState(78_000, 100_000);
    expect(state.alertTier).toBe('red');
  });

  it('returns null tier when peakNav is 0 (no history)', () => {
    const state = computeDrawdownState(0, 0);
    expect(state.alertTier).toBeNull();
  });

  it('drawdownPct is 0 when currentNav equals peakNav', () => {
    const state = computeDrawdownState(100_000, 100_000);
    expect(state.drawdownPct).toBe(0);
    expect(state.alertTier).toBeNull();
  });
});

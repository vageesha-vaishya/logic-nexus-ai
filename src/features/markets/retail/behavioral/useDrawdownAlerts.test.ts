import { describe, it, expect } from 'vitest';
import { computeDrawdownState } from './useDrawdownAlerts';

describe('computeDrawdownState', () => {
  it('returns null tier when drawdown is below 5%', () => {
    const state = computeDrawdownState(97_000, 100_000);
    expect(state.drawdownPct).toBeCloseTo(3, 0);
    expect(state.alertTier).toBeNull();
  });

  it('returns yellow tier at 7% drawdown', () => {
    const state = computeDrawdownState(93_000, 100_000);
    expect(state.drawdownPct).toBeCloseTo(7, 0);
    expect(state.alertTier).toBe('yellow');
  });

  it('returns yellow at the exact 5% boundary', () => {
    expect(computeDrawdownState(95_000, 100_000).alertTier).toBe('yellow');
  });

  it('returns orange tier at 15% drawdown', () => {
    const state = computeDrawdownState(85_000, 100_000);
    expect(state.alertTier).toBe('orange');
  });

  it('returns orange at the exact 10% boundary', () => {
    expect(computeDrawdownState(90_000, 100_000).alertTier).toBe('orange');
  });

  it('returns red tier at 22% drawdown', () => {
    const state = computeDrawdownState(78_000, 100_000);
    expect(state.alertTier).toBe('red');
  });

  it('returns red at the exact 20% boundary', () => {
    expect(computeDrawdownState(80_000, 100_000).alertTier).toBe('red');
  });

  it('returns null tier when peakNav is 0 (no series yet)', () => {
    const state = computeDrawdownState(0, 0);
    expect(state.alertTier).toBeNull();
    expect(state.drawdownPct).toBe(0);
  });

  it('does not break on negative current NAV (extreme loss > peak)', () => {
    const state = computeDrawdownState(-500, 1_000);
    expect(state.alertTier).toBe('red');
  });
});

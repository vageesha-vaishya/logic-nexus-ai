import { describe, it, expect } from 'vitest';
import { generateSimulatedRates } from '../simulation-engine';

describe('simulation-engine weight handling', () => {
  it('handles undefined weightKg without NaN pricing', () => {
    const options = generateSimulatedRates({
      mode: 'air',
      origin: 'JFK',
      destination: 'LHR',
      weightKg: undefined
    });
    expect(options.length).toBeGreaterThan(0);
    options.forEach(opt => {
      expect(typeof (opt as any).total_amount).toBe('number');
      expect(isNaN((opt as any).total_amount)).toBe(false);
    });
  });
});

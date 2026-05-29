import { describe, it, expect } from 'vitest';
import { computeComposerCompleteness } from '../completeness';

describe('computeComposerCompleteness', () => {
  it('returns 0 when no fields are filled', () => {
    const score = computeComposerCompleteness({
      quoteData: {},
      legs: [],
      charges: [],
    });

    expect(score).toBe(0);
  });

  it('returns 100 when all core fields, legs and charges are present', () => {
    const score = computeComposerCompleteness({
      quoteData: {
        account_id: 'a1',
        contact_id: 'c1',
        trade_direction_id: 't1',
        origin_port_id: 'o1',
        destination_port_id: 'd1',
        incoterm_id: 'i1',
        service_level: 'Standard',
        currencyId: 'USD',
        total_weight: 1000,
        total_volume: 10,
      },
      legs: [{}],
      charges: [{}],
    });

    expect(score).toBe(100);
  });

  it('computes proportional score when some fields are missing', () => {
    const score = computeComposerCompleteness({
      quoteData: {
        account_id: 'a1',
        origin_port_id: 'o1',
        destination_port_id: 'd1',
        currencyId: 'USD',
        total_weight: 1000,
      },
      legs: [{}],
      charges: [],
    });

    expect(score).toBe(50);
  });
});

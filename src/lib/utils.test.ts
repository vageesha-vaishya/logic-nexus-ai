import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, matchText } from './utils';

describe('formatDate', () => {
  it('formats a valid ISO date using the locale date format', () => {
    expect(formatDate('2024-03-15T00:00:00.000Z')).toBe(new Date('2024-03-15T00:00:00.000Z').toLocaleDateString());
  });

  it('returns the default placeholder for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('returns the default placeholder for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns the default placeholder for an unparseable value', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('accepts a custom placeholder', () => {
    expect(formatDate(null, 'N/A')).toBe('N/A');
    expect(formatDate('not-a-date', 'N/A')).toBe('N/A');
  });
});

describe('formatCurrency', () => {
  it('formats a positive amount as USD by default', () => {
    expect(formatCurrency(5000)).toBe('$5,000.00');
  });

  it('formats using a provided currency code', () => {
    expect(formatCurrency(100, 'EUR')).toBe('€100.00');
  });

  it('formats using a currency object with a code field', () => {
    expect(formatCurrency(100, { code: 'GBP' })).toBe('£100.00');
  });

  it('returns the default placeholder for null or non-finite amounts', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
    expect(formatCurrency(Number.NaN)).toBe('-');
  });

  it('accepts a custom placeholder', () => {
    expect(formatCurrency(null, 'USD', { placeholder: 'N/A' })).toBe('N/A');
  });
});

describe('matchText', () => {
  it('matches contains by default', () => {
    expect(matchText('Acme Logistics', 'logis')).toBe(true);
  });

  it('matches equals exactly', () => {
    expect(matchText('Acme', 'acme', 'equals')).toBe(true);
    expect(matchText('Acme Logistics', 'acme', 'equals')).toBe(false);
  });

  it('returns true for an empty query regardless of operator', () => {
    expect(matchText('anything', '', 'equals')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { parseTransitTimeToHours, parseTransitTimeToDays } from '@/lib/transit-time';

describe('transit-time parsing', () => {
  it('parses simple day strings into hours and days', () => {
    expect(parseTransitTimeToHours('25 days')).toBe(25 * 24);
    expect(parseTransitTimeToHours('1 day')).toBe(24);
    expect(parseTransitTimeToDays('25 days')).toBe(25);
    expect(parseTransitTimeToDays('1 day')).toBe(1);
  });

  it('parses hour strings into hours and days', () => {
    expect(parseTransitTimeToHours('48h')).toBe(48);
    expect(parseTransitTimeToHours('48 hours')).toBe(48);
    expect(parseTransitTimeToDays('48h')).toBe(2);
  });

  it('parses mixed day and hour strings', () => {
    expect(parseTransitTimeToHours('1d 12h')).toBe(36);
    expect(parseTransitTimeToDays('1d 12h')).toBe(2);
  });

  it('handles bare numeric values as days by default', () => {
    expect(parseTransitTimeToHours(5)).toBe(5 * 24);
    expect(parseTransitTimeToHours('5')).toBe(5 * 24);
    expect(parseTransitTimeToDays(5)).toBe(5);
  });

  it('returns null for invalid or non-positive values', () => {
    expect(parseTransitTimeToHours(null)).toBeNull();
    expect(parseTransitTimeToHours(undefined)).toBeNull();
    expect(parseTransitTimeToHours('')).toBeNull();
    expect(parseTransitTimeToHours('abc')).toBeNull();
    expect(parseTransitTimeToHours(0)).toBeNull();
  });
});

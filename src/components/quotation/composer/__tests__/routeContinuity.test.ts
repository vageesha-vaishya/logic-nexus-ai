import { describe, it, expect } from 'vitest';
import { hasRouteContinuityGap, normalizeLocationToken } from '../routeContinuity';
import { TransportLeg } from '@/types/quote-breakdown';

describe('routeContinuity', () => {
  it('returns false for equivalent textual endpoints', () => {
    expect(
      hasRouteContinuityGap(
        { destination: 'Port of Singapore' } as any,
        { origin: 'port of singapore' } as any,
      ),
    ).toBe(false);
  });

  it('returns false when placeholders are present', () => {
    expect(
      hasRouteContinuityGap(
        { destination: 'Destination' } as any,
        { origin: 'Origin' } as any,
      ),
    ).toBe(false);

    expect(
      hasRouteContinuityGap(
        { destination: 'Destination Port' } as any,
        { origin: 'Origin Location' } as any,
      ),
    ).toBe(false);
  });

  it('uses location ids for exact continuity checks', () => {
    expect(
      hasRouteContinuityGap(
        { destination: 'X', destination_location_id: 'loc-a' } as any,
        { origin: 'Y', origin_location_id: 'loc-a' } as any,
      ),
    ).toBe(false);

    expect(
      hasRouteContinuityGap(
        { destination: 'X', destination_location_id: 'loc-a' } as any,
        { origin: 'X', origin_location_id: 'loc-b' } as any,
      ),
    ).toBe(true);
  });

  it('supports transshipment continuity across multi-modal legs using shared endpoint id', () => {
    expect(
      hasRouteContinuityGap(
        { mode: 'ocean', destination: 'Jebel Ali', destination_location_id: 'port-jebel-ali' } as any,
        { mode: 'road', origin: 'Jebel Ali Free Zone', origin_location_id: 'port-jebel-ali' } as any,
      ),
    ).toBe(false);
  });

  it('flags only real gaps in a complex multi-leg route sequence', () => {
    const legs: TransportLeg[] = [
      { id: '1', mode: 'ocean', origin: 'Shanghai', destination: 'Singapore', destination_location_id: 'sg' },
      { id: '2', mode: 'road', origin: 'Singapore Inland Hub', destination: 'Singapore Airport', origin_location_id: 'sg', destination_location_id: 'sg-air' },
      { id: '3', mode: 'air', origin: 'Singapore Airport', destination: 'Frankfurt Airport', origin_location_id: 'sg-air', destination_location_id: 'fra-air' },
      { id: '4', mode: 'road', origin: 'Hamburg', destination: 'Berlin', origin_location_id: 'ham' },
    ];

    const gaps = legs.slice(1).map((leg, i) => hasRouteContinuityGap(legs[i], leg));
    expect(gaps).toEqual([false, false, true]);
  });

  it('detects real route gap for mismatched non-placeholder locations', () => {
    expect(
      hasRouteContinuityGap(
        { destination: 'Shanghai Port' } as any,
        { origin: 'Hamburg Port' } as any,
      ),
    ).toBe(true);
  });

  it('normalizes punctuation and spacing consistently', () => {
    expect(normalizeLocationToken('  Port-of  Singapore,  ')).toBe('portof singapore');
  });

  it('handles unicode arrows and dashes', () => {
    expect(normalizeLocationToken('Singapore →  Singapore—Airport')).toBe('singapore singaporeairport');
  });

  it('treats common placeholders as non-gap', () => {
    expect(
      hasRouteContinuityGap(
        { destination: 'N/A' } as any,
        { origin: 'Origin' } as any,
      ),
    ).toBe(false);
    expect(
      hasRouteContinuityGap(
        { destination: 'To be confirmed' } as any,
        { origin: 'Destination' } as any,
      ),
    ).toBe(false);
    expect(
      hasRouteContinuityGap(
        { destination: 'TBA' } as any,
        { origin: 'TBD' } as any,
      ),
    ).toBe(false);
  });
});

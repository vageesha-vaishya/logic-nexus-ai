import { describe, it, expect } from 'vitest';
import { mapLegsForVisualizer, normalizePoint } from '../quote-legs';

describe('normalizePoint', () => {
  it('trims whitespace', () => {
    expect(normalizePoint('  CNSHA  ')).toBe('CNSHA');
  });

  it('returns empty string for the literal placeholders "origin" and "destination"', () => {
    expect(normalizePoint('origin')).toBe('');
    expect(normalizePoint('Destination')).toBe('');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(normalizePoint(null)).toBe('');
    expect(normalizePoint(undefined)).toBe('');
    expect(normalizePoint('')).toBe('');
  });
});

describe('mapLegsForVisualizer', () => {
  it('returns an empty array when legs is undefined', () => {
    expect(mapLegsForVisualizer(undefined)).toEqual([]);
  });

  it('fills the first leg origin and last leg destination from the route when missing', () => {
    const legs = [
      { id: 'l1', mode: 'ocean', origin: '', destination: 'KRPUS' } as any,
      { id: 'l2', mode: 'ocean', origin: 'KRPUS', destination: '' } as any,
    ];
    const result = mapLegsForVisualizer(legs, { origin: 'CNSHA', destination: 'USLAX' });
    expect(result[0].from).toBe('CNSHA');
    expect(result[0].to).toBe('KRPUS');
    expect(result[1].from).toBe('KRPUS');
    expect(result[1].to).toBe('USLAX');
  });

  it('fills continuity between legs when an inner leg is missing an endpoint', () => {
    const legs = [
      { id: 'l1', mode: 'ocean', origin: 'CNSHA', destination: 'KRPUS' } as any,
      { id: 'l2', mode: 'ocean', origin: '', destination: 'USLAX' } as any,
    ];
    const result = mapLegsForVisualizer(legs);
    expect(result[1].from).toBe('KRPUS');
  });

  it('defaults carrier to "Unknown Carrier" when missing', () => {
    const legs = [{ id: 'l1', mode: 'ocean', origin: 'CNSHA', destination: 'USLAX' } as any];
    const result = mapLegsForVisualizer(legs);
    expect(result[0].carrier).toBe('Unknown Carrier');
  });

  it('falls back to "Origin"/"Destination" when nothing resolves an endpoint', () => {
    const legs = [{ id: 'l1', mode: 'ocean', origin: '', destination: '' } as any];
    const result = mapLegsForVisualizer(legs);
    expect(result[0].from).toBe('Origin');
    expect(result[0].to).toBe('Destination');
  });
});

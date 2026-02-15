import { describe, it, expect } from 'vitest';
import { quickQuoteSchema } from '../QuickQuoteModalContent';

describe('QuickQuote Zod Schema', () => {
  const base = {
    mode: 'ocean',
    origin: 'USLAX',
    destination: 'CNSHA',
    commodity: 'General Cargo',
    unit: 'kg',
  };

  it('rejects air mode when weight is missing or invalid', () => {
    const payload = { ...base, mode: 'air', weight: '' };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });

  it('accepts air mode with positive weight', () => {
    const payload = { ...base, mode: 'air', weight: '12.5' };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('rejects ocean/rail when container details missing', () => {
    const payload = { ...base, mode: 'ocean', containerQty: '0' };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });

  it('accepts ocean/rail with valid container details', () => {
    const payload = { 
      ...base, 
      mode: 'ocean', 
      containerType: 'FCL', 
      containerSize: '40HC', 
      containerQty: '2' 
    };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('rejects same origin and destination', () => {
    const payload = { ...base, origin: 'USLAX', destination: 'uslax' };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });

  it('rejects invalid unit', () => {
    const payload = { ...base, unit: 'invalid' as any };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });

  it('accepts optional volume and weight as non-negative numbers', () => {
    const payload = { ...base, mode: 'road', weight: '0', volume: '0' };
    const res = quickQuoteSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });
});

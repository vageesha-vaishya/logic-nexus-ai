import { describe, it, expect } from 'vitest';
import { buildSafeContextWithValidation, ValidationBlockError } from '../../supabase/functions/generate-quote-pdf/engine/context';

describe('PDF pre-render validation', () => {
  it('returns warnings instead of blocking for missing charges', () => {
    const rawData = {
      quote: {
        quote_number: 'QUO-VALIDATION-1',
        created_at: '2026-02-16T00:00:00.000Z',
        status: 'draft',
        total_amount: 0,
        currency: 'USD',
      },
      customer: {
        company_name: 'Test Customer',
      },
      legs: [],
      charges: [],
      items: [],
      branding: {
        company_name: 'Test Branding',
      },
    };

    const { warnings, context } = buildSafeContextWithValidation(rawData);
    expect(context.quote.number).toBe('QUO-VALIDATION-1');
    expect(warnings.some(w => /No sell-side charges/i.test(w))).toBe(true);
  });

  it('fills default branding company name when missing', () => {
    const rawData = {
      quote: {
        quote_number: 'QUO-VALIDATION-2',
        created_at: '2026-02-16T00:00:00.000Z',
        status: 'draft',
        total_amount: 100,
        currency: 'USD',
      },
      customer: { company_name: 'Test Customer' },
      legs: [],
      charges: [{ description: 'Charge', amount: 100, currency: 'USD' }],
      items: [],
      branding: {},
    };

    const { warnings, context } = buildSafeContextWithValidation(rawData);
    expect(context.branding.company_name.length).toBeGreaterThan(0);
    expect(warnings.some(w => /Branding company name/i.test(w))).toBe(false);
  });

  it('fills default branding company name when empty string', () => {
    const rawData = {
      quote: {
        quote_number: 'QUO-VALIDATION-4',
        created_at: '2026-02-16T00:00:00.000Z',
        status: 'draft',
        total_amount: 100,
        currency: 'USD',
      },
      customer: { company_name: 'Test Customer' },
      legs: [],
      charges: [{ description: 'Charge', amount: 100, currency: 'USD' }],
      items: [],
      branding: { company_name: '' },
    };

    const { context } = buildSafeContextWithValidation(rawData);
    expect(context.branding.company_name.length).toBeGreaterThan(0);
  });

  it('fills default branding company name when branding is undefined', () => {
    const rawData: any = {
      quote: {
        quote_number: 'QUO-VALIDATION-5',
        created_at: '2026-02-16T00:00:00.000Z',
        status: 'draft',
        total_amount: 100,
        currency: 'USD',
      },
      customer: { company_name: 'Test Customer' },
      legs: [],
      charges: [{ description: 'Charge', amount: 100, currency: 'USD' }],
      items: [],
    };

    const { context } = buildSafeContextWithValidation(rawData);
    expect(context.branding.company_name.length).toBeGreaterThan(0);
  });

  it('throws ValidationBlockError for negative volume', () => {
    const rawData = {
      quote: {
        quote_number: 'QUO-VALIDATION-3',
        created_at: '2026-02-16T00:00:00.000Z',
        status: 'draft',
        total_amount: 100,
        currency: 'USD',
      },
      customer: { company_name: 'Test Customer' },
      legs: [],
      charges: [{ description: 'Charge', amount: 100, currency: 'USD' }],
      items: [{ commodity: 'Widgets', weight: 10, volume: -1 }],
      branding: { company_name: 'Test Branding' },
    };

    expect(() => buildSafeContextWithValidation(rawData)).toThrowError(ValidationBlockError);
  });
});

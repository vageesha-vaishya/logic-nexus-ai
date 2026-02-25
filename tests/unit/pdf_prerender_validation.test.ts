import { describe, it, expect } from 'vitest';
import { buildSafeContext, ValidationBlockError } from '../../supabase/functions/generate-quote-pdf/engine/context';

describe('PDF pre-render validation', () => {
  it('throws ValidationBlockError when charges are missing or zero', () => {
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

    expect(() => buildSafeContext(rawData)).toThrowError(ValidationBlockError);
  });
});


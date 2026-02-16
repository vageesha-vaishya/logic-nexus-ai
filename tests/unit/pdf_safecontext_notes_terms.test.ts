import { describe, it, expect } from 'vitest';
import { buildSafeContext } from '../../supabase/functions/generate-quote-pdf/engine/context';

describe('PDF V2 SafeContext notes and terms mapping', () => {
  it('includes notes and terms_conditions from raw quote data', () => {
    const rawData = {
      quote: {
        quote_number: 'QUO-TEST-001',
        created_at: '2026-02-15T00:00:00.000Z',
        expiration_date: '2026-02-20T00:00:00.000Z',
        status: 'draft',
        total_amount: 1234.56,
        currency: 'USD',
        service_level: 'Standard',
        notes: 'These are sample quote notes for testing.',
        terms_conditions: 'These are sample terms and conditions for testing.'
      },
      customer: {
        company_name: 'Acme Corp',
        contact_name: 'John Doe',
        email: 'john.doe@example.com',
        address: '123 Test Street'
      },
      legs: [],
      charges: [
        {
          description: 'Test charge',
          amount: 100,
          currency: 'USD',
        },
      ],
      items: [],
      branding: {
        company_name: 'Acme Corp'
      }
    };

    const ctx = buildSafeContext(rawData);

    expect(ctx.quote.notes).toBe('These are sample quote notes for testing.');
    expect(ctx.quote.terms_conditions).toBe('These are sample terms and conditions for testing.');
  });
});

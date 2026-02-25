
import { describe, it, expect } from 'vitest';
import { quoteTransferSchema, type QuoteTransferPayload } from './quote-transfer';

describe('Quote Transfer Schema', () => {
  it('should validate a valid payload with AI data', () => {
    const validPayload: QuoteTransferPayload = {
      origin: 'Shanghai, China',
      destination: 'Los Angeles, USA',
      mode: 'ocean',
      selectedRates: [
        {
          id: 'opt_1',
          carrier_name: 'COSCO',
          service_type: 'Standard',
          total_amount: 5000,
          currency: 'USD',
          transitTime: '25 days',
          mode: 'sea',
          ai_generated: true,
          reliability_score: 90,
          total_co2_kg: 500.5,
          legs: [
            {
              origin: 'Shanghai',
              destination: 'Los Angeles',
              mode: 'sea',
            },
          ],
          charges: [
            {
              description: 'Ocean Freight',
              amount: 4500,
              currency: 'USD',
              category: 'Freight',
            },
          ],
        },
      ],
      marketAnalysis: 'Market is volatile due to peak season.',
      confidenceScore: 85,
      anomalies: ['Port congestion in LA'],
    };

    const result = quoteTransferSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should fail if required fields are missing', () => {
    const invalidPayload = {
      origin: '',
      destination: 'Los Angeles',
      mode: 'ocean',
      selectedRates: [],
    } as any;

    const result = quoteTransferSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it('should accept optional AI fields as undefined', () => {
    const basicPayload: QuoteTransferPayload = {
      origin: 'A',
      destination: 'B',
      mode: 'ocean',
      selectedRates: [
        {
          id: 'opt_1',
        },
      ],
    };

    const result = quoteTransferSchema.safeParse(basicPayload);
    expect(result.success).toBe(true);
  });
});

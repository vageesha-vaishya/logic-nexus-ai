
import { describe, it, expect } from 'vitest';
import { quoteTransferSchema, type QuoteTransferPayload } from './quote-transfer';

describe('Quote Transfer Schema', () => {
  it('should validate a valid payload with AI data', () => {
    const validPayload: QuoteTransferPayload = {
      origin: {
        address: 'Shanghai, China',
        coordinates: [121.4737, 31.2304]
      },
      destination: {
        address: 'Los Angeles, USA',
        coordinates: [-118.2437, 34.0522]
      },
      settings: {
        currency: 'USD',
        incoterms: 'FOB'
      },
      items: [
        {
          quantity: 1,
          weight: 1000,
          volume: 2.5,
          dimensions: { length: 100, width: 100, height: 100 }
        }
      ],
      market_analysis: 'Market is volatile due to peak season.',
      confidence_score: 85,
      anomalies: ['Port congestion in LA'],
      options: [
        {
          id: 'opt_1',
          carrier_name: 'COSCO',
          service_type: 'Standard',
          total_amount: 5000,
          currency: 'USD',
          transit_time: '25 days',
          mode: 'sea',
          ai_generated: true,
          reliability_score: 90,
          total_co2_kg: 500.5,
          legs: [
            {
              origin: 'Shanghai',
              destination: 'Los Angeles',
              mode: 'sea',
              charges: [
                {
                  description: 'Ocean Freight',
                  amount: 4500,
                  currency: 'USD',
                  category: 'Freight',
                  type: 'fixed'
                }
              ]
            }
          ]
        }
      ]
    };

    const result = quoteTransferSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should fail if required fields are missing', () => {
    const invalidPayload = {
      origin: 'Shanghai' // Invalid structure
    };

    const result = quoteTransferSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it('should accept optional AI fields as undefined', () => {
    const basicPayload: QuoteTransferPayload = {
      origin: { address: 'A', coordinates: [0, 0] },
      destination: { address: 'B', coordinates: [0, 0] },
      settings: { currency: 'USD' },
      items: [],
      options: []
    };

    const result = quoteTransferSchema.safeParse(basicPayload);
    expect(result.success).toBe(true);
  });
});

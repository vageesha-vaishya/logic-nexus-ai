import { describe, it, expect } from 'vitest';
import { RateOptionSchema, QuoteTransferSchema } from './quote-transfer';

describe('Quote Transfer Schemas', () => {
  describe('RateOptionSchema', () => {
    it('should validate a valid RateOption with standard fields', () => {
      const validRate = {
        id: 'rate-123',
        carrier: 'COSCO',
        name: 'Standard Service',
        price: 1500,
        currency: 'USD',
        transitTime: '25 days',
        tier: 'standard'
      };
      
      const result = RateOptionSchema.safeParse(validRate);
      expect(result.success).toBe(true);
    });

    it('should validate and preserve explicit charges array', () => {
      const rateWithCharges = {
        id: 'rate-123',
        carrier: 'ONE',
        name: 'Express',
        price: 2000,
        currency: 'USD',
        transitTime: '20 days',
        charges: [
          { code: 'FREIGHT', amount: 1500, unit: 'PER_CONTAINER' },
          { code: 'BAF', amount: 300, unit: 'PER_CONTAINER' },
          { code: 'THC', amount: 200, unit: 'PER_CONTAINER' }
        ]
      };
      
      const result = RateOptionSchema.safeParse(rateWithCharges);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.charges).toBeDefined();
        expect(result.data.charges).toHaveLength(3);
      }
    });

    it('should validate and preserve price_breakdown object', () => {
      const rateWithBreakdown = {
        id: 'rate-456',
        carrier: 'Maersk',
        name: 'Eco',
        price: 1800,
        currency: 'EUR',
        transitTime: '30 days',
        price_breakdown: {
          base_fare: 1500,
          surcharges: {
            fuel: 200,
            security: 100
          }
        }
      };
      
      const result = RateOptionSchema.safeParse(rateWithBreakdown);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price_breakdown).toBeDefined();
        expect(result.data.price_breakdown.surcharges.fuel).toBe(200);
      }
    });

    it('should allow passthrough of unknown fields', () => {
      const rateWithExtra = {
        id: 'rate-789',
        carrier: 'MSC',
        price: 1000,
        currency: 'USD',
        customField: 'some-value',
        legacy_data: { foo: 'bar' }
      };
      
      const result = RateOptionSchema.safeParse(rateWithExtra);
      expect(result.success).toBe(true);
      // @ts-ignore
      expect(result.data.customField).toBe('some-value');
    });

    it('should fail if required fields are missing', () => {
      const invalidRate = {
        id: 'rate-bad',
        // missing carrier
        price: 1000,
        currency: 'USD'
      };
      
      const result = RateOptionSchema.safeParse(invalidRate);
      expect(result.success).toBe(false);
    });
  });

  describe('QuoteTransferSchema', () => {
    it('should validate a complete transfer payload', () => {
      const payload = {
        origin: 'USLAX',
        destination: 'CNSHA',
        mode: 'ocean',
        selectedRates: [
          {
            id: 'rate-1',
            carrier: 'COSCO',
            price: 1200,
            currency: 'USD',
            charges: [{ code: 'FREIGHT', amount: 1200 }]
          }
        ],
        accountId: 'acc-123',
        trade_direction: 'export',
        containerType: '40HC',
        dangerousGoods: false
      };
      
      const result = QuoteTransferSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedRates).toHaveLength(1);
        expect(result.data.trade_direction).toBe('export');
      }
    });

    it('should fail if selectedRates is empty', () => {
      const invalidPayload = {
        origin: 'USLAX',
        destination: 'CNSHA',
        mode: 'ocean',
        selectedRates: [] // Empty array
      };
      
      const result = QuoteTransferSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should preserve nested objects in selectedRates', () => {
       const payload = {
        origin: 'USLAX',
        destination: 'CNSHA',
        mode: 'ocean',
        selectedRates: [
          {
            id: 'rate-1',
            carrier: 'COSCO',
            price: 1200,
            currency: 'USD',
            complex_object: { nested: true }
          }
        ]
      };
      
      const result = QuoteTransferSchema.safeParse(payload);
      expect(result.success).toBe(true);
      // @ts-ignore
      expect(result.data.selectedRates[0].complex_object).toEqual({ nested: true });
    });
  });
});

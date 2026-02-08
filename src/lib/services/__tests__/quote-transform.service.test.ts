import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuoteTransformService } from '../quote-transform.service';
import { QuoteTransferData } from '@/lib/schemas/quote-transfer';
import { logger } from '@/lib/logger';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('QuoteTransformService', () => {
  const mockMasterData = {
    serviceTypes: [
      { id: 'st-sea', name: 'Sea Freight', code: 'sea' },
      { id: 'st-air', name: 'Air Freight', code: 'air' }
    ],
    carriers: [
      { id: 'c-maersk', carrier_name: 'Maersk Line', scac: 'MAEU' },
      { id: 'c-cma', carrier_name: 'CMA CGM', scac: 'CMDU' }
    ]
  };

  const validPayload: QuoteTransferData = {
    origin: 'Shanghai',
    destination: 'Los Angeles',
    mode: 'Ocean',
    commodity: 'Electronics',
    weight: '1000',
    volume: '10',
    selectedRates: [{
      id: 'rate-1',
      carrier: 'Maersk',
      price: 5000,
      currency: 'USD',
      validUntil: '2023-12-31'
    }],
    containerCombos: [],
    containerType: '20GP',
    containerSize: '20',
    containerQty: '1'
  };

  describe('validatePayload', () => {
    it('should validate correct payload', () => {
      const result = QuoteTransformService.validatePayload(validPayload);
      expect(result).toEqual(validPayload);
    });

    it('should throw on invalid payload', () => {
      const invalidPayload = { ...validPayload, origin: '' }; // Invalid: min length 2
      expect(() => QuoteTransformService.validatePayload(invalidPayload)).toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('transformToQuoteForm', () => {
    it('should transform payload to form values correctly', () => {
      const result = QuoteTransformService.transformToQuoteForm(validPayload, mockMasterData);
      
      expect(result.title).toContain('Shanghai -> Los Angeles');
      expect(result.commodity).toBe('Electronics');
      expect(result.service_type_id).toBe('st-sea');
      expect(result.carrier_id).toBe('c-maersk');
      expect(result.items).toHaveLength(1);
      expect(result.items?.[0].unit_price).toBe(5000);
      expect(result.notes).toContain('Maersk');
    });

    it('should handle carrier resolution by name', () => {
        const payload = {
            ...validPayload,
            selectedRates: [{
                ...validPayload.selectedRates[0],
                carrier: 'CMA CGM',
                carrier_id: undefined
            }]
        };
        const result = QuoteTransformService.transformToQuoteForm(payload, mockMasterData);
        expect(result.carrier_id).toBe('c-cma');
    });

    it('should calculate unit price correctly', () => {
        const payload = {
            ...validPayload,
            containerQty: '2',
            selectedRates: [{
                ...validPayload.selectedRates[0],
                price: 10000
            }]
        };
        const result = QuoteTransformService.transformToQuoteForm(payload, mockMasterData);
        expect(result.items?.[0].quantity).toBe(2);
        expect(result.items?.[0].unit_price).toBe(5000); // 10000 / 2
    });
  });

  describe('retryOperation', () => {
    it('should return result on success', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        const result = await QuoteTransformService.retryOperation(mockFn);
        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
        const mockFn = vi.fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockResolvedValue('success');
            
        const result = await QuoteTransformService.retryOperation(mockFn, { initialDelay: 10 });
        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw after max retries', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('fail'));
        
        await expect(QuoteTransformService.retryOperation(mockFn, { maxAttempts: 3, initialDelay: 1 }))
            .rejects.toThrow('fail'); // It rethrows the last error or wrapper
        
        expect(mockFn).toHaveBeenCalledTimes(3);
        expect(logger.error).toHaveBeenCalled();
    });
  });
});

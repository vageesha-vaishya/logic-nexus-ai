
import { describe, it, expect } from 'vitest';
import { LogisticsQuotationEngine } from './LogisticsQuotationEngine';
import { RequestContext, LineItem } from '../types';

describe('LogisticsQuotationEngine', () => {
  const engine = new LogisticsQuotationEngine();
  
  const mockContext: RequestContext = {
    tenantId: 'tenant-1',
    domainId: 'domain-logistics',
    currency: 'USD',
    metadata: {
      mode: 'ocean',
      incoterms: 'FOB'
    }
  };

  const mockItems: LineItem[] = [
    {
      description: 'Pallet of Goods',
      quantity: 2,
      attributes: {
        weight: 1500, // 1500 kg per pallet
        volume: 2.5   // 2.5 cbm per pallet
      }
    }
  ];

  it('should calculate Ocean Freight correctly (Weight > Volume)', async () => {
    // 1500kg = 1.5 tons. 1.5 > 2.5? No. 
    // Wait, 1500kg / 1000 = 1.5 tons.
    // Volume = 2.5 cbm.
    // Chargeable = max(1.5, 2.5) = 2.5 w/m per item.
    // Total chargeable = 2.5 * 2 = 5.0 w/m.
    // Rate = 150.
    // Freight = 5.0 * 150 = 750.
    // Surcharges: Fuel (10%) = 75, Doc = 50, Handling = 35.
    // Total = 750 + 75 + 50 + 35 = 910.

    const result = await engine.calculate(mockContext, mockItems);
    
    expect(result.totalAmount).toBe(910.00);
    expect(result.breakdown.freight).toBe(750.00);
    expect(result.breakdown.surcharges['Fuel Surcharge']).toBe(75.00);
    expect(result.breakdown.items[0].chargeableWeight).toBe(5.0);
  });

  it('should calculate Ocean Freight correctly (Volume < Weight)', async () => {
    // Heavy item: 3000kg, 1 cbm
    const heavyItems: LineItem[] = [{
        description: 'Heavy Machine',
        quantity: 1,
        attributes: { weight: 3000, volume: 1 }
    }];
    
    // Chargeable: max(3.0, 1) = 3.0 w/m.
    // Freight: 3.0 * 150 = 450.
    // Fuel: 45. Doc: 50. Handling: 35.
    // Total: 450 + 45 + 50 + 35 = 580.

    const result = await engine.calculate(mockContext, heavyItems);
    expect(result.totalAmount).toBe(580.00);
  });

  it('should calculate Air Freight correctly', async () => {
    const airContext = { ...mockContext, metadata: { mode: 'air' } };
    // 1 CBM = 167 KG.
    // Item: 100kg, 1 cbm.
    // Volumetric: 1 * 167 = 167kg.
    // Chargeable: max(100, 167) = 167kg.
    // Rate: 2.50.
    // Freight: 167 * 2.50 = 417.50.
    // Fuel (10%): 41.75.
    // Security (5%): 20.875 -> 20.88?
    // Doc: 50. Handling: 35.
    // Total: 417.5 + 41.75 + 20.875 + 50 + 35 = 565.125 -> 565.13?
    
    const airItems: LineItem[] = [{
        description: 'Air Cargo',
        quantity: 1,
        attributes: { weight: 100, volume: 1 }
    }];

    const result = await engine.calculate(airContext, airItems);
    
    // Check approximate values due to float arithmetic
    expect(result.breakdown.freight).toBeCloseTo(417.50, 2);
    expect(result.breakdown.surcharges['Security Surcharge']).toBeCloseTo(20.875, 2);
  });

  it('should validate missing items', async () => {
    const result = await engine.validate(mockContext, []);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('NO_ITEMS');
  });

  it('should validate missing dimensions', async () => {
    const invalidItems = [{ description: 'Bad Item', quantity: 1, attributes: {} }];
    const result = await engine.validate(mockContext, invalidItems);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('MISSING_DIMENSIONS');
  });
});

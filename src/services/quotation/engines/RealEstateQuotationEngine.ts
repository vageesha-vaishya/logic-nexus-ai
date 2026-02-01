import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { createDebugLogger } from '@/lib/debug-logger';

export class RealEstateQuotationEngine implements IQuotationEngine {
  private debug;

  constructor() {
    this.debug = createDebugLogger('QuotationEngine', 'RealEstate');
  }

  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    this.debug.info('Calculating quote...');
    let total = 0;
    const breakdown: any[] = [];

    for (const item of items) {
      const { property_type, listing_type, area_sqft } = item.attributes;
      
      // Mock market rates per sqft
      let ratePerSqFt = 0;
      if (listing_type === 'sale') {
        ratePerSqFt = property_type === 'commercial_office' ? 450 : 300;
      } else {
        // Lease (monthly)
        ratePerSqFt = property_type === 'commercial_office' ? 4.50 : 2.50;
      }

      const area = Number(area_sqft) || 0;
      const estimatedValue = area * ratePerSqFt;

      // Commission (e.g., 3% for sale, 1 month rent for lease)
      const commission = listing_type === 'sale' 
        ? estimatedValue * 0.03 
        : estimatedValue; // 1 month rent

      total += commission;
      breakdown.push({
        description: item.description || `${property_type} (${listing_type})`,
        area: area,
        market_value_estimate: estimatedValue,
        commission_fee: commission,
        rate_applied: ratePerSqFt
      });
    }

    return {
      totalAmount: total, // Returning the Commission/Fee amount as the quote total
      currency: context.currency || 'USD',
      breakdown: breakdown,
      metadata: {
        engine: 'RealEstateQuotationEngine',
        timestamp: new Date().toISOString()
      }
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    for (const item of items) {
      if (!item.attributes.area_sqft) errors.push({ code: 'MISSING_AREA', message: 'Area (sqft) required' });
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

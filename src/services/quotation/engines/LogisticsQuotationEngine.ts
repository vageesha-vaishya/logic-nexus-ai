
import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';

export class LogisticsQuotationEngine implements IQuotationEngine {
  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    // Basic implementation for Phase 2 proof-of-concept
    console.log('LogisticsQuotationEngine: Calculating quote for', context.tenantId);

    // Mock calculation logic
    const totalAmount = items.reduce((sum, item) => {
      // Assume a simple mock rate of 10 per unit for now
      return sum + (item.quantity * 10);
    }, 0);

    return {
      totalAmount,
      currency: context.currency || 'USD',
      breakdown: {
        freight: totalAmount * 0.8,
        surcharges: totalAmount * 0.2,
        items: items.map(item => ({
          description: item.description,
          cost: item.quantity * 10
        }))
      },
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Valid for 7 days
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    
    if (!items || items.length === 0) {
      errors.push({
        code: 'NO_ITEMS',
        message: 'At least one line item is required.'
      });
    }

    items.forEach((item, index) => {
      if (item.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          message: `Item at index ${index} must have a positive quantity.`,
          field: `items[${index}].quantity`
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

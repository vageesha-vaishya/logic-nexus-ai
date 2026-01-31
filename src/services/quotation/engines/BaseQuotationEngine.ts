import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';

export class BaseQuotationEngine implements IQuotationEngine {
  constructor(private domainName: string) {}

  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    console.log(`[${this.domainName}] Calculating quote...`);
    return {
      totalAmount: 0,
      currency: context.currency || 'USD',
      breakdown: [],
      metadata: {
        engine: `${this.domainName}Engine`,
        timestamp: new Date().toISOString()
      }
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    return {
      isValid: true,
      errors: []
    };
  }
}

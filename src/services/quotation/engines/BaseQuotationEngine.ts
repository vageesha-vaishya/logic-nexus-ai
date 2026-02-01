import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { createDebugLogger } from '@/lib/debug-logger';

export class BaseQuotationEngine implements IQuotationEngine {
  private debug;

  constructor(private domainName: string) {
    this.debug = createDebugLogger('QuotationEngine', domainName);
  }

  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    this.debug.info(`Calculating quote...`);
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

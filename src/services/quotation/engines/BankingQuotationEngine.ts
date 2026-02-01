
import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { BankingMockService } from '../../banking/BankingMockService';
import { createDebugLogger } from '@/lib/debug-logger';

export class BankingQuotationEngine implements IQuotationEngine {
  private debug;

  constructor() {
    this.debug = createDebugLogger('QuotationEngine', 'Banking');
  }

  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    this.debug.info('Processing for', { tenantId: context.tenantId });

    // In Banking context, a "Quote" is typically a Loan Offer or Fee Calculation
    // We assume LineItems represent loan requests or service fee inquiries
    
    let totalInterest = 0;
    const breakdown: Record<string, any> = { offers: [] };

    for (const item of items) {
      if (item.attributes?.type === 'LOAN_APPLICATION') {
        try {
          const loanOffer = await BankingMockService.applyForLoan(context.tenantId, {
            applicantName: context.userId || 'Anonymous',
            amount: item.quantity, // Using quantity as loan amount for simplicity
            termMonths: item.attributes.termMonths || 12,
            purpose: item.description
          });

          breakdown.offers.push(loanOffer);
          
          if (loanOffer.status === 'APPROVED' && loanOffer.interestRate) {
             // Mock calculation of total interest payable
             totalInterest += (loanOffer.amount * (loanOffer.interestRate / 100));
          }
        } catch (error: unknown) {
          this.debug.error('Error getting loan offer:', error);
          breakdown.offers.push({ error: (error as Error).message });
        }
      }
    }

    return {
      totalAmount: totalInterest, // In this context, the "Quote Amount" is the cost of borrowing
      currency: context.currency || 'USD',
      breakdown,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours validity for rates
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    if (!context.userId) {
       // Banking usually requires strict user identity
       // For mock purposes we might allow it, but let's log a warning or error
       // errors.push({ code: 'AUTH_REQUIRED', message: 'User ID required for banking quotes' });
    }

    return { isValid: errors.length === 0, errors };
  }
}

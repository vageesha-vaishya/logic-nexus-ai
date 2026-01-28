
import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { TelecomMockService } from '../../telecom/TelecomMockService';

export class TelecomQuotationEngine implements IQuotationEngine {
  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    console.log('TelecomQuotationEngine: Calculating for', context.tenantId);

    // In Telecom context, a "Quote" is typically a Bill Estimate or New Plan Costing
    let totalCost = 0;
    const breakdown: Record<string, any> = { plans: [], activationFees: 0 };

    for (const item of items) {
      // Attributes might contain planId or requirements
      const planId = item.attributes?.planId;
      
      if (planId) {
        try {
          const availablePlans = await TelecomMockService.getAvailablePlans(context.tenantId);
          const plan = availablePlans.find(p => p.id === planId);

          if (plan) {
            const cost = plan.price * item.quantity; // Quantity = months or number of lines
            totalCost += cost;
            breakdown.plans.push({
              name: plan.name,
              monthlyCost: plan.price,
              lines: item.quantity,
              subtotal: cost
            });
          } else {
            breakdown.plans.push({ error: `Plan ${planId} not available` });
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    return {
      totalAmount: totalCost,
      currency: context.currency || 'USD',
      breakdown,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    
    // Telecom often requires location data for coverage check (optional for mock)
    // if (!context.metadata?.location) {
    //   errors.push({ code: 'LOCATION_REQUIRED', message: 'Service location required' });
    // }

    return { isValid: errors.length === 0, errors };
  }
}

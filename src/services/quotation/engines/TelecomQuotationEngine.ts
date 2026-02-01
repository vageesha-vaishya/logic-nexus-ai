import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { createDebugLogger } from '@/lib/debug-logger';

export class TelecomQuotationEngine implements IQuotationEngine {
  private debug;

  constructor() {
    this.debug = createDebugLogger('QuotationEngine', 'Telecom');
  }

  private baseRates: Record<string, number> = {
    'fiber': 50, // Base $50/mo
    '5g': 80,    // Base $80/mo
    'satellite': 120,
    'voip': 20
  };

  private bandwidthMultipliers: Record<string, number> = {
    '100mbps': 1,
    '1gbps': 2.5,
    '10gbps': 15
  };

  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    this.debug.info('Calculating quote...');
    let total = 0;
    const breakdown: any[] = [];

    for (const item of items) {
      const { service_type, bandwidth, contract_duration } = item.attributes;
      
      const baseRate = this.baseRates[service_type] || 50;
      const multiplier = this.bandwidthMultipliers[bandwidth] || 1;
      const duration = Number(contract_duration) || 12;

      const monthlyCost = baseRate * multiplier;
      const itemTotal = monthlyCost * duration;

      total += itemTotal;
      breakdown.push({
        description: item.description || `${service_type} ${bandwidth}`,
        monthly_cost: monthlyCost,
        duration_months: duration,
        total: itemTotal
      });
    }

    return {
      totalAmount: total,
      currency: context.currency || 'USD',
      breakdown: breakdown,
      metadata: {
        engine: 'TelecomQuotationEngine',
        timestamp: new Date().toISOString()
      }
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    for (const item of items) {
      if (!item.attributes.service_type) errors.push({ code: 'MISSING_TYPE', message: 'Service type required' });
      if (!item.attributes.contract_duration) errors.push({ code: 'MISSING_DURATION', message: 'Contract duration required' });
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

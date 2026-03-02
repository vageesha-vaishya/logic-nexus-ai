import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { createDebugLogger } from '@/lib/debug-logger';

export class EcommerceQuotationEngine implements IQuotationEngine {
  private debug;

  constructor() {
    this.debug = createDebugLogger('QuotationEngine', 'Ecommerce');
  }

  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    this.debug.info('Calculating quote...');
    let total = 0;
    const breakdownItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const platform = item.attributes.platform as string;
      const sku_count = item.attributes.sku_count;
      const monthly_orders = item.attributes.monthly_orders;
      const fulfillment_model = item.attributes.fulfillment_model;
      
      const skus = Number(sku_count) || 0;
      const orders = Number(monthly_orders) || 0;

      // Pricing Logic
      const platformFee = platform === 'magento' ? 500 : 79; // Monthly platform support fee
      
      // Fulfillment fees
      let fulfillmentFeePerOrder = 0;
      if (fulfillment_model === '3pl') fulfillmentFeePerOrder = 5.50;
      else if (fulfillment_model === 'dropshipping') fulfillmentFeePerOrder = 2.00; // Handling fee only
      
      // Storage fee estimate based on SKUs (mock logic: 10% of SKUs need a bin @ $5/bin)
      const storageFee = (skus * 0.1) * 5;

      const totalMonthlyCost = platformFee + (orders * fulfillmentFeePerOrder) + storageFee;

      total += totalMonthlyCost;
      breakdownItems.push({
        description: item.description || `Store Setup (${platform})`,
        platform_fee: platformFee,
        fulfillment_costs: orders * fulfillmentFeePerOrder,
        storage_costs: storageFee,
        total_monthly: totalMonthlyCost
      });
    }

    return {
      totalAmount: total,
      currency: context.currency || 'USD',
      breakdown: { items: breakdownItems },
      metadata: {
        engine: 'EcommerceQuotationEngine',
        timestamp: new Date().toISOString()
      }
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    for (const item of items) {
      if (!item.attributes.monthly_orders) errors.push({ code: 'MISSING_ORDERS', message: 'Monthly orders required' });
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

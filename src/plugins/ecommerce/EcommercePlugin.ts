import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { EcommerceQuotationEngine } from '../../services/quotation/engines/EcommerceQuotationEngine';

export class EcommercePlugin implements IPlugin {
  readonly id = 'plugin-ecommerce-core';
  readonly name = 'E-commerce Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'ECOMMERCE';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new EcommerceQuotationEngine();
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'store_details',
          title: 'Store Configuration',
          fields: [
            {
              id: 'platform',
              type: 'select',
              label: 'Platform',
              options: [
                { label: 'Shopify', value: 'shopify' },
                { label: 'WooCommerce', value: 'woocommerce' },
                { label: 'Magento', value: 'magento' },
                { label: 'Custom', value: 'custom' }
              ],
              required: true
            },
            {
              id: 'sku_count',
              type: 'number',
              label: 'SKU Count',
              required: true
            },
            {
              id: 'monthly_orders',
              type: 'number',
              label: 'Monthly Orders (Avg)',
              required: true
            }
          ]
        },
        {
          id: 'fulfillment_details',
          title: 'Fulfillment',
          fields: [
            {
              id: 'fulfillment_model',
              type: 'select',
              label: 'Fulfillment Model',
              options: [
                { label: 'Dropshipping', value: 'dropshipping' },
                { label: '3PL', value: '3pl' },
                { label: 'Self-Fulfillment', value: 'self' }
              ],
              required: true
            }
          ]
        }
      ]
    };
  }
}

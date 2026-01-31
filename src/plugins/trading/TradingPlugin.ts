import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { BaseQuotationEngine } from '../../services/quotation/engines/BaseQuotationEngine';

export class TradingPlugin implements IPlugin {
  readonly id = 'plugin-trading-core';
  readonly name = 'Trading & Procurement Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'TRADING';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new BaseQuotationEngine('Trading');
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'trade_details',
          title: 'Trade Details',
          fields: [
            {
              id: 'incoterm',
              type: 'select',
              label: 'Incoterm',
              options: [
                { label: 'FOB', value: 'FOB' },
                { label: 'CIF', value: 'CIF' }
              ],
              required: true
            },
            {
              id: 'supplier',
              type: 'text',
              label: 'Supplier Name',
              required: true
            }
          ]
        }
      ]
    };
  }
}

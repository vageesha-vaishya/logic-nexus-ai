import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { BaseQuotationEngine } from '../../services/quotation/engines/BaseQuotationEngine';

export class BankingPlugin implements IPlugin {
  readonly id = 'plugin-banking-core';
  readonly name = 'Banking & Finance Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'BANKING';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new BaseQuotationEngine('Banking');
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'financial_details',
          title: 'Financial Details',
          fields: [
            {
              id: 'loan_amount',
              type: 'number',
              label: 'Loan Amount',
              required: true
            },
            {
              id: 'interest_rate',
              type: 'number',
              label: 'Interest Rate (%)',
              required: true
            }
          ]
        }
      ]
    };
  }
}

import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { BaseQuotationEngine } from '../../services/quotation/engines/BaseQuotationEngine';

export class InsurancePlugin implements IPlugin {
  readonly id = 'plugin-insurance-core';
  readonly name = 'Insurance Services Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'INSURANCE';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new BaseQuotationEngine('Insurance');
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'risk_details',
          title: 'Risk Assessment',
          fields: [
            {
              id: 'coverage_amount',
              type: 'number',
              label: 'Coverage Amount',
              required: true
            },
            {
              id: 'risk_type',
              type: 'select',
              label: 'Risk Type',
              options: [
                { label: 'Marine Cargo', value: 'marine' },
                { label: 'Liability', value: 'liability' }
              ],
              required: true
            }
          ]
        }
      ]
    };
  }
}

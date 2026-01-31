import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { BaseQuotationEngine } from '../../services/quotation/engines/BaseQuotationEngine';

export class CustomsPlugin implements IPlugin {
  readonly id = 'plugin-customs-core';
  readonly name = 'Customs & Compliance Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'CUSTOMS';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new BaseQuotationEngine('Customs');
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'compliance_details',
          title: 'Compliance Details',
          fields: [
            {
              id: 'hs_code',
              type: 'text',
              label: 'HS Code',
              required: true
            },
            {
              id: 'declaration_type',
              type: 'select',
              label: 'Declaration Type',
              options: [
                { label: 'Import', value: 'import' },
                { label: 'Export', value: 'export' }
              ],
              required: true
            }
          ]
        }
      ]
    };
  }
}

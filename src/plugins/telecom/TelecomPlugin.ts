import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { TelecomQuotationEngine } from '../../services/quotation/engines/TelecomQuotationEngine';

export class TelecomPlugin implements IPlugin {
  readonly id = 'plugin-telecom-core';
  readonly name = 'Telecommunications Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'TELECOM';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new TelecomQuotationEngine();
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'service_details',
          title: 'Service Configuration',
          fields: [
            {
              id: 'service_type',
              type: 'select',
              label: 'Service Type',
              options: [
                { label: 'Fiber Optic', value: 'fiber' },
                { label: '5G Mobile', value: '5g' },
                { label: 'Satellite', value: 'satellite' },
                { label: 'VoIP', value: 'voip' }
              ],
              required: true
            },
            {
              id: 'bandwidth',
              type: 'select',
              label: 'Bandwidth',
              options: [
                { label: '100 Mbps', value: '100mbps' },
                { label: '1 Gbps', value: '1gbps' },
                { label: '10 Gbps', value: '10gbps' }
              ],
              required: true
            },
            {
              id: 'contract_duration',
              type: 'number',
              label: 'Contract Duration (Months)',
              required: true,
              defaultValue: 12
            }
          ]
        }
      ]
    };
  }
}

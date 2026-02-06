import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { LogisticsQuotationEngine } from '../../services/quotation/engines/LogisticsQuotationEngine';
import { LogisticsRateMapper, MasterData } from './services/LogisticsRateMapper';

export class LogisticsPlugin implements IPlugin {
  readonly id = 'plugin-logistics-core';
  readonly name = 'Logistics Core Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'LOGISTICS';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new LogisticsQuotationEngine();
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  createRateMapper(masterData: MasterData): LogisticsRateMapper {
    return new LogisticsRateMapper(masterData);
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'route_details',
          title: 'Route Details',
          fields: [
            {
              id: 'origin_city',
              type: 'location',
              label: 'Origin City',
              required: true
            },
            {
              id: 'destination_city',
              type: 'location',
              label: 'Destination City',
              required: true
            }
          ]
        },
        {
          id: 'service_details',
          title: 'Service Configuration',
          fields: [
            {
              id: 'service_type',
              type: 'select',
              label: 'Mode of Transport',
              options: [
                { label: 'Air Freight', value: 'air' },
                { label: 'Ocean Freight', value: 'ocean' },
                { label: 'Road Freight', value: 'road' },
                { label: 'Rail Freight', value: 'rail' }
              ],
              required: true,
              defaultValue: 'ocean'
            },
            {
              id: 'incoterms',
              type: 'select',
              label: 'Incoterms',
              options: [
                { label: 'EXW - Ex Works', value: 'EXW' },
                { label: 'FOB - Free on Board', value: 'FOB' },
                { label: 'CIF - Cost, Insurance & Freight', value: 'CIF' },
                { label: 'DDP - Delivered Duty Paid', value: 'DDP' }
              ],
              required: true
            }
          ]
        }
      ]
    };
  }
}

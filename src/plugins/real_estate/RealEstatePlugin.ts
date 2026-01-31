import { IPlugin, PluginFormConfig } from '../../services/plugins/IPlugin';
import { IQuotationEngine } from '../../services/quotation/IQuotationEngine';
import { RealEstateQuotationEngine } from '../../services/quotation/engines/RealEstateQuotationEngine';

export class RealEstatePlugin implements IPlugin {
  readonly id = 'plugin-real-estate-core';
  readonly name = 'Real Estate Plugin';
  readonly version = '1.0.0';
  readonly domainCode = 'REAL_ESTATE';

  private engine: IQuotationEngine;

  constructor() {
    this.engine = new RealEstateQuotationEngine();
  }

  getQuotationEngine(): IQuotationEngine {
    return this.engine;
  }

  getFormConfig(): PluginFormConfig {
    return {
      sections: [
        {
          id: 'property_details',
          title: 'Property Details',
          fields: [
            {
              id: 'property_type',
              type: 'select',
              label: 'Property Type',
              options: [
                { label: 'Residential', value: 'residential' },
                { label: 'Commercial Office', value: 'commercial_office' },
                { label: 'Industrial/Warehouse', value: 'industrial' },
                { label: 'Retail', value: 'retail' }
              ],
              required: true
            },
            {
              id: 'listing_type',
              type: 'select',
              label: 'Listing Type',
              options: [
                { label: 'For Sale', value: 'sale' },
                { label: 'For Lease', value: 'lease' }
              ],
              required: true
            },
            {
              id: 'area_sqft',
              type: 'number',
              label: 'Area (sq ft)',
              required: true
            }
          ]
        },
        {
          id: 'location_details',
          title: 'Location',
          fields: [
            {
              id: 'city',
              type: 'text',
              label: 'City',
              required: true
            },
            {
              id: 'zip_code',
              type: 'text',
              label: 'Zip Code',
              required: true
            }
          ]
        }
      ]
    };
  }
}

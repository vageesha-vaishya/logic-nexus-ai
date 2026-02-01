
import { IQuotationEngine } from '../IQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from '../types';
import { createDebugLogger } from '@/lib/debug-logger';

export class LogisticsQuotationEngine implements IQuotationEngine {
  private debug;

  constructor() {
    this.debug = createDebugLogger('QuotationEngine', 'Logistics');
  }

  /**
   * Calculates the quotation based on logistics-specific rules.
   * Logic includes:
   * 1. Chargeable Weight calculation based on Transport Mode (Air/Ocean/Road).
   * 2. Freight calculation using chargeable weight and mock rates.
   * 3. Application of standard surcharges (Fuel, Doc, Handling).
   */
  async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    this.debug.info('Calculating quote for', { tenantId: context.tenantId });

    // 1. Extract Contextual Factors
    const mode = context.metadata?.mode || 'ocean'; // default to ocean
    const incoterms = context.metadata?.incoterms || 'EXW';
    const currency = context.currency || 'USD';

    let totalFreight = 0;
    const itemBreakdowns: any[] = [];

    // 2. Process Line Items
    for (const item of items) {
      const quantity = item.quantity || 0;
      const weight = Number(item.attributes?.weight || 0); // kg
      const volume = Number(item.attributes?.volume || 0); // cbm
      
      // Calculate Chargeable Weight / Revenue Tons
      let chargeableWeight = 0;
      let ratePerUnit = 0;

      switch (mode.toLowerCase()) {
        case 'air':
          // Standard Air conversion: 1 CBM = 167 KG
          const volumetricWeightAir = volume * 167;
          chargeableWeight = Math.max(weight, volumetricWeightAir);
          ratePerUnit = 2.50; // Mock Rate per KG
          break;
        case 'road':
          // Standard Road conversion: 1 CBM = 333 KG
          const volumetricWeightRoad = volume * 333;
          chargeableWeight = Math.max(weight, volumetricWeightRoad);
          ratePerUnit = 0.80; // Mock Rate per KG
          break;
        case 'ocean':
        default:
          // Ocean: 1 CBM = 1 Ton (1000 KG)
          // Revenue Ton (w/m)
          const weightInTons = weight / 1000;
          chargeableWeight = Math.max(weightInTons, volume);
          ratePerUnit = 150.00; // Mock Rate per w/m (CBM/Ton)
          break;
      }

      const lineTotal = chargeableWeight * ratePerUnit * quantity; // quantity usually 1 for shipment-level, but if items are packages...
      
      // If items are packages, we sum them up. 
      // Assuming 'quantity' is number of packages and weight/volume is PER PACKAGE.
      const totalLineWeight = chargeableWeight * quantity;
      const finalLineCost = totalLineWeight * ratePerUnit;

      totalFreight += finalLineCost;

      itemBreakdowns.push({
        description: item.description,
        quantity,
        chargeableWeight: totalLineWeight,
        rate: ratePerUnit,
        total: finalLineCost,
        unit: mode === 'ocean' ? 'w/m' : 'kg'
      });
    }

    // 3. Apply Surcharges
    const surcharges: Record<string, number> = {};
    
    // Fuel Surcharge (e.g., 10% of freight)
    surcharges['Fuel Surcharge'] = totalFreight * 0.10;

    // Documentation Fee (Fixed)
    surcharges['Documentation Fee'] = 50.00;

    // Handling Fee (Fixed)
    surcharges['Handling Fee'] = 35.00;

    // Security Surcharge (Air only)
    if (mode.toLowerCase() === 'air') {
        surcharges['Security Surcharge'] = totalFreight * 0.05;
    }

    const totalSurcharges = Object.values(surcharges).reduce((sum, val) => sum + val, 0);
    const grandTotal = totalFreight + totalSurcharges;

    return {
      quoteId: context.metadata?.quoteId, // Pass through if available
      totalAmount: parseFloat(grandTotal.toFixed(2)),
      currency: currency,
      breakdown: {
        freight: parseFloat(totalFreight.toFixed(2)),
        surcharges: surcharges,
        items: itemBreakdowns,
        metadata: {
            mode,
            incoterms,
            totalChargeableWeight: itemBreakdowns.reduce((acc, i) => acc + i.chargeableWeight, 0)
        }
      },
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Valid for 7 days
    };
  }

  async validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult> {
    const errors = [];
    
    if (!items || items.length === 0) {
      errors.push({
        code: 'NO_ITEMS',
        message: 'At least one line item is required.'
      });
    }

    const mode = context.metadata?.mode;
    if (!mode) {
        // Warning only, default to ocean in calc
    }

    items.forEach((item, index) => {
      if (item.quantity <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          message: `Item at index ${index} must have a positive quantity.`,
          field: `items[${index}].quantity`
        });
      }
      
      // Logistics specific validation
      if ((!item.attributes?.weight || item.attributes.weight <= 0) && (!item.attributes?.volume || item.attributes.volume <= 0)) {
           errors.push({
            code: 'MISSING_DIMENSIONS',
            message: `Item at index ${index} must have weight or volume specified.`,
            field: `items[${index}].attributes`
          });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

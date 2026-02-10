
// Scripts/reproduce_quote_transfer.ts

// Mocks to replace imports
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta),
};

// Interfaces from src/lib/schemas/quote-transfer.ts (simplified)
interface QuoteTransferData {
  mode: string;
  origin: string | any;
  destination: string | any;
  commodity?: string;
  htsCode?: string;
  containerCombos?: Array<{ type: string; size: string; qty: number | string }>;
  containerType?: string;
  containerSize?: string;
  containerQty?: number | string;
  selectedRates: any[];
  selectedRate?: any;
  service_type_id?: string;
  accountId?: string;
  marketAnalysis?: string;
  confidenceScore?: number;
  anomalies?: string[];
  trade_direction?: 'export' | 'import';
  originId?: string;
  destinationId?: string;
  originDetails?: any;
  destinationDetails?: any;
  pickupDate?: string;
  deliveryDeadline?: string;
  vehicleType?: string;
  specialHandling?: string;
  incoterms?: string;
  shipping_amount?: string;
  weight?: string | number;
  volume?: string | number;
  dims?: string;
  dangerousGoods?: boolean;
  aes_hts_id?: string;
}

// Interface from QuoteTransformService
interface MasterData {
  serviceTypes: { id: string; name: string; code: string }[];
  carriers: { id: string; carrier_name: string; scac?: string }[];
  containerTypes?: { id: string; name: string; code: string }[];
    containerSizes?: { id: string; name: string; code?: string }[];
}

// QuoteItem Interface (simplified)
interface QuoteItem {
  type: 'container' | 'loose';
  container_type_id?: string;
  container_size_id?: string;
  quantity: number;
  product_name: string;
  unit_price: number;
  attributes?: any;
  aes_hts_id?: string;
}

// Copy of relevant QuoteTransformService methods (to test logic before modifying file)
class QuoteTransformServiceMock {
  static transformToQuoteForm(data: QuoteTransferData, masterData: MasterData) {
      const rates = data.selectedRates || (data.selectedRate ? [data.selectedRate] : []);
      const primaryRate = rates[0];

      const tradeDirection = data.trade_direction || 'export';
      const serviceTypeId = this.resolveServiceTypeId(data.mode, data.service_type_id, masterData.serviceTypes);
      const carrierId = this.resolveCarrierId(primaryRate, masterData.carriers);
      
      const items = this.generateQuoteItems(data, primaryRate, masterData);

      return {
          title: `Quote for ${data.commodity || 'General Cargo'} (${data.origin?.name || data.origin} -> ${data.destination?.name || data.destination})`,
          commodity: data.commodity,
          total_weight: data.weight?.toString(),
          total_volume: data.volume?.toString(),
          account_id: data.accountId,
          trade_direction: tradeDirection,
          origin_port_id: data.originId || data.originDetails?.id,
          destination_port_id: data.destinationId || data.destinationDetails?.id,
          service_type_id: serviceTypeId,
          carrier_id: carrierId,
          valid_until: primaryRate?.validUntil ? new Date(primaryRate.validUntil).toISOString().split('T')[0] : undefined,
          pickup_date: data.pickupDate,
          delivery_deadline: data.deliveryDeadline,
          vehicle_type: data.vehicleType,
          special_handling: data.specialHandling,
          incoterms: data.incoterms || (tradeDirection === 'export' ? 'CIF' : 'FOB'),
          shipping_amount: primaryRate?.price?.toString(),
          items: items,
          // notes: ... (omitted for brevity)
      };
  }

  private static resolveServiceTypeId(mode: string, explicitId: string | undefined, serviceTypes: MasterData['serviceTypes']): string | undefined {
      if (explicitId) return explicitId;
      const modeMap: Record<string, string> = {
          'ocean': 'Sea', 'sea': 'Sea',
          'air': 'Air', 'road': 'Road', 'truck': 'Road', 'rail': 'Rail'
      };
      const targetMode = modeMap[mode?.toLowerCase()] || mode;
      if (!targetMode || !serviceTypes.length) return undefined;
      return serviceTypes.find(
          st => st.name.toLowerCase().includes(targetMode.toLowerCase()) || 
                st.code.toLowerCase() === targetMode.toLowerCase()
      )?.id;
  }

  private static resolveCarrierId(rate: any | undefined, carriers: MasterData['carriers']): string | undefined {
      if (!rate || !carriers.length) return undefined;
      if (rate.carrier_id) {
          const match = carriers.find(c => c.id === rate.carrier_id);
          if (match) return match.id;
      }
      const searchName = (rate.carrier || rate.carrier_name || '').trim().toLowerCase();
      if (!searchName) return undefined;
      let match = carriers.find(c => c.carrier_name.toLowerCase() === searchName);
      if (!match) match = carriers.find(c => c.scac?.toLowerCase() === searchName);
      if (!match) match = carriers.find(c => c.carrier_name.toLowerCase().includes(searchName) || searchName.includes(c.carrier_name.toLowerCase()));
      return match?.id;
  }

  // THE METHOD UNDER TEST - UPDATED TO MATCH FIX
  private static generateQuoteItems(data: QuoteTransferData, primaryRate: any | undefined, masterData?: MasterData): QuoteItem[] {
      let items: QuoteItem[] = [];
      const normalizedMode = (data.mode || 'ocean').toLowerCase();
      const isContainerized = normalizedMode === 'ocean' || normalizedMode === 'rail';

      // A. Containerized Cargo
      if (isContainerized && (data.containerCombos?.length || (data.containerType && data.containerSize))) {
          const combos = data.containerCombos?.length 
              ? data.containerCombos 
              : [{ type: data.containerType!, size: data.containerSize!, qty: data.containerQty || 1 }];
          
          items = combos.map((c) => {
              // Resolve container type ID and Name
                let resolvedContainerTypeId = c.type;
                let resolvedContainerSizeId = c.size;
                let containerTypeName = '';

                if (masterData?.containerTypes) {
                    // Try to find by ID first
                    let typeMatch = masterData.containerTypes.find(t => t.id === c.type);
                    
                    // If not found, try by code (assuming c.type might be a code)
                    if (!typeMatch) {
                        typeMatch = masterData.containerTypes.find(t => t.code === c.type);
                    }
                    
                    if (typeMatch) {
                        resolvedContainerTypeId = typeMatch.id;
                        containerTypeName = typeMatch.name;
                    }
                }

                if (masterData?.containerSizes) {
                    // Try to find by ID first
                    let sizeMatch = masterData.containerSizes.find(s => s.id === c.size);
                    
                    // If not found, try by name (assuming c.size might be '20', '40' etc.)
                    if (!sizeMatch) {
                        // Strict check for name match (e.g. '20', '40', '40HC')
                        sizeMatch = masterData.containerSizes.find(s => s.name === c.size || s.code === c.size);
                    }
                    
                    if (sizeMatch) {
                        resolvedContainerSizeId = sizeMatch.id;
                    }
                }

                const productName = [
                    containerTypeName,
                    data.commodity || 'General Cargo'
                ].filter(Boolean).join(' - ');

                return {
                    type: 'container',
                    container_type_id: resolvedContainerTypeId,
                    container_size_id: resolvedContainerSizeId,
                    quantity: Number(c.qty) || 1,
                  product_name: productName,
                  unit_price: 0, // Calculated below
                  attributes: {
                      hazmat: data.dangerousGoods ? { is_hazardous: true } : undefined,
                      hs_code: data.htsCode
                  }
              };
          });
      } 
      // B. Loose / Air / LCL Cargo
      else {
          let dimensions = { length: 0, width: 0, height: 0 };
          if (data.dims) {
              const parts = data.dims.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
              if (parts && parts.length >= 4) {
                  dimensions = { length: Number(parts[1]), width: Number(parts[2]), height: Number(parts[3]) };
              }
          }

          items.push({
              type: 'loose',
              product_name: data.commodity || 'General Cargo',
              aes_hts_id: data.aes_hts_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.aes_hts_id || '') ? data.aes_hts_id : undefined,
              quantity: 1,
              unit_price: 0, 
              attributes: {
                  weight: Number(data.weight) || 0,
                  volume: Number(data.volume) || 0,
                  hs_code: data.htsCode,
                  ...dimensions,
                  hazmat: data.dangerousGoods ? { is_hazardous: true } : undefined
              }
          });
      }

      // C. Price Allocation
      const totalPrice = primaryRate?.price || primaryRate?.total_amount || 0;
      const totalQty = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
      
      if (totalQty > 0 && totalPrice > 0) {
          const unitPrice = Number((totalPrice / totalQty).toFixed(2));
          items = items.map(item => ({
              ...item,
              unit_price: unitPrice,
          }));
      }

      return items;
  }
}

// --- TEST SETUP ---

const mockMasterData: MasterData = {
  containerTypes: [{ id: 'uuid-40st-type', name: '40 Standard Dry', code: '40ST' }],
  containerSizes: [{ id: 'uuid-40-size', name: '40', code: '40' }],
  serviceTypes: [{ id: 'st-ocean-import', name: 'Ocean Import', code: 'OI' }],
  carriers: [{ id: 'c-maersk', carrier_name: 'Maersk', scac: 'MAEU' }]
};

const testPayload: QuoteTransferData = {
  mode: 'ocean',
  origin: {
    id: 'USNYC',
    name: 'New York',
    type: 'port',
    country_code: 'US'
  },
  destination: {
    id: 'INTKD',
    name: 'ICD Tughlakabad',
    type: 'port',
    country_code: 'IN'
  },
  incoterms: 'FOB',
  commodity: 'Electric Vehicles',
  htsCode: '8703.80', // Electric vehicles HTS
  containerCombos: [
    { type: '40ST', size: '40', qty: 2 } // Passing CODES, not UUIDs
  ],
  selectedRates: [
    {
      id: 'rate_123',
      carrier_name: 'Maersk',
      total_amount: 5000,
      currency: 'USD',
      validity_start: '2026-02-09',
      validity_end: '2026-03-09',
      legs: [],
      charge_breakdown: [],
      source_attribution: 'AI Smart Engine',
      reliability_score: 95
    }
  ],
  serviceType: 'ocean-import',
  weight: 20000,
  volume: 60,
};

async function runTest() {
  console.log('--- Starting Quote Transfer Reproduction ---');
  
  try {
    const result = QuoteTransformServiceMock.transformToQuoteForm(testPayload, mockMasterData);
    
    console.log('\n--- Transformation Result ---');
    console.log('Service Type ID:', result.service_type_id);
    
    console.log('\n--- Line Items (Quote Items) ---');
    result.items?.forEach((item, index) => {
      console.log(`Item ${index + 1}:`);
      console.log('  Type:', item.type);
      console.log('  Product Name:', item.product_name);
      console.log('  Container Type ID (Raw):', item.container_type_id);
      console.log('  Container Size ID (Raw):', item.container_size_id);
      console.log('  Attributes:', JSON.stringify(item.attributes));
      
      // Validation Checks
      const hasHsCode = !!item.attributes?.hs_code || !!item.aes_hts_id;
      console.log(`  [CHECK] HTS Code present? ${hasHsCode ? 'YES' : 'NO'} (Expected: YES)`);
      
      const isContainerIdUuid = item.container_type_id?.startsWith('uuid-');
      console.log(`  [CHECK] Container Type ID resolved to UUID? ${isContainerIdUuid ? 'YES' : 'NO'} (Expected: YES)`);

      const isContainerSizeIdUuid = item.container_size_id?.startsWith('uuid-');
      console.log(`  [CHECK] Container Size ID resolved to UUID? ${isContainerSizeIdUuid ? 'YES' : 'NO'} (Expected: YES)`);
      
      if (!hasHsCode || !isContainerIdUuid || !isContainerSizeIdUuid) {
          console.error('  [FAIL] Missing required fields or unresolved IDs!');
      } else {
          console.log('  [PASS] Item looks good.');
      }
    });
    
  } catch (error) {
    console.error('Error during transformation:', error);
  }
}

runTest();

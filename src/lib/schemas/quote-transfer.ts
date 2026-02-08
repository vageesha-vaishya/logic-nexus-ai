import { z } from 'zod';

// Define the Rate Option Schema (matches what QuickQuoteModal produces)
export const RateOptionSchema = z.object({
  id: z.string(),
  carrier: z.string().optional(),
  carrier_id: z.string().optional(),
  carrier_name: z.string().optional(),
  name: z.string().optional(),
  price: z.number().optional(),
  total_amount: z.number().optional(),
  currency: z.string().optional(),
  transitTime: z.string().optional(),
  transit_time: z.any().optional(),
  tier: z.string().optional(),
  route_type: z.enum(['Direct', 'Transshipment']).optional(),
  stops: z.number().optional(),
  co2_kg: z.number().optional(),
  total_co2_kg: z.number().optional(),
  legs: z.array(z.any()).optional(), 
  charges: z.array(z.any()).optional(),
  price_breakdown: z.any().optional(),
  source_attribution: z.string().optional(),
  source: z.string().optional(),
  ai_explanation: z.string().optional(),
  reliability: z.any().optional(),
  environmental: z.any().optional(),
  validUntil: z.string().optional().nullable(),
  service_type: z.string().optional(),
  service_type_id: z.string().optional(),
  
  // AI/Market Data
  reliability_score: z.number().optional(),
  ai_generated: z.boolean().optional(),
  
  // Financials
  buyPrice: z.number().optional(),
  marginAmount: z.number().optional(),
  marginPercent: z.number().optional(),
  markupPercent: z.number().optional(),
  
  // Verification
  verified: z.boolean().optional(),
  verificationTimestamp: z.string().optional(),
});

// Define the Transfer Data Schema - STRICT MODE
export const QuoteTransferSchema = z.object({
  // Core Fields
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  mode: z.string().min(1, "Mode is required"),
  
  // IDs (Optional but preferred for strict mapping)
  originId: z.string().optional(),
  destinationId: z.string().optional(),
  service_type_id: z.string().optional(),
  
  // Selected Rates
  selectedRates: z.array(RateOptionSchema).min(1, "At least one rate must be selected"),
  selectedRate: RateOptionSchema.optional(), // Backward compatibility
  
  // AI Context (Global)
  marketAnalysis: z.string().optional().nullable(),
  confidenceScore: z.number().optional().nullable(),
  anomalies: z.array(z.string()).optional().nullable(),
  
  // Context
  accountId: z.string().optional(),
  trade_direction: z.enum(['export', 'import']).optional(),
  
  // Detailed Location Data
  originDetails: z.any().optional(),
  destinationDetails: z.any().optional(),
  
  // Cargo Details
  commodity: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  volume: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  
  // Container Specifics
  containerType: z.string().optional(),
  containerSize: z.string().optional(),
  containerQty: z.union([z.string(), z.number()]).optional(),
  containerCombos: z.array(z.object({
    type: z.string(),
    size: z.string(),
    qty: z.union([z.string(), z.number()])
  })).optional(),
  
  // Compliance
  commodity_description: z.string().optional(),
  htsCode: z.string().optional(),
  aes_hts_id: z.string().optional(),
  scheduleB: z.string().optional(),
  dangerousGoods: z.boolean().optional(),
  
  // Logistics - Explicit Fields
  dims: z.string().optional(),
  specialHandling: z.string().optional(),
  vehicleType: z.string().optional(),
  pickupDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  
  // Commercial
  incoterms: z.string().optional(),
});

export type QuoteTransferData = z.infer<typeof QuoteTransferSchema>;
export type RateOption = z.infer<typeof RateOptionSchema>;

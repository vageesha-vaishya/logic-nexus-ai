import { z } from 'zod';

// Define the Rate Option Schema (matches what QuickQuoteModal produces)
export const RateOptionSchema = z.object({
  id: z.string(),
  carrier: z.string(),
  name: z.string().optional(),
  price: z.number(),
  currency: z.string(),
  transitTime: z.string().optional(),
  tier: z.string().optional(),
  route_type: z.enum(['Direct', 'Transshipment']).optional(),
  stops: z.number().optional(),
  co2_kg: z.number().optional(),
  legs: z.array(z.any()).optional(), // Making this flexible for now as leg structure varies
  charges: z.array(z.any()).optional(),
  price_breakdown: z.any().optional(),
  source_attribution: z.string().optional(),
  ai_explanation: z.string().optional(),
  reliability: z.any().optional(),
  environmental: z.any().optional(),
  validUntil: z.string().optional().nullable(),
  service_type: z.string().optional(),
  
  // AI/Market Data
  reliability_score: z.number().optional(),
  ai_generated: z.boolean().optional(),
}).passthrough(); // Allow extra fields like price_breakdown, transport_mode, etc.

// Define the Transfer Data Schema
export const QuoteTransferSchema = z.object({
  // Core Fields
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  mode: z.string().min(1, "Mode is required"),
  
  // Selected Rates
  selectedRates: z.array(RateOptionSchema).min(1, "At least one rate must be selected"),
  
  // AI Context (Global)
  marketAnalysis: z.string().optional(),
  confidenceScore: z.number().optional(),
  anomalies: z.array(z.string()).optional(),
  
  // Context
  accountId: z.string().optional(),
  trade_direction: z.enum(['export', 'import']).optional(),
  
  // Detailed Location Data
  originDetails: z.any().optional(),
  destinationDetails: z.any().optional(),
  
  // Cargo Details
  containerType: z.string().optional(),
  containerSize: z.string().optional(),
  containerQty: z.union([z.string(), z.number()]).optional(),
  
  // Compliance
  htsCode: z.string().optional(),
  aes_hts_id: z.string().optional(),
  scheduleB: z.string().optional(),
  dangerousGoods: z.boolean().optional(),
  
  // Logistics
  dims: z.string().optional(),
  specialHandling: z.string().optional(),
  vehicleType: z.string().optional(),
  pickupDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
}).passthrough(); // Allow extra context fields

export type QuoteTransferData = z.infer<typeof QuoteTransferSchema>;
export type RateOption = z.infer<typeof RateOptionSchema>;

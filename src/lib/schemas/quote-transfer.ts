import { z } from 'zod';

const RateLegSchema = z.object({
  id: z.string().optional(),
  mode: z.string().optional(),
  transport_mode: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  transit_time: z.union([z.string(), z.number()]).optional(),
});

const RateChargeSchema = z.object({
  code: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  price: z.union([z.number(), z.string()]).optional(),
  total: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  unit: z.string().optional(),
  basis: z.string().optional(),
  note: z.string().optional(),
});

const PriceBreakdownNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.number(),
    z.string(),
    z.object({}).catchall(PriceBreakdownNodeSchema),
  ])
);

const PriceBreakdownSchema = z.record(PriceBreakdownNodeSchema);

const ReliabilitySchema = z
  .object({
    score: z.number().optional(),
    on_time_performance: z.string().optional(),
  })
  .passthrough();

const EnvironmentalSchema = z
  .object({
    co2_emissions: z.string().optional(),
    rating: z.string().optional(),
  })
  .passthrough();

const LocationDetailsSchema = z
  .object({
    id: z.string().optional(),
    code: z.string().optional(),
    name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
  })
  .passthrough();

export const RateOptionSchema = z.object({
  id: z.string(),
  carrier: z.string().optional(),
  carrier_id: z.string().optional(),
  carrier_name: z.string().optional(),
  name: z.string().optional(),
  price: z.number().optional(),
  total_amount: z.number().optional(),
  currency: z.string().optional(),
  mode: z.string().optional(),
  transport_mode: z.string().optional(),
  transitTime: z.string().optional(),
  transit_time: z.union([z.string(), z.number()]).optional(),
  tier: z.string().optional(),
  route_type: z.enum(['Direct', 'Transshipment']).optional(),
  stops: z.number().optional(),
  co2_kg: z.number().optional(),
  total_co2_kg: z.number().optional(),
  legs: z.array(RateLegSchema).optional(),
  charges: z.array(RateChargeSchema).optional(),
  price_breakdown: PriceBreakdownSchema.optional(),
  source_attribution: z.string().optional(),
  source: z.string().optional(),
  ai_explanation: z.string().optional(),
  reliability: ReliabilitySchema.optional(),
  environmental: EnvironmentalSchema.optional(),
  validUntil: z.string().optional().nullable(),
  service_type: z.string().optional(),
  service_type_id: z.string().optional(),
  reliability_score: z.number().optional(),
  ai_generated: z.boolean().optional(),
  buyPrice: z.number().optional(),
  marginAmount: z.number().optional(),
  marginPercent: z.number().optional(),
  markupPercent: z.number().optional(),
  verified: z.boolean().optional(),
  verificationTimestamp: z.string().optional(),
});

export const QuoteTransferSchema = z.object({
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  mode: z.string().min(1, "Mode is required"),
  originId: z.string().optional(),
  destinationId: z.string().optional(),
  service_type_id: z.string().optional(),
  selectedRates: z.array(RateOptionSchema).min(1, "At least one rate must be selected"),
  selectedRate: RateOptionSchema.optional(),
  marketAnalysis: z.string().optional().nullable(),
  confidenceScore: z.number().optional().nullable(),
  anomalies: z.array(z.string()).optional().nullable(),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  trade_direction: z.enum(['export', 'import']).optional(),
  originDetails: LocationDetailsSchema.optional(),
  destinationDetails: LocationDetailsSchema.optional(),
  commodity: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  volume: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  containerType: z.string().optional(),
  containerSize: z.string().optional(),
  containerQty: z.union([z.string(), z.number()]).optional(),
  containerCombos: z.array(z.object({
    type: z.string(),
    size: z.string(),
    qty: z.union([z.string(), z.number()]),
  })).optional(),
  commodity_description: z.string().optional(),
  htsCode: z.string().optional(),
  aes_hts_id: z.string().optional(),
  scheduleB: z.string().optional(),
  dangerousGoods: z.boolean().optional(),
  dims: z.string().optional(),
  specialHandling: z.string().optional(),
  vehicleType: z.string().optional(),
  pickupDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  incoterms: z.string().optional(),
});

export type QuoteTransferData = z.infer<typeof QuoteTransferSchema>;
export type RateOption = z.infer<typeof RateOptionSchema>;

export const quoteTransferSchema = QuoteTransferSchema;
export type QuoteTransferPayload = QuoteTransferData;

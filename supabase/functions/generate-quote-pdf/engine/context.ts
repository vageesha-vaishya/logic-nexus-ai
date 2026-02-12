
import { z } from "zod";

// Define the shape of the raw input data (from DB)
// This is a loose schema to validate what we expect from the caller
export const RawQuoteDataSchema = z.object({
  quote: z.object({
    quote_number: z.string(),
    created_at: z.string(),
    expiration_date: z.string().optional(),
    status: z.string(),
    total_amount: z.number().optional(),
    currency: z.string().default("USD"),
    service_level: z.string().optional(),
  }),
  customer: z.object({
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  legs: z.array(z.object({
    sequence_id: z.number(),
    mode: z.string(),
    pol: z.string(),
    pod: z.string(),
    carrier: z.string().optional(),
    transit_time: z.string().optional(),
  })).optional(),
  charges: z.array(z.object({
    description: z.string(),
    amount: z.number(),
    currency: z.string(),
    type: z.string().optional(),
    basis: z.string().optional(),
    quantity: z.number().optional(),
    leg_id: z.string().optional(),
  })).optional(),
  items: z.array(z.object({
    container_type: z.string().optional(),
    quantity: z.number().optional(),
    commodity: z.string().optional(),
    weight: z.number().optional(),
    volume: z.number().optional(),
  })).optional(),
  branding: z.object({
    logo_url: z.string().optional(),
    logo_base64: z.string().optional(),
    primary_color: z.string().optional(),
    secondary_color: z.string().optional(),
    accent_color: z.string().optional(),
    company_name: z.string().optional(),
    font_family: z.string().optional(),
  }).optional(),
});

export type RawQuoteData = z.infer<typeof RawQuoteDataSchema>;

export interface SafeContext {
  meta: {
    generated_at: string;
    locale: string;
  };
  branding: {
    logo_url?: string;
    logo_base64?: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    company_name: string;
    font_family: string;
  };
  quote: {
    number: string;
    date: string;
    expiry?: string;
    grand_total: number;
    currency: string;
  };
  customer: {
    name: string;
    contact: string;
    full_address: string;
  };
  legs: Array<{
    seq: number;
    mode: string;
    origin: string;
    destination: string;
    carrier_name: string;
  }>;
  items: Array<{
    type: string;
    qty: number;
    commodity: string;
    details: string;
  }>;
  charges: Array<{
    desc: string;
    total: number;
    curr: string;
    unit_price?: number;
    qty?: number;
  }>;
}

/**
 * Safe Context Builder
 * 
 * Transforms raw DB data into a safe, structured context for the template engine.
 * - Removes sensitive internal IDs
 * - Standardizes field names
 * - Handles missing values gracefully
 */
export function buildSafeContext(rawData: unknown, locale: string = "en-US"): SafeContext {
  // 1. Validate Input
  const result = RawQuoteDataSchema.safeParse(rawData);
  
  if (!result.success) {
    console.warn("SafeContextBuilder: Input validation failed", result.error);
    // In production, we might want to throw or return a partial context. 
    // For now, we'll try to proceed with best-effort mapping if possible, 
    // or just return a default structure to prevent crash.
  }

  const data = result.success ? result.data : (rawData as any);

  // 2. Transform & Sanitize
  const safeCtx: SafeContext = {
    meta: {
      generated_at: new Date().toISOString(),
      locale: locale,
    },
    branding: {
      logo_url: data.branding?.logo_url || undefined,
      logo_base64: data.branding?.logo_base64 || undefined,
      primary_color: data.branding?.primary_color || "#0087b5",
      secondary_color: data.branding?.secondary_color || "#dceef2",
      accent_color: data.branding?.accent_color || "#000000",
      company_name: data.branding?.company_name || "Nexus Logistics",
      font_family: data.branding?.font_family || "Helvetica",
    },
    quote: {
      number: data.quote?.quote_number || "DRAFT",
      date: data.quote?.created_at || new Date().toISOString(),
      expiry: data.quote?.expiration_date,
      grand_total: Number(data.quote?.total_amount) || 0,
      currency: data.quote?.currency || "USD",
    },
    customer: {
      name: data.customer?.company_name || "Valued Customer",
      contact: data.customer?.contact_name || "",
      full_address: data.customer?.address || "",
    },
    legs: (data.legs || []).map((l: any) => ({
      seq: l.sequence_id || 0,
      mode: l.mode || "Unknown",
      origin: l.pol || "N/A",
      destination: l.pod || "N/A",
      carrier_name: l.carrier || "TBD",
    })),
    items: (data.items || []).map((i: any) => ({
      type: i.container_type || "Standard",
      qty: i.quantity || 1,
      commodity: i.commodity || "General Cargo",
      details: `${i.weight || 0} kg / ${i.volume || 0} cbm`
    })),
    charges: (data.charges || []).map((c: any) => ({
      desc: c.description || "Service Charge",
      total: Number(c.amount) || 0,
      curr: c.currency || "USD",
      unit_price: Number(c.amount) / (c.quantity || 1), // Simplified logic
      qty: c.quantity || 1,
    })),
  };

  return safeCtx;
}

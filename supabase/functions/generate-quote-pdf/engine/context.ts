
import { z } from "zod";
import { Logger } from "../../_shared/logger.ts";

export const RawQuoteDataSchema = z.object({
  quote: z.object({
    quote_number: z.string(),
    created_at: z.string(),
    expiration_date: z.string().optional(),
    status: z.string(),
    total_amount: z.number().optional(),
    currency: z.string().default("USD"),
    service_level: z.string().optional(),
    notes: z.string().optional(),
    terms_conditions: z.string().optional(),
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
    company_address: z.string().optional(),
    font_family: z.string().optional(),
    header_text: z.string().optional(),
    sub_header_text: z.string().optional(),
    footer_text: z.string().optional(),
    disclaimer_text: z.string().optional(),
  }).optional(),
  options: z.array(z.object({
    id: z.string(),
    grand_total: z.number(),
    legs: z.array(z.object({
      mode: z.string().nullable().optional(),
      transport_mode: z.string().nullable().optional(),
      carrier_name: z.string().nullable().optional(),
      transit_time: z.string().nullable().optional(),
      total_amount: z.number().nullable().optional(),
      provider_id: z.string().nullable().optional(),
    }).passthrough()),
    charges: z.array(z.object({
      amount: z.number(),
      currency: z.string().nullable().optional(),
      charge_name: z.string().nullable().optional(),
      category: z.object({ name: z.string() }).optional(),
      leg_id: z.string().nullable().optional(),
    }).passthrough()),
    carrier: z.string().optional(),
    transit_time: z.string().optional(),
    container_size: z.string().optional(),
    container_type: z.string().optional(),
  })).optional(),
  mode: z.enum(['single', 'consolidated', 'individual']).optional(),
});

export type RawQuoteData = z.infer<typeof RawQuoteDataSchema>;

export class ValidationBlockError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super("PDF pre-render validation failed");
    this.name = "ValidationBlockError";
    this.issues = issues;
  }
}

type PdfValidationResult = {
  blockers: string[];
  warnings: string[];
};

function validateForPdf(raw: any): PdfValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const items = Array.isArray(raw.items) ? raw.items : [];
  const charges = Array.isArray(raw.charges) ? raw.charges : [];

  if (items.length > 0) {
    items.forEach((item: any, index: number) => {
      const commodity = item?.commodity;
      if (!commodity || commodity === "General Cargo") {
        warnings.push(`Item ${index + 1}: commodity missing or too generic`);
      }

      const weight = Number(item?.weight ?? 0);
      const volume = Number(item?.volume ?? 0);

      if (weight < 0) {
        blockers.push(`Item ${index + 1}: weight must be zero or greater`);
      } else if (!(weight > 0)) {
        warnings.push(`Item ${index + 1}: weight is missing or zero`);
      }
      if (volume < 0) {
        blockers.push(`Item ${index + 1}: volume must be zero or greater`);
      }
    });
  }

  if (charges.length === 0) {
    warnings.push("No sell-side charges available for PDF");
  } else {
    const totalAmount = charges.reduce(
      (sum: number, c: any) => sum + Number(c?.amount ?? 0),
      0
    );
    if (!(totalAmount > 0)) {
      warnings.push("Total charge amount is zero");
    }
  }

  return { blockers, warnings };
}

export function mapQuoteItemsToRawItems(items: any[] | null | undefined) {
  if (!items) return [];
  return items.map((i: any) => {
    const weight = Number(
      typeof i.weight_kg !== "undefined" && i.weight_kg !== null
        ? i.weight_kg
        : i.total_weight
    ) || 0;
    const volume = Number(
      typeof i.volume_cbm !== "undefined" && i.volume_cbm !== null
        ? i.volume_cbm
        : i.total_volume
    ) || 0;
    return {
      container_type: i.container_types?.name || i.container_types?.code || "Container",
      quantity: i.quantity,
      commodity: i.master_commodities?.name || i.commodity_description || "General Cargo",
      weight,
      volume,
    };
  });
}

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
    company_address: string;
    font_family: string;
    header_text: string;
    sub_header_text: string;
    footer_text: string;
    disclaimer_text: string;
  };
  quote: {
    number: string;
    date: string;
    expiry?: string;
    grand_total: number;
    currency: string;
    notes?: string;
    terms_conditions?: string;
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
    transport_mode?: string;
    pol?: string;
    pod?: string;
    carrier?: string;
    transit_time?: string;
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
  // Multi-rate support
  options?: Array<{
    id: string;
    legs: Array<{
      seq: number;
      mode: string;
      origin: string;
      destination: string;
      carrier_name: string;
      transport_mode?: string;
      pol?: string;
      pod?: string;
      carrier?: string;
      transit_time?: string;
    }>;
    charges: Array<{
      desc: string;
      total: number;
      curr: string;
      unit_price?: number;
      qty?: number;
  }>;
  grand_total: number;
  carrier?: string;
  transit_time?: string;
  container_size?: string;
  container_type?: string;
}>;
  mode?: 'single' | 'consolidated';
}

function noopLogger(): Logger {
  return {
    info: async () => {},
    warn: async () => {},
    error: async () => {},
    debug: async () => {},
  } as any;
}

export function buildSafeContextWithValidation(
  rawData: unknown,
  logger?: Logger,
  locale: string = "en-US",
): { context: SafeContext; warnings: string[] } {
  const safeLogger = logger || noopLogger();
  // 1. Validate Input
  const result = RawQuoteDataSchema.safeParse(rawData);
  
  if (!result.success) {
    safeLogger.warn("SafeContextBuilder: Input validation failed", { error: result.error });
    // In production, we might want to throw or return a partial context. 
    // For now, we'll try to proceed with best-effort mapping if possible, 
    // or just return a default structure to prevent crash.
  }

  const data = result.success ? result.data : (rawData as any);

  const validation = validateForPdf(data);
  if (validation.blockers.length > 0) {
    throw new ValidationBlockError(validation.blockers);
  }
  if (validation.warnings.length > 0) {
    safeLogger.warn("SafeContextBuilder: PDF pre-render warnings", { warnings: validation.warnings });
  }

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
      company_address: data.branding?.company_address || "123 Logistics Way, Transport City, TC 12345",
      font_family: data.branding?.font_family || "Helvetica",
      header_text: data.branding?.header_text || "",
      sub_header_text: data.branding?.sub_header_text || "",
      footer_text: data.branding?.footer_text || "",
      disclaimer_text: data.branding?.disclaimer_text || "Standard terms and conditions apply.",
    },
    quote: {
      number: data.quote?.quote_number || "DRAFT",
      date: data.quote?.created_at || new Date().toISOString(),
      expiry: data.quote?.expiration_date,
      grand_total: Number(data.quote?.total_amount) || 0,
      currency: data.quote?.currency || "USD",
      notes: data.quote?.notes,
      terms_conditions: data.quote?.terms_conditions,
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
    charges: (data.charges || []).map((c: any) => {
      const amount = Number(c.amount) || 0;
      const quantity = c.quantity || 1;
      const currency = c.currency || "USD";
      const description = c.description || "Service Charge";

      return {
        desc: description,
        description,
        total: amount,
        amount,
        curr: currency,
        currency,
        unit_price: quantity ? amount / quantity : amount,
        qty: quantity,
        quantity,
      };
    }),
    mode: data.mode || 'single',
    options: (data.options || []).map((opt: any) => ({
        id: opt.id,
        grand_total: opt.grand_total || 0,
        carrier: opt.carrier,
        transit_time: opt.transit_time,
        container_size: opt.container_size,
        container_type: opt.container_type,
        legs: (opt.legs || []).map((l: any) => ({
        seq: l.sequence_id || 0,
        mode: l.mode || "Unknown",
        origin: l.pol || "N/A",
        destination: l.pod || "N/A",
        carrier_name: l.carrier || "TBD",
      })),
      charges: (opt.charges || []).map((c: any) => {
        const amount = Number(c.amount) || 0;
        const quantity = c.quantity || 1;
        const currency = c.currency || "USD";
        const description = c.description || "Service Charge";
        return {
          desc: description,
          description,
          total: amount,
          amount,
          curr: currency,
          currency,
          unit_price: quantity ? amount / quantity : amount,
          qty: quantity,
          quantity,
        };
      }),
    })),
  };

  return { context: safeCtx, warnings: validation.warnings };
}

export function buildSafeContext(rawData: unknown, logger?: Logger, locale: string = "en-US"): SafeContext {
  return buildSafeContextWithValidation(rawData, logger, locale).context;
}


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
    origin: z.any().optional(),
    destination: z.any().optional(),
    incoterms: z.string().optional(),
  }),
  customer: z.object({
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    code: z.string().optional(),
    inquiry_number: z.string().optional(),
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
    note: z.string().optional(),
  })).optional(),
  items: z.array(z.object({
    sequence_number: z.number().optional(),
    container_type: z.string().optional(),
    container_size: z.string().optional(),
    quantity: z.number().optional(),
    qty: z.number().optional(),
    commodity: z.string().optional(),
    weight: z.number().optional(),
    volume: z.number().optional(),
    dimensions: z.string().optional(),
    declared_value: z.number().optional(),
    is_hazmat: z.boolean().optional(),
    is_stackable: z.boolean().optional(),
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
      note: z.string().nullable().optional(),
    }).passthrough()),
    carrier: z.string().optional(),
    transit_time: z.string().optional(),
    frequency: z.string().optional(),
    container_size: z.string().optional(),
    container_type: z.string().optional(),
    remarks: z.string().optional(),
  }).passthrough()).optional(),
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
      const containerType = String(item?.container_type || "").trim();
      if (!containerType || /^container$/i.test(containerType)) {
        warnings.push(`Item ${index + 1}: container type is missing`);
      }

      const weight = Number(item?.weight ?? 0);
      const volume = Number(item?.volume ?? 0);

      if (weight < 0) {
        // Log as warning instead of blocking
        warnings.push(`Item ${index + 1}: weight must be zero or greater (found ${weight})`);
      } else if (!(weight > 0)) {
        warnings.push(`Item ${index + 1}: weight is missing or zero`);
      }
      if (volume < 0) {
        // Log as warning instead of blocking
        warnings.push(`Item ${index + 1}: volume must be zero or greater (found ${volume})`);
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

function deriveContainerFromText(...values: Array<unknown>): { size: string; type: string } {
  const haystack = values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) {
    return { size: "", type: "" };
  }

  const compact = haystack.replace(/[^a-z0-9]/g, "");
  const compactMatch = compact.match(/(20|40|45)(gp|hc|hq|rf|reefer|ot|opentop|fr|flatrack|std|standard)/i);
  let inferredSize = "";
  let inferredType = "";

  if (compactMatch) {
    inferredSize = `${compactMatch[1]}FT`;
    inferredType = compactMatch[2].toUpperCase();
  } else {
    const sizeMatch = haystack.match(/\b(20|40|45)\s*(ft|')?\b/i);
    if (sizeMatch) {
      inferredSize = `${sizeMatch[1]}FT`;
    }
    if (/\b(hc|hq|high\s*cube)\b/i.test(haystack)) inferredType = "HC";
    else if (/\b(rf|reefer|refrigerated)\b/i.test(haystack)) inferredType = "RF";
    else if (/\b(ot|open[\s-]*top)\b/i.test(haystack)) inferredType = "OT";
    else if (/\b(fr|flat[\s-]*rack)\b/i.test(haystack)) inferredType = "FR";
    else if (/\b(gp|general\s*purpose|standard|std)\b/i.test(haystack)) inferredType = "GP";
  }

  if (inferredType === "REEFER") inferredType = "Reefer";
  if (inferredType === "OPENTOP") inferredType = "Open Top";
  if (inferredType === "FLATRACK") inferredType = "Flat Rack";
  if (inferredType === "STD" || inferredType === "STANDARD" || inferredType === "GP") inferredType = "Dry Standard";
  if (inferredType === "HC") inferredType = "High Cube";

  return {
    size: inferredSize,
    type: inferredType,
  };
}

export function mapQuoteItemsToRawItems(items: any[] | null | undefined) {
  if (!items) return [];
  return items.map((i: any, index: number) => {
    const toFiniteNumber = (value: unknown, fallback = 0): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const extractCodeOrName = (obj: any): string => {
      if (!obj) return "";
      if (Array.isArray(obj)) {
        return obj.length > 0 ? extractCodeOrName(obj[0]) : "";
      }
      return obj.code || obj.name || "";
    };

    const containerSize =
      extractCodeOrName(i.container_sizes) ||
      extractCodeOrName(i.container_size) ||
      i.sizeId ||
      i.size_id ||
      i.container_size_code ||
      i.container_size_name ||
      (typeof i.container_size === 'string' ? i.container_size : "") ||
      "";

    const containerType =
      extractCodeOrName(i.container_types) ||
      extractCodeOrName(i.container_type) ||
      i.typeId ||
      i.type_id ||
      i.container_type_code ||
      i.container_type_name ||
      (typeof i.container_type === 'string' ? i.container_type : "") ||
      "";

    const inferred = deriveContainerFromText(
      i.product_name,
      i.commodity,
      i.commodity_description,
      i.description,
      i.item_description,
      typeof i.typeId === 'string' ? i.typeId : "",
      typeof i.sizeId === 'string' ? i.sizeId : "",
      typeof i.container_type === 'string' ? i.container_type : "",
      typeof i.container_size === 'string' ? i.container_size : ""
    );

    let normalizedSize = String(containerSize || inferred.size || "").trim();
    let normalizedType = String(containerType || inferred.type || "").trim();

    const typeUpper = normalizedType.toUpperCase().replace(/[\s_-]/g, "");
    if (typeUpper === "GP" || typeUpper === "STANDARD" || typeUpper === "STD" || typeUpper === "DRY" || typeUpper === "DRYSTANDARD") normalizedType = "Dry Standard";
    if (typeUpper === "OT" || typeUpper === "OPENTOP") normalizedType = "Open Top";
    if (typeUpper === "RF" || typeUpper === "REEFER") normalizedType = "Reefer";
    if (typeUpper === "FR" || typeUpper === "FLATRACK") normalizedType = "Flat Rack";
    if (typeUpper === "HC" || typeUpper === "HIGHCUBE") normalizedType = "High Cube";

    const sizeUpper = normalizedSize.toUpperCase().replace(/[\s_-]/g, "");
    if (sizeUpper === "20" || sizeUpper === "20FT") normalizedSize = "20FT";
    if (sizeUpper === "40" || sizeUpper === "40FT") normalizedSize = "40FT";
    if (sizeUpper === "45" || sizeUpper === "45FT") normalizedSize = "45FT";
    if (sizeUpper === "40HC" || sizeUpper === "40HQ") normalizedSize = "40FT";

    const weight = toFiniteNumber(i.gross_weight ?? i.weight_kg ?? i.weight ?? i.total_weight ?? 0, 0);
    const volume = toFiniteNumber(i.volume_cbm ?? i.cbm ?? i.volume ?? i.total_volume ?? 0, 0);
    const rawQty = i.quantity ?? i.qty ?? 1;
    const quantity = toFiniteNumber(rawQty, 0);

    return {
      sequence_number: index + 1,
      container_type: normalizedType || "Container",
      container_size: normalizedSize || "-",
      quantity: quantity,
      commodity: i.commodity || i.master_commodities?.name || i.commodity_description || "General Cargo",
      weight,
      volume,
      dimensions: i.dimensions || "N/A",
      declared_value: i.declared_value,
      is_hazmat: i.is_hazmat,
      is_stackable: i.is_stackable,
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
    quote_number: string;
    date: string;
    created_at: string;
    expiry?: string;
    expiration_date?: string;
    grand_total: number;
    currency: string;
    notes?: string;
    terms_conditions?: string;
    origin?: any;
    destination?: any;
    incoterms?: string;
    service_level?: string;
  };
  customer: {
    name: string;
    company_name: string;
    contact: string;
    contact_name: string;
    email: string;
    phone: string;
    full_address: string;
    address: string;
    code: string;
    inquiry_number: string;
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
    sequence_number: number;
    container_type?: string;
    container_size?: string;
    qty: number;
    quantity?: number;
    commodity: string;
    details: string;
    weight?: number;
    volume?: number;
    dimensions?: string;
    declared_value?: number;
    is_hazmat?: boolean;
    is_stackable?: boolean;
  }>;
  charges: Array<{
    desc: string;
    total: number;
    curr: string;
    unit_price?: number;
    qty?: number;
    note?: string;
  }>;
  // Multi-rate support
  options?: Array<{
    id: string;
    rate_option_id?: string;
    option_group_key?: string;
    option_name?: string;
    rate_option_name?: string;
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
      category?: string;
      leg_id?: string;
      note?: string;
    }>;
  grand_total: number;
  carrier?: string;
  transit_time?: string;
  frequency?: string;
  container_size?: string;
  container_type?: string;
  remarks?: string;
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

function resolveNormalizedAmount(charge: any): number {
  const normalized = Number(charge?.converted_amount);
  if (Number.isFinite(normalized)) return normalized;
  return Number(charge?.amount) || Number(charge?.total) || 0;
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
  const resolvedBrandingCompanyName = String(
    data.branding?.company_name ||
    data.customer?.company_name ||
    "Miami Global Lines",
  ).trim() || "Miami Global Lines";

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
      company_name: resolvedBrandingCompanyName,
      company_address: data.branding?.company_address || "123 Logistics Way, Transport City, TC 12345",
      font_family: data.branding?.font_family || "Helvetica",
      header_text: data.branding?.header_text || "",
      sub_header_text: data.branding?.sub_header_text || "",
      footer_text: data.branding?.footer_text || "",
      disclaimer_text: data.branding?.disclaimer_text || "Standard terms and conditions apply.",
    },
    quote: {
      number: data.quote?.quote_number || "DRAFT",
      quote_number: data.quote?.quote_number || "DRAFT",
      date: data.quote?.created_at || new Date().toISOString(),
      created_at: data.quote?.created_at || new Date().toISOString(),
      expiry: data.quote?.expiration_date,
      expiration_date: data.quote?.expiration_date,
      grand_total: Number(data.quote?.total_amount) || 0,
      currency: data.quote?.currency || "USD",
      notes: data.quote?.notes,
      terms_conditions: data.quote?.terms_conditions,
      origin: data.quote?.origin,
      destination: data.quote?.destination,
      incoterms: data.quote?.incoterms,
      service_level: data.quote?.service_level,
    },
    customer: {
      name: data.customer?.company_name || "Valued Customer",
      company_name: data.customer?.company_name || "Valued Customer",
      contact: data.customer?.contact_name || "",
      contact_name: data.customer?.contact_name || "",
      email: data.customer?.email || "",
      phone: data.customer?.phone || "",
      full_address: data.customer?.address || "",
      address: data.customer?.address || "",
      code: data.customer?.code || "",
      inquiry_number: data.customer?.inquiry_number || "",
    },
    legs: (data.legs || []).map((l: any) => {
      const origin =
        l.pol ||
        l.origin_name ||
        l.origin_code ||
        l.origin?.location_name ||
        l.origin?.name ||
        l.origin_location?.location_name ||
        l.origin_location?.name ||
        l.origin ||
        "N/A";
      const destination =
        l.pod ||
        l.destination_name ||
        l.destination_code ||
        l.destination?.location_name ||
        l.destination?.name ||
        l.destination_location?.location_name ||
        l.destination_location?.name ||
        l.destination ||
        "N/A";
      return {
        id: l.id || l.leg_id || null,
        seq: l.sequence_id || l.sort_order || 0,
        sequence_id: l.sequence_id || l.sort_order || 0,
        mode: l.mode || l.transport_mode || "Unknown",
        transport_mode: l.transport_mode || l.mode,
        origin,
        destination,
        pol: origin,
        pod: destination,
        carrier_name: l.carrier_name || l.carrier || "TBD",
        transit_time: l.transit_time || l.transit_time_hours,
      };
    }),
    items: (data.items || []).map((i: any, index: number) => ({
      type: i.container_type || i.type || [i.container_size, i.container_type].filter(Boolean).join(" ").trim() || "Standard",
      sequence_number: i.sequence_number || index + 1,
      container_type: i.container_type || i.type || [i.container_size, i.container_type].filter(Boolean).join(" ").trim() || "Standard",
      container_size: i.container_size,
      qty: Number.isFinite(Number(i.quantity ?? i.qty ?? 1)) ? Number(i.quantity ?? i.qty ?? 1) : 0,
      quantity: Number.isFinite(Number(i.quantity ?? i.qty ?? 1)) ? Number(i.quantity ?? i.qty ?? 1) : 0,
      commodity: i.commodity || "General Cargo",
      details: `${i.weight || 0} kg / ${i.volume || 0} cbm`,
      weight: i.weight || 0,
      volume: i.volume || 0,
      dimensions: i.dimensions || "N/A",
      declared_value: i.declared_value || 0,
      is_hazmat: !!i.is_hazmat,
      is_stackable: !!i.is_stackable,
    })),
    charges: (data.charges || []).map((c: any) => {
      const amount = resolveNormalizedAmount(c);
      const quantity = Number.isFinite(Number(c.quantity ?? 1)) ? Number(c.quantity ?? 1) : 0;
      const currency = c.target_currency || c.currency || "USD";
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
        note: c.note || "",
        source_currency: c.source_currency || c.currency || currency,
        target_currency: c.target_currency || currency,
        fx_rate: Number(c.fx_rate) || 1,
      };
    }),
    mode: data.mode || 'single',
    options: (data.options || []).map((opt: any) => ({
        id: opt.id,
        rate_option_id: opt.rate_option_id || opt.option_id || opt.id,
        option_group_key: opt.option_group_key || opt.rate_option_id || opt.option_id || opt.id,
        option_name: opt.option_name || opt.rate_option_name || opt.name,
        rate_option_name: opt.rate_option_name || opt.option_name || opt.name,
        grand_total: opt.grand_total || opt.total_amount || 0,
        carrier: opt.carrier || opt.carrier_name || opt.carriers?.carrier_name,
        transit_time: opt.transit_time,
        frequency: opt.frequency,
        container_size: opt.container_size || opt.container_sizes?.name || opt.container_sizes?.code,
        container_type: opt.container_type || opt.container_types?.name || opt.container_types?.code,
        remarks: opt.remarks,
        legs: (opt.legs || []).map((l: any) => {
            const origin =
              l.pol ||
              l.origin_name ||
              l.origin_code ||
              l.origin?.location_name ||
              l.origin?.name ||
              l.origin_location?.location_name ||
              l.origin_location?.name ||
              l.origin ||
              "N/A";
            const destination =
              l.pod ||
              l.destination_name ||
              l.destination_code ||
              l.destination?.location_name ||
              l.destination?.name ||
              l.destination_location?.location_name ||
              l.destination_location?.name ||
              l.destination ||
              "N/A";
            return {
              id: l.id || l.leg_id || null,
              seq: l.sequence_id || l.sort_order || 0,
              sequence_id: l.sequence_id || l.sort_order || 0,
              mode: l.mode || l.transport_mode || "Unknown",
              transport_mode: l.transport_mode || l.mode,
              origin,
              destination,
              pol: origin,
              pod: destination,
              carrier_name: l.carrier_name || l.carrier || opt.carrier_name || "TBD",
              carrier: l.carrier || l.carrier_name || opt.carrier || opt.carrier_name,
              transit_time: l.transit_time || l.transit_time_hours,
            };
          }),
    charges: (opt.charges || []).map((c: any) => {
        const amount = resolveNormalizedAmount(c);
        const quantity = Number.isFinite(Number(c.quantity ?? 1)) ? Number(c.quantity ?? 1) : 0;
        const currency = c.target_currency || c.currency || "USD";
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
          category: c.category?.name || "Other",
          note: c.note || "",
          leg_id: c.leg_id,
          source_currency: c.source_currency || c.currency || currency,
          target_currency: c.target_currency || currency,
          fx_rate: Number(c.fx_rate) || 1,
        };
      }),
    })),
  };

  return { context: safeCtx, warnings: validation.warnings };
}

export function buildSafeContext(rawData: unknown, logger?: Logger, locale: string = "en-US"): SafeContext {
  return buildSafeContextWithValidation(rawData, logger, locale).context;
}

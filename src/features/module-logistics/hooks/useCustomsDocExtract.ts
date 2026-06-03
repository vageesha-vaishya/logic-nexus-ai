// useCustomsDocExtract — frontend wrapper for llm-customs-doc-extract
// (shipped 2026-06-03, commit 7cbbf38e). Multi-modal: image/* or
// application/pdf. Output is a structured 13-field-group extraction
// for Bill of Lading / Commercial Invoice / Certificate of Origin /
// Packing List / etc.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type CustomsDocType =
  | 'bill_of_lading'
  | 'air_waybill'
  | 'commercial_invoice'
  | 'packing_list'
  | 'certificate_of_origin'
  | 'customs_declaration'
  | 'phytosanitary_certificate'
  | 'insurance_certificate'
  | 'other_freight_doc'
  | 'unknown';

export interface ShipmentContext {
  shipment_id?: string | null;
  booking_reference?: string | null;
  origin_country?: string | null;       // ISO-3166-1 alpha-2
  destination_country?: string | null;  // ISO-3166-1 alpha-2
  mode?: 'ocean_fcl' | 'ocean_lcl' | 'air' | 'road' | 'rail' | 'multimodal' | null;
  incoterm_hint?: string | null;
  currency_hint?: string | null;        // ISO-4217
  notes_from_uploader?: string | null;
}

export interface CustomsDocExtractInput {
  shipment_context: ShipmentContext;
  file: File;
}

export interface CustomsParty {
  name: string | null;
  address: string | null;
  country: string | null;
  tax_id?: string | null;
}

export interface CustomsMoney {
  amount: number | null;
  currency: string | null;
}

export interface CustomsLineItem {
  line_no: number | null;
  description: string;
  hs_code: string | null;
  quantity: { value: number; unit: string };
  unit_price: CustomsMoney;
  total_price: CustomsMoney;
  country_of_origin: string | null;
}

export interface CustomsDocExtractOutput {
  doc_type: CustomsDocType;
  doc_number: string | null;
  issuer: { name: string | null; address_country: string | null };
  parties: { shipper: CustomsParty; consignee: CustomsParty; notify_party: CustomsParty };
  route: {
    port_of_loading: string | null;
    port_of_discharge: string | null;
    place_of_receipt: string | null;
    place_of_delivery: string | null;
    vessel_or_flight: string | null;
    departure_date: string | null;
    estimated_arrival_date: string | null;
  };
  incoterm: string | null;
  currency: string | null;
  totals: {
    invoice_value: CustomsMoney;
    freight: CustomsMoney;
    insurance: CustomsMoney;
    total_packages: { value: number | null; unit: string | null };
    gross_weight: { value: number | null; unit: string | null };
    net_weight: { value: number | null; unit: string | null };
    volume: { value: number | null; unit: string | null };
  };
  line_items: CustomsLineItem[];
  matches_shipment_context: {
    booking_ref_match: boolean | null;
    country_pair_match: boolean | null;
    incoterm_match: boolean | null;
    match_rationale: string;
  };
  extracted_text_excerpts: string[];
  warnings: string[];
  confidence: number;
}

export interface CustomsDocExtractResult {
  invocation_id: string;
  output: CustomsDocExtractOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

const MAX_FILE_BYTES = 6 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isOutput(raw: unknown): raw is CustomsDocExtractOutput {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.doc_type === 'string' &&
    typeof r.confidence === 'number' &&
    typeof r.parties === 'object' &&
    typeof r.route === 'object' &&
    typeof r.totals === 'object' &&
    Array.isArray(r.line_items) &&
    Array.isArray(r.warnings)
  );
}

function extractOutput(raw: unknown): CustomsDocExtractOutput | null {
  if (isOutput(raw)) return raw;
  if (raw && typeof raw === 'object' && typeof (raw as { text?: unknown }).text === 'string') {
    try {
      const parsed = JSON.parse((raw as { text: string }).text);
      if (isOutput(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useCustomsDocExtract() {
  return useMutation({
    mutationFn: async (
      input: CustomsDocExtractInput,
    ): Promise<CustomsDocExtractResult & { parsed_output: CustomsDocExtractOutput | null }> => {
      if (input.file.size > MAX_FILE_BYTES) {
        throw new Error(
          `file too large (${(input.file.size / 1024 / 1024).toFixed(1)} MB); max ${
            MAX_FILE_BYTES / 1024 / 1024
          } MB`,
        );
      }
      const mime_type =
        input.file.type ||
        (input.file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      if (!mime_type.startsWith('image/') && mime_type !== 'application/pdf') {
        throw new Error('file must be image/* or application/pdf');
      }
      const content_base64 = await fileToBase64(input.file);
      const { data, error } = await supabase.functions.invoke<CustomsDocExtractResult>(
        'llm-customs-doc-extract',
        {
          body: {
            shipment_context: input.shipment_context,
            attachment: { mime_type, content_base64, label: input.file.name },
          },
        },
      );
      if (error) {
        logger.error({
          event: 'customs_doc_extract.failed',
          shipment_id: input.shipment_context.shipment_id,
          booking_reference: input.shipment_context.booking_reference,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-customs-doc-extract');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI customs doc extract failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

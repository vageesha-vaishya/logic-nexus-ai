// useComplianceDocOcr — frontend wrapper for llm-compliance-doc-ocr
// (shipped 2026-06-03, commit bf492bd3). Multi-modal: accepts image/*
// or application/pdf attachments. Output is a strict 15-field
// structured extraction the operator can validate against the
// in-flight work-order.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type ComplianceDocType =
  | 'form_8130-3'
  | 'easa_form_1'
  | 'caac_aac_038'
  | 'sacaa_card'
  | 'ad_signoff'
  | 'sb_completion'
  | 'ferry_permit'
  | 'other_release_cert'
  | 'unknown';

export type IssuingAuthority = 'FAA' | 'EASA' | 'CAAC' | 'SACAA' | 'OTHER';

export interface DocumentContext {
  work_order_id?: string | null;
  work_order_package_number?: string | null;
  directive_id?: string | null;
  aircraft_registration?: string | null;
  issuing_authority_hint?: IssuingAuthority | null;
  notes_from_uploader?: string | null;
}

export interface ComplianceDocOcrInput {
  document_context: DocumentContext;
  file: File;
}

export interface ComplianceDocOcrOutput {
  doc_type: ComplianceDocType;
  issuing_authority: IssuingAuthority | null;
  issuing_organisation: string | null;
  approval_number: string | null;
  serial_or_lot: { type: 'serial' | 'lot' | 'batch' | 'none'; value: string | null };
  part_number: string | null;
  part_description: string | null;
  quantity: { value: number | null; unit: 'EA' | 'FT' | 'GAL' | 'KG' | 'L' | 'OTHER' | null };
  work_performed_codes: string[];
  authorised_signature: {
    present: boolean;
    signatory_name: string | null;
    signatory_role: string | null;
    signature_date: string | null;
  };
  applicable_to_aircraft: {
    registration_extracted: string | null;
    matches_context: boolean | null;
    match_rationale: string;
  };
  expires_on: string | null;
  extracted_text_excerpts: string[];
  warnings: string[];
  confidence: number;
}

export interface ComplianceDocOcrResult {
  invocation_id: string;
  output: ComplianceDocOcrOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

const MAX_FILE_BYTES = 6 * 1024 * 1024; // ~8 MiB once base64-encoded; matches gateway cap

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

function isOutput(raw: unknown): raw is ComplianceDocOcrOutput {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.doc_type === 'string' &&
    typeof r.confidence === 'number' &&
    typeof r.applicable_to_aircraft === 'object' &&
    typeof r.authorised_signature === 'object' &&
    Array.isArray(r.warnings) &&
    Array.isArray(r.extracted_text_excerpts)
  );
}

function extractOutput(raw: unknown): ComplianceDocOcrOutput | null {
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

export function useComplianceDocOcr() {
  return useMutation({
    mutationFn: async (
      input: ComplianceDocOcrInput,
    ): Promise<ComplianceDocOcrResult & { parsed_output: ComplianceDocOcrOutput | null }> => {
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
      const { data, error } = await supabase.functions.invoke<ComplianceDocOcrResult>(
        'llm-compliance-doc-ocr',
        {
          body: {
            document_context: input.document_context,
            attachment: { mime_type, content_base64, label: input.file.name },
          },
        },
      );
      if (error) {
        logger.error({
          event: 'compliance_doc_ocr.failed',
          work_order_id: input.document_context.work_order_id,
          directive_id: input.document_context.directive_id,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-compliance-doc-ocr');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI doc OCR failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

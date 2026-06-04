// useInvoiceLineClassify — frontend wrapper for the
// llm-invoice-line-classify Edge Function (commit bed2ab56).
// Given draft invoice lines + tenant chart of accounts + tax rules,
// classify each line into a GL account with tax treatment.
//
// Non-modal: structured JSON only.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type GlAccountType =
  | 'revenue' | 'cost_of_sales' | 'expense'
  | 'pass_through_liability' | 'tax_payable' | 'tax_receivable' | 'other';

export type TaxTreatment =
  | 'standard' | 'zero_rated' | 'exempt' | 'reverse_charge' | 'out_of_scope';

export type TaxLabel = 'GST' | 'VAT' | 'Sales Tax' | 'Service Tax' | 'None';

export interface InvoiceLineInput {
  line_id: string;
  charge_code: string;
  description: string;
  amount: number;
  currency: string;
  is_pass_through?: boolean | null;
  vendor_ref?: string | null;
  service_country_origin?: string | null;
  service_country_destination?: string | null;
}

export interface ChartAccountInput {
  code: string;
  name: string;
  type: GlAccountType;
  tags?: string[];
}

export interface TaxRulesInput {
  jurisdiction: string;
  tax_label: TaxLabel;
  default_rate_pct: number | null;
  reverse_charge_applicable_codes: string[];
  zero_rated_charges: string[];
}

export interface InvoiceLineClassifyInput {
  invoice_id?: string | null;
  invoice_lines: InvoiceLineInput[];
  chart_of_accounts: ChartAccountInput[];
  tax_rules: TaxRulesInput;
}

export interface LineClassification {
  line_id: string;
  gl_account_code: string;
  gl_account_name: string;
  gl_account_type: GlAccountType;
  is_pass_through: boolean;
  applies_tax: boolean;
  tax_code: string | null;
  tax_rate_pct: number | null;
  tax_treatment: TaxTreatment;
  rationale: string;
  confidence: number;
}

export interface UnclassifiedLine {
  line_id: string;
  reason: string;
}

export interface InvoiceLineClassifyOutput {
  classifications: LineClassification[];
  unclassified_lines: UnclassifiedLine[];
  warnings: string[];
  confidence: number;
}

export interface InvoiceLineClassifyResult {
  invocation_id: string;
  output: InvoiceLineClassifyOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function isLineClass(c: unknown): c is LineClassification {
  if (!c || typeof c !== 'object') return false;
  const r = c as Record<string, unknown>;
  return (
    typeof r.line_id === 'string' &&
    typeof r.gl_account_code === 'string' &&
    typeof r.gl_account_name === 'string' &&
    typeof r.gl_account_type === 'string' &&
    typeof r.is_pass_through === 'boolean' &&
    typeof r.applies_tax === 'boolean' &&
    typeof r.tax_treatment === 'string' &&
    typeof r.rationale === 'string' &&
    typeof r.confidence === 'number'
  );
}

function extractOutput(raw: unknown): InvoiceLineClassifyOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    Array.isArray(r.classifications) &&
    r.classifications.every(isLineClass) &&
    Array.isArray(r.unclassified_lines) &&
    Array.isArray(r.warnings) &&
    typeof r.confidence === 'number'
  ) {
    return r as unknown as InvoiceLineClassifyOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.classifications && parsed?.unclassified_lines) {
        return parsed as InvoiceLineClassifyOutput;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useInvoiceLineClassify() {
  return useMutation({
    mutationFn: async (
      input: InvoiceLineClassifyInput,
    ): Promise<InvoiceLineClassifyResult & { parsed_output: InvoiceLineClassifyOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<InvoiceLineClassifyResult>(
        'llm-invoice-line-classify',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'invoice_line_classify.failed',
          invoice_id: input.invoice_id,
          line_count: input.invoice_lines.length,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-invoice-line-classify');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI line classification failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

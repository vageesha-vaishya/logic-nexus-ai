// useExtractStockTip — calls llm-extract-stock-tip edge function with
// a screenshot the Sthira user picked. Returns the gateway-rendered
// sthira.tip.screenshot_extract output (tickers + claim + fit verdict).

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type TipSource = 'whatsapp' | 'news_article' | 'broker_app' | 'social_media' | 'chart' | 'other';
export type FitVerdict = 'fits' | 'stretch' | 'off_profile' | 'unreadable';

export interface ExtractStockTipInput {
  experience_level: string;
  risk_tag: string;
  goals_summary?: string;
  screenshot: File;
}

export interface StockTipOutput {
  tickers: string[];
  claim: string;
  tip_source: TipSource;
  fit_verdict: FitVerdict;
  explanation: string;
  suggested_action: string;
  confidence: number;
}

export interface ExtractStockTipResult {
  invocation_id: string;
  output: StockTipOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

const MAX_BYTES = 6 * 1024 * 1024; // ~8 MiB base64 ≈ 6 MiB binary

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

function extractOutput(raw: unknown): StockTipOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    Array.isArray(r.tickers) &&
    typeof r.claim === 'string' &&
    typeof r.tip_source === 'string' &&
    typeof r.fit_verdict === 'string' &&
    typeof r.explanation === 'string' &&
    typeof r.suggested_action === 'string' &&
    typeof r.confidence === 'number'
  ) {
    return r as unknown as StockTipOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.fit_verdict && parsed?.claim) return parsed as StockTipOutput;
    } catch { /* fall through */ }
  }
  return null;
}

export function useExtractStockTip() {
  return useMutation({
    mutationFn: async (
      input: ExtractStockTipInput,
    ): Promise<ExtractStockTipResult & { parsed_output: StockTipOutput | null }> => {
      if (input.screenshot.size > MAX_BYTES) {
        throw new Error(`screenshot too large (${(input.screenshot.size / 1024 / 1024).toFixed(1)} MB); max ${MAX_BYTES / 1024 / 1024} MB`);
      }
      const content_base64 = await fileToBase64(input.screenshot);
      const mime_type = input.screenshot.type || 'image/png';
      const { data, error } = await supabase.functions.invoke<ExtractStockTipResult>(
        'llm-extract-stock-tip',
        {
          body: {
            experience_level: input.experience_level,
            risk_tag: input.risk_tag,
            goals_summary: input.goals_summary,
            screenshot: { mime_type, content_base64, label: input.screenshot.name },
          },
        },
      );
      if (error) {
        logger.error({ event: 'extract_stock_tip.failed', err: String(error) });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-extract-stock-tip');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI couldn't read the screenshot: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

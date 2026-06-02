// useReadDefectPhoto — calls the llm-read-defect-photo edge function
// with a File the user picked. The hook handles base64 encoding so
// callers only have to pass the File + the surrounding task context.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type DefectSeverity = 'advisory' | 'minor' | 'major' | 'critical';

export interface ReadDefectPhotoInput {
  aircraft_id: string;
  task_source: string;
  notes?: string;
  task_draft_id?: string;
  photo: File;
}

export interface DefectPhotoOutput {
  defect_description: string;
  initial_assessment: string;
  ata_chapter: string | null;
  fault_code: string | null;
  severity: DefectSeverity;
  confidence: number;
}

export interface ReadDefectPhotoResult {
  aircraft_id: string;
  invocation_id: string;
  output: DefectPhotoOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

const MAX_PHOTO_BYTES = 6 * 1024 * 1024; // ~8 MiB once base64-encoded

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked to avoid String.fromCharCode arg-count limits on large files.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function extractOutput(raw: unknown): DefectPhotoOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.defect_description === 'string' &&
    typeof r.initial_assessment === 'string' &&
    typeof r.severity === 'string' &&
    typeof r.confidence === 'number'
  ) {
    return {
      defect_description: r.defect_description,
      initial_assessment: r.initial_assessment,
      ata_chapter: typeof r.ata_chapter === 'string' ? r.ata_chapter : null,
      fault_code: typeof r.fault_code === 'string' ? r.fault_code : null,
      severity: r.severity as DefectSeverity,
      confidence: r.confidence as number,
    };
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.defect_description && parsed?.severity) return parsed as DefectPhotoOutput;
    } catch { /* fall through */ }
  }
  return null;
}

export function useReadDefectPhoto() {
  return useMutation({
    mutationFn: async (
      input: ReadDefectPhotoInput,
    ): Promise<ReadDefectPhotoResult & { parsed_output: DefectPhotoOutput | null }> => {
      if (input.photo.size > MAX_PHOTO_BYTES) {
        throw new Error(`photo too large (${(input.photo.size / 1024 / 1024).toFixed(1)} MB); max ${MAX_PHOTO_BYTES / 1024 / 1024} MB`);
      }
      const content_base64 = await fileToBase64(input.photo);
      const mime_type = input.photo.type || 'image/jpeg';
      const { data, error } = await supabase.functions.invoke<ReadDefectPhotoResult>(
        'llm-read-defect-photo',
        {
          body: {
            aircraft_id: input.aircraft_id,
            task_source: input.task_source,
            notes: input.notes,
            task_draft_id: input.task_draft_id,
            photo: { mime_type, content_base64, label: input.photo.name },
          },
        },
      );
      if (error) {
        logger.error({ event: 'read_defect_photo.failed', aircraft_id: input.aircraft_id, err: String(error) });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-read-defect-photo');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI photo read failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

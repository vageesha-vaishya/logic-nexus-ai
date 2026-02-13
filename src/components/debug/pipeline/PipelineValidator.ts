import { z } from 'zod';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';

// Schema for Composer State
const ComposerSchema = z.object({
  quoteId: z.string().optional(),
  versionId: z.string().optional(),
  optionId: z.string().optional(),
  step: z.number().optional(),
  quoteData: z.any().optional(), // Can be refined later
  legs: z.array(z.any()).optional(),
  charges: z.array(z.any()).optional(),
  options: z.array(z.any()).optional(),
});

// Schema for PDF Generation Props
const PDFGenSchema = z.object({
  quoteData: z.any(), // Required for PDF
  legs: z.array(z.any()).optional(),
  combinedCharges: z.array(z.any()).optional(),
  templateId: z.string().optional(),
  landedCost: z.any().optional().nullable(),
});

// Mapping stages to schemas
export const PipelineSchemas: Record<string, z.ZodType<any>> = {
  'QuickQuote': QuoteTransferSchema,
  'QuoteNew': QuoteTransferSchema,
  'DetailedQuote': QuoteTransferSchema, // Reuse for now
  'Composer': ComposerSchema,
  'PDFGen': PDFGenSchema,
};

export function validateStage(stage: string, data: any) {
  const schema = PipelineSchemas[stage];
  
  // If no schema defined, assume valid or return warning
  if (!schema) {
    return { valid: true, errors: [], warning: 'No schema defined for this stage' };
  }
  
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { valid: true, errors: [] };
  }
  
  return { 
    valid: false, 
    errors: result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code
    }))
  };
}

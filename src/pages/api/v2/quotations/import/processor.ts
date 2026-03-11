import { z } from 'zod';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { logApiEvent } from '../../../_utils/http';

const MAX_BATCH_SIZE = 500;

const quoteRowSchema = z.object({
  quote_number: z.preprocess((v) => String(v ?? '').trim(), z.string().min(1)),
  title: z.preprocess((v) => String(v ?? '').trim(), z.string().min(1)),
  status: z.preprocess((v) => String(v ?? 'draft').trim().toLowerCase(), z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'])),
  currency: z.preprocess((v) => String(v ?? 'USD').trim().toUpperCase(), z.string().length(3)),
  buy_price: z.preprocess((v) => Number(v ?? 0), z.number().min(0).max(10_000_000)),
  sell_price: z.preprocess((v) => Number(v ?? 0), z.number().min(0).max(10_000_000)),
  validity_date: z.preprocess((v) => (v ? String(v) : null), z.string().nullable().optional()),
  terms_conditions: z.preprocess((v) => (v ? String(v) : null), z.string().nullable().optional()),
  custom_fields: z.record(z.unknown()).optional(),
  account_id: z.string().optional().nullable(),
  contact_id: z.string().optional().nullable(),
  opportunity_id: z.string().optional().nullable(),
  carrier_id: z.string().optional().nullable(),
  transport_mode: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
}).refine((row) => row.sell_price >= row.buy_price, {
  message: 'sell_price must be >= buy_price',
  path: ['sell_price'],
});

export const importPayloadSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']).default('json'),
  mode: z.enum(['full', 'section']).default('full'),
  duplicateMode: z.enum(['skip', 'update', 'allow']).default('update'),
  async: z.boolean().optional().default(false),
  batchSize: z.number().int().positive().max(MAX_BATCH_SIZE).default(MAX_BATCH_SIZE),
  rows: z.array(z.record(z.unknown())).min(1).max(10000),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;

type ImportSummary = {
  success: number;
  failed: number;
  inserted: number;
  updated: number;
};

type ProcessImportParams = {
  importId: string;
  tenantId: string;
  userId: string;
  payload: ImportPayload;
  correlationId: string;
};

function businessViolation(row: z.infer<typeof quoteRowSchema>): string | null {
  const creditStatus = String(row.custom_fields?.credit_status ?? '').toLowerCase();
  if (creditStatus === 'blocked' || creditStatus === 'hold') return 'customer credit status is blocked';
  const expiredPart = row.custom_fields?.has_expired_part_numbers;
  if (expiredPart === true || String(expiredPart).toLowerCase() === 'true') return 'expired part numbers found';
  return null;
}

async function isCancelled(db: ReturnType<typeof getSupabaseAdminClient>, importId: string): Promise<boolean> {
  const { data } = await db.from('import_history').select('status').eq('id', importId).single();
  return String((data as any)?.status || '') === 'cancelled';
}

export async function processQuotationImportJob(params: ProcessImportParams): Promise<{ summary: ImportSummary; status: string }> {
  const db = getSupabaseAdminClient();
  const summary: ImportSummary = { success: 0, failed: 0, inserted: 0, updated: 0 };

  await db
    .from('import_history')
    .update({
      status: 'partial',
      summary,
    })
    .eq('id', params.importId);

  try {
    const validationErrors: any[] = [];
    const details: any[] = [];
    const validRows: z.infer<typeof quoteRowSchema>[] = [];

    for (let idx = 0; idx < params.payload.rows.length; idx += 1) {
      if (await isCancelled(db, params.importId)) {
        return { summary, status: 'cancelled' };
      }
      const rowNumber = idx + 1;
      const parsedRow = quoteRowSchema.safeParse(params.payload.rows[idx]);
      if (!parsedRow.success) {
        summary.failed += 1;
        validationErrors.push({
          import_id: params.importId,
          row_number: rowNumber,
          field: parsedRow.error.issues[0]?.path?.join('.') || 'row',
          error_message: parsedRow.error.issues.map((i) => i.message).join(', '),
          raw_data: params.payload.rows[idx],
        });
        continue;
      }

      const violation = businessViolation(parsedRow.data);
      if (violation) {
        summary.failed += 1;
        validationErrors.push({
          import_id: params.importId,
          row_number: rowNumber,
          field: 'business',
          error_message: violation,
          raw_data: params.payload.rows[idx],
        });
        continue;
      }

      validRows.push(parsedRow.data);
    }

    const quoteNumbers = Array.from(new Set(validRows.map((r) => r.quote_number)));
    const existingMap = new Map<string, any>();
    if (quoteNumbers.length > 0) {
      const { data: existingRows, error: existingError } = await db
        .from('quotes')
        .select('*')
        .eq('tenant_id', params.tenantId)
        .in('quote_number', quoteNumbers);
      if (existingError) throw new Error(existingError.message);
      for (const row of existingRows || []) {
        existingMap.set(String((row as any).quote_number), row);
      }
    }

    const rowsToInsert: any[] = [];
    const rowsToUpsert: any[] = [];
    for (const row of validRows) {
      const existing = existingMap.get(row.quote_number);
      if (!existing) {
        rowsToInsert.push({
          ...row,
          tenant_id: params.tenantId,
        });
        continue;
      }
      if (params.payload.duplicateMode === 'skip') continue;
      if (params.payload.duplicateMode === 'allow') {
        rowsToInsert.push({
          ...row,
          tenant_id: params.tenantId,
        });
        continue;
      }
      rowsToUpsert.push({
        ...row,
        id: existing.id,
        tenant_id: params.tenantId,
      });
      details.push({
        import_id: params.importId,
        record_id: existing.id,
        operation_type: 'update',
        previous_data: existing,
        new_data: row,
      });
    }

    for (let offset = 0; offset < rowsToInsert.length; offset += params.payload.batchSize) {
      if (await isCancelled(db, params.importId)) {
        return { summary, status: 'cancelled' };
      }
      const chunk = rowsToInsert.slice(offset, offset + params.payload.batchSize);
      if (!chunk.length) continue;
      const { data: inserted, error } = await db.from('quotes').insert(chunk).select('*');
      if (error) {
        summary.failed += chunk.length;
        validationErrors.push({
          import_id: params.importId,
          row_number: 0,
          field: 'database',
          error_message: `insert failed: ${error.message}`,
          raw_data: chunk,
        });
      } else {
        const insertedRows = inserted || [];
        summary.success += insertedRows.length;
        summary.inserted += insertedRows.length;
        for (const row of insertedRows) {
          details.push({
            import_id: params.importId,
            record_id: (row as any).id,
            operation_type: 'insert',
            new_data: row,
          });
        }
      }
    }

    for (let offset = 0; offset < rowsToUpsert.length; offset += params.payload.batchSize) {
      if (await isCancelled(db, params.importId)) {
        return { summary, status: 'cancelled' };
      }
      const chunk = rowsToUpsert.slice(offset, offset + params.payload.batchSize);
      if (!chunk.length) continue;
      const { data: updated, error } = await db.from('quotes').upsert(chunk, { onConflict: 'id' }).select('*');
      if (error) {
        summary.failed += chunk.length;
        validationErrors.push({
          import_id: params.importId,
          row_number: 0,
          field: 'database',
          error_message: `update failed: ${error.message}`,
          raw_data: chunk,
        });
      } else {
        const updatedRows = updated || [];
        summary.success += updatedRows.length;
        summary.updated += updatedRows.length;
      }
    }

    if (details.length > 0) {
      for (let offset = 0; offset < details.length; offset += params.payload.batchSize) {
        const chunk = details.slice(offset, offset + params.payload.batchSize);
        const { error } = await db.from('import_history_details').insert(chunk);
        if (error) throw new Error(error.message);
      }
    }

    if (validationErrors.length > 0) {
      for (let offset = 0; offset < validationErrors.length; offset += params.payload.batchSize) {
        const chunk = validationErrors.slice(offset, offset + params.payload.batchSize);
        await db.from('import_errors').insert(chunk);
      }
    }

    const finalStatus = summary.failed > 0 && summary.success > 0 ? 'partial' : summary.failed > 0 ? 'failed' : 'success';
    await db
      .from('import_history')
      .update({
        status: finalStatus,
        summary,
      })
      .eq('id', params.importId);

    logApiEvent('info', '[QuotationImportV2] background job completed', {
      correlationId: params.correlationId,
      tenantId: params.tenantId,
      userId: params.userId,
      importId: params.importId,
      summary,
      status: finalStatus,
    });

    return { summary, status: finalStatus };
  } catch (error) {
    await db
      .from('import_history')
      .update({
        status: 'failed',
        summary: { ...summary, failed: summary.failed + 1 },
      })
      .eq('id', params.importId);

    logApiEvent('error', '[QuotationImportV2] background job failed', {
      correlationId: params.correlationId,
      tenantId: params.tenantId,
      userId: params.userId,
      importId: params.importId,
      message: error instanceof Error ? error.message : 'unknown',
    });

    throw error;
  }
}

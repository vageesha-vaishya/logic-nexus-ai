import { createHash, createHmac } from 'crypto';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { applyCors, authenticateRequest, buildApiContext, enforceAnyPermission, enforceCsrfProtection, enforceHttps, enforceRateLimit, enforceRoles, handlePreflight, logApiEvent } from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';

const MAX_EXPORT_ROWS = 10_000;

const exportFieldSchema = z.enum([
  'id',
  'quote_number',
  'title',
  'status',
  'currency',
  'buy_price',
  'sell_price',
  'validity_date',
  'terms_conditions',
  'account_id',
  'contact_id',
  'opportunity_id',
  'carrier_id',
  'transport_mode',
  'origin',
  'destination',
  'custom_fields',
  'created_at',
  'updated_at',
]);

const sensitiveFields = new Set<string>(['buy_price', 'account_id', 'contact_id', 'opportunity_id', 'custom_fields']);
const defaultFields = ['id', 'quote_number', 'title', 'status', 'currency', 'sell_price', 'validity_date', 'terms_conditions', 'carrier_id', 'transport_mode', 'origin', 'destination', 'created_at', 'updated_at'] as const;

const exportPayloadSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']).default('json'),
  scope: z.enum(['single', 'selected', 'filtered', 'all']).default('filtered'),
  quoteId: z.string().min(1).max(64).optional(),
  ids: z.array(z.string().min(1).max(64)).max(MAX_EXPORT_ROWS).optional().default([]),
  fields: z.array(exportFieldSchema).max(200).optional(),
  includeSensitive: z.boolean().optional().default(false),
  filters: z.object({
    status: z.string().min(1).max(32).optional(),
    search: z.string().min(1).max(120).optional(),
  }).optional(),
  limit: z.number().int().positive().max(MAX_EXPORT_ROWS).default(MAX_EXPORT_ROWS),
});

type ExportPayload = z.infer<typeof exportPayloadSchema>;

function toSerializableRows(rows: Record<string, unknown>[], fields: string[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const key of fields) mapped[key] = row[key];
    return mapped;
  });
}

function stripSensitiveFields(fields: string[], includeSensitive: boolean): string[] {
  if (includeSensitive) return fields;
  return fields.filter((field) => !sensitiveFields.has(field));
}

function resolveRequestedFields(payload: ExportPayload): string[] {
  const requested = payload.fields && payload.fields.length > 0 ? payload.fields : [...defaultFields];
  return Array.from(new Set(requested.map((field) => String(field))));
}

function hasSensitiveSelection(fields: string[]): boolean {
  return fields.some((field) => sensitiveFields.has(field));
}

function deriveFilename(format: ExportPayload['format']): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `quotations_export_${stamp}.${format}`;
}

function deriveMimeType(format: ExportPayload['format']): string {
  if (format === 'csv') return 'text/csv;charset=utf-8';
  if (format === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/json;charset=utf-8';
}

function encodeExportData(rows: Record<string, unknown>[], format: ExportPayload['format']): { base64: string; checksumSha256: string; rowCount: number } {
  if (format === 'json') {
    const payload = JSON.stringify({
      schemaVersion: '2.0',
      entity: 'Quotes',
      exportedAt: new Date().toISOString(),
      rowCount: rows.length,
      rows,
    });
    const bytes = Buffer.from(payload, 'utf8');
    return {
      base64: bytes.toString('base64'),
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: rows.length,
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotes');

  if (format === 'csv') {
    const csv = `\ufeff${XLSX.utils.sheet_to_csv(worksheet)}`;
    const bytes = Buffer.from(csv, 'utf8');
    return {
      base64: bytes.toString('base64'),
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: rows.length,
    };
  }

  const xlsxArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const bytes = Buffer.from(xlsxArray as ArrayBuffer);
  return {
    base64: bytes.toString('base64'),
    checksumSha256: createHash('sha256').update(bytes).digest('hex'),
    rowCount: rows.length,
  };
}

function buildSignature(checksumSha256: string, tenantId: string): { algorithm: string; keyId: string; value: string } {
  const secret = String(process.env.QUOTATION_EXPORT_SIGNING_SECRET || '').trim();
  if (secret) {
    const keyId = String(process.env.QUOTATION_EXPORT_SIGNING_KEY_ID || 'quotation-export-hmac-v1');
    return {
      algorithm: 'hmac-sha256',
      keyId,
      value: createHmac('sha256', secret).update(checksumSha256).digest('hex'),
    };
  }
  return {
    algorithm: 'sha256',
    keyId: 'unsigned-local',
    value: createHash('sha256').update(`${tenantId}:${checksumSha256}`).digest('hex'),
  };
}

function normalizeSearchValue(value: string): string {
  return value.replace(/[%_]/g, '').trim();
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    enforceCsrfProtection(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceRoles(auth.role, ['admin', 'operations', 'sales', 'developer']);
    enforceAnyPermission(auth.permissions, ['export_quotation', 'quotes.import_export']);

    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Missing tenant context', correlationId: ctx.correlationId });
    }

    const parsedPayload = exportPayloadSchema.safeParse(req.body);
    if (!parsedPayload.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        issues: parsedPayload.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        correlationId: ctx.correlationId,
      });
    }

    const payload = parsedPayload.data;
    const requestedFields = resolveRequestedFields(payload);
    if (hasSensitiveSelection(requestedFields) || payload.includeSensitive) {
      enforceAnyPermission(auth.permissions, ['export_quotation_sensitive', 'quotes.export_sensitive']);
    }
    const effectiveFields = stripSensitiveFields(requestedFields, payload.includeSensitive);
    if (effectiveFields.length === 0) {
      return res.status(400).json({
        error: 'No exportable fields after policy enforcement',
        correlationId: ctx.correlationId,
      });
    }

    const db = getSupabaseAdminClient();
    let query = db.from('quotes').select(effectiveFields.join(',')).eq('tenant_id', ctx.tenantId).order('updated_at', { ascending: false }).limit(payload.limit);

    if (payload.scope === 'single') {
      if (!payload.quoteId) {
        return res.status(400).json({ error: 'quoteId is required for single scope', correlationId: ctx.correlationId });
      }
      query = query.eq('id', payload.quoteId);
    } else if (payload.scope === 'selected') {
      if (!payload.ids.length) {
        return res.status(400).json({ error: 'ids are required for selected scope', correlationId: ctx.correlationId });
      }
      query = query.in('id', payload.ids);
    }

    if (payload.filters?.status) {
      query = query.eq('status', payload.filters.status);
    }
    if (payload.filters?.search) {
      const cleanSearch = normalizeSearchValue(payload.filters.search);
      if (cleanSearch) {
        query = query.or(`quote_number.ilike.%${cleanSearch}%,title.ilike.%${cleanSearch}%`);
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const rawRows = ((rows as unknown) as unknown[]) || [];
    const normalizedRows: Record<string, unknown>[] = rawRows
      .filter((row) => !!row && typeof row === 'object' && !Array.isArray(row))
      .map((row) => row as Record<string, unknown>);
    const serializedRows = toSerializableRows(normalizedRows, effectiveFields);
    const encoded = encodeExportData(serializedRows, payload.format);
    const signature = buildSignature(encoded.checksumSha256, ctx.tenantId);
    const generatedAt = new Date().toISOString();
    const fileName = deriveFilename(payload.format);

    logApiEvent('info', '[QuotationExportV2] export completed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      format: payload.format,
      scope: payload.scope,
      rowCount: encoded.rowCount,
      includeSensitive: payload.includeSensitive,
    });

    return res.status(200).json({
      version: 'v2',
      export: {
        format: payload.format,
        fileName,
        mimeType: deriveMimeType(payload.format),
        encoding: 'base64',
        data: encoded.base64,
      },
      report: {
        schemaVersion: '1.0',
        generatedAt,
        rowCount: encoded.rowCount,
        checksumSha256: encoded.checksumSha256,
        filterCriteria: {
          scope: payload.scope,
          quoteId: payload.quoteId || null,
          idsCount: payload.ids.length,
          filters: payload.filters || {},
          fields: effectiveFields,
          includeSensitive: payload.includeSensitive,
        },
        digitalSignature: signature,
      },
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    logApiEvent('error', '[QuotationExportV2] export failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}

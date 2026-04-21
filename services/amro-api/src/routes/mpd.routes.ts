import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

type JsonRecord = Record<string, unknown>;

const router = Router();

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_MPD_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function getSupabaseAdminClient(): SupabaseClient {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  ).trim();
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceKey);
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function normalizeString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function normalizeDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function normalizeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parsePagination(req: AuthRequest): { page: number; pageSize: number; from: number; to: number } {
  const pageRaw = Number(req.query.page || 1);
  const pageSizeRaw = Number(req.query.page_size || req.query.pageSize || 50);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Math.max(1, Math.min(500, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

function mapTaskTemplateRowToMpd(row: JsonRecord): JsonRecord {
  return {
    id: String(row.id || ''),
    mpd_sequence: normalizeInteger(row.tt_sequence ?? row.task_template_id),
    mpd_code: normalizeString(row.code_form_no),
    ata_code: normalizeString(row.ata_code),
    reference_amp: normalizeString(row.reference_amp),
    description: normalizeString(row.description),
    category_code: normalizeString(row.category_code),
    estimated_man_hours: normalizeDecimal(row.estimated_man_hours),
    revision_status: normalizeString(row.revision_status),
    interval_hours: normalizeInteger(row.interval_hours),
    interval_cycles: normalizeInteger(row.interval_cycles),
    interval_months: normalizeInteger(row.interval_months),
    is_mandatory: normalizeBoolean(row.is_mandatory, true),
    assembly_model_id: normalizeString(row.assembly_models ?? row.model_id),
    task_template_detail_json: normalizeJsonArray(row.task_template_detail_json),
    task_template_scope_json: normalizeJsonArray(row.task_template_scope_json),
    tenant_id: normalizeString(row.tenant_id),
    franchise_id: normalizeString(row.franchise_id),
    created_at: normalizeString(row.created_at),
    updated_at: normalizeString(row.updated_at),
  };
}

function mapMpdPayloadToTaskTemplateInput(payload: JsonRecord): JsonRecord {
  const input: JsonRecord = {};
  const setIfDefined = (key: string, value: unknown) => {
    if (value !== undefined) input[key] = value;
  };

  if (payload.mpd_code !== undefined || payload.code_form_no !== undefined) {
    setIfDefined('code_form_no', normalizeString(payload.mpd_code ?? payload.code_form_no));
  }
  if (payload.ata_code !== undefined) setIfDefined('ata_code', normalizeString(payload.ata_code));
  if (payload.reference_amp !== undefined) setIfDefined('reference_amp', normalizeString(payload.reference_amp));
  if (payload.description !== undefined) setIfDefined('description', normalizeString(payload.description));
  if (payload.category_code !== undefined) setIfDefined('category_code', normalizeString(payload.category_code));
  if (payload.estimated_man_hours !== undefined) setIfDefined('estimated_man_hours', normalizeDecimal(payload.estimated_man_hours));
  if (payload.is_mandatory !== undefined) setIfDefined('is_mandatory', normalizeBoolean(payload.is_mandatory, true));
  if (payload.task_template_detail_json !== undefined) setIfDefined('task_template_detail_json', normalizeJsonArray(payload.task_template_detail_json));
  if (payload.task_template_scope_json !== undefined) setIfDefined('task_template_scope_json', normalizeJsonArray(payload.task_template_scope_json));
  if (
    payload.assembly_model_id !== undefined
    || payload.assembly_models !== undefined
    || payload.model_id !== undefined
  ) {
    const modelValue = normalizeString(payload.assembly_model_id ?? payload.assembly_models ?? payload.model_id);
    setIfDefined('assembly_models', modelValue);
    setIfDefined('model_id', modelValue);
  }
  if (payload.revision_status !== undefined) {
    setIfDefined('revision_status', normalizeString(payload.revision_status));
  }
  if (payload.interval_hours !== undefined) {
    setIfDefined('interval_hours', normalizeInteger(payload.interval_hours));
  }
  if (payload.interval_cycles !== undefined) {
    setIfDefined('interval_cycles', normalizeInteger(payload.interval_cycles));
  }
  if (payload.interval_months !== undefined) {
    setIfDefined('interval_months', normalizeInteger(payload.interval_months));
  }

  return input;
}

function validateMpdInput(payload: JsonRecord, mode: 'create' | 'patch'): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  if (mode === 'create') {
    if (!normalizeString(payload.ata_code)) issues.push({ field: 'ata_code', message: 'ata_code is required' });
    if (!normalizeString(payload.description)) issues.push({ field: 'description', message: 'description is required' });
  }
  if (
    payload.estimated_man_hours !== undefined
    && payload.estimated_man_hours !== null
    && payload.estimated_man_hours !== ''
    && normalizeDecimal(payload.estimated_man_hours) === null
  ) {
    issues.push({ field: 'estimated_man_hours', message: 'estimated_man_hours must be a valid number' });
  }
  return issues;
}

router.get(
  '/amro/mpd',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId) {
      res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
      return;
    }

    const { page, pageSize, from, to } = parsePagination(req);
    const tenantId = String(req.tenantId);
    const franchiseId = String(req.headers['x-franchise-id'] || '').trim() || null;
    const search = String(req.query.search || '').trim();
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('task_templates')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    if (search) {
      const escaped = search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      query = query.or(`description.ilike.%${escaped}%,ata_code.ilike.%${escaped}%,reference_amp.ilike.%${escaped}%,code_form_no.ilike.%${escaped}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to query MPD records: ${error.message}`,
        code: 'MPD_QUERY_FAILED',
        statusCode: 500,
      });
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'amro-mpd-list',
      output: {
        page,
        page_size: pageSize,
        total: Number(count || 0),
        records: (Array.isArray(data) ? data : []).map((row) => mapTaskTemplateRowToMpd(asObject(row))),
      },
    });
  }),
);

router.post(
  '/amro/mpd',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }

    const payload = asObject(req.body);
    const issues = validateMpdInput(payload, 'create');
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', statusCode: 400, issues });
      return;
    }

    const tenantId = String(req.tenantId);
    const franchiseId = String(req.headers['x-franchise-id'] || '').trim() || null;
    const supabase = getSupabaseAdminClient();
    const row = {
      ...mapMpdPayloadToTaskTemplateInput(payload),
      tenant_id: tenantId,
      franchise_id: franchiseId,
    };

    const { data, error } = await supabase
      .from('task_templates')
      .insert(row)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(500).json({
        error: `Failed to create MPD record: ${error.message}`,
        code: 'MPD_CREATE_FAILED',
        statusCode: 500,
      });
      return;
    }

    res.status(201).json({
      version: 'v2',
      interface: 'amro-mpd-create',
      output: {
        record: mapTaskTemplateRowToMpd(asObject(data)),
      },
    });
  }),
);

router.patch(
  '/amro/mpd/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }

    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const payload = asObject(req.body);
    const issues = validateMpdInput(payload, 'patch');
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', statusCode: 400, issues });
      return;
    }

    const patch = mapMpdPayloadToTaskTemplateInput(payload);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        issues: [{ field: 'payload', message: 'No MPD fields provided for update' }],
      });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('task_templates')
      .update(patch)
      .eq('tenant_id', req.tenantId)
      .eq('id', id)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(500).json({
        error: `Failed to update MPD record: ${error.message}`,
        code: 'MPD_UPDATE_FAILED',
        statusCode: 500,
      });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'amro-mpd-update',
      output: {
        record: mapTaskTemplateRowToMpd(asObject(data)),
      },
    });
  }),
);

router.delete(
  '/amro/mpd/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }

    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('tenant_id', req.tenantId)
      .eq('id', id);

    if (error) {
      res.status(500).json({
        error: `Failed to delete MPD record: ${error.message}`,
        code: 'MPD_DELETE_FAILED',
        statusCode: 500,
      });
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'amro-mpd-delete',
      output: { id, deleted: true },
    });
  }),
);

export default router;

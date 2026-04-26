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

function parseHoursFromInterval(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2));
  const text = String(value).trim();
  if (!text) return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(Number(text).toFixed(2));
  const daysMatch = text.match(/(-?\d+)\s+day/);
  const days = daysMatch ? Number(daysMatch[1]) : 0;
  const timeMatch = text.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const mins = Number(timeMatch[2]);
    const secs = Number(timeMatch[3] || 0);
    const total = (days * 24) + hours + (mins / 60) + (secs / 3600);
    return Number(total.toFixed(2));
  }
  const hourWord = text.match(/(-?\d+(?:\.\d+)?)\s*hour/);
  if (hourWord) return Number(Number(hourWord[1]).toFixed(2));
  return null;
}

function toIntervalLiteral(value: unknown): string | null {
  const hours = normalizeDecimal(value);
  return hours === null ? null : `${hours} hours`;
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
  const intervalHours = parseHoursFromInterval(row.threshold_hours ?? row.interval_hours);
  const intervalCycles = normalizeInteger(row.threshold_cycles ?? row.interval_cycles);
  const intervalMonths = normalizeInteger(row.threshold_calendar ?? row.interval_months);
  const thresholdLandings = normalizeInteger(row.threshold_landings);
  return {
    id: String(row.id || ''),
    mpd_sequence: normalizeInteger(row.tt_sequence ?? row.task_template_id),
    mpd_code: normalizeString(row.code_form_no),
    ata_code: normalizeString(row.ata_code),
    reference_amp: normalizeString(row.reference_amp),
    description: normalizeString(row.description),
    category_code: normalizeString(row.category_code),
    estimated_man_hours: parseHoursFromInterval(row.estimated_man_hours),
    revision_status: normalizeString(row.revision_status),
    interval_hours: intervalHours,
    interval_cycles: intervalCycles,
    interval_months: intervalMonths,
    calendar_unit: intervalMonths === null ? null : 'Mt',
    threshold_landings: thresholdLandings,
    threshold_rins: normalizeInteger(row.threshold_rins),
    threshold_hobbs: normalizeInteger(row.threshold_hobbs),
    threshold_cycles: intervalCycles,
    is_mandatory: normalizeBoolean(row.is_mandatory, true),
    assembly_model_id: normalizeString(row.assembly_models ?? row.model_id),
    loc_json: normalizeJsonArray(row.loc_json),
    other_details_json: normalizeJsonArray(row.other_details_json),
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
  if (payload.estimated_man_hours !== undefined) setIfDefined('estimated_man_hours', toIntervalLiteral(payload.estimated_man_hours));
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
  }
  if (payload.revision_status !== undefined) {
    setIfDefined('revision_status', normalizeString(payload.revision_status));
  }
  // Backward-compatible remap: old clients may still send interval_hours.
  // task_templates uses threshold_hours.
  if (payload.interval_hours !== undefined && payload.threshold_hours === undefined) {
    setIfDefined('threshold_hours', toIntervalLiteral(payload.interval_hours));
  }
  if (payload.threshold_hours !== undefined) {
    setIfDefined('threshold_hours', toIntervalLiteral(payload.threshold_hours));
  }
  // Backward-compatible remap: old clients may still send interval_cycles.
  // task_templates uses threshold_cycles for cycle-based frequency.
  if (payload.interval_cycles !== undefined && payload.threshold_cycles === undefined) {
    setIfDefined('threshold_cycles', normalizeInteger(payload.interval_cycles));
  }
  // Backward-compatible remap: old clients may still send interval_months.
  // task_templates uses threshold_calendar.
  if (payload.interval_months !== undefined && payload.threshold_calendar === undefined) {
    setIfDefined('threshold_calendar', normalizeInteger(payload.interval_months));
  }
  if (payload.threshold_calendar !== undefined) {
    setIfDefined('threshold_calendar', normalizeInteger(payload.threshold_calendar));
  }
  if (payload.threshold_cycles !== undefined) {
    setIfDefined('threshold_cycles', normalizeInteger(payload.threshold_cycles));
  }
  if (payload.threshold_landings !== undefined) {
    setIfDefined('threshold_cycles', normalizeInteger(payload.threshold_landings));
  }
  if (payload.threshold_rins !== undefined) {
    setIfDefined('threshold_rins', normalizeInteger(payload.threshold_rins));
  }
  if (payload.threshold_hobbs !== undefined) {
    setIfDefined('threshold_hobbs', normalizeInteger(payload.threshold_hobbs));
  }
  if (payload.loc_json !== undefined) {
    setIfDefined('loc_json', normalizeJsonArray(payload.loc_json));
  }
  if (payload.other_details_json !== undefined) {
    setIfDefined('other_details_json', normalizeJsonArray(payload.other_details_json));
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
  if (
    payload.interval_hours !== undefined
    && payload.interval_hours !== null
    && payload.interval_hours !== ''
    && normalizeDecimal(payload.interval_hours) === null
  ) {
    issues.push({ field: 'interval_hours', message: 'interval_hours must be a valid number' });
  }
  if (
    payload.threshold_hours !== undefined
    && payload.threshold_hours !== null
    && payload.threshold_hours !== ''
    && normalizeDecimal(payload.threshold_hours) === null
  ) {
    issues.push({ field: 'threshold_hours', message: 'threshold_hours must be a valid number' });
  }
  if (
    payload.interval_months !== undefined
    && payload.interval_months !== null
    && payload.interval_months !== ''
    && normalizeInteger(payload.interval_months) === null
  ) {
    issues.push({ field: 'interval_months', message: 'interval_months must be an integer' });
  }
  if (
    payload.threshold_calendar !== undefined
    && payload.threshold_calendar !== null
    && payload.threshold_calendar !== ''
    && normalizeInteger(payload.threshold_calendar) === null
  ) {
    issues.push({ field: 'threshold_calendar', message: 'threshold_calendar must be an integer' });
  }
  if (
    payload.threshold_cycles !== undefined
    && payload.threshold_cycles !== null
    && payload.threshold_cycles !== ''
    && normalizeInteger(payload.threshold_cycles) === null
  ) {
    issues.push({ field: 'threshold_cycles', message: 'threshold_cycles must be an integer' });
  }
  if (
    payload.threshold_landings !== undefined
    && payload.threshold_landings !== null
    && payload.threshold_landings !== ''
    && normalizeInteger(payload.threshold_landings) === null
  ) {
    issues.push({ field: 'threshold_landings', message: 'threshold_landings must be an integer' });
  }
  if (
    payload.threshold_rins !== undefined
    && payload.threshold_rins !== null
    && payload.threshold_rins !== ''
    && normalizeInteger(payload.threshold_rins) === null
  ) {
    issues.push({ field: 'threshold_rins', message: 'threshold_rins must be an integer' });
  }
  if (
    payload.threshold_hobbs !== undefined
    && payload.threshold_hobbs !== null
    && payload.threshold_hobbs !== ''
    && normalizeInteger(payload.threshold_hobbs) === null
  ) {
    issues.push({ field: 'threshold_hobbs', message: 'threshold_hobbs must be an integer' });
  }
  return issues;
}

function buildMpdQueryError(errorMessage: string): { error: string; code: string; statusCode: number } {
  const normalized = String(errorMessage || '').toLowerCase();
  if (normalized.includes('column task_templates.model_id does not exist')) {
    return {
      error: 'Failed to query MPD records: invalid model column mapping detected. Use task_templates.assembly_models for model filtering.',
      code: 'MPD_MODEL_COLUMN_MAPPING_ERROR',
      statusCode: 500,
    };
  }
  return {
    error: `Failed to query MPD records: ${errorMessage}`,
    code: 'MPD_QUERY_FAILED',
    statusCode: 500,
  };
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
    const modelId = String(req.query.model_id || req.query.modelId || '').trim();
    const ataCode = String(req.query.ata_code || req.query.ataCode || '').trim();
    const categoryCode = String(req.query.category_code || req.query.categoryCode || '').trim();
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
    if (modelId) {
      query = query.eq('assembly_models', modelId);
    }
    if (ataCode) {
      query = query.eq('ata_code', ataCode);
    }
    if (categoryCode) {
      query = query.eq('category_code', categoryCode);
    }

    const { data, error, count } = await query;
    if (error) {
      const mappedError = buildMpdQueryError(error.message);
      res.status(mappedError.statusCode).json(mappedError);
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

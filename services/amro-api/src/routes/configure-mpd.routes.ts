import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

type JsonRecord = Record<string, unknown>;

const router = Router();

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_CONFIGURE_MPD_V2_ENABLED || 'true').trim().toLowerCase();
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

function normalizeString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
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

function resolveFranchiseId(req: AuthRequest): string | null {
  const fromHeader = String(req.headers['x-franchise-id'] || '').trim();
  if (fromHeader) return fromHeader;
  const fromQuery = String(req.query.franchise_id || req.query.franchiseId || '').trim();
  if (fromQuery) return fromQuery;
  const fromUser = String((req.user as Record<string, unknown> | undefined)?.franchise_id || '').trim();
  return fromUser || null;
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

function parseHoursFromThresholdHours(value: unknown): number | null {
  return parseHoursFromInterval(value);
}

function mapTaskTemplateToMpdRecord(row: JsonRecord): JsonRecord {
  const intervalHours = parseHoursFromThresholdHours(row.threshold_hours);
  const intervalCycles = normalizeInteger(row.threshold_cycles);
  const intervalMonths = normalizeInteger(row.threshold_calendar);
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
    calendar_unit: intervalMonths === null ? null : normalizeString(row.calendar_unit) || 'Mt',
    threshold_landings: thresholdLandings,
    threshold_rins: normalizeInteger(row.threshold_rins),
    threshold_hobbs: normalizeInteger(row.threshold_hobbs),
    threshold_cycles: intervalCycles,
    threshold_hours: intervalHours,
    threshold_calendar: intervalMonths,
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

function mapTaskWithTemplateToConfiguredRecord(taskRow: JsonRecord, templateRow: JsonRecord | null): JsonRecord {
  const templateMapped = mapTaskTemplateToMpdRecord(templateRow || {});
  return {
    ...templateMapped,
    id: String(taskRow.id || ''),
    task_id: String(taskRow.id || ''),
    task_template_id: normalizeString(taskRow.task_template_id),
    work_order_id: normalizeString(taskRow.work_order_id ?? taskRow.work_order_id),
    task_number: normalizeString(taskRow.task_number),
    task_title: normalizeString(taskRow.title),
    task_description: normalizeString(taskRow.description),
    task_category: normalizeString(taskRow.task_category),
    task_status: normalizeString(taskRow.status),
    task_sequence_order: normalizeInteger(taskRow.sequence_order),
    task_assigned_to: normalizeString(taskRow.assigned_technician_id),
    task_planned_start_date: normalizeString(taskRow.planned_start_date),
    task_planned_end_date: normalizeString(taskRow.planned_end_date),
    task_actual_start_date: normalizeString(taskRow.actual_start_date),
    task_actual_end_date: normalizeString(taskRow.actual_end_date),
    task_created_at: normalizeString(taskRow.created_at),
    task_updated_at: normalizeString(taskRow.updated_at),
    created_at: normalizeString(taskRow.created_at),
    updated_at: normalizeString(taskRow.updated_at),
  };
}

function applyTemplateFilters(rows: JsonRecord[], filters: {
  search: string;
  ataCode: string;
  categoryCode: string;
}): JsonRecord[] {
  const search = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.ataCode && String(row.ata_code || '').trim() !== filters.ataCode) return false;
    if (filters.categoryCode && String(row.category_code || '').trim() !== filters.categoryCode) return false;
    if (!search) return true;
    const haystack = [
      String(row.code_form_no || ''),
      String(row.ata_code || ''),
      String(row.reference_amp || ''),
      String(row.description || ''),
      String(row.category_code || ''),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
}

function paginate<T>(rows: T[], from: number, to: number): T[] {
  if (rows.length === 0) return [];
  const safeFrom = Math.max(0, from);
  const safeTo = Math.min(rows.length - 1, to);
  if (safeFrom > safeTo) return [];
  return rows.slice(safeFrom, safeTo + 1);
}

async function fetchAircraftOptions(params: {
  supabase: SupabaseClient;
  tenantId: string;
  franchiseId: string | null;
  modelId: string;
}): Promise<JsonRecord[]> {
  let query = params.supabase
    .from('aircraft')
    .select('id,registration,assembly_models,status')
    .eq('tenant_id', params.tenantId)
    .order('registration', { ascending: true });
  if (params.franchiseId) {
    query = query.eq('franchise_id', params.franchiseId);
  }
  if (params.modelId) {
    query = query.eq('assembly_models', params.modelId);
  }
  const { data, error } = await query.limit(1000);
  if (error) {
    throw new Error(`Failed to load aircraft options: ${error.message}`);
  }
  return (Array.isArray(data) ? data : []).map((row) => {
    const record = row as JsonRecord;
    const registration = String(record.registration || '').trim();
    return {
      id: String(record.id || ''),
      registration,
      label: registration || String(record.id || ''),
      assembly_model_id: normalizeString(record.assembly_models),
      status: normalizeString(record.status),
    };
  });
}

async function resolveLatestTasksByTemplate(params: {
  supabase: SupabaseClient;
  tenantId: string;
  franchiseId: string | null;
  aircraftId: string;
}): Promise<JsonRecord[]> {
  let query = params.supabase
    .from('tasks')
    .select('id,tenant_id,franchise_id,task_template_id,work_order_id,task_number,title,description,task_category,status,sequence_order,assigned_technician_id,planned_start_date,planned_end_date,actual_start_date,actual_end_date,created_at,updated_at,work_orders!inner(aircraft_id)')
    .eq('tenant_id', params.tenantId)
    .eq('work_orders.aircraft_id', params.aircraftId)
    .not('task_template_id', 'is', null)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });
  if (params.franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
  }
  const { data, error } = await query.limit(5000);
  if (error) {
    throw new Error(`Failed to load configured tasks: ${error.message}`);
  }

  const latestByTemplateId = new Map<string, JsonRecord>();
  for (const row of Array.isArray(data) ? data : []) {
    const task = row as JsonRecord;
    const taskTemplateId = String(task.task_template_id || '').trim();
    if (!taskTemplateId || latestByTemplateId.has(taskTemplateId)) continue;
    latestByTemplateId.set(taskTemplateId, task);
  }
  return Array.from(latestByTemplateId.values());
}

async function ensureConfigureWorkOrder(params: {
  supabase: SupabaseClient;
  tenantId: string;
  franchiseId: string | null;
  aircraftId: string;
  userId: string;
}): Promise<JsonRecord> {
  let existingQuery = params.supabase
    .from('work_orders')
    .select('id,work_order_number')
    .eq('tenant_id', params.tenantId)
    .eq('aircraft_id', params.aircraftId)
    .eq('title', 'Configure MPD')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (params.franchiseId) {
    existingQuery = existingQuery.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
  }
  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    throw new Error(`Failed to resolve configure work package: ${existingError.message}`);
  }
  const existing = (Array.isArray(existingRows) ? existingRows[0] : null) as JsonRecord | null;
  if (existing?.id) return existing;

  const workOrderNumber = `CFG-${params.aircraftId.slice(0, 8)}-${Date.now()}`;
  const { data: created, error: createError } = await params.supabase
    .from('work_orders')
    .insert({
      tenant_id: params.tenantId,
      franchise_id: params.franchiseId,
      aircraft_id: params.aircraftId,
      work_order_number: workOrderNumber,
      title: 'Configure MPD',
      description: 'Auto-generated work package for Configure MPD task assignments',
      work_type: 'config',
      maintenance_type: 'inspection',
      status: 'planning',
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select('id,work_order_number')
    .single();
  if (createError) {
    throw new Error(`Failed to create configure work package: ${createError.message}`);
  }
  return (created || {}) as JsonRecord;
}

const TASK_TYPE_CODES = new Set([
  'AD', 'SB', 'SC', 'CM', 'DF', 'UN', 'MEL', 'IN', 'RE', 'TR', 'CC', 'CT', 'CE', 'CF', 'GE',
]);

function normalizeAtaForTaskNumber(ataCode: string | null): string {
  const digits = String(ataCode || '').trim().replace(/\D/g, '');
  if (!digits) return '0000';
  return digits.length <= 2
    ? digits.padStart(2, '0') + '00'
    : digits.padStart(4, '0').slice(0, 4);
}

function getUtcYearMonth(now: Date): string {
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function resolveTaskTypeCode(template: JsonRecord): string {
  const categoryCode = String(template.category_code || '').trim().toUpperCase();
  if (TASK_TYPE_CODES.has(categoryCode)) return categoryCode;
  const codeFormNo = String(template.code_form_no || '').trim().toUpperCase();
  if (codeFormNo.startsWith('MPD')) return 'SC';
  return 'SC';
}

function buildStandardTaskNumber(
  ataCode: string | null,
  taskTypeCode: string,
  yearMonth: string,
  sequence: number,
): string {
  const ata = normalizeAtaForTaskNumber(ataCode);
  const type = String(taskTypeCode || 'SC').trim().toUpperCase() || 'SC';
  const yyyymm = String(yearMonth || '').trim() || getUtcYearMonth(new Date());
  const seq = String(Math.max(1, sequence)).padStart(6, '0');
  return `TSK-${ata}-${type}-${yyyymm}-${seq}`;
}

async function reserveNextTaskSequence(params: {
  supabase: SupabaseClient;
  tenantId: string;
  yearMonth: string;
}): Promise<number> {
  const { data, error } = await params.supabase.rpc('next_task_seq', {
    p_tenant_id: params.tenantId,
    p_yyyymm: params.yearMonth,
  });
  if (error) {
    throw new Error(`Failed to reserve next task sequence: ${error.message}`);
  }
  const sequence = Number(data);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error(`Invalid task sequence value returned by next_task_seq: ${String(data)}`);
  }
  return Math.trunc(sequence);
}

function mapTemplateToTaskInsert(params: {
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  workOrderId: string;
  aircraftId: string;
  taskYearMonth: string;
  tenantScopedSequence: number;
  template: JsonRecord;
  templateSequence: number;
}): JsonRecord {
  const ttSequence = normalizeInteger(params.template.tt_sequence);
  const fallbackSequence = ttSequence ?? params.templateSequence;
  const taskTemplateId = String(params.template.id || '').trim();
  const taskTypeCode = resolveTaskTypeCode(params.template);
  return {
    tenant_id: params.tenantId,
    franchise_id: params.franchiseId,
    work_order_id: params.workOrderId,
    aircraft_id: params.aircraftId,
    task_template_id: taskTemplateId,
    task_number: buildStandardTaskNumber(
      String(params.template.ata_code || ''),
      taskTypeCode,
      params.taskYearMonth,
      params.tenantScopedSequence,
    ),
    title: String(params.template.code_form_no || params.template.description || `Template Task ${fallbackSequence}`),
    description: normalizeString(params.template.description),
    task_category: String(params.template.category_code || 'general'),
    estimated_duration_hours: toIntervalLiteral(params.template.estimated_man_hours),
    sequence_order: fallbackSequence,
    status: 'pending',
    notes: normalizeString(params.template.reference_amp),
    created_by: params.userId,
    updated_by: params.userId,
  };
}

function mapTemplatePatchPayload(payload: JsonRecord): JsonRecord {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const patch: JsonRecord = {};
  if (has('mpd_code') || has('code_form_no')) {
    patch.code_form_no = normalizeString(payload.mpd_code ?? payload.code_form_no);
  }
  if (has('ata_code')) patch.ata_code = normalizeString(payload.ata_code);
  if (has('reference_amp')) patch.reference_amp = normalizeString(payload.reference_amp);
  if (has('description')) patch.description = normalizeString(payload.description);
  if (has('category_code')) patch.category_code = normalizeString(payload.category_code);
  if (has('estimated_man_hours')) patch.estimated_man_hours = toIntervalLiteral(payload.estimated_man_hours);
  if (has('revision_status')) patch.revision_status = normalizeString(payload.revision_status);
  if (has('interval_hours') || has('threshold_hours')) {
    patch.threshold_hours = toIntervalLiteral(payload.interval_hours ?? payload.threshold_hours);
  }
  if (has('interval_cycles') || has('threshold_cycles')) {
    patch.threshold_cycles = normalizeInteger(payload.interval_cycles ?? payload.threshold_cycles);
  }
  if (has('interval_months') || has('threshold_calendar')) {
    patch.threshold_calendar = normalizeInteger(payload.interval_months ?? payload.threshold_calendar);
  }
  if (has('threshold_landings')) patch.threshold_landings = normalizeInteger(payload.threshold_landings);
  if (has('threshold_rins')) patch.threshold_rins = normalizeInteger(payload.threshold_rins);
  if (has('threshold_hobbs')) patch.threshold_hobbs = normalizeInteger(payload.threshold_hobbs);
  if (has('is_mandatory')) patch.is_mandatory = normalizeBoolean(payload.is_mandatory, true);
  if (has('assembly_model_id') || has('assembly_models')) {
    patch.assembly_models = normalizeString(payload.assembly_model_id ?? payload.assembly_models);
  }
  if (has('loc_json')) patch.loc_json = normalizeJsonArray(payload.loc_json);
  if (has('other_details_json')) patch.other_details_json = normalizeJsonArray(payload.other_details_json);
  if (has('task_template_detail_json')) patch.task_template_detail_json = normalizeJsonArray(payload.task_template_detail_json);
  if (has('task_template_scope_json')) patch.task_template_scope_json = normalizeJsonArray(payload.task_template_scope_json);
  return patch;
}

router.get(
  '/amro/configure-mpd/aircraft-options',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId) {
      res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
      return;
    }
    const tenantId = String(req.tenantId);
    const franchiseId = resolveFranchiseId(req);
    const modelId = String(req.query.model_id || '').trim();
    const supabase = getSupabaseAdminClient();
    const records = await fetchAircraftOptions({ supabase, tenantId, franchiseId, modelId });
    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-aircraft-options',
      output: { records, total: records.length },
    });
  }),
);

router.get(
  '/amro/configure-mpd/non-configured',
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
    const modelId = String(req.query.model_id || '').trim();
    const aircraftId = String(req.query.aircraft_id || '').trim();
    const search = String(req.query.search || '').trim();
    const ataCode = String(req.query.ata_code || '').trim();
    const categoryCode = String(req.query.category_code || '').trim();
    const exportAsCsv = String(req.query.export || '').trim().toLowerCase() === 'csv';
    const supabase = getSupabaseAdminClient();

    if (!modelId || !aircraftId) {
      res.status(200).json({
        version: 'v2',
        interface: 'configure-mpd-non-configured-list',
        output: { page, page_size: pageSize, total: 0, records: [] },
      });
      return;
    }

    const latestConfiguredTasks = await resolveLatestTasksByTemplate({ supabase, tenantId, franchiseId, aircraftId });
    const configuredTemplateIds = new Set(
      latestConfiguredTasks.map((row) => String(row.task_template_id || '').trim()).filter(Boolean),
    );

    let query = supabase
      .from('task_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assembly_models', modelId)
      .order('created_at', { ascending: false });
    if (franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    const { data: templateRows, error: templateError } = await query.limit(5000);
    if (templateError) {
      res.status(500).json({
        error: `Failed to query non-configured templates: ${templateError.message}`,
        code: 'CONFIGURE_MPD_NON_CONFIGURED_QUERY_FAILED',
        statusCode: 500,
      });
      return;
    }

    const filteredRows = applyTemplateFilters(
      (Array.isArray(templateRows) ? templateRows : []).map((row) => row as JsonRecord),
      { search, ataCode, categoryCode },
    )
      .filter((row) => !configuredTemplateIds.has(String(row.id || '').trim()))
      .map(mapTaskTemplateToMpdRecord);

    if (exportAsCsv) {
      const header = [
        'mpd_sequence',
        'mpd_code',
        'ata_code',
        'reference_amp',
        'description',
        'category_code',
        'estimated_man_hours',
        'threshold_hours',
        'threshold_cycles',
        'threshold_calendar',
        'threshold_landings',
        'threshold_rins',
        'threshold_hobbs',
      ];
      const lines = [header.join(',')];
      for (const row of filteredRows) {
        const record = row as JsonRecord;
        lines.push(
          header
            .map((key) => `"${String(record[key] ?? '').replace(/"/g, '""')}"`)
            .join(','),
        );
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send(lines.join('\n'));
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-non-configured-list',
      output: {
        page,
        page_size: pageSize,
        total: filteredRows.length,
        records: paginate(filteredRows, from, to),
      },
    });
  }),
);

router.get(
  '/amro/configure-mpd/configured',
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
    const aircraftId = String(req.query.aircraft_id || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const exportAsCsv = String(req.query.export || '').trim().toLowerCase() === 'csv';
    const supabase = getSupabaseAdminClient();

    if (!aircraftId) {
      res.status(200).json({
        version: 'v2',
        interface: 'configure-mpd-configured-list',
        output: { page, page_size: pageSize, total: 0, records: [] },
      });
      return;
    }

    const latestTasks = await resolveLatestTasksByTemplate({ supabase, tenantId, franchiseId, aircraftId });
    const templateIds = latestTasks
      .map((row) => String(row.task_template_id || '').trim())
      .filter(Boolean);

    let templateById = new Map<string, JsonRecord>();
    if (templateIds.length > 0) {
      let templateQuery = supabase
        .from('task_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', templateIds);
      if (franchiseId) {
        templateQuery = templateQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }
      const { data: templateRows, error: templateError } = await templateQuery;
      if (templateError) {
        res.status(500).json({
          error: `Failed to query configured templates: ${templateError.message}`,
          code: 'CONFIGURE_MPD_CONFIGURED_TEMPLATE_QUERY_FAILED',
          statusCode: 500,
        });
        return;
      }
      templateById = new Map(
        (Array.isArray(templateRows) ? templateRows : []).map((row) => [String((row as JsonRecord).id || ''), row as JsonRecord]),
      );
    }

    const mappedRows = latestTasks
      .map((task) => {
        const templateId = String(task.task_template_id || '').trim();
        const template = templateById.get(templateId) || null;
        return mapTaskWithTemplateToConfiguredRecord(task, template);
      })
      .filter((row) => {
        if (!search) return true;
        const record = row as JsonRecord;
        const haystack = [
          String(record.task_number || ''),
          String(record.task_title || ''),
          String(record.task_description || ''),
          String(record.mpd_code || ''),
          String(record.ata_code || ''),
          String(record.description || ''),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });

    if (exportAsCsv) {
      const header = [
        'task_number',
        'task_status',
        'task_title',
        'task_category',
        'mpd_sequence',
        'mpd_code',
        'ata_code',
        'description',
      ];
      const lines = [header.join(',')];
      for (const row of mappedRows) {
        const record = row as JsonRecord;
        lines.push(
          header
            .map((key) => `"${String(record[key] ?? '').replace(/"/g, '""')}"`)
            .join(','),
        );
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send(lines.join('\n'));
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-configured-list',
      output: {
        page,
        page_size: pageSize,
        total: mappedRows.length,
        records: paginate(mappedRows, from, to),
      },
    });
  }),
);

router.post(
  '/amro/configure-mpd/configure',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }

    const payload = (req.body && typeof req.body === 'object' ? req.body : {}) as JsonRecord;
    const aircraftId = String(payload.aircraft_id || '').trim();
    const taskTemplateIds = Array.isArray(payload.task_template_ids)
      ? payload.task_template_ids.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (!aircraftId || taskTemplateIds.length === 0) {
      res.status(400).json({
        error: 'aircraft_id and task_template_ids are required',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
      return;
    }

    const tenantId = String(req.tenantId);
    const userId = String(req.userId);
    const franchiseId = String(req.headers['x-franchise-id'] || '').trim() || null;
    const supabase = getSupabaseAdminClient();

    const latestTasks = await resolveLatestTasksByTemplate({ supabase, tenantId, franchiseId, aircraftId });
    const alreadyConfiguredIds = new Set(
      latestTasks.map((row) => String(row.task_template_id || '').trim()).filter(Boolean),
    );
    const targetTemplateIds = taskTemplateIds.filter((id) => !alreadyConfiguredIds.has(id));

    if (targetTemplateIds.length === 0) {
      res.status(200).json({
        version: 'v2',
        interface: 'configure-mpd-configure',
        output: {
          configured_count: 0,
          skipped_count: taskTemplateIds.length,
          configured_task_ids: [],
        },
      });
      return;
    }

    let templateQuery = supabase
      .from('task_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('id', targetTemplateIds);
    if (franchiseId) {
      templateQuery = templateQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    const { data: templateRows, error: templateError } = await templateQuery;
    if (templateError) {
      res.status(500).json({
        error: `Failed to load task templates for configure action: ${templateError.message}`,
        code: 'CONFIGURE_MPD_TEMPLATE_QUERY_FAILED',
        statusCode: 500,
      });
      return;
    }

    const templates = (Array.isArray(templateRows) ? templateRows : []) as JsonRecord[];
    const workOrder = await ensureConfigureWorkOrder({
      supabase,
      tenantId,
      franchiseId,
      aircraftId,
      userId,
    });
    const { data: aircraftRow, error: aircraftError } = await supabase
      .from('aircraft')
      .select('franchise_id')
      .eq('tenant_id', tenantId)
      .eq('id', aircraftId)
      .maybeSingle();
    if (aircraftError) {
      res.status(500).json({
        error: `Failed to resolve aircraft franchise for task creation: ${aircraftError.message}`,
        code: 'CONFIGURE_MPD_AIRCRAFT_QUERY_FAILED',
        statusCode: 500,
      });
      return;
    }
    const aircraftFranchiseId = normalizeString((aircraftRow as JsonRecord | null)?.franchise_id) || null;
    const taskFranchiseId = aircraftFranchiseId ?? franchiseId;
    const workOrderId = String(workOrder.id || '').trim();
    const taskYearMonth = getUtcYearMonth(new Date());

    const inserts: JsonRecord[] = [];
    for (const [index, template] of templates.entries()) {
      const tenantScopedSequence = await reserveNextTaskSequence({
        supabase,
        tenantId,
        yearMonth: taskYearMonth,
      });
      inserts.push(
        mapTemplateToTaskInsert({
          tenantId,
          franchiseId: taskFranchiseId,
          userId,
          workOrderId,
          aircraftId,
          taskYearMonth,
          tenantScopedSequence,
          template,
          templateSequence: index + 1,
        }),
      );
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('tasks').insert(inserts);
      if (insertError) {
        res.status(500).json({
          error: `Failed to create configured tasks: ${insertError.message}`,
          code: 'CONFIGURE_MPD_TASK_INSERT_FAILED',
          statusCode: 500,
        });
        return;
      }
    }

    const { data: createdRows, error: createdError } = await supabase
      .from('tasks')
      .select('id,task_template_id')
      .eq('tenant_id', tenantId)
      .or(`work_order_id.eq.${workOrderId},work_order_id.eq.${workOrderId}`)
      .in('task_template_id', targetTemplateIds);
    if (createdError) {
      res.status(500).json({
        error: `Configured tasks created but verification query failed: ${createdError.message}`,
        code: 'CONFIGURE_MPD_TASK_VERIFY_FAILED',
        statusCode: 500,
      });
      return;
    }

    const configuredTaskIds = (Array.isArray(createdRows) ? createdRows : [])
      .map((row) => String((row as JsonRecord).id || '').trim())
      .filter(Boolean);

    res.status(201).json({
      version: 'v2',
      interface: 'configure-mpd-configure',
      output: {
        configured_count: configuredTaskIds.length,
        skipped_count: taskTemplateIds.length - targetTemplateIds.length,
        configured_task_ids: configuredTaskIds,
      },
    });
  }),
);

router.patch(
  '/amro/configure-mpd/non-configured/:templateId',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const templateId = String(req.params.templateId || '').trim();
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const payload = (req.body && typeof req.body === 'object' ? req.body : {}) as JsonRecord;
    const patch = mapTemplatePatchPayload(payload);
    patch.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();
    const query = supabase
      .from('task_templates')
      .update(patch)
      .eq('tenant_id', req.tenantId)
      .eq('id', templateId)
      .select('*')
      .single();
    const { data, error } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to update non-configured template: ${error.message}`,
        code: 'CONFIGURE_MPD_TEMPLATE_UPDATE_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-non-configured-update',
      output: { record: mapTaskTemplateToMpdRecord((data || {}) as JsonRecord) },
    });
  }),
);

router.delete(
  '/amro/configure-mpd/non-configured/:templateId',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const templateId = String(req.params.templateId || '').trim();
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const supabase = getSupabaseAdminClient();
    const query = supabase
      .from('task_templates')
      .delete()
      .eq('tenant_id', req.tenantId)
      .eq('id', templateId);
    const { error } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to delete non-configured template: ${error.message}`,
        code: 'CONFIGURE_MPD_TEMPLATE_DELETE_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-non-configured-delete',
      output: { id: templateId, deleted: true },
    });
  }),
);

router.patch(
  '/amro/configure-mpd/configured/:taskId',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const taskId = String(req.params.taskId || '').trim();
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const payload = (req.body && typeof req.body === 'object' ? req.body : {}) as JsonRecord;
    const patch: JsonRecord = {};
    if (payload.task_title !== undefined || payload.title !== undefined) {
      patch.title = normalizeString(payload.task_title ?? payload.title);
    }
    if (payload.task_description !== undefined || payload.description !== undefined) {
      patch.description = normalizeString(payload.task_description ?? payload.description);
    }
    if (payload.task_status !== undefined || payload.status !== undefined) {
      patch.status = normalizeString(payload.task_status ?? payload.status);
    }
    if (payload.task_category !== undefined || payload.task_category_code !== undefined) {
      patch.task_category = normalizeString(payload.task_category ?? payload.task_category_code);
    }
    if (payload.task_assigned_to !== undefined || payload.assigned_technician_id !== undefined) {
      patch.assigned_technician_id = normalizeString(payload.task_assigned_to ?? payload.assigned_technician_id);
    }
    patch.updated_by = String(req.userId);
    patch.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('tenant_id', req.tenantId)
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) {
      res.status(500).json({
        error: `Failed to update configured task: ${error.message}`,
        code: 'CONFIGURE_MPD_TASK_UPDATE_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-configured-update',
      output: { record: data || null },
    });
  }),
);

router.delete(
  '/amro/configure-mpd/configured/:taskId',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const taskId = String(req.params.taskId || '').trim();
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('tenant_id', req.tenantId)
      .eq('id', taskId);
    if (error) {
      res.status(500).json({
        error: `Failed to delete configured task: ${error.message}`,
        code: 'CONFIGURE_MPD_TASK_DELETE_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'configure-mpd-configured-delete',
      output: { id: taskId, deleted: true },
    });
  }),
);

export default router;

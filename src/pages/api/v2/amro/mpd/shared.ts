import type { ApiRequest } from '../../../_utils/types';

export type TaskTemplateSequenceColumn = 'tt_sequence' | 'task_template_id';
export type TaskTemplateModelColumn = 'assembly_models' | 'model_id';

export type MpdRecord = {
  id: string;
  mpd_sequence: number | null;
  mpd_code: string | null;
  ata_code: string | null;
  reference_amp: string | null;
  description: string | null;
  category_code: string | null;
  estimated_man_hours: number | null;
  revision_status: string | null;
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
  is_mandatory: boolean;
  assembly_model_id: string | null;
  task_template_detail_json: unknown[];
  task_template_scope_json: unknown[];
  tenant_id: string;
  franchise_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ValidationIssue = {
  field: string;
  message: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && (message.includes('column') || message.includes('does not exist'));
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function normalizeString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

export function normalizeDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

export function parseHoursFromInterval(value: unknown): number | null {
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

export function toIntervalLiteral(value: unknown): string | null {
  const hours = normalizeDecimal(value);
  return hours === null ? null : `${hours} hours`;
}

export function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export function normalizeJsonArray(value: unknown): unknown[] {
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

export function parsePagination(req: ApiRequest): { page: number; pageSize: number; start: number; end: number } {
  const pageRaw = Number(req.query.page || 1);
  const pageSizeRaw = Number(req.query.page_size || req.query.pageSize || 25);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Math.min(200, Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 25));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return { page, pageSize, start, end };
}

export function parseSort(req: ApiRequest): { sortBy: string; ascending: boolean } {
  const allowed = new Set([
    'created_at',
    'updated_at',
    'tt_sequence',
    'task_template_id',
    'ata_code',
    'reference_amp',
    'code_form_no',
    'category_code',
  ]);
  const requestedSort = String(req.query.sort_by || req.query.sortBy || 'created_at').trim();
  const sortBy = allowed.has(requestedSort) ? requestedSort : 'created_at';
  const ascending = String(req.query.sort_dir || req.query.sortDir || 'desc').trim().toLowerCase() === 'asc';
  return { sortBy, ascending };
}

export function parseExportRequested(req: ApiRequest): boolean {
  return String(req.query.export || '').trim().toLowerCase() === 'csv';
}

export function taskTemplateSelectColumns(
  sequenceColumn: TaskTemplateSequenceColumn,
  modelColumn: TaskTemplateModelColumn,
): string {
  void sequenceColumn;
  void modelColumn;
  return '*';
}

export function mapTaskTemplateRowToMpd(
  row: Record<string, unknown>,
  sequenceColumn: TaskTemplateSequenceColumn,
  modelColumn: TaskTemplateModelColumn,
): MpdRecord {
  return {
    id: String(row.id || '').trim(),
    mpd_sequence: normalizeInteger(row[sequenceColumn]),
    mpd_code: normalizeString(row.code_form_no),
    ata_code: normalizeString(row.ata_code),
    reference_amp: normalizeString(row.reference_amp),
    description: normalizeString(row.description),
    category_code: normalizeString(row.category_code),
    estimated_man_hours: parseHoursFromInterval(row.estimated_man_hours),
    revision_status: normalizeString(row.revision_status),
    interval_hours: parseHoursFromInterval(row.threshold_hours ?? row.interval_hours),
    interval_cycles: normalizeInteger(row.threshold_cycles ?? row.interval_cycles),
    interval_months: normalizeInteger(row.threshold_calendar ?? row.interval_months),
    is_mandatory: normalizeBoolean(row.is_mandatory, true),
    assembly_model_id: normalizeString(row[modelColumn]),
    task_template_detail_json: normalizeJsonArray(row.task_template_detail_json),
    task_template_scope_json: normalizeJsonArray(row.task_template_scope_json),
    tenant_id: String(row.tenant_id || '').trim(),
    franchise_id: normalizeString(row.franchise_id),
    created_at: normalizeString(row.created_at),
    updated_at: normalizeString(row.updated_at),
  };
}

export function mapMpdPayloadToTaskTemplateInput(
  payload: Record<string, unknown>,
  modelColumn: TaskTemplateModelColumn,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'mpd_code') || Object.prototype.hasOwnProperty.call(payload, 'code_form_no')) {
    row.code_form_no = normalizeString(payload.mpd_code ?? payload.code_form_no);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'ata_code')) {
    row.ata_code = normalizeString(payload.ata_code);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'reference_amp')) {
    row.reference_amp = normalizeString(payload.reference_amp);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    row.description = normalizeString(payload.description);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'category_code')) {
    row.category_code = normalizeString(payload.category_code);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'estimated_man_hours')) {
    row.estimated_man_hours = toIntervalLiteral(payload.estimated_man_hours);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'revision_status')) {
    row.revision_status = normalizeString(payload.revision_status);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'interval_hours')) {
    row.threshold_hours = toIntervalLiteral(payload.interval_hours);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'threshold_hours')) {
    row.threshold_hours = toIntervalLiteral(payload.threshold_hours);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'interval_cycles')) {
    row.threshold_cycles = normalizeInteger(payload.interval_cycles);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'threshold_cycles')) {
    row.threshold_cycles = normalizeInteger(payload.threshold_cycles);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'interval_months')) {
    row.threshold_calendar = normalizeInteger(payload.interval_months);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'threshold_calendar')) {
    row.threshold_calendar = normalizeInteger(payload.threshold_calendar);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'is_mandatory')) {
    row.is_mandatory = normalizeBoolean(payload.is_mandatory, true);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'assembly_model_id')
    || Object.prototype.hasOwnProperty.call(payload, 'assembly_models')
    || Object.prototype.hasOwnProperty.call(payload, 'model_id')
  ) {
    row[modelColumn] = normalizeString(payload.assembly_model_id ?? payload.assembly_models ?? payload.model_id);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'task_template_detail_json')) {
    row.task_template_detail_json = normalizeJsonArray(payload.task_template_detail_json);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'task_template_scope_json')) {
    row.task_template_scope_json = normalizeJsonArray(payload.task_template_scope_json);
  }

  return row;
}

export function validateMpdInput(payload: Record<string, unknown>, mode: 'create' | 'patch'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const description = normalizeString(payload.description);
  const ataCode = normalizeString(payload.ata_code);
  const referenceAmp = normalizeString(payload.reference_amp);
  const estimatedManHours = payload.estimated_man_hours;
  const intervalHours = payload.interval_hours;
  const intervalCycles = payload.interval_cycles;
  const intervalMonths = payload.interval_months;
  const assemblyModelId = normalizeString(payload.assembly_model_id ?? payload.assembly_models ?? payload.model_id);

  if (mode === 'create') {
    if (!description) issues.push({ field: 'description', message: 'description is required' });
    if (!ataCode) issues.push({ field: 'ata_code', message: 'ata_code is required' });
  }

  if (estimatedManHours !== undefined && estimatedManHours !== null && estimatedManHours !== '' && normalizeDecimal(estimatedManHours) === null) {
    issues.push({ field: 'estimated_man_hours', message: 'estimated_man_hours must be a valid number' });
  }
  if (intervalHours !== undefined && intervalHours !== null && intervalHours !== '' && normalizeDecimal(intervalHours) === null) {
    issues.push({ field: 'interval_hours', message: 'interval_hours must be a valid number' });
  }
  if (intervalCycles !== undefined && intervalCycles !== null && intervalCycles !== '' && normalizeInteger(intervalCycles) === null) {
    issues.push({ field: 'interval_cycles', message: 'interval_cycles must be an integer' });
  }
  if (intervalMonths !== undefined && intervalMonths !== null && intervalMonths !== '' && normalizeInteger(intervalMonths) === null) {
    issues.push({ field: 'interval_months', message: 'interval_months must be an integer' });
  }

  const intervalValues = [
    normalizeDecimal(intervalHours),
    normalizeInteger(intervalCycles),
    normalizeInteger(intervalMonths),
  ].filter((value): value is number => value !== null);
  if (intervalValues.some((value) => value < 0)) {
    issues.push({ field: 'interval', message: 'interval values must be non-negative' });
  }

  if (estimatedManHours !== undefined && normalizeDecimal(estimatedManHours) !== null && (normalizeDecimal(estimatedManHours) as number) < 0) {
    issues.push({ field: 'estimated_man_hours', message: 'estimated_man_hours must be non-negative' });
  }

  if (assemblyModelId && !isUuid(assemblyModelId)) {
    issues.push({ field: 'assembly_model_id', message: 'assembly_model_id must be a valid UUID' });
  }

  if (referenceAmp && referenceAmp.length > 100) {
    issues.push({ field: 'reference_amp', message: 'reference_amp cannot exceed 100 characters' });
  }
  if (ataCode && ataCode.length > 10) {
    issues.push({ field: 'ata_code', message: 'ata_code cannot exceed 10 characters' });
  }

  return issues;
}

export function buildCsv(records: MpdRecord[]): string {
  const headers = [
    'id',
    'mpd_sequence',
    'mpd_code',
    'ata_code',
    'reference_amp',
    'description',
    'category_code',
    'estimated_man_hours',
    'revision_status',
    'interval_hours',
    'interval_cycles',
    'interval_months',
    'is_mandatory',
    'assembly_model_id',
    'created_at',
    'updated_at',
  ];

  const escapeCsv = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [headers.join(',')];
  for (const record of records) {
    lines.push([
      record.id,
      record.mpd_sequence,
      record.mpd_code,
      record.ata_code,
      record.reference_amp,
      record.description,
      record.category_code,
      record.estimated_man_hours,
      record.revision_status,
      record.interval_hours,
      record.interval_cycles,
      record.interval_months,
      record.is_mandatory,
      record.assembly_model_id,
      record.created_at,
      record.updated_at,
    ].map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

type FallbackQueryResult<TData> = {
  data: TData | null;
  error: { message?: string } | null;
  count?: number | null;
};

export async function parseTaskTemplateRowsWithFallback<TData>(
  executor: (
    sequenceColumn: TaskTemplateSequenceColumn,
    modelColumn: TaskTemplateModelColumn,
  ) => Promise<FallbackQueryResult<TData>>,
): Promise<FallbackQueryResult<TData> & {
  sequenceColumn: TaskTemplateSequenceColumn;
  modelColumn: TaskTemplateModelColumn;
}> {
  const candidates: Array<{ sequenceColumn: TaskTemplateSequenceColumn; modelColumn: TaskTemplateModelColumn }> = [
    { sequenceColumn: 'tt_sequence', modelColumn: 'assembly_models' },
    { sequenceColumn: 'tt_sequence', modelColumn: 'model_id' },
    { sequenceColumn: 'task_template_id', modelColumn: 'assembly_models' },
    { sequenceColumn: 'task_template_id', modelColumn: 'model_id' },
  ];

  let lastResult: FallbackQueryResult<TData> | null = null;
  let lastColumns = candidates[0];

  for (const candidate of candidates) {
    const result = await executor(candidate.sequenceColumn, candidate.modelColumn);
    lastResult = result;
    lastColumns = candidate;
    if (!result.error) {
      return { ...result, ...candidate };
    }
    const missingSequence = isMissingColumnError(result.error, candidate.sequenceColumn);
    const missingModel = isMissingColumnError(result.error, candidate.modelColumn);
    if (!missingSequence && !missingModel) {
      return { ...result, ...candidate };
    }
  }

  return {
    ...(lastResult || { data: null, error: { message: 'Unable to resolve task_templates schema columns' }, count: 0 }),
    ...lastColumns,
  };
}

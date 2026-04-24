import type { ApiRequest } from '../../../_utils/types';

export type DirectiveRecord = {
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
  threshold_cycles: number | null;
  is_mandatory: boolean;
  assembly_model_id: string | null;
  directives_type_id: string | null;
  directives_type_label: string | null;
  loc_json: unknown[];
  other_details_json: unknown[];
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
  const pageSize = Math.min(500, Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 25));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return { page, pageSize, start, end };
}

export function parseSort(req: ApiRequest): { sortBy: string; ascending: boolean } {
  const allowed = new Set([
    'created_at',
    'updated_at',
    'directive_sequence',
    'ata_code',
    'reference_amp',
    'code_form_no',
    'category_code',
    'is_mandatory',
  ]);
  const requestedSort = String(req.query.sort_by || req.query.sortBy || 'created_at').trim();
  const sortBy = allowed.has(requestedSort) ? requestedSort : 'created_at';
  const ascending = String(req.query.sort_dir || req.query.sortDir || 'desc').trim().toLowerCase() === 'asc';
  return { sortBy, ascending };
}

export function parseExportRequested(req: ApiRequest): boolean {
  return String(req.query.export || '').trim().toLowerCase() === 'csv';
}

function intervalToHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value);
  const text = String(value).trim();
  if (!text) return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

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

function toIntervalLiteral(hoursValue: unknown): string | null {
  const hours = normalizeDecimal(hoursValue);
  if (hours === null) return null;
  return `${hours} hours`;
}

export const directiveSelectColumns = [
  'id',
  'tenant_id',
  'franchise_id',
  'directive_sequence',
  'code_form_no',
  'ata_code',
  'reference_amp',
  'description',
  'category_code',
  'estimated_man_hours',
  'revision_status',
  'threshold_hours',
  'threshold_cycles',
  'threshold_calendar',
  'calendar_unit',
  'threshold_landings',
  'is_mandatory',
  'assembly_models',
  'directives_type_id',
  'location_json',
  'other_details_json',
  'directive_detail_json',
  'directive_scope_json',
  'created_at',
  'updated_at',
].join(',');

export function mapDirectiveRowToRecord(
  row: Record<string, unknown>,
  directiveTypeLabelById?: Map<string, string>,
): DirectiveRecord {
  const directiveTypeId = normalizeString(row.directives_type_id);
  return {
    id: String(row.id || '').trim(),
    mpd_sequence: normalizeInteger(row.directive_sequence),
    mpd_code: normalizeString(row.code_form_no),
    ata_code: normalizeString(row.ata_code),
    reference_amp: normalizeString(row.reference_amp),
    description: normalizeString(row.description),
    category_code: normalizeString(row.category_code),
    estimated_man_hours: intervalToHours(row.estimated_man_hours),
    revision_status: normalizeString(row.revision_status),
    interval_hours: intervalToHours(row.threshold_hours),
    interval_cycles: normalizeInteger(row.threshold_cycles),
    interval_months: normalizeInteger(row.threshold_calendar),
    threshold_cycles: normalizeInteger(row.threshold_landings),
    is_mandatory: normalizeBoolean(row.is_mandatory, true),
    assembly_model_id: normalizeString(row.assembly_models),
    directives_type_id: directiveTypeId,
    directives_type_label: directiveTypeId ? (directiveTypeLabelById?.get(directiveTypeId) || null) : null,
    loc_json: normalizeJsonArray(row.location_json),
    other_details_json: normalizeJsonArray(row.other_details_json),
    task_template_detail_json: normalizeJsonArray(row.directive_detail_json),
    task_template_scope_json: normalizeJsonArray(row.directive_scope_json),
    tenant_id: String(row.tenant_id || '').trim(),
    franchise_id: normalizeString(row.franchise_id),
    created_at: normalizeString(row.created_at),
    updated_at: normalizeString(row.updated_at),
  };
}

export function mapPayloadToDirectiveInput(payload: Record<string, unknown>): Record<string, unknown> {
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
  if (Object.prototype.hasOwnProperty.call(payload, 'interval_cycles')) {
    row.threshold_cycles = normalizeInteger(payload.interval_cycles);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'interval_months')) {
    const months = normalizeInteger(payload.interval_months);
    row.threshold_calendar = months;
    row.calendar_unit = months === null ? null : 'Mt';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'threshold_cycles')) {
    row.threshold_landings = normalizeInteger(payload.threshold_cycles);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'is_mandatory')) {
    row.is_mandatory = normalizeBoolean(payload.is_mandatory, true);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'assembly_model_id')
    || Object.prototype.hasOwnProperty.call(payload, 'assembly_models')
    || Object.prototype.hasOwnProperty.call(payload, 'model_id')
  ) {
    row.assembly_models = normalizeString(payload.assembly_model_id ?? payload.assembly_models ?? payload.model_id);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'directives_type_id')) {
    row.directives_type_id = normalizeString(payload.directives_type_id);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'loc_json')) {
    row.location_json = normalizeJsonArray(payload.loc_json);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'other_details_json')) {
    row.other_details_json = normalizeJsonArray(payload.other_details_json);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'task_template_detail_json')) {
    row.directive_detail_json = normalizeJsonArray(payload.task_template_detail_json);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'task_template_scope_json')) {
    row.directive_scope_json = normalizeJsonArray(payload.task_template_scope_json);
  }

  return row;
}

export function validateDirectiveInput(payload: Record<string, unknown>, mode: 'create' | 'patch'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const description = normalizeString(payload.description);
  const ataCode = normalizeString(payload.ata_code);
  const referenceAmp = normalizeString(payload.reference_amp);
  const estimatedManHours = payload.estimated_man_hours;
  const intervalHours = payload.interval_hours;
  const intervalCycles = payload.interval_cycles;
  const intervalMonths = payload.interval_months;
  const thresholdCycles = payload.threshold_cycles;
  const assemblyModelId = normalizeString(payload.assembly_model_id ?? payload.assembly_models ?? payload.model_id);
  const directivesTypeId = normalizeString(payload.directives_type_id);

  if (mode === 'create') {
    if (!description) issues.push({ field: 'description', message: 'description is required' });
    if (!ataCode) issues.push({ field: 'ata_code', message: 'ata_code is required' });
  }

  if (estimatedManHours !== undefined && estimatedManHours !== null && estimatedManHours !== '' && normalizeDecimal(estimatedManHours) === null) {
    issues.push({ field: 'estimated_man_hours', message: 'estimated_man_hours must be a valid number' });
  }
  if (intervalHours !== undefined && intervalHours !== null && intervalHours !== '' && normalizeDecimal(intervalHours) === null) {
    issues.push({ field: 'interval_hours', message: 'interval_hours must be a number' });
  }
  if (intervalCycles !== undefined && intervalCycles !== null && intervalCycles !== '' && normalizeInteger(intervalCycles) === null) {
    issues.push({ field: 'interval_cycles', message: 'interval_cycles must be an integer' });
  }
  if (intervalMonths !== undefined && intervalMonths !== null && intervalMonths !== '' && normalizeInteger(intervalMonths) === null) {
    issues.push({ field: 'interval_months', message: 'interval_months must be an integer' });
  }
  if (thresholdCycles !== undefined && thresholdCycles !== null && thresholdCycles !== '' && normalizeInteger(thresholdCycles) === null) {
    issues.push({ field: 'threshold_cycles', message: 'threshold_cycles must be an integer' });
  }

  const intervalValues = [
    normalizeDecimal(intervalHours),
    normalizeInteger(intervalCycles),
    normalizeInteger(intervalMonths),
    normalizeInteger(thresholdCycles),
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
  if (directivesTypeId && !isUuid(directivesTypeId)) {
    issues.push({ field: 'directives_type_id', message: 'directives_type_id must be a valid UUID' });
  }

  if (referenceAmp && referenceAmp.length > 100) {
    issues.push({ field: 'reference_amp', message: 'reference_amp cannot exceed 100 characters' });
  }
  if (ataCode && ataCode.length > 10) {
    issues.push({ field: 'ata_code', message: 'ata_code cannot exceed 10 characters' });
  }

  return issues;
}

export function buildCsv(records: DirectiveRecord[]): string {
  const headers = [
    'id',
    'directive_sequence',
    'code_form_no',
    'ata_code',
    'reference_amp',
    'description',
    'category_code',
    'estimated_man_hours',
    'revision_status',
    'threshold_hours',
    'threshold_cycles',
    'threshold_calendar',
    'threshold_landings',
    'is_mandatory',
    'assembly_models',
    'directives_type_id',
    'directives_type_label',
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
      record.threshold_cycles,
      record.is_mandatory,
      record.assembly_model_id,
      record.directives_type_id,
      record.directives_type_label,
      record.created_at,
      record.updated_at,
    ].map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

// Phase 8h.1 — pure helpers extracted from AmroSettingsMasterDataPage.tsx.
// Behavior-preserving lift: the page got too large to maintain (10K LOC),
// and these helpers are pure data-shaping functions with no React deps,
// so they belong outside the page module. Each function's logic is
// unchanged from its prior home in AmroSettingsMasterDataPage.tsx.

import { UUID_PATTERN } from '../amroSettingsMasterDataConstants';
import type { AircraftTemplateRecord } from './services';
import type { RecordRow } from './types';
import { getPayloadRecords } from './utils';

// ── Types lifted from the page module ─────────────────────────────────

export type AircraftTemplateModelJsonDetails = {
  assemblyModelId: string;
  assemblyModelName: string;
  manufacturerId: string;
  manufacturerName: string;
  aircraftCategoryName: string;
};

export type AircraftTemplateFormValues = {
  template_name: string;
  aircraft_type: string;
  manufacturer: string;
  manufacturer_id: string;
  aircraft_model: string;
  maintenance_program: string;
  revision_number: string;
  amendment_number: string;
};

export type AircraftWorkOrderTaskListItem = {
  id: string;
  taskNumber: string;
  ataCode: string;
  serialNumber: string;
  partNumber: string;
  description: string;
  status: string;
  selectable: boolean;
  source: 'template' | 'existing_wp' | 'scope' | 'selected';
  parentWorkOrderId?: string;
  parentWorkOrderNumber?: string;
};

export type AircraftWorkOrderRecordSummary = {
  id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  maintenanceType: string;
  priority: string;
  station: string;
  updatedAt: string;
  tasks: AircraftWorkOrderTaskListItem[];
};

// ── Primitive coercers ────────────────────────────────────────────────

export const parseBooleanLike = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'on';
};

export const isUuidLike = (value: string): boolean => UUID_PATTERN.test(value.trim());

export const isSystemSelectValue = (value: string): boolean => value.startsWith('__');

export const parseJsonObjectLike = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
};

export const coerceRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
      }
      if (parsed && typeof parsed === 'object') {
        return [parsed as Record<string, unknown>];
      }
      return [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    return [value as Record<string, unknown>];
  }
  return [];
};

export const extractJoinedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    const first = value.find((entry) => Boolean(entry) && typeof entry === 'object');
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

// ── Aircraft template helpers ─────────────────────────────────────────

export const parseAircraftTemplateModelJson = (source: unknown): AircraftTemplateModelJsonDetails | null => {
  let parsed: unknown = source;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (Array.isArray(parsed)) {
    parsed = parsed.find((entry) => Boolean(entry) && typeof entry === 'object') || null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedTextByKey = new Map<string, string>();
  Object.entries(record).forEach(([key, value]) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    const normalizedKey = normalizeKey(key);
    if (!normalizedTextByKey.has(normalizedKey)) {
      normalizedTextByKey.set(normalizedKey, text);
    }
  });
  const readText = (keys: string[]): string => {
    for (const key of keys) {
      const directValue = String(record[key] ?? '').trim();
      if (directValue) {
        return directValue;
      }
      const normalizedValue = normalizedTextByKey.get(normalizeKey(key));
      if (normalizedValue) {
        return normalizedValue;
      }
    }
    return '';
  };
  const details: AircraftTemplateModelJsonDetails = {
    assemblyModelId: readText(['assembly_model_id', 'assemblyModelId', 'assembly_models']),
    assemblyModelName: readText(['assembly_model_name', 'assemblyModelName', 'model', 'aircraft_model', 'name']),
    manufacturerId: readText(['manufacturer_id', 'manufacturerId']),
    manufacturerName: readText(['manufacturer_name', 'manufacturerName', 'Manufacturer Name', 'manufacturer', 'Manufacturer']),
    aircraftCategoryName: readText([
      'aircraft_categorie_name',
      'aircraft_category_name',
      'aircraftCategoryName',
      'category_name',
      'category',
      'Category',
      'aircraft_type',
      'aircraftType',
    ]),
  };
  if (
    !details.assemblyModelId
    && !details.assemblyModelName
    && !details.manufacturerId
    && !details.manufacturerName
    && !details.aircraftCategoryName
  ) {
    return null;
  }
  return details;
};

export const parseAircraftTemplateRecordDetails = (record: Record<string, unknown> | null | undefined): AircraftTemplateModelJsonDetails | null => {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const fromJson = parseAircraftTemplateModelJson(record.model_json);
  const readText = (keys: string[]): string => {
    for (const key of keys) {
      const value = String(record[key] ?? '').trim();
      if (value) {
        return value;
      }
    }
    return '';
  };
  const merged: AircraftTemplateModelJsonDetails = {
    assemblyModelId: fromJson?.assemblyModelId || readText(['assembly_models', 'assembly_model_id']),
    assemblyModelName: fromJson?.assemblyModelName || readText(['aircraft_model', 'model', 'name', 'assembly_model_name']),
    manufacturerId: fromJson?.manufacturerId || readText(['manufacturer_id']),
    manufacturerName: fromJson?.manufacturerName || readText(['manufacturer', 'manufacturer_name', 'Manufacturer Name']),
    // Category must come from aircraft_template.model_json only.
    aircraftCategoryName: fromJson?.aircraftCategoryName || '',
  };
  if (
    !merged.assemblyModelId
    && !merged.assemblyModelName
    && !merged.manufacturerId
    && !merged.manufacturerName
    && !merged.aircraftCategoryName
  ) {
    return null;
  }
  return merged;
};

export const buildAircraftWarrantyJson = (values: Record<string, unknown>): Record<string, unknown> => {
  const normalizedStartDate = String(values.warranty_start_date ?? '').trim();
  const normalizedEndDate = String(values.warranty_end_date ?? '').trim();
  return {
    is_under_warranty: parseBooleanLike(values.is_under_warranty),
    warranty_start_date: /^\d{4}-\d{2}-\d{2}$/.test(normalizedStartDate) ? normalizedStartDate : '',
    warranty_end_date: /^\d{4}-\d{2}-\d{2}$/.test(normalizedEndDate) ? normalizedEndDate : '',
  };
};

export const buildAircraftWeightAndCapacityJson = (values: Record<string, unknown>): Record<string, unknown> => {
  const weightKeys = [
    'empty_weight',
    'all_up_weight',
    'gross_payload',
    'taxi_weight',
    'takeoff_weight',
    'zero_fuel_weight',
    'landing_weight',
    'fuel_capacity',
  ] as const;
  return weightKeys.reduce<Record<string, unknown>>((accumulator, key) => {
    const rawValue = String(values[key] ?? '').trim();
    const rawUnit = String(values[`${key}_unit`] ?? '').trim();
    accumulator[key] = rawValue;
    accumulator[`${key}_unit`] = rawUnit;
    return accumulator;
  }, {});
};

export const buildAircraftOtherDetailsJson = (values: Record<string, unknown>): Record<string, unknown> => ({
  is_not_in_use: parseBooleanLike(values.is_not_in_use),
  not_in_use_date: /^\d{4}-\d{2}-\d{2}$/.test(String(values.not_in_use_date ?? '').trim()) ? String(values.not_in_use_date ?? '').trim() : '',
  is_readonly: parseBooleanLike(values.is_readonly),
  readonly_date: /^\d{4}-\d{2}-\d{2}$/.test(String(values.readonly_date ?? '').trim()) ? String(values.readonly_date ?? '').trim() : '',
  is_flight_log_under_utc: parseBooleanLike(values.is_flight_log_under_utc),
});

export const getDefaultAircraftTemplateFormValues = (): AircraftTemplateFormValues => ({
  template_name: '',
  aircraft_type: '',
  manufacturer: '',
  manufacturer_id: '',
  aircraft_model: '',
  maintenance_program: '',
  revision_number: '',
  amendment_number: '',
});

export const mapAircraftTemplateRecordToFormValues = (record: AircraftTemplateRecord): AircraftTemplateFormValues => ({
  template_name: String(record.template_name || '').trim(),
  aircraft_type: String(record.aircraft_type || '').trim(),
  manufacturer: String(record.manufacturer || '').trim(),
  manufacturer_id: String(record.manufacturer_id || '').trim(),
  aircraft_model: String(record.aircraft_model || '').trim(),
  maintenance_program: String(record.maintenance_program || '').trim(),
  revision_number: String(record.revision_number || '').trim(),
  amendment_number: String(record.amendment_number || '').trim(),
});

// ── Work order helpers ────────────────────────────────────────────────

export const resolveWorkOrderApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  const normalized = String((error as Error)?.message || '').trim();
  if ((error as Error)?.name === 'AbortError') {
    return 'Request timed out. Please check your connection and retry.';
  }
  if (normalized.toLowerCase() === 'failed to fetch') {
    return 'Network error. Verify connectivity and try again.';
  }
  return normalized || fallbackMessage;
};

export const normalizeWorkOrderTaskStatus = (value: unknown): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'pending';
  return normalized;
};

export const isTaskNonPerformedStatus = (value: unknown): boolean => {
  const normalized = normalizeWorkOrderTaskStatus(value);
  return !(
    normalized.includes('completed')
    || normalized.includes('performed')
    || normalized.includes('closed')
    || normalized.includes('done')
  );
};

export const extractTemplateRegistryRecords = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : null;
  const outputData = output?.data && typeof output.data === 'object' ? (output.data as Record<string, unknown>) : null;
  const candidateArrays: unknown[] = [
    output?.records,
    output?.items,
    output?.templates,
    outputData?.records,
    outputData?.items,
    outputData?.templates,
    payload.records,
    payload.items,
    payload.templates,
  ];
  for (const candidate of candidateArrays) {
    const rows = coerceRecordArray(candidate);
    if (rows.length > 0) {
      return rows;
    }
  }
  const stack: unknown[] = [payload];
  const visited = new Set<unknown>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) {
      continue;
    }
    visited.add(current);
    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }
    const record = current as Record<string, unknown>;
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        const rows = coerceRecordArray(value);
        if (
          rows.length > 0
          && rows.some((row) =>
            Boolean(
              row.id
              || row.template_id
              || row.template_code
              || row.template_name
              || row.tasks_json
              || row.scope_json,
            ))
        ) {
          return rows;
        }
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return getPayloadRecords(payload);
};

export const normalizeWorkOrderRecordSummary = (record: Record<string, unknown>): AircraftWorkOrderRecordSummary | null => {
  const id = String(record.id || record.work_order_id || '').trim();
  if (!id) {
    return null;
  }
  const workOrderNumber = String(record.work_order_number || record.work_order_number || record.package_number || '').trim() || id;
  const title = String(record.title || record.topic || workOrderNumber).trim() || workOrderNumber;
  const status = String(record.status || record.lifecycle_stage || 'planning').trim() || 'planning';
  const maintenanceType = String(record.maintenance_type || record.type || 'line').trim() || 'line';
  const priority = String(record.priority || 'medium').trim() || 'medium';
  const station = String(record.station || record.station_code || '').trim();
  const updatedAt = String(record.updated_at || record.modified_at || record.created_at || '').trim();
  const selectedTask = record.selected_task && typeof record.selected_task === 'object' ? (record.selected_task as Record<string, unknown>) : null;
  const taskSnapshotRows = coerceRecordArray(record.task_snapshot);
  const scopeRows = coerceRecordArray(record.scope_items).map((row, index) => ({
    id: `scope-${id}-${index + 1}`,
    task_number: String(row.task_number || row.taskNumber || `SCOPE-${index + 1}`),
    ata_code: String(row.ata_code || row.ataCode || selectedTask?.ata_code || ''),
    serial_number: String(row.serial_number || row.serialNumber || selectedTask?.serial_number || ''),
    part_number: String(row.part_number || row.partNumber || selectedTask?.part_number || ''),
    description: String(row.description || row.title || row.name || ''),
    status: String(row.status || 'pending'),
  }));
  const taskRows = [...taskSnapshotRows, ...scopeRows];
  if (selectedTask) {
    taskRows.push({
      id: `selected-${id}`,
      task_number: String(selectedTask.task_number || ''),
      ata_code: String(selectedTask.ata_code || ''),
      serial_number: String(selectedTask.serial_number || ''),
      part_number: String(selectedTask.part_number || ''),
      description: String(selectedTask.description || ''),
      status: String(selectedTask.status || 'pending'),
    });
  }
  const normalizedTasks = taskRows
    .map((task, index): AircraftWorkOrderTaskListItem => {
      const taskRecord = task as Record<string, unknown>;
      const taskNumber = String(taskRecord.task_number || taskRecord['taskNumber'] || `TASK-${index + 1}`).trim() || `TASK-${index + 1}`;
      const ataCode = String(taskRecord.ata_code || taskRecord['ataCode'] || '').trim();
      const serialNumber = String(taskRecord.serial_number || taskRecord['serialNumber'] || '').trim();
      const partNumber = String(taskRecord.part_number || taskRecord['partNumber'] || '').trim();
      const description = String(taskRecord.description || taskRecord['title'] || taskRecord['name'] || '').trim();
      const taskStatus = normalizeWorkOrderTaskStatus(taskRecord.status || status);
      const source: AircraftWorkOrderTaskListItem['source'] = String(taskRecord.id || '').startsWith('scope-') ? 'scope' : 'existing_wp';
      return {
        id: `existing-${id}-${index + 1}-${taskNumber}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        taskNumber,
        ataCode,
        serialNumber,
        partNumber,
        description,
        status: taskStatus,
        selectable: true,
        source,
        parentWorkOrderId: id,
        parentWorkOrderNumber: workOrderNumber,
      };
    })
    .filter((task) => Boolean(task.description) || Boolean(task.taskNumber));
  return {
    id,
    workOrderNumber,
    title,
    status,
    maintenanceType,
    priority,
    station,
    updatedAt,
    tasks: normalizedTasks,
  };
};

// ── Flight log helpers ────────────────────────────────────────────────

export const formatAirportLabel = (record: Record<string, unknown> | null, fallback: string): string => {
  if (!record) return fallback;
  const name = String(record.name || '').trim();
  const code = String(record.icao_code || '').trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return fallback;
};

export const resolveFlightLogAircraftLabel = (row: RecordRow): string => {
  const ref = extractJoinedRecord(row.aircraft_ref);
  const refRegistration = String(ref?.registration || ref?.tail_number || '').trim();
  return String(row.aircraft_label || row.aircraft_registration || refRegistration || row.aircraft_id || '');
};

export const resolveFlightLogAirportLabel = (
  row: RecordRow,
  labelKey: 'departure_airport_label' | 'arrival_airport_label',
  refKey: 'departure_airport_ref' | 'arrival_airport_ref',
  fallbackKey: 'departure_airport' | 'arrival_airport',
): string => {
  const explicitLabel = String(row[labelKey] || '').trim();
  if (explicitLabel) return explicitLabel;
  const ref = extractJoinedRecord(row[refKey]);
  const fallback = String(row[fallbackKey] || '');
  return formatAirportLabel(ref, fallback);
};

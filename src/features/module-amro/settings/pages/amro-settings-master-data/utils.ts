import type {
  AircraftPresenceCollaborator,
  AircraftWorkPackageFormValues,
  AircraftWorkPackageSnapshot,
  EntityFormField,
  FormValues,
  MasterEntity,
  RecordRow,
} from './types';
import {
  AIRCRAFT_PRESENCE_BADGE_CLASSES,
  AIRCRAFT_STATUS_OPTIONS,
  AIRCRAFT_TYPE_OPTIONS,
  ENTITY_DEFAULT_VALUES,
  ENTITY_FORM_FIELDS,
  MANUFACTURER_SEED_NAMES,
} from './constants';

export function getPayloadRecords(payload: Record<string, unknown>): RecordRow[] {
  const output = payload.output;
  if (!output || typeof output !== 'object') {
    return [];
  }
  const outputRecord = output as Record<string, unknown>;
  const outputRecords = outputRecord.records;
  if (!Array.isArray(outputRecords)) {
    return [];
  }
  return outputRecords.filter((record): record is RecordRow => Boolean(record) && typeof record === 'object');
}

export function getPayloadImportedCount(payload: Record<string, unknown>): number {
  const output = payload.output;
  if (!output || typeof output !== 'object') {
    return 0;
  }
  const outputRecord = output as Record<string, unknown>;
  const count = Number(outputRecord.imported_count);
  return Number.isFinite(count) ? count : 0;
}

export function createRowsRenderSignature(rows: RecordRow[]): string {
  return rows
    .map((row) =>
      Object.entries(row)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => {
          if (value === null || value === undefined) {
            return `${key}:`;
          }
          if (typeof value === 'object') {
            return `${key}:${JSON.stringify(value)}`;
          }
          return `${key}:${String(value)}`;
        })
        .join('|'),
    )
    .join('||');
}

export function createSeedRecords(entity: MasterEntity): Record<string, unknown>[] {
  if (entity === 'regulator_profiles') {
    return [
      {
        regulator_code: 'FAA',
        regulator_name: 'Federal Aviation Administration',
        jurisdiction: 'US',
        policy_version: '2026.1',
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: null,
        is_active: true,
        metadata: { authority_scope: 'airworthiness', priority: 'high', source: 'master_data_seed_ui' },
      },
      {
        regulator_code: 'EASA',
        regulator_name: 'European Union Aviation Safety Agency',
        jurisdiction: 'EU',
        policy_version: '2026.2',
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: null,
        is_active: true,
        metadata: { authority_scope: 'continuing_airworthiness', priority: 'high', source: 'master_data_seed_ui' },
      },
    ];
  }
  if (entity === 'shift_calendars') {
    return [
      {
        station_code: 'DXB',
        shift_name: 'DAY_A',
        shift_start_time: '06:00:00',
        shift_end_time: '14:00:00',
        capacity: 6,
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: null,
        is_active: true,
      },
      {
        station_code: 'DXB',
        shift_name: 'SWING_B',
        shift_start_time: '14:00:00',
        shift_end_time: '22:00:00',
        capacity: 5,
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: null,
        is_active: true,
      },
    ];
  }
  if (entity === 'work_package_templates') {
    return [
      {
        template_code: 'TMP-A320-LINE-48H',
        version: 1,
        active: true,
        template_name: 'A320 48H Transit Check',
        maintenance_type: 'line',
        scope_json: [
          { phase: 'pre_docking', estimated_minutes: 45, station_scope: 'gate' },
          { phase: 'inspection', estimated_minutes: 120, regulators: ['FAA', 'EASA'] },
          { phase: 'close_out', estimated_minutes: 35, requires_authority_signoff: true },
        ],
        tasks_json: [
          { task_code: 'LINE-001', title: 'Exterior Walkaround', skill_codes: ['LIC-B1'], critical: true },
          { task_code: 'LINE-014', title: 'Brake Wear Inspection', skill_codes: ['LIC-B1', 'NDT-L1'], critical: true },
        ],
      },
      {
        template_code: 'TMP-HEAVY-CHECK-PLANNING',
        version: 2,
        active: true,
        template_name: 'Base Heavy Check Planning Pack',
        maintenance_type: 'base',
        scope_json: [
          { phase: 'slotting', estimated_minutes: 90, depends_on: ['manpower_forecast', 'dock_availability'] },
          { phase: 'material_readiness', estimated_minutes: 240, requires_procurement_sync: true },
        ],
        tasks_json: [
          { task_code: 'BASE-010', title: 'Structural Inspection Program', skill_codes: ['STRUCT-L2'], critical: true },
          { task_code: 'BASE-121', title: 'Cabin Systems Functional Tests', skill_codes: ['AVIONICS-L2'], critical: false },
        ],
      },
    ];
  }
  if (entity === 'manufacturers') {
    const seen = new Set<string>();
    const records = MANUFACTURER_SEED_NAMES
      .map((name) => {
        const normalized = name.trim().toLowerCase();
        if (!normalized || seen.has(normalized)) {
          return null;
        }
        seen.add(normalized);
        const token = normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 18);
        let hash = 0;
        for (let index = 0; index < normalized.length; index += 1) {
          hash = (hash << 5) - hash + normalized.charCodeAt(index);
          hash |= 0;
        }
        const suffix = Math.abs(hash).toString(16).slice(0, 4);
        return {
          manufacturer_code: `${token}-${suffix}`,
          name,
          is_active: true,
          metadata: { source: 'master_data_seed_ui' },
        };
      })
      .filter(
        (record): record is { manufacturer_code: string; name: string; is_active: boolean; metadata: { source: string } } =>
          Boolean(record),
      );
    return records as Record<string, unknown>[];
  }
  return [];
}

export function createDefaultBulkText(entity: MasterEntity): string {
  const seedRecords = createSeedRecords(entity);
  if (seedRecords.length > 0) {
    return JSON.stringify(seedRecords, null, 2);
  }
  return '[\n  {}\n]';
}

export function normalizeFeatureFlag(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
  return fallback;
}

export function toDateTimeInputValue(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function getDefaultAircraftWorkPackageValues(stationHint?: string): AircraftWorkPackageFormValues {
  const now = new Date();
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const nowDate = now.toISOString().slice(0, 10);
  return {
    source: 'schedule_due',
    maintenanceType: 'line',
    priority: 'medium',
    status: 'planning',
    validationState: 'pending',
    plannedStart: toDateTimeInputValue(now),
    plannedEnd: toDateTimeInputValue(end),
    station: stationHint || '',
    workPackageNumber: '',
    topic: '',
    ttafHours: '',
    openingDate: nowDate,
    revisionNumber: '',
    revisionDate: nowDate,
    transmissionDate: nowDate,
    maintenanceReleaseDate: nowDate,
    workReportNumber: '',
    expectedReceptionDate: nowDate,
    workReceptionDate: nowDate,
    comments: '',
    selectedTaskNumber: '',
    selectedTaskAtaCode: '',
    selectedTaskSerialNumber: '',
    selectedTaskPartNumber: '',
    selectedTaskDescription: '',
    scopeItemsText: 'General inspection',
  };
}

export function parseWorkPackageItems(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = payload.data;
  if (data && typeof data === 'object') {
    const workPackages = (data as Record<string, unknown>).workPackages;
    if (Array.isArray(workPackages)) {
      return workPackages.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
    }
  }
  const items = payload.items;
  if (Array.isArray(items)) {
    return items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }
  return getPayloadRecords(payload);
}

function parseJsonLikeValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  const parsed = parseJsonLikeValue(value);
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed as Record<string, unknown>];
  }
  return [];
}

function readTemplateTextCandidate(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(record[key] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

export function normalizeTemplateScopeItems(scopeSource: unknown): string[] {
  const scopeRows = toRecordArray(scopeSource);
  const items = scopeRows
    .map((row) => readTemplateTextCandidate(row, ['description', 'title', 'phase', 'task', 'name']))
    .filter(Boolean);
  return Array.from(new Set(items));
}

export function normalizeTemplateTaskRows(tasksSource: unknown): Array<{
  taskNumber: string;
  ataCode: string;
  serialNumber: string;
  partNumber: string;
  description: string;
}> {
  return toRecordArray(tasksSource).map((row, index) => ({
    taskNumber: readTemplateTextCandidate(row, ['task_number', 'taskNumber', 'task_code', 'code']) || `TASK-${index + 1}`,
    ataCode: readTemplateTextCandidate(row, ['ata_code', 'ataCode']) || '05-20-TIME LIMITS/MAINTENANCE CHECKS',
    serialNumber: readTemplateTextCandidate(row, ['serial_number', 'serialNumber']),
    partNumber: readTemplateTextCandidate(row, ['part_number', 'partNumber']),
    description: readTemplateTextCandidate(row, ['description', 'title', 'task', 'phase']),
  }));
}

export function buildAircraftWorkPackageSnapshot(items: Record<string, unknown>[]): AircraftWorkPackageSnapshot {
  let open = 0;
  let inProgress = 0;
  let deferred = 0;
  let completed = 0;

  items.forEach((item) => {
    const status = String(item.status || item.lifecycle_stage || '').trim().toLowerCase();
    if (status.includes('defer')) {
      deferred += 1;
      return;
    }
    if (status.includes('progress') || status.includes('wip') || status.includes('execution')) {
      inProgress += 1;
      return;
    }
    if (status.includes('complete') || status.includes('closed') || status.includes('rts')) {
      completed += 1;
      return;
    }
    open += 1;
  });

  const rtsBlockers = deferred;
  const slaRisk = items.filter((item) => String(item.priority || '').toLowerCase() === 'critical').length;
  return { open, inProgress, deferred, completed, rtsBlockers, slaRisk };
}

export function getInitialFormValues(entity: MasterEntity): FormValues {
  return { ...ENTITY_DEFAULT_VALUES[entity] };
}

function getInitials(value: string): string {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return 'NA';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
}

function deriveRoleFromNameToken(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized.startsWith('captain')) return 'Captain';
  if (normalized.startsWith('fo ') || normalized.startsWith('first officer')) return 'First Officer';
  if (normalized.startsWith('engineer')) return 'Engineer';
  if (normalized.startsWith('inspector')) return 'Inspector';
  return 'Crew';
}

function extractCrewNames(raw: unknown): string[] {
  return String(raw || '')
    .split(/[\n,;/]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildAircraftPresenceCollaborators(row: RecordRow, flightLogs: RecordRow[] = []): AircraftPresenceCollaborator[] {
  const sortedLogs = [...flightLogs].sort((left, right) => String(right.flight_date || '').localeCompare(String(left.flight_date || '')));
  const seen = new Set<string>();
  const collaborators: AircraftPresenceCollaborator[] = [];

  sortedLogs.forEach((log) => {
    const people = [String(log.pilot_name || '').trim(), ...extractCrewNames(log.crew_details)].filter(Boolean);
    people.forEach((person) => {
      const key = person.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const index = collaborators.length % AIRCRAFT_PRESENCE_BADGE_CLASSES.length;
      collaborators.push({
        id: `${String(log.id || row.id)}-${key.replace(/[^a-z0-9]+/g, '-')}`,
        name: person,
        role: deriveRoleFromNameToken(person),
        initials: getInitials(person),
        badgeClass: AIRCRAFT_PRESENCE_BADGE_CLASSES[index],
        latestFlightNumber: String(log.flight_number || '').trim() || undefined,
        latestFlightDate: String(log.flight_date || '').trim() || undefined,
        latestRoute: [String(log.departure_airport || '').trim(), String(log.arrival_airport || '').trim()].filter(Boolean).join(' → ') || undefined,
        source: 'flight_logs',
      });
    });
  });

  if (collaborators.length > 0) {
    return collaborators.slice(0, 3);
  }

  const fallbackName = String(row.owner_name || row.tail_number || row.registration || row.id || 'Ops Team').trim();
  return [{
    id: `fallback-${String(row.id || 'aircraft')}`,
    name: fallbackName,
    role: 'No Flight Log Crew',
    initials: getInitials(fallbackName),
    badgeClass: AIRCRAFT_PRESENCE_BADGE_CLASSES[0],
    source: 'fallback',
  }];
}

function asInputString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function normalizeFormValue(field: EntityFormField, value: unknown): unknown {
  if (field.type === 'boolean') {
    return Boolean(value);
  }
  if (field.type === 'json') {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined || value === '') return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }
  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : '';
  }
  return asInputString(value);
}

export function pickFormValuesFromRow(entity: MasterEntity, row: RecordRow): FormValues {
  const fields = ENTITY_FORM_FIELDS[entity];
  const next = getInitialFormValues(entity);
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(row, field.key)) {
      next[field.key] = normalizeFormValue(field, row[field.key]);
    }
  });
  return next;
}

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function toTimeComparable(value: string): number {
  const normalized = value.trim().length === 5 ? `${value.trim()}:00` : value.trim();
  const [hourText, minuteText, secondText] = normalized.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText || 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return -1;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return -1;
  return hour * 3600 + minute * 60 + second;
}

export function buildPayloadFromForm(entity: MasterEntity, values: FormValues): { payload: Record<string, unknown>; errors: Record<string, string> } {
  const fields = ENTITY_FORM_FIELDS[entity];
  const errors: Record<string, string> = {};
  const payload: Record<string, unknown> = {};
  fields.forEach((field) => {
    const raw = values[field.key];
    if (field.required && isBlank(raw) && field.type !== 'boolean') {
      errors[field.key] = `${field.label} is required`;
      return;
    }
    if (field.type === 'boolean') {
      payload[field.key] = Boolean(raw);
      return;
    }
    if (isBlank(raw)) {
      return;
    }
    const textValue = String(raw).trim();
    if (field.type === 'email') {
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue);
      if (!validEmail) {
        errors[field.key] = `${field.label} is invalid`;
        return;
      }
      payload[field.key] = textValue;
      return;
    }
    if (field.type === 'number') {
      const numberValue = Number(textValue);
      if (!Number.isFinite(numberValue)) {
        errors[field.key] = `${field.label} must be numeric`;
        return;
      }
      if (typeof field.min === 'number' && numberValue < field.min) {
        errors[field.key] = `${field.label} must be at least ${field.min}`;
        return;
      }
      payload[field.key] = numberValue;
      return;
    }
    if (field.type === 'json') {
      try {
        payload[field.key] = JSON.parse(textValue);
      } catch {
        errors[field.key] = `${field.label} must be valid JSON`;
      }
      return;
    }
    if (field.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
        errors[field.key] = `${field.label} must be in YYYY-MM-DD format`;
        return;
      }
      payload[field.key] = textValue;
      return;
    }
    if (field.type === 'time') {
      if (toTimeComparable(textValue) < 0) {
        errors[field.key] = `${field.label} must be in HH:mm or HH:mm:ss format`;
        return;
      }
      payload[field.key] = textValue.trim().length === 5 ? `${textValue.trim()}:00` : textValue;
      return;
    }
    payload[field.key] = textValue;
  });

  if (entity === 'shift_calendars' && !errors.shift_start_time && !errors.shift_end_time) {
    const start = toTimeComparable(String(payload.shift_start_time || ''));
    const end = toTimeComparable(String(payload.shift_end_time || ''));
    if (start >= 0 && end >= 0 && start >= end) {
      errors.shift_end_time = 'Shift End must be after Shift Start';
    }
  }

  if (entity === 'aircraft') {
    if (payload.tail_number) {
      const normalizedTailNumber = String(payload.tail_number).trim().toUpperCase();
      payload.tail_number = normalizedTailNumber;
      if (!/^[A-Z0-9-]{3,12}$/.test(normalizedTailNumber)) {
        errors.tail_number = 'Tail Number must be 3-12 characters (A-Z, 0-9, hyphen)';
      }
    }
    if (payload.registration) {
      const normalizedRegistration = String(payload.registration).trim().toUpperCase();
      payload.registration = normalizedRegistration;
      if (!/^[A-Z0-9-]{3,12}$/.test(normalizedRegistration)) {
        errors.registration = 'Registration must be 3-12 characters (A-Z, 0-9, hyphen)';
      }
    }
    if (payload.serial_number) {
      const serialNumber = String(payload.serial_number).trim().toUpperCase();
      payload.serial_number = serialNumber;
      if (serialNumber.length < 3) {
        errors.serial_number = 'Serial Number must be at least 3 characters';
      }
    }
    if (payload.aircraft_type && !AIRCRAFT_TYPE_OPTIONS.includes(String(payload.aircraft_type))) {
      errors.aircraft_type = 'Aircraft Type is invalid';
    }
    if (payload.status && !AIRCRAFT_STATUS_OPTIONS.includes(String(payload.status) as (typeof AIRCRAFT_STATUS_OPTIONS)[number])) {
      errors.status = 'Status is invalid';
    }
    if (payload.maintenance_program && String(payload.maintenance_program).trim().length < 3) {
      errors.maintenance_program = 'Maintenance Program must be at least 3 characters';
    }
    if (payload.configuration_code && String(payload.configuration_code).trim().length > 24) {
      errors.configuration_code = 'Configuration Code cannot exceed 24 characters';
    }
  }

  return { payload, errors };
}

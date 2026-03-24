import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useCRM } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MasterEntity =
  | 'aircraft'
  | 'parts_inventory'
  | 'suppliers'
  | 'maintenance_facilities'
  | 'work_centers'
  | 'skill_codes'
  | 'regulator_profiles'
  | 'shift_calendars'
  | 'work_package_templates';

export const ENTITY_LABEL: Record<MasterEntity, string> = {
  aircraft: 'Aircraft',
  parts_inventory: 'Parts Inventory',
  suppliers: 'Suppliers',
  maintenance_facilities: 'Maintenance Facilities',
  work_centers: 'Work Centers',
  skill_codes: 'Skill Codes',
  regulator_profiles: 'Regulator Profiles',
  shift_calendars: 'Shift Calendars',
  work_package_templates: 'Work Package Templates',
};

type RecordRow = {
  id: string;
  [key: string]: unknown;
};

const ENTITY_TABLE_COLUMNS: Record<MasterEntity, string[]> = {
  aircraft: ['id', 'registration', 'tail_number', 'aircraft_type', 'aircraft_model', 'status', 'updated_at'],
  parts_inventory: ['id', 'part_number', 'serial_number', 'description', 'quantity_available', 'warehouse_location', 'status', 'updated_at'],
  suppliers: ['id', 'supplier_code', 'name', 'contact_name', 'email', 'phone', 'is_active', 'updated_at'],
  maintenance_facilities: ['id', 'facility_code', 'name', 'facility_type', 'station_code', 'location_city', 'is_active', 'updated_at'],
  work_centers: ['id', 'work_center_code', 'name', 'center_type', 'station_code', 'capacity_hours_per_day', 'is_active', 'updated_at'],
  skill_codes: ['id', 'skill_code', 'description', 'skill_family', 'license_authority', 'is_certification_required', 'is_active', 'updated_at'],
  regulator_profiles: ['id', 'regulator_code', 'regulator_name', 'jurisdiction', 'policy_version', 'effective_from', 'is_active', 'updated_at'],
  shift_calendars: ['id', 'station_code', 'shift_name', 'shift_start_time', 'shift_end_time', 'capacity', 'is_active', 'updated_at'],
  work_package_templates: ['id', 'template_code', 'template_name', 'maintenance_type', 'version', 'active', 'updated_at'],
};

type FormFieldType = 'text' | 'email' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'boolean' | 'json';

type EntityFormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
};

type FormValues = Record<string, unknown>;

const ENTITY_FORM_FIELDS: Record<MasterEntity, EntityFormField[]> = {
  aircraft: [
    { key: 'registration', label: 'Registration', type: 'text' },
    { key: 'tail_number', label: 'Tail Number', type: 'text', required: true },
    { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
    { key: 'aircraft_type', label: 'Aircraft Type', type: 'text', required: true },
    { key: 'aircraft_model', label: 'Aircraft Model', type: 'text', required: true },
    { key: 'configuration_code', label: 'Configuration Code', type: 'text' },
    { key: 'maintenance_program', label: 'Maintenance Program', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'inactive', 'grounded', 'maintenance'] },
  ],
  parts_inventory: [
    { key: 'part_number', label: 'Part Number', type: 'text', required: true },
    { key: 'serial_number', label: 'Serial Number', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'unit_of_measure', label: 'UoM', type: 'text' },
    { key: 'min_stock_level', label: 'Min Stock Level', type: 'number', min: 0 },
    { key: 'quantity_on_hand', label: 'Quantity On Hand', type: 'number', min: 0 },
    { key: 'supplier_id', label: 'Supplier ID', type: 'text' },
    { key: 'warehouse_location', label: 'Warehouse Location', type: 'text', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'quarantine'] },
  ],
  suppliers: [
    { key: 'supplier_code', label: 'Supplier Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'contact_name', label: 'Contact Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'lead_time_days', label: 'Lead Time (Days)', type: 'number', min: 0 },
    { key: 'rating', label: 'Rating', type: 'number', min: 0 },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
  ],
  maintenance_facilities: [
    { key: 'facility_code', label: 'Facility Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'facility_type', label: 'Facility Type', type: 'select', required: true, options: ['line', 'base', 'engine', 'component'] },
    { key: 'station_code', label: 'Station Code', type: 'text', required: true },
    { key: 'location_city', label: 'City', type: 'text' },
    { key: 'location_country', label: 'Country', type: 'text' },
    { key: 'timezone', label: 'Timezone', type: 'text' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
  ],
  work_centers: [
    { key: 'facility_id', label: 'Facility ID', type: 'text' },
    { key: 'facility_code', label: 'Facility Code', type: 'text' },
    { key: 'work_center_code', label: 'Work Center Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'center_type', label: 'Center Type', type: 'select', required: true, options: ['airframe', 'avionics', 'powerplant', 'structures', 'ndt'] },
    { key: 'station_code', label: 'Station Code', type: 'text', required: true },
    { key: 'capacity_hours_per_day', label: 'Capacity Hours/Day', type: 'number', min: 0 },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
  ],
  skill_codes: [
    { key: 'skill_code', label: 'Skill Code', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'skill_family', label: 'Skill Family', type: 'text' },
    { key: 'license_authority', label: 'License Authority', type: 'text' },
    { key: 'is_certification_required', label: 'Certification Required', type: 'boolean' },
    { key: 'validity_period_months', label: 'Validity Period (Months)', type: 'number', min: 0 },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
  ],
  regulator_profiles: [
    { key: 'regulator_code', label: 'Regulator Code', type: 'text', required: true },
    { key: 'regulator_name', label: 'Regulator Name', type: 'text', required: true },
    { key: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: true },
    { key: 'policy_version', label: 'Policy Version', type: 'text', required: true },
    { key: 'effective_from', label: 'Effective From', type: 'date' },
    { key: 'effective_to', label: 'Effective To', type: 'date' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
  ],
  shift_calendars: [
    { key: 'station_code', label: 'Station Code', type: 'text', required: true },
    { key: 'shift_name', label: 'Shift Name', type: 'text', required: true },
    { key: 'shift_start_time', label: 'Shift Start', type: 'time', required: true },
    { key: 'shift_end_time', label: 'Shift End', type: 'time', required: true },
    { key: 'capacity', label: 'Capacity', type: 'number', min: 0 },
    { key: 'effective_from', label: 'Effective From', type: 'date' },
    { key: 'effective_to', label: 'Effective To', type: 'date' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ],
  work_package_templates: [
    { key: 'template_code', label: 'Template Code', type: 'text', required: true },
    { key: 'template_name', label: 'Template Name', type: 'text', required: true },
    { key: 'maintenance_type', label: 'Maintenance Type', type: 'select', required: true, options: ['line', 'base', 'hangar', 'shop'] },
    { key: 'version', label: 'Version', type: 'number', required: true, min: 1 },
    { key: 'active', label: 'Active', type: 'boolean' },
    { key: 'policy_snapshot_id', label: 'Policy Snapshot ID', type: 'text' },
    { key: 'scope_json', label: 'Scope JSON', type: 'json' },
    { key: 'tasks_json', label: 'Tasks JSON', type: 'json' },
  ],
};

export const AMRO_MASTER_ENTITY_FORM_FIELDS = ENTITY_FORM_FIELDS;
const MASTER_ENTITY_SEQUENCE = Object.keys(ENTITY_LABEL) as MasterEntity[];
const ENTITY_ROUTE_SEGMENT: Record<MasterEntity, string> = {
  aircraft: 'aircraft',
  parts_inventory: 'parts-inventory',
  suppliers: 'suppliers',
  maintenance_facilities: 'maintenance-facilities',
  work_centers: 'work-centers',
  skill_codes: 'skill-codes',
  regulator_profiles: 'regulator-profiles',
  shift_calendars: 'shift-calendars',
  work_package_templates: 'work-package-templates',
};
const ROUTE_SEGMENT_ENTITY: Record<string, MasterEntity> = Object.entries(ENTITY_ROUTE_SEGMENT).reduce(
  (accumulator, [entityKey, routeSegment]) => {
    accumulator[routeSegment] = entityKey as MasterEntity;
    return accumulator;
  },
  {} as Record<string, MasterEntity>,
);

const ENTITY_DEFAULT_VALUES: Record<MasterEntity, FormValues> = {
  aircraft: {
    registration: '',
    tail_number: '',
    serial_number: '',
    aircraft_type: '',
    aircraft_model: '',
    configuration_code: '',
    maintenance_program: '',
    status: 'active',
  },
  parts_inventory: {
    part_number: '',
    serial_number: '',
    description: '',
    category: '',
    unit_of_measure: 'EA',
    min_stock_level: 0,
    quantity_on_hand: 0,
    supplier_id: '',
    warehouse_location: '',
    status: 'active',
  },
  suppliers: {
    supplier_code: '',
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    lead_time_days: 0,
    rating: 0,
    is_active: true,
    metadata: '{}',
  },
  maintenance_facilities: {
    facility_code: '',
    name: '',
    facility_type: 'line',
    station_code: '',
    location_city: '',
    location_country: '',
    timezone: '',
    is_active: true,
    metadata: '{}',
  },
  work_centers: {
    facility_id: '',
    facility_code: '',
    work_center_code: '',
    name: '',
    center_type: 'airframe',
    station_code: '',
    capacity_hours_per_day: 8,
    is_active: true,
    metadata: '{}',
  },
  skill_codes: {
    skill_code: '',
    description: '',
    skill_family: '',
    license_authority: '',
    is_certification_required: false,
    validity_period_months: 0,
    is_active: true,
    metadata: '{}',
  },
  regulator_profiles: {
    regulator_code: '',
    regulator_name: '',
    jurisdiction: '',
    policy_version: '',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    is_active: true,
    metadata: '{}',
  },
  shift_calendars: {
    station_code: '',
    shift_name: '',
    shift_start_time: '08:00:00',
    shift_end_time: '16:00:00',
    capacity: 1,
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    is_active: true,
  },
  work_package_templates: {
    template_code: '',
    template_name: '',
    maintenance_type: 'line',
    version: 1,
    active: true,
    policy_snapshot_id: '',
    scope_json: '[]',
    tasks_json: '[]',
  },
};

function getPayloadRecords(payload: Record<string, unknown>): RecordRow[] {
  const output = payload.output;
  if (!output || typeof output !== 'object') {
    return [];
  }
  const outputRecord = output as Record<string, unknown>;
  const outputRecords = outputRecord['records'];
  if (!Array.isArray(outputRecords)) {
    return [];
  }
  return outputRecords.filter((record): record is RecordRow => Boolean(record) && typeof record === 'object');
}

function getPayloadImportedCount(payload: Record<string, unknown>): number {
  const output = payload.output;
  if (!output || typeof output !== 'object') {
    return 0;
  }
  const outputRecord = output as Record<string, unknown>;
  const count = Number(outputRecord['imported_count']);
  return Number.isFinite(count) ? count : 0;
}

function createSeedRecords(entity: MasterEntity): Record<string, unknown>[] {
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
  return [];
}

function createDefaultBulkText(entity: MasterEntity): string {
  const seedRecords = createSeedRecords(entity);
  if (seedRecords.length > 0) {
    return JSON.stringify(seedRecords, null, 2);
  }
  return '[\n  {}\n]';
}

function getInitialFormValues(entity: MasterEntity): FormValues {
  return { ...ENTITY_DEFAULT_VALUES[entity] };
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

function pickFormValuesFromRow(entity: MasterEntity, row: RecordRow): FormValues {
  const fields = ENTITY_FORM_FIELDS[entity];
  const next = getInitialFormValues(entity);
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(row, field.key)) {
      next[field.key] = normalizeFormValue(field, row[field.key]);
    }
  });
  return next;
}

async function buildApiHeaders(scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null }) {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token || '';
  }
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (scope.tenantId) headers.set('x-tenant-id', scope.tenantId);
  if (scope.franchiseId) headers.set('x-franchise-id', scope.franchiseId);
  if (scope.userId) headers.set('x-user-id', scope.userId);
  headers.set('x-domain-id', 'AMRO');
  return headers;
}

async function parseApiPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch (error) {
    if (response.ok) {
      return {};
    }
    throw new Error(`Invalid response format (${response.status})`);
  }
}

function isBlank(value: unknown): boolean {
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

  return { payload, errors };
}

export async function verifyReferenceExists(headers: Headers, entity: MasterEntity, searchTerm: string, fieldKeys: string[]): Promise<boolean> {
  const query = new URLSearchParams({
    search: searchTerm,
    page: '1',
    page_size: '20',
  });
  const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to validate ${ENTITY_LABEL[entity]} reference`));
  }
  const records = getPayloadRecords(payload);
  const normalized = searchTerm.trim().toLowerCase();
  return records.some((record) => fieldKeys.some((fieldKey) => String(record[fieldKey] || '').trim().toLowerCase() === normalized));
}

type AmroSettingsMasterDataPageProps = {
  entityOverride?: MasterEntity;
};

export function AmroSettingsMasterDataPage({ entityOverride }: AmroSettingsMasterDataPageProps = {}) {
  const { context } = useCRM();
  const { entity: entityParam } = useParams<{ entity?: string }>();
  const navigate = useNavigate();
  const resolvedRouteEntity = useMemo(() => {
    if (entityOverride) {
      return entityOverride;
    }
    if (entityParam && ROUTE_SEGMENT_ENTITY[entityParam]) {
      return ROUTE_SEGMENT_ENTITY[entityParam];
    }
    if (entityParam && MASTER_ENTITY_SEQUENCE.includes(entityParam as MasterEntity)) {
      return entityParam as MasterEntity;
    }
    return 'aircraft' as MasterEntity;
  }, [entityOverride, entityParam]);
  const [entity, setEntity] = useState<MasterEntity>(resolvedRouteEntity);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(getInitialFormValues(resolvedRouteEntity));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState(createDefaultBulkText(resolvedRouteEntity));
  const [pageSize, setPageSize] = useState('25');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'configuration' | 'system'>('basic');
  const clickDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const scope = useMemo(
    () => ({
      tenantId: context.tenantId,
      franchiseId: context.franchiseId,
      userId: context.userId,
    }),
    [context.franchiseId, context.tenantId, context.userId],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await buildApiHeaders(scope);
      const query = new URLSearchParams({
        search,
        page: String(page),
        page_size: pageSize,
        sort_by: 'updated_at',
        sort_dir: 'desc',
      });
      const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, { method: 'GET', headers });
      const payload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Failed to load records'));
      let records = getPayloadRecords(payload);
      if (statusFilter !== 'all') {
        records = records.filter(
          (record: Record<string, unknown>) =>
            String(record.status ?? record.is_active ?? record.active).toLowerCase() === statusFilter.toLowerCase(),
        );
      }
      setRows(records);
    } catch (error) {
      toast.error(String((error as Error).message || 'Failed to load records'));
    } finally {
      setLoading(false);
    }
  }, [entity, page, pageSize, scope, search, statusFilter]);

  useEffect(() => {
    setEntity(resolvedRouteEntity);
  }, [resolvedRouteEntity]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    setSelectedId(null);
    setFormValues(getInitialFormValues(entity));
    setFormErrors({});
    setBulkText(createDefaultBulkText(entity));
  }, [entity]);

  useEffect(() => {
    navigate(`/dashboard/amro/settings/master-data/${ENTITY_ROUTE_SEGMENT[entity]}`, { replace: true });
  }, [entity, navigate]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const timeout = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeout);
  }, [modalOpen]);

  useEffect(
    () => () => {
      if (clickDelayTimerRef.current) {
        clearTimeout(clickDelayTimerRef.current);
      }
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    try {
      const { payload, errors } = buildPayloadFromForm(entity, formValues);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast.error('Please resolve form validation errors');
        return false;
      }
      const headers = await buildApiHeaders(scope);
      if (entity === 'parts_inventory' && payload.supplier_id) {
        const exists = await verifyReferenceExists(headers, 'suppliers', String(payload.supplier_id), ['id', 'supplier_code']);
        if (!exists) {
          setFormErrors((previous) => ({ ...previous, supplier_id: 'Supplier ID was not found' }));
          toast.error('Supplier reference is invalid');
          return false;
        }
      }
      if (entity === 'work_centers') {
        const facilityId = String(payload.facility_id || '').trim();
        const facilityCode = String(payload.facility_code || '').trim();
        if (facilityId) {
          const exists = await verifyReferenceExists(headers, 'maintenance_facilities', facilityId, ['id']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, facility_id: 'Facility ID was not found' }));
            toast.error('Facility reference is invalid');
            return false;
          }
        }
        if (facilityCode) {
          const exists = await verifyReferenceExists(headers, 'maintenance_facilities', facilityCode, ['facility_code']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, facility_code: 'Facility Code was not found' }));
            toast.error('Facility reference is invalid');
            return false;
          }
        }
      }
      const response = await fetch(`/api/v2/amro/master-data/${entity}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const responsePayload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(responsePayload.error || 'Create failed'));
      toast.success(`${ENTITY_LABEL[entity]} record created`);
      setFormErrors({});
      setFormValues(getInitialFormValues(entity));
      setSelectedId(null);
      await loadRecords();
      return true;
    } catch (error) {
      toast.error(String((error as Error).message || 'Create failed'));
      return false;
    }
  }, [entity, formValues, loadRecords, scope]);

  const handleUpdate = useCallback(async () => {
    if (!selectedId) {
      toast.error('Select a record first');
      return false;
    }
    try {
      const { payload, errors } = buildPayloadFromForm(entity, formValues);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast.error('Please resolve form validation errors');
        return false;
      }
      const headers = await buildApiHeaders(scope);
      if (entity === 'parts_inventory' && payload.supplier_id) {
        const exists = await verifyReferenceExists(headers, 'suppliers', String(payload.supplier_id), ['id', 'supplier_code']);
        if (!exists) {
          setFormErrors((previous) => ({ ...previous, supplier_id: 'Supplier ID was not found' }));
          toast.error('Supplier reference is invalid');
          return false;
        }
      }
      if (entity === 'work_centers') {
        const facilityId = String(payload.facility_id || '').trim();
        const facilityCode = String(payload.facility_code || '').trim();
        if (facilityId) {
          const exists = await verifyReferenceExists(headers, 'maintenance_facilities', facilityId, ['id']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, facility_id: 'Facility ID was not found' }));
            toast.error('Facility reference is invalid');
            return false;
          }
        }
        if (facilityCode) {
          const exists = await verifyReferenceExists(headers, 'maintenance_facilities', facilityCode, ['facility_code']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, facility_code: 'Facility Code was not found' }));
            toast.error('Facility reference is invalid');
            return false;
          }
        }
      }
      const response = await fetch(`/api/v2/amro/master-data/${entity}/${selectedId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const responsePayload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(responsePayload.error || 'Update failed'));
      toast.success(`${ENTITY_LABEL[entity]} record updated`);
      setFormErrors({});
      await loadRecords();
      return true;
    } catch (error) {
      toast.error(String((error as Error).message || 'Update failed'));
      return false;
    }
  }, [entity, formValues, loadRecords, scope, selectedId]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) {
      toast.error('Select a record first');
      return;
    }
    setDeleteDialogOpen(true);
  }, [selectedId]);

  const confirmDelete = useCallback(async () => {
    if (!selectedId) return;
    try {
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}/${selectedId}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Delete failed'));
      toast.success(`${ENTITY_LABEL[entity]} record deleted`);
      setDeleteDialogOpen(false);
      setSelectedId(null);
      setFormErrors({});
      setFormValues(getInitialFormValues(entity));
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Delete failed'));
    }
  }, [entity, loadRecords, scope, selectedId]);

  const handleBulkImport = useCallback(async () => {
    try {
      const records = JSON.parse(bulkText);
      if (!Array.isArray(records)) throw new Error('Bulk payload must be a JSON array');
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operation: 'bulk_import',
          records,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Bulk import failed'));
      toast.success(`${getPayloadImportedCount(payload)} records imported`);
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Bulk import failed'));
    }
  }, [bulkText, entity, loadRecords, scope]);

  const handleExport = useCallback(async () => {
    try {
      const headers = await buildApiHeaders(scope);
      const query = new URLSearchParams({
        search,
        export: 'csv',
        page: '1',
        page_size: '5000',
      });
      const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, { method: 'GET', headers });
      const csvText = await response.text();
      if (!response.ok) throw new Error(csvText || 'Export failed');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `amro-${entity}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ENTITY_LABEL[entity]} CSV`);
    } catch (error) {
      toast.error(String((error as Error).message || 'Export failed'));
    }
  }, [entity, scope, search]);

  const tableColumns = useMemo(() => {
    const preferredColumns = ENTITY_TABLE_COLUMNS[entity];
    if (!rows.length) return preferredColumns;
    const firstRowColumns = Object.keys(rows[0]);
    const selected = preferredColumns.filter((column) => firstRowColumns.includes(column));
    const extras = firstRowColumns.filter((column) => !selected.includes(column));
    return [...selected, ...extras].slice(0, 10);
  }, [entity, rows]);

  const formFields = ENTITY_FORM_FIELDS[entity];
  const basicSectionFields = useMemo(() => formFields.slice(0, Math.min(formFields.length, 4)), [formFields]);
  const configurationSectionFields = useMemo(() => formFields.slice(Math.min(formFields.length, 4)), [formFields]);
  const systemFields = useMemo(
    () => tableColumns.filter((column) => ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(column)),
    [tableColumns],
  );
  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  const setFieldValue = useCallback((fieldKey: string, value: unknown) => {
    setFormValues((previous) => ({ ...previous, [fieldKey]: value }));
    setFormErrors((previous) => ({ ...previous, [fieldKey]: '' }));
  }, []);

  const handleRowSingleClick = useCallback(
    (row: RecordRow) => {
      if (clickDelayTimerRef.current) {
        clearTimeout(clickDelayTimerRef.current);
      }
      clickDelayTimerRef.current = setTimeout(() => {
        setSelectedId(row.id);
        setFormValues(pickFormValuesFromRow(entity, row));
        setFormErrors({});
      }, 300);
    },
    [entity],
  );

  const handleRowDoubleClick = useCallback(
    (row: RecordRow) => {
      if (clickDelayTimerRef.current) {
        clearTimeout(clickDelayTimerRef.current);
      }
      setSelectedId(row.id);
      setFormValues(pickFormValuesFromRow(entity, row));
      setFormErrors({});
      setModalMode('update');
      setActiveFormTab('basic');
      setModalOpen(true);
    },
    [entity],
  );

  const handleOpenCreateModal = useCallback(() => {
    setModalMode('create');
    setSelectedId(null);
    setFormValues(getInitialFormValues(entity));
    setFormErrors({});
    setActiveFormTab('basic');
    setModalOpen(true);
  }, [entity]);

  const handleSubmitModal = useCallback(async () => {
    const ok = modalMode === 'create' ? await handleCreate() : await handleUpdate();
    if (ok) {
      setModalOpen(false);
    }
  }, [handleCreate, handleUpdate, modalMode]);

  const tabLabelClass = (tab: 'basic' | 'configuration' | 'system') =>
    `border-b-2 px-4 pb-2 pt-1 text-sm font-medium transition-colors duration-200 ${
      activeFormTab === tab ? 'border-[#1E3A8A] text-[#1E3A8A]' : 'border-[#E5E7EB] text-[#64748B]'
    }`;

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 font-[Inter] text-[14px] leading-6 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AMRO Settings · Master Data</h1>
            <p className="text-sm text-muted-foreground">
              Tenant-scoped CRUD management for fleet, inventory, suppliers, facilities, workforce, compliance profiles, shift
              capacity, and work package templates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>
            <Button variant="outline" asChild>
              <Link to="/dashboard/amro/settings">Settings Dashboard</Link>
            </Button>
            <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
            <Button variant="outline" onClick={() => void handleExport()}>Export CSV</Button>
            <Button className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" onClick={handleOpenCreateModal}>New {ENTITY_LABEL[entity]}</Button>
          </div>
        </div>

        <Tabs value={entity} onValueChange={(next) => setEntity(next as MasterEntity)}>
          <TabsList className="flex h-auto flex-wrap gap-2">
            {MASTER_ENTITY_SEQUENCE.map((key) => (
              <TabsTrigger key={key} value={key}>{ENTITY_LABEL[key]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>{ENTITY_LABEL[entity]} Search and Filter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="amro-master-search">Search</Label>
              <Input id="amro-master-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{ENTITY_LABEL[entity]} Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC]">
                    {tableColumns.map((column) => (
                      <TableHead key={column} className="h-auto px-4 py-3 text-left text-[14px] font-semibold text-[#64748B]">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.id === selectedId ? 'selected' : undefined}
                      className="cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#F5F7FA]"
                      onClick={() => handleRowSingleClick(row)}
                      onDoubleClick={() => handleRowDoubleClick(row)}
                    >
                      {tableColumns.map((column) => (
                        <TableCell key={column} className="max-w-[240px] px-4 py-3 text-left align-middle text-[14px] text-[#1F2937]">
                          <span className="block truncate">{String(row[column] ?? '')}</span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Selected: {selectedId || 'none'} | Records: {rows.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage((previous) => Math.max(1, previous - 1))}>Previous</Button>
                <Badge variant="secondary">Page {page}</Badge>
                <Button variant="outline" onClick={() => setPage((previous) => previous + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{ENTITY_LABEL[entity]} Bulk Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBulkText(createDefaultBulkText(entity));
                    toast.success(`${ENTITY_LABEL[entity]} seed payload loaded`);
                  }}
                >
                  Load Seed Payload
                </Button>
              </div>
              <Textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} rows={14} />
              <Button onClick={() => void handleBulkImport()}>Run Bulk Import</Button>
            </CardContent>
          </Card>
        </div>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="z-[1000] max-h-[90vh] max-w-5xl overflow-y-auto border border-[#E5E7EB] p-0 duration-[250ms] data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
            <DialogHeader className="border-b border-[#E5E7EB] px-6 py-4">
              <DialogTitle className="text-[16px] font-semibold text-[#1F2937]">
                {modalMode === 'create' ? `Create ${ENTITY_LABEL[entity]}` : `Update ${ENTITY_LABEL[entity]}`}
              </DialogTitle>
              <DialogDescription className="text-[14px] text-[#64748B]">
                Double-click row behavior and CRUD flow mirrors Leads Management interaction patterns.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 px-6 pb-6 pt-4">
              <div className="flex flex-wrap gap-4 border-b-2 border-[#E5E7EB]">
                <button type="button" className={tabLabelClass('basic')} onClick={() => setActiveFormTab('basic')}>Basic Information</button>
                <button type="button" className={tabLabelClass('configuration')} onClick={() => setActiveFormTab('configuration')}>Configuration Settings</button>
                <button type="button" className={tabLabelClass('system')} onClick={() => setActiveFormTab('system')}>System Information</button>
              </div>
              {activeFormTab === 'basic' && (
                <div className="mt-6 space-y-4">
                  <h3 className="mb-6 text-[16px] font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {basicSectionFields.map((field, index) => (
                      <div key={field.key} className={field.type === 'textarea' || field.type === 'json' ? 'space-y-2 md:col-span-2 xl:col-span-4' : 'space-y-2'}>
                        <Label htmlFor={`master-data-basic-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                        {field.type === 'select' && (
                          <Select value={String(formValues[field.key] ?? '')} onValueChange={(value) => setFieldValue(field.key, value)}>
                            <SelectTrigger id={`master-data-basic-${field.key}`} className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {field.type === 'boolean' && (
                          <div className="flex h-10 items-center rounded-md border px-3">
                            <Switch id={`master-data-basic-${field.key}`} checked={Boolean(formValues[field.key])} onCheckedChange={(checked) => setFieldValue(field.key, checked)} />
                          </div>
                        )}
                        {(field.type === 'textarea' || field.type === 'json') && (
                          <Textarea
                            id={`master-data-basic-${field.key}`}
                            rows={field.type === 'json' ? 6 : 4}
                            value={String(formValues[field.key] ?? '')}
                            onChange={(event) => setFieldValue(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            className="text-[14px]"
                            aria-invalid={Boolean(formErrors[field.key])}
                          />
                        )}
                        {['text', 'email', 'number', 'date', 'time'].includes(field.type) && (
                          <Input
                            id={`master-data-basic-${field.key}`}
                            ref={index === 0 ? firstFieldRef : undefined}
                            type={field.type === 'number' ? 'number' : field.type}
                            value={String(formValues[field.key] ?? '')}
                            onChange={(event) => setFieldValue(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            min={typeof field.min === 'number' ? field.min : undefined}
                            step={field.type === 'number' ? 'any' : undefined}
                            className={`h-10 text-[14px] ${formErrors[field.key] ? 'border-[#EF4444]' : ''}`}
                            aria-invalid={Boolean(formErrors[field.key])}
                          />
                        )}
                        {formErrors[field.key] ? <p className="text-xs text-[#EF4444]">{formErrors[field.key]}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeFormTab === 'configuration' && (
                <div className="mt-6 space-y-4">
                  <h3 className="mb-6 text-[16px] font-semibold">Configuration Settings</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {configurationSectionFields.map((field) => (
                      <div key={field.key} className={field.type === 'textarea' || field.type === 'json' ? 'space-y-2 md:col-span-2 xl:col-span-4' : 'space-y-2'}>
                        <Label htmlFor={`master-data-configuration-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                        {field.type === 'select' && (
                          <Select value={String(formValues[field.key] ?? '')} onValueChange={(value) => setFieldValue(field.key, value)}>
                            <SelectTrigger id={`master-data-configuration-${field.key}`} className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {field.type === 'boolean' && (
                          <div className="flex h-10 items-center rounded-md border px-3">
                            <Switch id={`master-data-configuration-${field.key}`} checked={Boolean(formValues[field.key])} onCheckedChange={(checked) => setFieldValue(field.key, checked)} />
                          </div>
                        )}
                        {(field.type === 'textarea' || field.type === 'json') && (
                          <Textarea
                            id={`master-data-configuration-${field.key}`}
                            rows={field.type === 'json' ? 6 : 4}
                            value={String(formValues[field.key] ?? '')}
                            onChange={(event) => setFieldValue(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            className="text-[14px]"
                            aria-invalid={Boolean(formErrors[field.key])}
                          />
                        )}
                        {['text', 'email', 'number', 'date', 'time'].includes(field.type) && (
                          <Input
                            id={`master-data-configuration-${field.key}`}
                            type={field.type === 'number' ? 'number' : field.type}
                            value={String(formValues[field.key] ?? '')}
                            onChange={(event) => setFieldValue(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            min={typeof field.min === 'number' ? field.min : undefined}
                            step={field.type === 'number' ? 'any' : undefined}
                            className={`h-10 text-[14px] ${formErrors[field.key] ? 'border-[#EF4444]' : ''}`}
                            aria-invalid={Boolean(formErrors[field.key])}
                          />
                        )}
                        {formErrors[field.key] ? <p className="text-xs text-[#EF4444]">{formErrors[field.key]}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeFormTab === 'system' && (
                <div className="mt-6 space-y-4">
                  <h3 className="mb-6 text-[16px] font-semibold">System Information</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {systemFields.map((field) => (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={`master-data-system-${field}`}>{field}</Label>
                        <Input id={`master-data-system-${field}`} value={String(selectedRow?.[field] ?? '')} readOnly className="h-10 bg-muted" />
                      </div>
                    ))}
                    {!systemFields.length && (
                      <p className="text-sm text-[#64748B]">Select a row to view system metadata.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" className="h-9 px-4" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="destructive" className="h-9 px-4" onClick={() => void handleDelete()} disabled={!selectedId}>Delete</Button>
                <Button className="h-9 bg-[#1E3A8A] px-4 hover:bg-[#1E3A8A]/90" onClick={() => void handleSubmitModal()}>
                  {modalMode === 'create' ? 'Save' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected {ENTITY_LABEL[entity]} record?</AlertDialogTitle>
              <AlertDialogDescription>
                This operation is permanent and will be captured in audit logs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmDelete()}>Confirm Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

export default AmroSettingsMasterDataPage;

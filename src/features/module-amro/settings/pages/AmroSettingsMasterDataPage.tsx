import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckSquare,
  CreditCard,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  LayoutGrid,
  List,
  ListChecks,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  TimerReset,
  Trash2,
  Users,
  Workflow,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FlightLogForm,
  buildFlightLogPayload,
  getDefaultFlightLogFormValues,
  type FlightLogFormConfig,
  type FlightLogFormMode,
  type FlightLogFormSubmitInput,
  type FlightLogFormValues,
  validateFlightLogFormValues,
} from './FlightLogForm';
import {
  buildApiHeaders,
  createAircraftTemplate,
  deleteAircraftTemplate,
  filterManufacturersByTenant,
  listAircraftTemplates,
  parseApiPayload,
  updateAircraftTemplate,
  verifyReferenceExists,
  type AircraftTemplateRecord,
} from './amro-settings-master-data/services';
import {
  buildAircraftPresenceCollaborators,
  buildAircraftWorkPackageSnapshot,
  buildPayloadFromForm,
  createSeedRecords,
  createDefaultBulkText,
  createRowsRenderSignature,
  getDefaultAircraftWorkPackageValues,
  getInitialFormValues,
  getPayloadImportedCount,
  getPayloadRecords,
  normalizeFeatureFlag,
  normalizeTemplateScopeItems,
  normalizeTemplateTaskRows,
  isBlank,
  parseWorkPackageItems,
  pickFormValuesFromRow,
} from './amro-settings-master-data/utils';
import { FlightLogsFilters } from './amro-settings-master-data/components/FlightLogsFilters';
import { AircraftLeadsManager, type AircraftLeadsTab } from './amro-settings-master-data/components/AircraftLeadsManager';
import { AircraftActionPalette, type AircraftPaletteAction } from './amro-settings-master-data/components/AircraftActionPalette';
import { AircraftDataTableFrame } from './amro-settings-master-data/components/AircraftDataTableFrame';
import { AircraftListingControls } from './amro-settings-master-data/components/AircraftListingControls';
import { AircraftCreateDialogSection } from './amro-settings-master-data/components/AircraftCreateDialogSection';
import { AircraftTemplateDialog } from './amro-settings-master-data/components/AircraftTemplateDialog';
import { AddWorkPackageDialog } from './amro-settings-master-data/components/AddWorkPackageDialog';
import { WorkPackageTemplateCreateSection } from './amro-settings-master-data/components/WorkPackageTemplateCreateSection';
import { AmroWorkPackageTemplateAdapter } from '@/features/module-amro/components/templates/AmroWorkPackageTemplateAdapter';
import {
  filterUnifiedModuleRows,
  type AircraftUnifiedFilterOption,
  type AircraftUnifiedLayoutLabels,
  type AircraftUnifiedLayoutModuleKey,
} from './amro-settings-master-data/components/AircraftUnifiedLayout';

export { buildPayloadFromForm } from './amro-settings-master-data/utils';
export { verifyReferenceExists } from './amro-settings-master-data/services';

export type MasterEntity =
  | 'aircraft'
  | 'flight_logs'
  | 'parts_inventory'
  | 'suppliers'
  | 'maintenance_facilities'
  | 'work_centers'
  | 'skill_codes'
  | 'manufacturers'
  | 'assembly_models'
  | 'regulator_profiles'
  | 'shift_calendars'
  | 'work_package_templates';

export const ENTITY_LABEL: Record<MasterEntity, string> = {
  aircraft: 'Aircraft',
  flight_logs: 'Flight Logs',
  parts_inventory: 'Parts Inventory',
  suppliers: 'Suppliers',
  maintenance_facilities: 'Maintenance Facilities',
  work_centers: 'Work Centers',
  skill_codes: 'Skill Codes',
  manufacturers: 'Manufacturers',
  assembly_models: 'Model',
  regulator_profiles: 'Regulator Profiles',
  shift_calendars: 'Shift Calendars',
  work_package_templates: 'Work Package Templates',
};

type RecordRow = {
  id: string;
  [key: string]: unknown;
};

type SortDirection = 'asc' | 'desc';
type AircraftWorkPackageTab = 'new-wp' | 'existing-wp' | 'non-performed-tasks' | 'selected-task' | 'all-tasks';

type InlineEditingCell = {
  rowId: string;
  column: string;
} | null;

type ManufacturerOption = {
  id: string;
  label: string;
  code: string;
  name: string;
  tenantId: string;
  active: boolean;
};

type AssemblyTypeOption = {
  id: string;
  label: string;
  active: boolean;
};

type AssemblyModelOption = {
  id: string;
  label: string;
  modelValue: string;
  manufacturerId: string;
  manufacturerTokens: string[];
  active: boolean;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AircraftTempOption = {
  id: string;
  name: string;
  tenantId: string;
  franchiseId: string;
  aircraftType: string;
  manufacturerId: string;
  manufacturerName: string;
  aircraftModel: string;
  maintenanceProgram: string;
  revisionNumber: string;
  amendmentNumber: string;
};

type AircraftTemplateFormValues = {
  template_name: string;
  aircraft_type: string;
  manufacturer: string;
  manufacturer_id: string;
  aircraft_model: string;
  maintenance_program: string;
  revision_number: string;
  amendment_number: string;
};

const getDefaultAircraftTemplateFormValues = (): AircraftTemplateFormValues => ({
  template_name: '',
  aircraft_type: '',
  manufacturer: '',
  manufacturer_id: '',
  aircraft_model: '',
  maintenance_program: '',
  revision_number: '',
  amendment_number: '',
});

const mapAircraftTemplateRecordToFormValues = (record: AircraftTemplateRecord): AircraftTemplateFormValues => ({
  template_name: String(record.template_name || '').trim(),
  aircraft_type: String(record.aircraft_type || '').trim(),
  manufacturer: String(record.manufacturer || '').trim(),
  manufacturer_id: String(record.manufacturer_id || '').trim(),
  aircraft_model: String(record.aircraft_model || '').trim(),
  maintenance_program: String(record.maintenance_program || '').trim(),
  revision_number: String(record.revision_number || '').trim(),
  amendment_number: String(record.amendment_number || '').trim(),
});

const isSystemSelectValue = (value: string): boolean => value.startsWith('__');
const TEMPLATE_REGISTRY_TIMEOUT_MS = 12000;
const ENGINE_USABILITY_STORAGE_KEY = 'amro.engine.usability.session.events.v1';
const WORK_PACKAGE_CREATE_TIMEOUT_MS = 20000;

const resolveWorkPackageApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  const normalized = String((error as Error)?.message || '').trim();
  if ((error as Error)?.name === 'AbortError') {
    return 'Request timed out. Please check your connection and retry.';
  }
  if (normalized.toLowerCase() === 'failed to fetch') {
    return 'Network error. Verify connectivity and try again.';
  }
  return normalized || fallbackMessage;
};

const extractJoinedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    const first = value.find((entry) => Boolean(entry) && typeof entry === 'object');
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

const formatAirportLabel = (record: Record<string, unknown> | null, fallback: string): string => {
  if (!record) return fallback;
  const name = String(record.name || '').trim();
  const code = String(record.icao_code || '').trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return fallback;
};

const normalizeWorkPackageTaskStatus = (value: unknown): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'pending';
  return normalized;
};

const isTaskNonPerformedStatus = (value: unknown): boolean => {
  const normalized = normalizeWorkPackageTaskStatus(value);
  return !(
    normalized.includes('completed')
    || normalized.includes('performed')
    || normalized.includes('closed')
    || normalized.includes('done')
  );
};

const coerceRecordArray = (value: unknown): Record<string, unknown>[] => {
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

const extractTemplateRegistryRecords = (payload: Record<string, unknown>): Record<string, unknown>[] => {
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

const normalizeWorkPackageRecordSummary = (record: Record<string, unknown>): AircraftWorkPackageRecordSummary | null => {
  const id = String(record.id || record.work_package_id || '').trim();
  if (!id) {
    return null;
  }
  const workPackageNumber = String(record.work_order_number || record.work_package_number || record.package_number || '').trim() || id;
  const title = String(record.title || record.topic || workPackageNumber).trim() || workPackageNumber;
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
    .map((task, index): AircraftWorkPackageTaskListItem => {
      const taskRecord = task as Record<string, unknown>;
      const taskNumber = String(taskRecord.task_number || taskRecord['taskNumber'] || `TASK-${index + 1}`).trim() || `TASK-${index + 1}`;
      const ataCode = String(taskRecord.ata_code || taskRecord['ataCode'] || '').trim();
      const serialNumber = String(taskRecord.serial_number || taskRecord['serialNumber'] || '').trim();
      const partNumber = String(taskRecord.part_number || taskRecord['partNumber'] || '').trim();
      const description = String(taskRecord.description || taskRecord['title'] || taskRecord['name'] || '').trim();
      const taskStatus = normalizeWorkPackageTaskStatus(taskRecord.status || status);
      const source: AircraftWorkPackageTaskListItem['source'] = String(taskRecord.id || '').startsWith('scope-') ? 'scope' : 'existing_wp';
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
        parentWorkPackageId: id,
        parentWorkPackageNumber: workPackageNumber,
      };
    })
    .filter((task) => Boolean(task.description) || Boolean(task.taskNumber));
  return {
    id,
    workPackageNumber,
    title,
    status,
    maintenanceType,
    priority,
    station,
    updatedAt,
    tasks: normalizedTasks,
  };
};

const resolveFlightLogAircraftLabel = (row: RecordRow): string => {
  const ref = extractJoinedRecord(row.aircraft_ref);
  const refRegistration = String(ref?.registration || ref?.tail_number || '').trim();
  return String(row.aircraft_label || row.aircraft_registration || refRegistration || row.aircraft_id || '');
};

const resolveFlightLogAirportLabel = (
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

const ENTITY_TABLE_COLUMNS: Record<MasterEntity, string[]> = {
  aircraft: [
    'registration',
    'serial_number',
    'owner_name',
    'base_location',
    'defect_count',
    'current_flight_hours',
    'current_cycles',
    'status',
    'first_limit_remaining',
    'restrictions',
    'engine_install_history',
    'thrust_rating_change_log',
    'on_wing_lifecycle_records',
  ],
  flight_logs: [
    'aircraft_id',
    'flight_date',
    'flight_number',
    'departure_airport',
    'arrival_airport',
    'pilot_name',
    'flight_hours',
    'block_hours',
    'flight_cycles',
    'regulatory_authority',
  ],
  parts_inventory: ['id', 'part_number', 'serial_number', 'description', 'quantity_available', 'warehouse_location', 'status', 'updated_at'],
  suppliers: ['id', 'supplier_code', 'name', 'contact_name', 'email', 'phone', 'is_active', 'updated_at'],
  maintenance_facilities: ['id', 'facility_code', 'name', 'facility_type', 'station_code', 'location_city', 'is_active', 'updated_at'],
  work_centers: ['id', 'work_center_code', 'name', 'center_type', 'station_code', 'capacity_hours_per_day', 'is_active', 'updated_at'],
  skill_codes: ['id', 'skill_code', 'description', 'skill_family', 'license_authority', 'is_certification_required', 'is_active', 'updated_at'],
  manufacturers: ['id', 'manufacturer_code', 'name', 'country', 'is_active', 'updated_at'],
  assembly_models: ['id', 'model_code', 'name', 'manufacturer_id', 'assembly_type_id', 'is_active', 'updated_at'],
  regulator_profiles: ['id', 'regulator_code', 'regulator_name', 'jurisdiction', 'policy_version', 'effective_from', 'is_active', 'updated_at'],
  shift_calendars: ['id', 'station_code', 'shift_name', 'shift_start_time', 'shift_end_time', 'capacity', 'is_active', 'updated_at'],
  work_package_templates: ['id', 'template_code', 'template_name', 'model_id', 'aircraft_model', 'maintenance_type', 'version', 'active', 'updated_at'],
};

const ENTITY_HIDDEN_COLUMNS: Partial<Record<MasterEntity, string[]>> = {
  aircraft: ['id', 'created_at', 'updated_at', 'tenant_id', 'franchise_id'],
  flight_logs: ['tenant_id', 'franchise_id', 'is_deleted', 'deleted_at', 'deleted_by', 'created_by', 'updated_by', 'metadata'],
  work_package_templates: ['id', 'created_at', 'updated_at', 'tenant_id', 'franchise_id', 'scope_json'],
};

const AIRCRAFT_EDITABLE_COLUMNS = new Set(['registration', 'tail_number', 'serial_number', 'aircraft_type', 'engine_type', 'aircraft_model', 'maintenance_program', 'status']);

const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
  id: 'ID',
  tail_number: 'Tail Number',
  serial_number: 'Serial Number',
  owner_name: 'Owner',
  base_location: 'Base',
  defect_count: 'Defect',
  current_flight_hours: 'TTAF',
  current_cycles: 'Landing',
  first_limit_remaining: 'First Limit Remaining',
  restrictions: 'Restrictions',
  aircraft_type: 'Aircraft Type',
  engine_type: 'Engine Type',
  aircraft_model: 'Aircraft Model',
  updated_at: 'Updated At',
  aircraft_id: 'Aircraft',
  flight_date: 'Flight Date',
  flight_number: 'Flight Number',
  departure_airport: 'Departure',
  arrival_airport: 'Arrival',
  pilot_name: 'Pilot',
  flight_hours: 'Flight Hours',
  block_hours: 'Block Hours',
  flight_cycles: 'Cycles',
  regulatory_authority: 'Regulatory Authority',
};

const isAbortLikeError = (error: unknown): boolean => {
  if (!error) return false;
  const name = String((error as { name?: unknown }).name ?? '').toLowerCase();
  if (name === 'aborterror') return true;
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return message.includes('aborted') || message.includes('signal is aborted');
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
type FormSectionKey = 'basic' | 'configuration';
type WorkPackageTrigger = 'schedule_due' | 'defect' | 'campaign' | 'predictive_alert';
type WorkPackageCreateAction = 'save_draft' | 'create_schedule' | 'create_open';

type AircraftWorkPackageFormValues = {
  source: WorkPackageTrigger;
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: '' | 'planning' | 'scheduled' | 'in_progress' | 'blocked';
  validationState: '' | 'pending' | 'validated' | 'not_validated';
  plannedStart: string;
  plannedEnd: string;
  station: string;
  workPackageNumber: string;
  topic: string;
  ttafHours: string;
  openingDate: string;
  revisionNumber: string;
  revisionDate: string;
  transmissionDate: string;
  maintenanceReleaseDate: string;
  workReportNumber: string;
  expectedReceptionDate: string;
  workReceptionDate: string;
  comments: string;
  selectedTaskNumber: string;
  selectedTaskAtaCode: string;
  selectedTaskSerialNumber: string;
  selectedTaskPartNumber: string;
  selectedTaskDescription: string;
  scopeItemsText: string;
};

type AircraftWorkPackageSnapshot = {
  open: number;
  inProgress: number;
  deferred: number;
  completed: number;
  rtsBlockers: number;
  slaRisk: number;
};

type AircraftPresenceCollaborator = {
  id: string;
  name: string;
  role: string;
  initials: string;
  badgeClass: string;
  latestFlightNumber?: string;
  latestFlightDate?: string;
  latestRoute?: string;
  source: 'flight_logs' | 'fallback';
};

type WorkPackageTemplateRegistryItem = {
  id: string;
  templateCode: string;
  templateName: string;
  description: string;
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  version: string;
  active: boolean;
  scopeItems: string[];
  taskRows: Array<{
    id: string;
    taskNumber: string;
    ataCode: string;
    serialNumber: string;
    partNumber: string;
    description: string;
  }>;
};

type AircraftWorkPackageRecordSummary = {
  id: string;
  workPackageNumber: string;
  title: string;
  status: string;
  maintenanceType: string;
  priority: string;
  station: string;
  updatedAt: string;
  tasks: AircraftWorkPackageTaskListItem[];
};

type AircraftWorkPackageTaskListItem = {
  id: string;
  taskNumber: string;
  ataCode: string;
  serialNumber: string;
  partNumber: string;
  description: string;
  status: string;
  selectable: boolean;
  source: 'template' | 'existing_wp' | 'scope' | 'selected';
  parentWorkPackageId?: string;
  parentWorkPackageNumber?: string;
};

type AircraftTemplateAssociatedTaskRow = {
  id: string;
  codeFormNo: string;
  ataCode: string;
  referenceAmp: string;
  description: string;
  categoryCode: string;
  estimatedManHours: string;
  isMandatory: boolean;
  jsonDetails: string;
};

type AircraftDashboardKpis = {
  fleet_size: number;
  open_work_packages: number;
  due_within_window: number;
  overdue_work_packages: number;
  open_defects: number;
  total_flight_hours: number;
  total_cycles: number;
  compliance_ready_pct: number;
};

type AircraftDashboardTrendPoint = {
  day: string;
  flight_hours?: number;
  cycles?: number;
  opened?: number;
  resolved?: number;
  tbo_remaining_hours?: number;
  vibration_ips?: number;
  oil_consumption_lph?: number;
  replacements?: number;
  compliance_breaches?: number;
  defects_opened?: number;
};

type AircraftDashboardAlert = {
  module?: string;
  code?: string;
  severity?: string;
  message?: string;
  due_in_days?: number | null;
};

type AircraftDashboardEngineModule = {
  kpis?: Record<string, number | string>;
  statuses?: Record<string, string>;
  trend?: AircraftDashboardTrendPoint[];
  lifecycle_management?: Array<Record<string, unknown>>;
  serialized_engine_tracking?: Array<Record<string, unknown>>;
  thrust_rating_management?: Array<Record<string, unknown>>;
  on_wing_lifecycle?: Array<Record<string, unknown>>;
  maintenance_schedule?: Array<Record<string, unknown>>;
  maintenance_planning?: {
    predictive_candidates?: Array<Record<string, unknown>>;
    scheduled_windows?: Array<Record<string, unknown>>;
    conflicts?: Array<Record<string, unknown>>;
    resolution_actions?: Array<Record<string, unknown>>;
    resource_allocation?: Array<Record<string, unknown>>;
  };
  lifecycle_traceability?: Array<Record<string, unknown>>;
  component_monitoring?: {
    statuses?: Record<string, string | number>;
    realtime_updated_at?: string;
    source?: string;
    sensor_data?: Array<Record<string, unknown>>;
    anomaly_detection?: Record<string, unknown>;
  };
  work_orders?: {
    totals?: Record<string, number>;
    recent?: Array<Record<string, unknown>>;
    digital_signature_workflow?: Record<string, unknown>;
    parts_tracking?: Array<Record<string, unknown>>;
  };
  compliance_tracking?: {
    ready_count?: number;
    pending_count?: number;
    overdue_count?: number;
    compliance_pct?: number;
    ad_sb_tracking?: Record<string, unknown>;
    regulatory_profiles?: Record<string, unknown>;
    standards?: string[];
  };
  performance_analytics?: {
    utilization_pct?: number;
    anomaly_index?: number;
    forecast_risk?: string;
    trend_summary?: Array<Record<string, unknown>>;
    failure_prediction?: Record<string, unknown>;
  };
  integration_capabilities?: Array<Record<string, unknown>>;
  integration_resilience?: Record<string, unknown>;
  standards_alignment?: Record<string, string>;
  validation?: Record<string, unknown>;
  drilldown?: {
    defect_drivers?: Array<Record<string, unknown>>;
  };
  alerts?: AircraftDashboardAlert[];
};

type AircraftDashboardComponentsModule = {
  kpis?: Record<string, number | string>;
  statuses?: Record<string, string>;
  lifecycle_tracking?: Array<Record<string, unknown>>;
  replacement_history?: Array<Record<string, unknown>>;
  trend?: AircraftDashboardTrendPoint[];
  drilldown?: {
    open_defects?: Array<Record<string, unknown>>;
  };
  alerts?: AircraftDashboardAlert[];
};

type AircraftDashboardModuleFilter = 'overview' | 'engine' | 'components' | 'all';
type EngineUsabilityTaskId =
  | 'engine_risk_scan'
  | 'engine_maintenance_next_due'
  | 'engine_compliance_readiness'
  | 'engine_anomaly_review'
  | 'engine_data_entry_validation';

type AircraftDashboardReportSection = {
  section: string;
  metric: string;
  value: string;
};

type AircraftDashboardOutput = {
  metadata?: {
    role_view?: string;
    cache?: string;
    generated_at?: string;
  };
  kpis?: Partial<AircraftDashboardKpis>;
  aircraft_status?: Array<Record<string, unknown>>;
  maintenance_schedule?: Array<Record<string, unknown>>;
  flight_logs?: Array<Record<string, unknown>>;
  defect_tracking?: Array<Record<string, unknown>>;
  compliance_status?: Record<string, unknown>;
  performance_metrics?: {
    flight_hours_trend?: AircraftDashboardTrendPoint[];
    defect_trend?: AircraftDashboardTrendPoint[];
    signal_severity_index?: number;
  };
  alerts?: AircraftDashboardAlert[];
  engine_module?: AircraftDashboardEngineModule | null;
  components_module?: AircraftDashboardComponentsModule | null;
};

type EngineAssetReadModel = {
  id: string;
  tailNumber?: string;
  engineSerialNumber?: string;
  position?: string;
  tsn?: number;
  csn?: number;
  status?: string;
};

type EnginePerformanceHistoryPoint = {
  ts: string;
  metric: string;
  value: number;
  unit?: string;
};

const AIRCRAFT_NAV_RAIL = [
  { label: 'Aircraft List', path: '/dashboard/amro/aircraft/list', view: 'list' as const, icon: TimerReset },
  { label: 'Templates', path: '/dashboard/amro/aircraft/templates', view: 'module' as const, icon: FileSpreadsheet },
  { label: 'Engine', path: '/dashboard/amro/aircraft/engine', view: 'analytics' as const, icon: CheckSquare },
  { label: 'Components', path: '/dashboard/amro/aircraft/components', view: 'grid' as const, icon: CheckSquare },
  { label: 'Documents', path: '/dashboard/amro/aircraft/documents', view: 'import_export' as const, icon: FileText },
  { label: 'AD/SB', path: '/dashboard/amro/aircraft/ad-sb', view: 'pipeline' as const, icon: FileCheck },
  { label: 'Operations', path: '/dashboard/amro/aircraft/work-packages', view: 'card' as const, icon: CalendarDays },
] as const;

type AircraftSubModuleSegment = 'list' | 'templates' | 'engine' | 'components' | 'documents' | 'ad-sb' | 'work-packages';

const AIRCRAFT_SUBMODULE_SEGMENTS: ReadonlyArray<AircraftSubModuleSegment> = ['list', 'templates', 'engine', 'components', 'documents', 'ad-sb', 'work-packages'];

const AIRCRAFT_SUBMODULE_VIEW_MAP: Record<string, 'module' | AircraftLeadsTab> = {
  list: 'module',
  templates: 'module',
  engine: 'analytics',
  components: 'grid',
  documents: 'import_export',
  'ad-sb': 'pipeline',
  'work-packages': 'card',
};

const DEFAULT_AIRCRAFT_DASHBOARD_KPIS: AircraftDashboardKpis = {
  fleet_size: 0,
  open_work_packages: 0,
  due_within_window: 0,
  overdue_work_packages: 0,
  open_defects: 0,
  total_flight_hours: 0,
  total_cycles: 0,
  compliance_ready_pct: 0,
};

const AIRCRAFT_DASHBOARD_DUE_WINDOW_OPTIONS = ['7', '14', '30', '60'] as const;

const AIRCRAFT_UNIFIED_STATUS_OPTIONS: AircraftUnifiedFilterOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'active', label: 'Active' },
  { value: 'critical', label: 'Critical' },
  { value: 'compliant', label: 'Compliant' },
];

const AIRCRAFT_UNIFIED_LAYOUT_I18N: Record<string, AircraftUnifiedLayoutLabels> = {
  en: {
    searchPlaceholder: 'Search in active module',
    searchAriaLabel: 'Unified module search',
    statusAriaLabel: 'Unified module status filter',
    localeAriaLabel: 'Unified module locale selector',
    navAriaLabel: 'Unified module navigation',
    clearFilters: 'Clear filters',
    loadingMessage: 'Loading module data…',
    resultLabel: 'records',
  },
  es: {
    searchPlaceholder: 'Buscar en el módulo activo',
    searchAriaLabel: 'Búsqueda del módulo unificado',
    statusAriaLabel: 'Filtro de estado del módulo unificado',
    localeAriaLabel: 'Selector de idioma del módulo unificado',
    navAriaLabel: 'Navegación de módulos unificados',
    clearFilters: 'Limpiar filtros',
    loadingMessage: 'Cargando datos del módulo…',
    resultLabel: 'registros',
  },
  fr: {
    searchPlaceholder: 'Rechercher dans le module actif',
    searchAriaLabel: 'Recherche du module unifié',
    statusAriaLabel: 'Filtre de statut du module unifié',
    localeAriaLabel: 'Sélecteur de langue du module unifié',
    navAriaLabel: 'Navigation du module unifié',
    clearFilters: 'Réinitialiser les filtres',
    loadingMessage: 'Chargement des données du module…',
    resultLabel: 'enregistrements',
  },
};

const MASTER_DATA_CONTROLS_I18N: Record<string, AircraftUnifiedLayoutLabels> = {
  en: {
    searchPlaceholder: 'Search in active module',
    searchAriaLabel: 'Unified module search',
    statusAriaLabel: 'Unified module status filter',
    localeAriaLabel: 'Unified module locale selector',
    navAriaLabel: 'Unified module navigation',
    clearFilters: 'Clear filters',
    loadingMessage: 'Loading module data…',
    resultLabel: 'records',
  },
  es: {
    searchPlaceholder: 'Buscar en el módulo activo',
    searchAriaLabel: 'Búsqueda del módulo unificado',
    statusAriaLabel: 'Filtro de estado del módulo unificado',
    localeAriaLabel: 'Selector de idioma del módulo unificado',
    navAriaLabel: 'Navegación de módulos unificados',
    clearFilters: 'Limpiar filtros',
    loadingMessage: 'Cargando datos del módulo…',
    resultLabel: 'registros',
  },
  fr: {
    searchPlaceholder: 'Rechercher dans le module actif',
    searchAriaLabel: 'Recherche du module unifié',
    statusAriaLabel: 'Filtre de statut du module unifié',
    localeAriaLabel: 'Sélecteur de langue du module unifié',
    navAriaLabel: 'Navigation du module unifié',
    clearFilters: 'Réinitialiser les filtres',
    loadingMessage: 'Chargement des données du module…',
    resultLabel: 'enregistrements',
  },
};


const MANUFACTURER_SEED_NAMES = [
  'AIRBUS',
  'ATR',
  'ATR 72',
  'Beech Aircraft Corporation, Wichita, Kansas, USA',
  'BELL HELICOPTER TEXTRON',
  'Bombardier',
  'CENTRAL GEARBOX',
  'CESSNA AIRCRAFT COMPANY',
  'CESSNA CARAVAN 208B',
  'CESSNA CITATION',
  'DASSAULT AVIATION',
  'De Havilland Aircraft Company of Canada',
  'EMBRAER',
  'EUROCOPTER',
  'FZM',
  'Hartzell',
  'HARTZELL PROPELLER INC',
  'HAWKER BEECHCRAFT',
  'HINDUSTAN AERONAUTICS LTD',
  'HONEYWELL',
  'Keystone Helicopter',
  'KING AIR',
  'Learjet Inc. (Bombardier)',
  'Lycoming Textron',
  'McCAULEY',
  'PARTHENAVIA',
  'PIAGGIO AERO',
  'Pilatus',
  'PILATUS PC-12',
  'Pratt & Whittney',
  'RAYTHEON AIRCRAFT COMPANY',
  'ROLLS ROYCE',
  'Schweizer',
  'SGST',
  'SUPER KING AIR',
  'TAAL',
  'TURBOMECA',
  'VULCAN AIR',
  'Westland Agusta',
  'WESTLAND AUGUSTA',
  'WILLIAMS INTERNATIONAL',
];

const AIRCRAFT_TYPE_FALLBACK_OPTIONS = ['NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded'];
const AIRCRAFT_STATUS_OPTIONS = ['active', 'maintenance', 'grounded', 'retired', 'storage'] as const;
const AIRCRAFT_FORM_SECTION_FIELD_KEYS: Record<FormSectionKey, string[]> = {
  basic: ['tail_number', 'registration', 'serial_number', 'aircraft_type', 'engine_type', 'manufacturer_id'],
  configuration: ['aircraft_model', 'configuration_code', 'maintenance_program', 'status'],
};
const AIRCRAFT_FIELD_HELP: Partial<Record<string, string>> = {
  tail_number: 'Use 3-12 uppercase letters, numbers, or hyphen.',
  registration: 'Registration should align with authority records and paint scheme.',
  serial_number: 'Enter manufacturer serial number with at least 3 characters.',
  engine_type: 'Capture the installed engine family or model code for planning and traceability.',
  manufacturer_id: 'Choose the approved manufacturer before selecting aircraft model.',
  aircraft_model: 'Model list is filtered by selected manufacturer.',
  maintenance_program: 'Attach approved program code used by planning and compliance teams.',
  status: 'Status drives risk scoring and available operational quick actions.',
};
const AIRCRAFT_UNSELECTED_OPTION = 'Nothing selected';
const AIRCRAFT_PRESENCE_CACHE_TTL_MS = 120000;

type AircraftCounterRow = {
  key: string;
  name: string;
  serialNumber: string;
  model: string;
  initialValue: string;
  initialDate: string;
  unit: string;
};

const getDefaultAircraftCounterRows = (): AircraftCounterRow[] => [
  { key: 'calendar', name: 'Calendar', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'flight_hours', name: 'Flight hours', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'landing', name: 'Landing', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'n1', name: 'N1', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'n2', name: 'N2', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
];

const ENTITY_FORM_FIELDS: Record<MasterEntity, EntityFormField[]> = {
  aircraft: [
    { key: 'registration', label: 'Registration', type: 'text' },
    { key: 'tail_number', label: 'Tail Number', type: 'text', required: true },
    { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
    { key: 'aircraft_type', label: 'Aircraft Type', type: 'select', required: true, options: AIRCRAFT_TYPE_FALLBACK_OPTIONS },
    { key: 'engine_type', label: 'Engine Type', type: 'text' },
    { key: 'manufacturer_id', label: 'Manufacturer', type: 'select', required: true },
    { key: 'aircraft_model', label: 'Aircraft Model', type: 'select', required: true },
    { key: 'configuration_code', label: 'Configuration Code', type: 'text' },
    { key: 'maintenance_program', label: 'Maintenance Program', type: 'text' },
    { key: 'engine_install_history', label: 'Engine Install History', type: 'json' },
    { key: 'thrust_rating_change_log', label: 'Thrust Rating Change Log', type: 'json' },
    { key: 'on_wing_lifecycle_records', label: 'On-Wing Lifecycle Records', type: 'json' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'maintenance', 'grounded', 'retired', 'storage'] },
  ],
  flight_logs: [
    { key: 'aircraft_id', label: 'Aircraft Id', type: 'text', required: true },
    { key: 'flight_date', label: 'Flight Date', type: 'date', required: true },
    { key: 'flight_number', label: 'Flight Number', type: 'text' },
    { key: 'departure_airport', label: 'Departure Airport', type: 'text', required: true },
    { key: 'arrival_airport', label: 'Arrival Airport', type: 'text', required: true },
    { key: 'pilot_name', label: 'Pilot Name', type: 'text' },
    { key: 'flight_hours', label: 'Flight Hours', type: 'number', min: 0 },
    { key: 'block_hours', label: 'Block Hours', type: 'number', min: 0 },
    { key: 'flight_cycles', label: 'Flight Cycles', type: 'number', min: 0 },
    { key: 'crew_details', label: 'Crew Details', type: 'textarea' },
    { key: 'fuel_burn_kg', label: 'Fuel Burn (Kg)', type: 'number', min: 0 },
    { key: 'oil_uplift_liters', label: 'Oil Uplift (Liters)', type: 'number', min: 0 },
    { key: 'pirep_discrepancy', label: 'PIREP Discrepancy', type: 'textarea' },
    { key: 'regulatory_authority', label: 'Regulatory Authority', type: 'text' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
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
  manufacturers: [
    { key: 'manufacturer_code', label: 'Manufacturer Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'metadata', label: 'Metadata JSON', type: 'json' },
  ],
  assembly_models: [
    { key: 'manufacturer_id', label: 'Manufacturer', type: 'select', required: true, placeholder: 'Select manufacturer' },
    { key: 'assembly_type_id', label: 'Assembly Type Id', type: 'select', required: true, placeholder: 'Select assembly type' },
    { key: 'model_code', label: 'Model Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'primary_model', label: 'Primary Model', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
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
    { key: 'aircraft_model', label: 'Aircraft Model', type: 'select' },
    { key: 'maintenance_type', label: 'Maintenance Type', type: 'select', required: true, options: ['line', 'base', 'component', 'inspection', 'overhaul', 'repair', 'upgrade', 'modification'] },
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
  flight_logs: 'flight-logs',
  parts_inventory: 'parts-inventory',
  suppliers: 'suppliers',
  maintenance_facilities: 'maintenance-facilities',
  work_centers: 'work-centers',
  skill_codes: 'skill-codes',
  manufacturers: 'manufacturers',
  assembly_models: 'model',
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
    engine_type: '',
    aircraft_model: '',
    manufacturer_id: '',
    configuration_code: '',
    maintenance_program: '',
    engine_install_history: '[]',
    thrust_rating_change_log: '[]',
    on_wing_lifecycle_records: '[]',
    status: 'active',
  },
  flight_logs: {
    aircraft_id: '',
    flight_date: new Date().toISOString().slice(0, 10),
    flight_number: '',
    departure_airport: '',
    arrival_airport: '',
    pilot_name: '',
    flight_hours: 0,
    block_hours: 0,
    flight_cycles: 0,
    crew_details: '',
    fuel_burn_kg: 0,
    oil_uplift_liters: 0,
    pirep_discrepancy: '',
    regulatory_authority: 'DGCA',
    metadata: '{}',
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
  manufacturers: {
    manufacturer_code: '',
    name: '',
    country: '',
    is_active: true,
    metadata: '{}',
  },
  assembly_models: {
    manufacturer_id: '',
    assembly_type_id: '',
    model_code: '',
    name: '',
    primary_model: '',
    description: '',
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
    aircraft_model: '',
    maintenance_type: 'line',
    version: 1,
    active: true,
    policy_snapshot_id: '',
    scope_json: '[]',
    tasks_json: '[]',
  },
};

type AmroSettingsMasterDataPageProps = {
  entityOverride?: MasterEntity;
  variant?: 'master-data' | 'aircraft-sub-module';
};

export function AmroSettingsMasterDataPage({ entityOverride, variant = 'master-data' }: AmroSettingsMasterDataPageProps = {}) {
  const { context, scopedDb } = useCRM();
  const { hasPermission, session } = useAuth();
  const { entity: entityParam } = useParams<{ entity?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAircraftSubModule = variant === 'aircraft-sub-module';
  const routeBasePath = useMemo(() => {
    if (isAircraftSubModule) {
      return '/dashboard/amro';
    }
    if (
      entityOverride === 'work_package_templates'
      && location.pathname.startsWith('/dashboard/amro/settings/work-package-templates')
    ) {
      return '/dashboard/amro/settings';
    }
    return '/dashboard/amro/settings/master-data';
  }, [entityOverride, isAircraftSubModule, location.pathname]);
  const breadcrumbParentLabel = isAircraftSubModule ? 'AMRO' : 'AMRO Settings';
  const breadcrumbParentPath = isAircraftSubModule ? '/dashboard/amro/overview' : '/dashboard/amro/settings';
  const breadcrumbCurrentLabel = isAircraftSubModule ? 'Aircraft' : 'Master Data';
  const pageTitle = isAircraftSubModule ? 'AMRO · Aircraft' : 'AMRO Settings · Master Data';
  const pageSubtitle = isAircraftSubModule
    ? 'Tenant-scoped aircraft operations management with governed CRUD controls, validation, filtering, and exports.'
    : 'Tenant-scoped CRUD management for fleet, inventory, manufacturers, suppliers, facilities, workforce, compliance profiles, shift capacity, and work package templates.';
  const homeActionLabel = isAircraftSubModule ? 'AMRO Overview' : 'Settings Dashboard';
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
  const hideAircraftModuleHeaderMeta = isAircraftSubModule && resolvedRouteEntity === 'aircraft';
  const [entity, setEntity] = useState<MasterEntity>(resolvedRouteEntity);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [flightDateFrom, setFlightDateFrom] = useState(searchParams.get('flight_from') || '');
  const [flightDateTo, setFlightDateTo] = useState(searchParams.get('flight_to') || '');
  const [flightAircraftFilter, setFlightAircraftFilter] = useState(searchParams.get('flight_aircraft') || searchParams.get('aircraft_id') || '');
  const [flightRegistrationFilter, setFlightRegistrationFilter] = useState(searchParams.get('flight_registration') || searchParams.get('aircraft_registration') || '');
  const [flightPilotFilter, setFlightPilotFilter] = useState(searchParams.get('flight_pilot') || '');
  const [flightNumberFilter, setFlightNumberFilter] = useState(searchParams.get('flight_number') || '');
  const [debouncedFlightFilters, setDebouncedFlightFilters] = useState({
    flightDateFrom: searchParams.get('flight_from') || '',
    flightDateTo: searchParams.get('flight_to') || '',
    flightAircraftFilter: searchParams.get('flight_aircraft') || searchParams.get('aircraft_id') || '',
    flightRegistrationFilter: searchParams.get('flight_registration') || searchParams.get('aircraft_registration') || '',
    flightPilotFilter: searchParams.get('flight_pilot') || '',
    flightNumberFilter: searchParams.get('flight_number') || '',
  });
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('cf_')) {
        filters[key.replace('cf_', '')] = value;
      }
    });
    return filters;
  });
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('selected'));
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<FormValues>(getInitialFormValues(resolvedRouteEntity));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState(createDefaultBulkText(resolvedRouteEntity));
  const [pageSize, setPageSize] = useState(searchParams.get('page_size') || '25');
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'configuration' | 'system'>('basic');
  const [collapsedFormPanels, setCollapsedFormPanels] = useState<Record<'basic' | 'configuration' | 'system', boolean>>({
    basic: false,
    configuration: false,
    system: false,
  });
  const [manufacturerOptions, setManufacturerOptions] = useState<ManufacturerOption[]>([]);
  const [manufacturerOptionsLoading, setManufacturerOptionsLoading] = useState(false);
  const [manufacturerOptionsError, setManufacturerOptionsError] = useState('');
  const [assemblyTypeOptions, setAssemblyTypeOptions] = useState<AssemblyTypeOption[]>([]);
  const [assemblyTypeOptionsLoading, setAssemblyTypeOptionsLoading] = useState(false);
  const [assemblyTypeOptionsError, setAssemblyTypeOptionsError] = useState('');
  const [assemblyModelOptions, setAssemblyModelOptions] = useState<AssemblyModelOption[]>([]);
  const [assemblyModelOptionsLoading, setAssemblyModelOptionsLoading] = useState(false);
  const [assemblyModelOptionsError, setAssemblyModelOptionsError] = useState('');
  const [franchiseAssemblyModels, setFranchiseAssemblyModels] = useState<AssemblyModelOption[]>([]);
  const [franchiseAssemblyModelsLoading, setFranchiseAssemblyModelsLoading] = useState(false);
  const [systemTemplateModelOptions, setSystemTemplateModelOptions] = useState<AircraftTempOption[]>([]);
  const [aircraftTemplateRows, setAircraftTemplateRows] = useState<AircraftTemplateRecord[]>([]);
  const [aircraftTemplateLoading, setAircraftTemplateLoading] = useState(false);
  const [aircraftTemplateError, setAircraftTemplateError] = useState('');
  const [aircraftTemplateDialogOpen, setAircraftTemplateDialogOpen] = useState(false);
  const [aircraftTemplateDialogMode, setAircraftTemplateDialogMode] = useState<'create' | 'update'>('create');
  const [aircraftTemplateDialogSubmitting, setAircraftTemplateDialogSubmitting] = useState(false);
  const [aircraftTemplateDeleteSubmitting, setAircraftTemplateDeleteSubmitting] = useState(false);
  const [aircraftTemplateDeleteDialogOpen, setAircraftTemplateDeleteDialogOpen] = useState(false);
  const [selectedAircraftTemplateId, setSelectedAircraftTemplateId] = useState('');
  const [aircraftTemplateFormValues, setAircraftTemplateFormValues] = useState<AircraftTemplateFormValues>(getDefaultAircraftTemplateFormValues());
  const [aircraftTemplateFormErrors, setAircraftTemplateFormErrors] = useState<Record<string, string>>({});
  const [aircraftUnifiedSearch, setAircraftUnifiedSearch] = useState('');
  const [aircraftUnifiedStatusFilter, setAircraftUnifiedStatusFilter] = useState('all');
  const [aircraftUnifiedLocale, setAircraftUnifiedLocale] = useState('en');
  const [aircraftUnifiedTemplateTypeFilter, setAircraftUnifiedTemplateTypeFilter] = useState('all');
  const [aircraftUnifiedTemplateManufacturerFilter, setAircraftUnifiedTemplateManufacturerFilter] = useState('all');
  const [aircraftUnifiedDocumentCategoryFilter, setAircraftUnifiedDocumentCategoryFilter] = useState('all');
  const [aircraftUnifiedAdSbComplianceFilter, setAircraftUnifiedAdSbComplianceFilter] = useState('all');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState('all');
  const [facilityStationFilter, setFacilityStationFilter] = useState('all');
  const [workCenterTypeFilter, setWorkCenterTypeFilter] = useState('all');
  const deferredAircraftUnifiedSearch = useDeferredValue(aircraftUnifiedSearch);
  const [aircraftTypeOptions, setAircraftTypeOptions] = useState<string[]>([]);
  const [aircraftStatusOptions, setAircraftStatusOptions] = useState<string[]>([]);
  const [aircraftBaseCatalogOptions, setAircraftBaseCatalogOptions] = useState<string[]>([]);
  const [aircraftOwnerCatalogOptions, setAircraftOwnerCatalogOptions] = useState<string[]>([]);
  const [aircraftListboxOptionsLoading, setAircraftListboxOptionsLoading] = useState(false);
  const [aircraftTenantOptions, setAircraftTenantOptions] = useState<SelectOption[]>([]);
  const [aircraftTenantOptionsLoading, setAircraftTenantOptionsLoading] = useState(false);
  const [aircraftTenantOptionsError, setAircraftTenantOptionsError] = useState('');
  const [aircraftFranchiseOptions, setAircraftFranchiseOptions] = useState<SelectOption[]>([]);
  const [aircraftFranchiseOptionsLoading, setAircraftFranchiseOptionsLoading] = useState(false);
  const [aircraftFranchiseOptionsError, setAircraftFranchiseOptionsError] = useState('');
  const [aircraftWorkPackageDialogOpen, setAircraftWorkPackageDialogOpen] = useState(false);
  const [aircraftWorkPackageValues, setAircraftWorkPackageValues] = useState<AircraftWorkPackageFormValues>(getDefaultAircraftWorkPackageValues());
  const [aircraftWorkPackageErrors, setAircraftWorkPackageErrors] = useState<Record<string, string>>({});
  const [aircraftWorkPackageSubmitting, setAircraftWorkPackageSubmitting] = useState(false);
  const [aircraftWorkPackageActiveTab, setAircraftWorkPackageActiveTab] = useState<AircraftWorkPackageTab>('new-wp');
  const [aircraftWorkPackageTaskSearch, setAircraftWorkPackageTaskSearch] = useState('');
  const [aircraftWorkPackageTaskSort, setAircraftWorkPackageTaskSort] = useState<'taskNumber' | 'ataCode' | 'description'>('taskNumber');
  const [aircraftWorkPackageTaskSortDirection, setAircraftWorkPackageTaskSortDirection] = useState<SortDirection>('asc');
  const [aircraftWorkPackageTaskPage, setAircraftWorkPackageTaskPage] = useState(1);
  const [aircraftWorkPackageSelectedTaskIds, setAircraftWorkPackageSelectedTaskIds] = useState<string[]>([]);
  const [aircraftExistingWorkPackages, setAircraftExistingWorkPackages] = useState<AircraftWorkPackageRecordSummary[]>([]);
  const [aircraftExistingWorkPackagesLoading, setAircraftExistingWorkPackagesLoading] = useState(false);
  const [aircraftExistingWorkPackagesError, setAircraftExistingWorkPackagesError] = useState('');
  const [aircraftSelectedExistingWorkPackageId, setAircraftSelectedExistingWorkPackageId] = useState('');
  const [workPackageTemplateRegistry, setWorkPackageTemplateRegistry] = useState<WorkPackageTemplateRegistryItem[]>([]);
  const [workPackageTemplateRegistryLoading, setWorkPackageTemplateRegistryLoading] = useState(false);
  const [workPackageTemplateRegistryError, setWorkPackageTemplateRegistryError] = useState('');
  const [selectedWorkPackageTemplateId, setSelectedWorkPackageTemplateId] = useState('');
  const [aircraftTemplateAssociatedTasks, setAircraftTemplateAssociatedTasks] = useState<AircraftTemplateAssociatedTaskRow[]>([]);
  const [aircraftTemplateAssociatedTasksLoading, setAircraftTemplateAssociatedTasksLoading] = useState(false);
  const [aircraftTemplateAssociatedTasksError, setAircraftTemplateAssociatedTasksError] = useState('');
  const [flightLogDialogOpen, setFlightLogDialogOpen] = useState(false);
  const [flightLogSubmitting, setFlightLogSubmitting] = useState(false);
  const [flightLogMode, setFlightLogMode] = useState<FlightLogFormMode>('add');
  const [flightLogInitialValues, setFlightLogInitialValues] = useState<Partial<FlightLogFormValues>>(getDefaultFlightLogFormValues());
  const [flightLogDialogInstance, setFlightLogDialogInstance] = useState(0);
  const [flightLogDetailOpen, setFlightLogDetailOpen] = useState(false);
  const [flightLogDetailRow, setFlightLogDetailRow] = useState<RecordRow | null>(null);
  const [busyAction, setBusyAction] = useState<'refresh' | 'export' | 'export_pdf' | 'create' | null>(null);
  const [sortColumn, setSortColumn] = useState(searchParams.get('sort_by') || 'updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>((searchParams.get('sort_dir') as SortDirection) || 'desc');
  const [inlineEditingCell, setInlineEditingCell] = useState<InlineEditingCell>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [aircraftWorkPackageSnapshot, setAircraftWorkPackageSnapshot] = useState<AircraftWorkPackageSnapshot>({
    open: 0,
    inProgress: 0,
    deferred: 0,
    completed: 0,
    rtsBlockers: 0,
    slaRisk: 0,
  });
  const [aircraftDashboardLoading, setAircraftDashboardLoading] = useState(false);
  const [aircraftDashboardError, setAircraftDashboardError] = useState('');
  const [aircraftDashboard, setAircraftDashboard] = useState<AircraftDashboardOutput | null>(null);
  const [aircraftDashboardSearch, setAircraftDashboardSearch] = useState('');
  const [aircraftDashboardStatusFilter, setAircraftDashboardStatusFilter] = useState<'all' | 'active' | 'maintenance' | 'grounded'>('all');
  const [aircraftDashboardDueWindowDays, setAircraftDashboardDueWindowDays] = useState<(typeof AIRCRAFT_DASHBOARD_DUE_WINDOW_OPTIONS)[number]>('30');
  const [aircraftDashboardTrendDays, setAircraftDashboardTrendDays] = useState<'7' | '14' | '30'>('14');
  const [aircraftEngineAssets, setAircraftEngineAssets] = useState<EngineAssetReadModel[]>([]);
  const [aircraftEnginePerformanceHistory, setAircraftEnginePerformanceHistory] = useState<EnginePerformanceHistoryPoint[]>([]);
  const [aircraftEngineReadModelError, setAircraftEngineReadModelError] = useState('');
  const [engineEntrySerial, setEngineEntrySerial] = useState('');
  const [engineEntryPosition, setEngineEntryPosition] = useState<'L' | 'R' | 'C' | 'AUX'>('L');
  const [engineEntryTsn, setEngineEntryTsn] = useState('');
  const [engineEntryCsn, setEngineEntryCsn] = useState('');
  const [engineEntryModule, setEngineEntryModule] = useState('CORE');
  const [engineEntryErrors, setEngineEntryErrors] = useState<Record<string, string>>({});
  const [engineEntrySubmitting, setEngineEntrySubmitting] = useState(false);
  const [aircraftLeadsActiveTab, setAircraftLeadsActiveTab] = useState<AircraftLeadsTab>('list');
  const [aircraftNavigationView, setAircraftNavigationView] = useState<'module' | AircraftLeadsTab>('module');
  const [aircraftPresenceByRowId, setAircraftPresenceByRowId] = useState<Record<string, AircraftPresenceCollaborator[]>>({});
  const [aircraftPresenceLoading, setAircraftPresenceLoading] = useState(false);
  const [aircraftPresenceError, setAircraftPresenceError] = useState('');
  const aircraftPresenceCacheRef = useRef<{ key: string; fetchedAt: number; map: Record<string, AircraftPresenceCollaborator[]> } | null>(null);
  const aircraftColumnPreferencesHydratedRef = useRef(false);
  const clickDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const recordsRequestControllerRef = useRef<AbortController | null>(null);
  const recordsRequestIdRef = useRef(0);
  const rowsRenderSignatureRef = useRef('');
  const manufacturerSeedAttemptedRef = useRef(false);
  const assemblyTypeSeedAttemptedRef = useRef(false);
  const assemblyModelSeedAttemptedRef = useRef(false);
  const aircraftTemplateSeedAttemptedRef = useRef(false);
  const selectionAnchorRef = useRef<string | null>(null);
  const aircraftSnapshotAuthToastShownRef = useRef(false);
  const aircraftEnhancementEnabled = normalizeFeatureFlag(import.meta.env.VITE_AMRO_AIRCRAFT_FORM_ENHANCEMENTS, true);
  const workPackageTemplateStandardDefault = import.meta.env.MODE !== 'test';
  const workPackageTemplateStandardEnabled = normalizeFeatureFlag(
    import.meta.env.VITE_AMRO_WPT_STANDARD_TEMPLATE,
    workPackageTemplateStandardDefault,
  );
  const aircraftFormDraftKey = useMemo(
    () => `amro:aircraft-form-draft:${modalMode}:${selectedId || 'new'}`,
    [modalMode, selectedId],
  );
  const [aircraftFormDraftStatus, setAircraftFormDraftStatus] = useState<'idle' | 'restored' | 'saved'>('idle');
  const [aircraftFormLastSavedAt, setAircraftFormLastSavedAt] = useState('');
  const [lastCollaborationPingAt, setLastCollaborationPingAt] = useState(new Date().toISOString());
  const [aircraftNoSerialNumber, setAircraftNoSerialNumber] = useState(false);
  const [aircraftTemplateModel, setAircraftTemplateModel] = useState('');
  const [aircraftManufacturingDate, setAircraftManufacturingDate] = useState('');
  const [aircraftBase, setAircraftBase] = useState(AIRCRAFT_UNSELECTED_OPTION);
  const [aircraftOwner, setAircraftOwner] = useState(AIRCRAFT_UNSELECTED_OPTION);
  const [aircraftLineNumber, setAircraftLineNumber] = useState('');
  const [aircraftVariableNumber, setAircraftVariableNumber] = useState('');
  const [aircraftMaintenanceRevisionNumber, setAircraftMaintenanceRevisionNumber] = useState('');
  const [aircraftMaintenanceRevisionDate, setAircraftMaintenanceRevisionDate] = useState('');
  const [aircraftAmendmentNumber, setAircraftAmendmentNumber] = useState('');
  const [aircraftAmendmentDate, setAircraftAmendmentDate] = useState('');
  const [aircraftCounterRows, setAircraftCounterRows] = useState<AircraftCounterRow[]>(getDefaultAircraftCounterRows);
  const canCreateWorkPackage = hasPermission('create_maintenance_request');
  const canScheduleWorkPackage = hasPermission('edit_aircraft_records');
  const canExportAircraftOps = hasPermission('delete_flight_logs');
  const canEscalateAircraftOps = hasPermission('approve_work_orders');
  const canCreateAircraftRecords = hasPermission('edit_aircraft_records') || hasPermission('create_maintenance_request');
  const canManageAircraftTemplates = hasPermission('edit_aircraft_records') || hasPermission('create_maintenance_request');
  const canDeleteAircraftTemplates = hasPermission('approve_work_orders') || hasPermission('delete_flight_logs');
  const canManageAircraftLeads = hasPermission('edit_aircraft_records') || hasPermission('create_maintenance_request');
  const canDeleteAircraftLeads = hasPermission('approve_work_orders') || hasPermission('delete_flight_logs');
  const scope = useMemo(
    () => ({
      tenantId: context.tenantId,
      franchiseId: context.franchiseId,
      userId: context.userId,
      isTenantAdmin: context.isTenantAdmin,
    }),
    [context.franchiseId, context.isTenantAdmin, context.tenantId, context.userId],
  );
  const sessionAccessToken = useMemo(() => String(session?.access_token || '').trim(), [session?.access_token]);
  const aircraftColumnPreferenceStorageKey = useMemo(
    () => `amro:aircraft-visible-columns:${scope.tenantId || 'tenant'}:${scope.franchiseId || 'franchise'}`,
    [scope.franchiseId, scope.tenantId],
  );
  const [aircraftSelectedColumns, setAircraftSelectedColumns] = useState<string[]>([]);
  const aircraftSubModuleSegment = useMemo<AircraftSubModuleSegment>(() => {
    if (!isAircraftSubModule) {
      return 'list';
    }
    if (!location.pathname.startsWith('/dashboard/amro/aircraft')) {
      return 'list';
    }
    const segment = location.pathname.replace('/dashboard/amro/aircraft', '').replace(/^\/+/, '');
    if (!segment) {
      return 'list';
    }
    if (AIRCRAFT_SUBMODULE_SEGMENTS.includes(segment as AircraftSubModuleSegment)) {
      return segment as AircraftSubModuleSegment;
    }
    return 'list';
  }, [isAircraftSubModule, location.pathname]);
  const currentAircraftNavPath = useMemo(
    () => (aircraftSubModuleSegment === 'list' ? '/dashboard/amro/aircraft/list' : `/dashboard/amro/aircraft/${aircraftSubModuleSegment}`),
    [aircraftSubModuleSegment],
  );
  const aircraftDashboardModule = useMemo<AircraftDashboardModuleFilter>(() => {
    if (aircraftSubModuleSegment === 'engine') return 'engine';
    if (aircraftSubModuleSegment === 'components') return 'components';
    if (aircraftSubModuleSegment === 'list') return 'overview';
    return 'overview';
  }, [aircraftSubModuleSegment]);
  const showAircraftLeadWorkspace =
    entity === 'aircraft'
    && aircraftEnhancementEnabled
    && ((!isAircraftSubModule && aircraftNavigationView !== 'module') || aircraftSubModuleSegment === 'work-packages');
  const showAircraftTemplatesWorkspace = entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule && aircraftSubModuleSegment === 'templates';
  const showAircraftMasterRecords = entity === 'aircraft'
    ? (!isAircraftSubModule || aircraftSubModuleSegment === 'list')
      && !showAircraftTemplatesWorkspace
    : !showAircraftLeadWorkspace;
  const showAircraftEngineWorkspace = entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule && aircraftSubModuleSegment === 'engine';
  const showAircraftComponentsWorkspace = entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule && aircraftSubModuleSegment === 'components';
  const showAircraftDocumentsWorkspace = entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule && aircraftSubModuleSegment === 'documents';
  const showAircraftAdSbWorkspace = entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule && aircraftSubModuleSegment === 'ad-sb';
  const showAircraftUnifiedControlsInOperationsCard = entity === 'aircraft'
    && aircraftEnhancementEnabled
    && isAircraftSubModule
    && aircraftSubModuleSegment !== 'list'
    && aircraftSubModuleSegment !== 'templates';
  const showAircraftOperationsOverview = !showAircraftEngineWorkspace && !showAircraftComponentsWorkspace && !showAircraftDocumentsWorkspace && !showAircraftAdSbWorkspace && !showAircraftTemplatesWorkspace;
  const showAircraftOperationsOverviewSection = false;
  const handleAircraftViewNavigation = useCallback((tab: AircraftLeadsTab) => {
    if (isAircraftSubModule) {
      const nextPath = AIRCRAFT_NAV_RAIL.find((item) => item.view === tab)?.path || '/dashboard/amro/aircraft/list';
      navigate(`${nextPath}${location.search}`, { replace: true });
    }
    if (tab === 'list') {
      setAircraftLeadsActiveTab(tab);
      setAircraftNavigationView('module');
      window.requestAnimationFrame(() => {
        focusUnifiedMasterSearch();
      });
      return;
    }
    setAircraftLeadsActiveTab(tab);
    setAircraftNavigationView(tab);
  }, [isAircraftSubModule, location.search, navigate]);
  const focusUnifiedMasterSearch = useCallback(() => {
    const field = document.querySelector<HTMLInputElement>('[aria-label="Unified module search"]');
    if (field) {
      field.focus();
    }
  }, []);

  useEffect(() => {
    if (entity !== 'aircraft') {
      setAircraftNavigationView('module');
      setAircraftLeadsActiveTab('list');
    }
  }, [entity]);
  useEffect(() => {
    if (!isAircraftSubModule) {
      return;
    }
    const view = AIRCRAFT_SUBMODULE_VIEW_MAP[aircraftSubModuleSegment] || 'module';
    if (view === 'module') {
      setAircraftLeadsActiveTab('list');
      setAircraftNavigationView('module');
      return;
    }
    setAircraftLeadsActiveTab(view);
    setAircraftNavigationView(view);
  }, [aircraftSubModuleSegment, isAircraftSubModule]);
  const trackWorkPackageTemplateAdoption = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      const payload = {
        event,
        tenantId: scope.tenantId || '',
        franchiseId: scope.franchiseId || '',
        userId: scope.userId || '',
        timestamp: new Date().toISOString(),
        ...details,
      };
      logger.info('Aircraft work package template adoption metric', {
        component: 'AmroSettingsMasterDataPage',
        ...payload,
      });
      try {
        const key = 'amro:work-package-template-adoption-metrics';
        const previousRaw = localStorage.getItem(key);
        const previous = previousRaw ? JSON.parse(previousRaw) : [];
        const next = Array.isArray(previous) ? [...previous, payload].slice(-100) : [payload];
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        return;
      }
    },
    [scope.franchiseId, scope.tenantId, scope.userId],
  );

  const fetchManufacturerOptions = useCallback(async (headers: Headers, tenantId: string): Promise<ManufacturerOption[]> => {
    const query = new URLSearchParams({
      page: '1',
      page_size: '200',
      sort_by: 'name',
      sort_dir: 'asc',
      tenant_id: tenantId,
    });
    const response = await fetch(`/api/v2/amro/master-data/manufacturers?${query.toString()}`, { method: 'GET', headers });
    const payload = await parseApiPayload(response);
    if (!response.ok) throw new Error(String(payload.error || 'Failed to load manufacturers'));
    const records = getPayloadRecords(payload);
    const options = records
      .map((record) => {
        const id = String(record.id || '').trim();
        if (!id) return null;
        const code = String(record.manufacturer_code || '').trim();
        const name = String(record.name || '').trim();
        const tenantId = String(record.tenant_id || '').trim();
        const label = name && code ? `${name} (${code})` : name || code || id;
        const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
        return { id, label, code, name, tenantId, active };
      })
      .filter((option): option is ManufacturerOption => Boolean(option));
    return filterManufacturersByTenant(options, tenantId);
  }, []);

  const fetchAssemblyTypeOptions = useCallback(async (headers: Headers): Promise<AssemblyTypeOption[]> => {
    const query = new URLSearchParams({
      page: '1',
      page_size: '200',
      sort_by: 'name',
      sort_dir: 'asc',
    });
    const response = await fetch(`/api/v2/amro/master-data/assembly_types?${query.toString()}`, { method: 'GET', headers });
    const payload = await parseApiPayload(response);
    if (!response.ok) throw new Error(String(payload.error || 'Failed to load assembly types'));
    const records = getPayloadRecords(payload);
    return records
      .map((record) => {
        const id = String(record.id || '').trim();
        if (!id) return null;
        const code = String(record.assembly_code || '').trim();
        const name = String(record.name || '').trim();
        const label = name && code ? `${name} (${code})` : name || code || id;
        const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
        return { id, label, active };
      })
      .filter((option): option is AssemblyTypeOption => Boolean(option));
  }, []);

  const fetchAssemblyModelOptions = useCallback(async (headers: Headers): Promise<AssemblyModelOption[]> => {
    const query = new URLSearchParams({
      page: '1',
      page_size: '500',
      sort_by: 'name',
      sort_dir: 'asc',
    });
    const response = await fetch(`/api/v2/amro/master-data/assembly_models?${query.toString()}`, { method: 'GET', headers });
    const payload = await parseApiPayload(response);
    if (!response.ok) throw new Error(String(payload.error || 'Failed to load aircraft models'));
    const records = getPayloadRecords(payload);
    return records
      .map((record) => {
        const id = String(record.id || '').trim();
        if (!id) return null;
        const manufacturerId = String(record.manufacturer_id || '').trim();
        const code = String(record.model_code || '').trim();
        const name = String(record.name || '').trim();
        const modelValue = name || code || id;
        const label = name && code && name !== code ? `${name} (${code})` : name || code || id;
        const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
        const manufacturerTokens = [
          manufacturerId,
          String(record.manufacturer || '').trim(),
          String(record.manufacturer_code || '').trim(),
          String(record.manufacturer_name || '').trim(),
          String(record.manufacturer_label || '').trim(),
        ]
          .filter(Boolean)
          .map((token) => token.toLowerCase());
        return { id, manufacturerId, label, modelValue, manufacturerTokens, active };
      })
      .filter((option): option is AssemblyModelOption => Boolean(option));
  }, []);

  const fetchAircraftTempOptions = useCallback(async (headers: Headers): Promise<AircraftTempOption[]> => {
    // Always use API for aircraft templates; direct scoped DB access can fail on
    // environments where aircraft_template does not expose franchise_id.
    const query = new URLSearchParams({
      page: '1',
      page_size: '200',
      sort_by: 'template_name',
      sort_dir: 'asc',
    });
    const response = await fetch(`/api/v2/amro/master-data/aircraft_template?${query.toString()}`, { method: 'GET', headers });
    const payload = await parseApiPayload(response);
    if (!response.ok) throw new Error(String(payload.error || 'Failed to load aircraft templates'));
    const records = getPayloadRecords(payload);
    const seen = new Set<string>();
    return records
      .map((record) => {
        const id = String(record.id || '').trim();
        const name = String(record.template_name || '').trim();
        if (!id || !name) return null;
        if (seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          name,
          tenantId: String(record.tenant_id || '').trim(),
          franchiseId: String(record.franchise_id || '').trim(),
          aircraftType: String(record.aircraft_type || '').trim(),
          manufacturerId: String(record.manufacturer_id || '').trim(),
          manufacturerName: String(record.manufacturer || '').trim(),
          aircraftModel: String(record.aircraft_model || '').trim(),
          maintenanceProgram: String(record.maintenance_program || '').trim(),
          revisionNumber: String(record.revision_number || '').trim(),
          amendmentNumber: String(record.amendment_number || '').trim(),
        };
      })
      .filter((option): option is AircraftTempOption => Boolean(option))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, []);

  const fetchAircraftTemplateCounterRows = useCallback(
    async (templateId: string): Promise<AircraftCounterRow[]> => {
      const normalizedTemplateId = String(templateId || '').trim();
      if (!normalizedTemplateId || !scopedDb) {
        return getDefaultAircraftCounterRows();
      }
      const { data, error } = await (scopedDb as any)
        .from('aircraft_template_counters')
        .select('*')
        .eq('template_id', normalizedTemplateId);
      if (error || !Array.isArray(data) || data.length === 0) {
        return getDefaultAircraftCounterRows();
      }
      const normalizeCounterKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const counterRowByKey = new Map(getDefaultAircraftCounterRows().map((row) => [row.key, row]));
      const mappedRows = (data as Record<string, unknown>[])
        .map((record) => {
          const name = String(record.counter_name || '').trim();
          if (!name) return null;
          const key = normalizeCounterKey(name);
          return {
            key,
            name,
            serialNumber: String(record.serial_number || record.serial_no || '').trim(),
            model: String(record.model || record.model_affected || '').trim(),
            initialValue: String(record.initial_value || '').trim(),
            initialDate: String(record.initial_date || '').trim().slice(0, 10),
            unit: String(record.unit_measured || '').trim(),
          } as AircraftCounterRow;
        })
        .filter((row): row is AircraftCounterRow => Boolean(row));
      if (mappedRows.length === 0) {
        return getDefaultAircraftCounterRows();
      }
      mappedRows.forEach((row) => {
        counterRowByKey.set(row.key, row);
      });
      return Array.from(counterRowByKey.values());
    },
    [scopedDb],
  );

  const fetchAircraftCreateCatalogOptions = useCallback(
    async (headers: Headers): Promise<{ aircraftTypes: string[]; aircraftStatuses: string[]; aircraftOwners: string[]; aircraftBases: string[] }> => {
      const query = new URLSearchParams({
        page: '1',
        page_size: '500',
        sort_by: 'updated_at',
        sort_dir: 'desc',
      });
      const response = await fetch(`/api/v2/amro/master-data/aircraft?${query.toString()}`, { method: 'GET', headers });
      const payload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Failed to load aircraft option catalog'));
      const typeSeen = new Set<string>();
      const statusSeen = new Set<string>();
      const ownerSeen = new Set<string>();
      const baseSeen = new Set<string>();
      const aircraftTypes: string[] = [];
      const aircraftStatuses: string[] = [];
      const aircraftOwners: string[] = [];
      const aircraftBases: string[] = [];
      getPayloadRecords(payload).forEach((record) => {
        const aircraftType = String(record.aircraft_type || '').trim();
        if (aircraftType) {
          const key = aircraftType.toLowerCase();
          if (!typeSeen.has(key)) {
            typeSeen.add(key);
            aircraftTypes.push(aircraftType);
          }
        }
        const status = String(record.status || '').trim().toLowerCase();
        if (status) {
          if (!statusSeen.has(status)) {
            statusSeen.add(status);
            aircraftStatuses.push(status);
          }
        }
        const owner = String(record.owner_name || '').trim();
        if (owner) {
          const key = owner.toLowerCase();
          if (!ownerSeen.has(key)) {
            ownerSeen.add(key);
            aircraftOwners.push(owner);
          }
        }
        const base = String(record.base_location || '').trim();
        if (base) {
          const key = base.toLowerCase();
          if (!baseSeen.has(key)) {
            baseSeen.add(key);
            aircraftBases.push(base);
          }
        }
      });
      return { aircraftTypes, aircraftStatuses, aircraftOwners, aircraftBases };
    },
    [],
  );

  const seedAircraftTemplatesIfNeeded = useCallback(async (headers: Headers): Promise<boolean> => {
    if (aircraftTemplateSeedAttemptedRef.current) {
      return false;
    }
    const query = new URLSearchParams({
      page: '1',
      page_size: '200',
      sort_by: 'template_name',
      sort_dir: 'asc',
    });
    const response = await fetch(`/api/v2/amro/master-data/work_package_templates?${query.toString()}`, {
      method: 'GET',
      headers,
    });
    const payload = await parseApiPayload(response);
    if (!response.ok) {
      aircraftTemplateSeedAttemptedRef.current = true;
      return false;
    }
    const records = getPayloadRecords(payload);
    if (records.length === 0) {
      aircraftTemplateSeedAttemptedRef.current = true;
      return false;
    }
    const inferAircraftType = (templateName: string, maintenanceType: string): string => {
      const text = `${templateName} ${maintenanceType}`.toLowerCase();
      if (/(787|777|747|767|350|340|330|a3[3-9]|a380|wide)/.test(text)) {
        return 'WideBody';
      }
      return 'NarrowBody';
    };
    const inferManufacturer = (templateName: string): string => {
      const text = templateName.toLowerCase();
      if (text.includes('airbus') || /\ba\d{3}/.test(text)) return 'Airbus';
      if (text.includes('boeing') || /\bb\d{3}/.test(text)) return 'Boeing';
      if (text.includes('embraer') || /\be\d{3}/.test(text)) return 'Embraer';
      if (text.includes('atr')) return 'ATR';
      return '';
    };
    const inferAircraftModel = (templateName: string): string => {
      const match = templateName.match(/\b([ABE]\d{3}(?:-\d{1,3})?)\b/i);
      return match?.[1]?.toUpperCase() || '';
    };
    const seen = new Set<string>();
    const seedRecords = records
      .map((record) => {
        const templateName = String(record.template_name || '').trim();
        if (!templateName) return null;
        const dedupeKey = templateName.toLowerCase();
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);
        const maintenanceType = String(record.maintenance_type || '').trim();
        const aircraftType = inferAircraftType(templateName, maintenanceType);
        return {
          template_name: templateName,
          aircraft_type: aircraftType,
          manufacturer: inferManufacturer(templateName),
          aircraft_model: inferAircraftModel(templateName),
          maintenance_program: String(record.template_code || '').trim(),
          revision_number: String(record.version || '').trim(),
          amendment_number: '',
        };
      })
      .filter(
        (
          record,
        ): record is {
          template_name: string;
          aircraft_type: string;
          manufacturer: string;
          aircraft_model: string;
          maintenance_program: string;
          revision_number: string;
          amendment_number: string;
        } => Boolean(record),
      );
    if (seedRecords.length === 0) {
      aircraftTemplateSeedAttemptedRef.current = true;
      return false;
    }
    const createResponse = await fetch('/api/v2/amro/master-data/aircraft_template', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation: 'bulk_import',
        records: seedRecords,
      }),
    });
    const createPayload = await parseApiPayload(createResponse);
    aircraftTemplateSeedAttemptedRef.current = true;
    if (!createResponse.ok) {
      logger.warn('Aircraft template seed from work package templates failed', {
        component: 'AmroSettingsMasterDataPage',
        error: String(createPayload.error || 'Create aircraft_template bulk import failed'),
      });
      return false;
    }
    return true;
  }, []);

  const fetchAircraftBaseFacilityOptions = useCallback(async (headers: Headers): Promise<string[]> => {
    const query = new URLSearchParams({
      page: '1',
      page_size: '500',
      sort_by: 'station_code',
      sort_dir: 'asc',
    });
    const response = await fetch(`/api/v2/amro/master-data/maintenance_facilities?${query.toString()}`, { method: 'GET', headers });
    const payload = await parseApiPayload(response);
    if (!response.ok) throw new Error(String(payload.error || 'Failed to load maintenance facilities'));
    const seen = new Set<string>();
    const options: string[] = [];
    getPayloadRecords(payload).forEach((record) => {
      const stationCode = String(record.station_code || '').trim();
      if (!stationCode) return;
      const key = stationCode.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(stationCode);
    });
    return options;
  }, []);

  const seedManufacturersIfNeeded = useCallback(async (headers: Headers) => {
    if (manufacturerSeedAttemptedRef.current) {
      return false;
    }
    const seedRecords = createSeedRecords('manufacturers');
    if (!seedRecords.length) {
      manufacturerSeedAttemptedRef.current = true;
      return false;
    }
    const response = await fetch('/api/v2/amro/master-data/manufacturers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ operation: 'bulk_import', records: seedRecords }),
    });
    const payload = await parseApiPayload(response);
    manufacturerSeedAttemptedRef.current = true;
    if (!response.ok) {
      throw new Error(String(payload.error || 'Failed to seed manufacturers'));
    }
    return true;
  }, []);

  const seedAssemblyTypesIfNeeded = useCallback(async (headers: Headers) => {
    if (assemblyTypeSeedAttemptedRef.current) {
      return false;
    }
    const response = await fetch('/api/v2/amro/master-data/assembly_types', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation: 'bulk_import',
        records: [
          {
            assembly_code: 'AIRFRAME',
            name: 'Airframe',
            description: 'Aircraft structure and certified configuration reference',
            is_active: true,
            metadata: { source: 'master_data_seed_ui' },
          },
        ],
      }),
    });
    const payload = await parseApiPayload(response);
    assemblyTypeSeedAttemptedRef.current = true;
    if (!response.ok) {
      throw new Error(String(payload.error || 'Failed to seed assembly types'));
    }
    return true;
  }, []);

  const seedAssemblyModelsIfNeeded = useCallback(
    async (headers: Headers, manufacturerReferenceOptions: ManufacturerOption[], assemblyTypeReferenceOptions: AssemblyTypeOption[]) => {
      if (assemblyModelSeedAttemptedRef.current) {
        return false;
      }
      const activeManufacturers = manufacturerReferenceOptions.filter((option) => option.active);
      if (!activeManufacturers.length || !assemblyTypeReferenceOptions.length) {
        assemblyModelSeedAttemptedRef.current = true;
        return false;
      }
      const preferredAssemblyType =
        assemblyTypeReferenceOptions.find((option) => option.label.toLowerCase().includes('airframe')) ||
        assemblyTypeReferenceOptions.find((option) => option.active) ||
        assemblyTypeReferenceOptions[0];
      const assemblyTypeId = preferredAssemblyType?.id || '';
      if (!assemblyTypeId) {
        assemblyModelSeedAttemptedRef.current = true;
        return false;
      }
      const normalize = (value: string) => value.trim().toLowerCase();
      const findManufacturerId = (token: string) =>
        activeManufacturers.find((option) => {
          const name = normalize(option.name);
          const code = normalize(option.code);
          const label = normalize(option.label);
          const target = normalize(token);
          return name.includes(target) || code === target || label.includes(target);
        })?.id;
      const preferredBlueprints = [
        { token: 'airbus', code: 'A320-200', name: 'A320-200' },
        { token: 'boeing', code: 'B737-800', name: 'B737-800' },
        { token: 'embraer', code: 'E190-E2', name: 'E190-E2' },
        { token: 'atr', code: 'ATR72-600', name: 'ATR72-600' },
      ];
      const seededManufacturerIds = new Set<string>();
      const records: Record<string, unknown>[] = [];
      preferredBlueprints.forEach((blueprint) => {
        const manufacturerId = findManufacturerId(blueprint.token);
        if (!manufacturerId || seededManufacturerIds.has(manufacturerId)) {
          return;
        }
        seededManufacturerIds.add(manufacturerId);
        records.push({
          manufacturer_id: manufacturerId,
          assembly_type_id: assemblyTypeId,
          model_code: blueprint.code,
          name: blueprint.name,
          primary_model: blueprint.name,
          description: `${blueprint.name} airframe reference`,
          is_active: true,
          metadata: { source: 'master_data_seed_ui' },
        });
      });
      if (!records.length) {
        activeManufacturers.slice(0, 12).forEach((manufacturer, index) => {
          const codeToken = String(manufacturer.code || 'MODEL')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '')
            .slice(0, 8);
          const suffix = String(index + 1).padStart(2, '0');
          const modelCode = `${codeToken || 'MODEL'}-${suffix}`;
          const modelName = `${manufacturer.name || manufacturer.label || 'Aircraft'} Series ${suffix}`;
          records.push({
            manufacturer_id: manufacturer.id,
            assembly_type_id: assemblyTypeId,
            model_code: modelCode,
            name: modelName,
            primary_model: modelName,
            description: `${modelName} airframe reference`,
            is_active: true,
            metadata: { source: 'master_data_seed_ui' },
          });
        });
      }
      if (!records.length) {
        assemblyModelSeedAttemptedRef.current = true;
        return false;
      }
      const response = await fetch('/api/v2/amro/master-data/assembly_models', {
        method: 'POST',
        headers,
        body: JSON.stringify({ operation: 'bulk_import', records }),
      });
      const payload = await parseApiPayload(response);
      assemblyModelSeedAttemptedRef.current = true;
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to seed aircraft models'));
      }
      return true;
    },
    [],
  );

  const loadManufacturerOptions = useCallback(async (tenantOverride = '') => {
    setManufacturerOptionsLoading(true);
    setManufacturerOptionsError('');
    try {
      const tenantScopeId = String(tenantOverride || formValues.tenant_id || scope.tenantId || '').trim();
      const headers = await buildApiHeaders({ tenantId: tenantScopeId, userId: scope.userId, franchiseId: null });
      let options = await fetchManufacturerOptions(headers, tenantScopeId);
      if (options.length === 0) {
        const seeded = await seedManufacturersIfNeeded(headers);
        if (seeded) {
          options = await fetchManufacturerOptions(headers, tenantScopeId);
        }
      }
      setManufacturerOptions(options);
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load manufacturers');
      setManufacturerOptionsError(message);
      toast.error(message);
    } finally {
      setManufacturerOptionsLoading(false);
    }
  }, [fetchManufacturerOptions, formValues.tenant_id, scope.tenantId, scope.userId, seedManufacturersIfNeeded]);

  const loadAssemblyTypeOptions = useCallback(async () => {
    setAssemblyTypeOptionsLoading(true);
    setAssemblyTypeOptionsError('');
    try {
      const headers = await buildApiHeaders(scope);
      let options = await fetchAssemblyTypeOptions(headers);
      if (options.length === 0) {
        const seeded = await seedAssemblyTypesIfNeeded(headers);
        if (seeded) {
          options = await fetchAssemblyTypeOptions(headers);
        }
      }
      setAssemblyTypeOptions(options);
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load assembly types');
      setAssemblyTypeOptionsError(message);
      toast.error(message);
    } finally {
      setAssemblyTypeOptionsLoading(false);
    }
  }, [fetchAssemblyTypeOptions, scope, seedAssemblyTypesIfNeeded]);

  const loadAssemblyModelOptions = useCallback(async () => {
    setAssemblyModelOptionsLoading(true);
    setAssemblyModelOptionsError('');
    try {
      const headers = await buildApiHeaders(scope);
      let options = await fetchAssemblyModelOptions(headers);
      if (options.length === 0) {
        let manufacturerReferenceOptions = manufacturerOptions;
        if (manufacturerReferenceOptions.length === 0) {
          manufacturerReferenceOptions = await fetchManufacturerOptions(headers, String(scope.tenantId || '').trim());
          if (manufacturerReferenceOptions.length === 0) {
            const seededManufacturers = await seedManufacturersIfNeeded(headers);
            if (seededManufacturers) {
              manufacturerReferenceOptions = await fetchManufacturerOptions(headers, String(scope.tenantId || '').trim());
            }
          }
          if (manufacturerReferenceOptions.length > 0) {
            setManufacturerOptions(manufacturerReferenceOptions);
          }
        }
        let assemblyTypeReferenceOptions = assemblyTypeOptions;
        if (assemblyTypeReferenceOptions.length === 0) {
          assemblyTypeReferenceOptions = await fetchAssemblyTypeOptions(headers);
          if (assemblyTypeReferenceOptions.length === 0) {
            const seededAssemblyTypes = await seedAssemblyTypesIfNeeded(headers);
            if (seededAssemblyTypes) {
              assemblyTypeReferenceOptions = await fetchAssemblyTypeOptions(headers);
            }
          }
          if (assemblyTypeReferenceOptions.length > 0) {
            setAssemblyTypeOptions(assemblyTypeReferenceOptions);
          }
        }
        const seededModels = await seedAssemblyModelsIfNeeded(headers, manufacturerReferenceOptions, assemblyTypeReferenceOptions);
        if (seededModels) {
          options = await fetchAssemblyModelOptions(headers);
        }
      }
      setAssemblyModelOptions(options);
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load aircraft models');
      setAssemblyModelOptionsError(message);
      toast.error(message);
    } finally {
      setAssemblyModelOptionsLoading(false);
    }
  }, [
    assemblyTypeOptions,
    fetchAssemblyModelOptions,
    fetchAssemblyTypeOptions,
    fetchManufacturerOptions,
    manufacturerOptions,
    scope,
    seedAssemblyModelsIfNeeded,
    seedAssemblyTypesIfNeeded,
    seedManufacturersIfNeeded,
  ]);

  const loadAircraftCreateListboxOptions = useCallback(async () => {
    if (entity !== 'aircraft') {
      return;
    }
    setAircraftListboxOptionsLoading(true);
    try {
      const headers = await buildApiHeaders(scope);
      let templateOptions = await fetchAircraftTempOptions(headers);
      if (templateOptions.length === 0) {
        const seeded = await seedAircraftTemplatesIfNeeded(headers);
        if (seeded) {
          templateOptions = await fetchAircraftTempOptions(headers);
        }
      }
      setSystemTemplateModelOptions(templateOptions);
      const [aircraftCatalogResult, facilityBasesResult] = await Promise.allSettled([
        fetchAircraftCreateCatalogOptions(headers),
        fetchAircraftBaseFacilityOptions(headers),
      ]);
      if (aircraftCatalogResult.status === 'fulfilled') {
        const templateAircraftTypes = Array.from(new Set(templateOptions.map((option) => String(option.aircraftType || '').trim()).filter(Boolean)));
        const enumLikeAircraftTypes = AIRCRAFT_TYPE_FALLBACK_OPTIONS.filter((option) => !templateAircraftTypes.includes(option));
        setAircraftTypeOptions([...templateAircraftTypes, ...enumLikeAircraftTypes]);
        setAircraftStatusOptions(aircraftCatalogResult.value.aircraftStatuses);
        setAircraftOwnerCatalogOptions(aircraftCatalogResult.value.aircraftOwners);
      } else {
        const templateAircraftTypes = Array.from(new Set(templateOptions.map((option) => String(option.aircraftType || '').trim()).filter(Boolean)));
        const enumLikeAircraftTypes = AIRCRAFT_TYPE_FALLBACK_OPTIONS.filter((option) => !templateAircraftTypes.includes(option));
        setAircraftTypeOptions([...templateAircraftTypes, ...enumLikeAircraftTypes]);
      }
      if (facilityBasesResult.status === 'fulfilled') {
        const catalogBases = aircraftCatalogResult.status === 'fulfilled' ? aircraftCatalogResult.value.aircraftBases : [];
        setAircraftBaseCatalogOptions([...facilityBasesResult.value, ...catalogBases]);
      } else if (aircraftCatalogResult.status === 'fulfilled') {
        setAircraftBaseCatalogOptions(aircraftCatalogResult.value.aircraftBases);
      }
    } catch (error) {
      toast.error(String((error as Error).message || 'Failed to load aircraft listbox options'));
    } finally {
      setAircraftListboxOptionsLoading(false);
    }
  }, [entity, fetchAircraftBaseFacilityOptions, fetchAircraftCreateCatalogOptions, fetchAircraftTempOptions, scope, seedAircraftTemplatesIfNeeded]);

  const loadAircraftTemplatesWorkspace = useCallback(async () => {
    if (entity !== 'aircraft') {
      return;
    }
    setAircraftTemplateLoading(true);
    setAircraftTemplateError('');
    try {
      const records = await listAircraftTemplates(scope, sessionAccessToken);
      setAircraftTemplateRows(records);
      const templateOptions = records
        .map((record) => {
          const id = String(record.id || '').trim();
          const name = String(record.template_name || '').trim();
          if (!id || !name) return null;
          return {
            id,
            name,
            tenantId: String(record.tenant_id || '').trim(),
            franchiseId: String(record.franchise_id || '').trim(),
            aircraftType: String(record.aircraft_type || '').trim(),
            manufacturerId: String(record.manufacturer_id || '').trim(),
            manufacturerName: String(record.manufacturer || '').trim(),
            aircraftModel: String(record.aircraft_model || '').trim(),
            maintenanceProgram: String(record.maintenance_program || '').trim(),
            revisionNumber: String(record.revision_number || '').trim(),
            amendmentNumber: String(record.amendment_number || '').trim(),
          } satisfies AircraftTempOption;
        })
        .filter((record): record is AircraftTempOption => Boolean(record));
      setSystemTemplateModelOptions(templateOptions);
      setAircraftTypeOptions((previous) => {
        const fromTemplates = templateOptions.map((option) => String(option.aircraftType || '').trim()).filter(Boolean);
        const merged = Array.from(new Set([...previous, ...fromTemplates, ...AIRCRAFT_TYPE_FALLBACK_OPTIONS]));
        return merged;
      });
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load aircraft templates');
      setAircraftTemplateError(message);
      toast.error(message);
    } finally {
      setAircraftTemplateLoading(false);
    }
  }, [entity, scope, sessionAccessToken]);

  const resetAircraftTemplateDialog = useCallback(() => {
    setAircraftTemplateDialogOpen(false);
    setAircraftTemplateDialogMode('create');
    setAircraftTemplateDialogSubmitting(false);
    setAircraftTemplateFormErrors({});
    setAircraftTemplateFormValues(getDefaultAircraftTemplateFormValues());
    setSelectedAircraftTemplateId('');
  }, []);

  const validateAircraftTemplateForm = useCallback((values: AircraftTemplateFormValues): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!values.template_name.trim()) {
      errors.template_name = 'Template Name is required';
    }
    if (!values.aircraft_type.trim()) {
      errors.aircraft_type = 'Aircraft Type is required';
    }
    return errors;
  }, []);

  const openCreateAircraftTemplateDialog = useCallback(() => {
    if (!canManageAircraftTemplates) {
      toast.error('You do not have permission to manage templates');
      return;
    }
    setAircraftTemplateDialogMode('create');
    setAircraftTemplateFormValues(getDefaultAircraftTemplateFormValues());
    setAircraftTemplateFormErrors({});
    setSelectedAircraftTemplateId('');
    setAircraftTemplateDialogOpen(true);
  }, [canManageAircraftTemplates]);

  const openEditAircraftTemplateDialog = useCallback(
    (record: AircraftTemplateRecord) => {
      if (!canManageAircraftTemplates) {
        toast.error('You do not have permission to manage templates');
        return;
      }
      const templateId = String(record.id || '').trim();
      if (!templateId) {
        toast.error('Select a valid template');
        return;
      }
      setAircraftTemplateDialogMode('update');
      setAircraftTemplateFormValues(mapAircraftTemplateRecordToFormValues(record));
      setAircraftTemplateFormErrors({});
      setSelectedAircraftTemplateId(templateId);
      setAircraftTemplateDialogOpen(true);
    },
    [canManageAircraftTemplates],
  );

  const submitAircraftTemplateDialog = useCallback(async () => {
    if (!canManageAircraftTemplates) {
      toast.error('You do not have permission to manage templates');
      return;
    }
    const validationErrors = validateAircraftTemplateForm(aircraftTemplateFormValues);
    setAircraftTemplateFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    setAircraftTemplateDialogSubmitting(true);
    try {
      if (aircraftTemplateDialogMode === 'create') {
        await createAircraftTemplate(scope, sessionAccessToken, aircraftTemplateFormValues);
        toast.success('Aircraft template created');
      } else {
        await updateAircraftTemplate(scope, sessionAccessToken, selectedAircraftTemplateId, aircraftTemplateFormValues);
        toast.success('Aircraft template updated');
      }
      resetAircraftTemplateDialog();
      await loadAircraftTemplatesWorkspace();
    } catch (error) {
      toast.error(String((error as Error).message || 'Failed to save aircraft template'));
    } finally {
      setAircraftTemplateDialogSubmitting(false);
    }
  }, [
    aircraftTemplateDialogMode,
    aircraftTemplateFormValues,
    canManageAircraftTemplates,
    loadAircraftTemplatesWorkspace,
    resetAircraftTemplateDialog,
    scope,
    selectedAircraftTemplateId,
    sessionAccessToken,
    validateAircraftTemplateForm,
  ]);

  const openDeleteAircraftTemplateDialog = useCallback(
    (record: AircraftTemplateRecord) => {
      if (!canDeleteAircraftTemplates) {
        toast.error('You do not have permission to delete templates');
        return;
      }
      const templateId = String(record.id || '').trim();
      if (!templateId) {
        toast.error('Select a valid template');
        return;
      }
      setSelectedAircraftTemplateId(templateId);
      setAircraftTemplateDeleteDialogOpen(true);
    },
    [canDeleteAircraftTemplates],
  );

  const confirmDeleteAircraftTemplate = useCallback(async () => {
    if (!canDeleteAircraftTemplates) {
      toast.error('You do not have permission to delete templates');
      return;
    }
    if (!selectedAircraftTemplateId.trim()) {
      toast.error('Select a template first');
      return;
    }
    setAircraftTemplateDeleteSubmitting(true);
    try {
      await deleteAircraftTemplate(scope, sessionAccessToken, selectedAircraftTemplateId);
      toast.success('Aircraft template deleted');
      setAircraftTemplateDeleteDialogOpen(false);
      setSelectedAircraftTemplateId('');
      await loadAircraftTemplatesWorkspace();
    } catch (error) {
      toast.error(String((error as Error).message || 'Failed to delete aircraft template'));
    } finally {
      setAircraftTemplateDeleteSubmitting(false);
    }
  }, [canDeleteAircraftTemplates, loadAircraftTemplatesWorkspace, scope, selectedAircraftTemplateId, sessionAccessToken]);

  useEffect(() => {
    if (!showAircraftTemplatesWorkspace) {
      return;
    }
    void loadAircraftTemplatesWorkspace();
  }, [loadAircraftTemplatesWorkspace, showAircraftTemplatesWorkspace]);

  const loadRecords = useCallback(async () => {
    const requestId = recordsRequestIdRef.current + 1;
    recordsRequestIdRef.current = requestId;
    recordsRequestControllerRef.current?.abort();
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    recordsRequestControllerRef.current = controller;
    const shouldShowLoading = rowsRenderSignatureRef.current.length === 0;
    if (shouldShowLoading) {
      setLoading(true);
    }
    try {
      const headers = await buildApiHeaders(scope);
      const query = new URLSearchParams({
        search: debouncedSearch,
        page: String(page),
        page_size: pageSize,
        sort_by: sortColumn,
        sort_dir: sortDirection,
      });
      if (entity === 'flight_logs' && debouncedFlightFilters.flightDateFrom.trim()) query.set('flight_from', debouncedFlightFilters.flightDateFrom.trim());
      if (entity === 'flight_logs' && debouncedFlightFilters.flightDateTo.trim()) query.set('flight_to', debouncedFlightFilters.flightDateTo.trim());
      if (entity === 'flight_logs' && debouncedFlightFilters.flightAircraftFilter.trim()) query.set('aircraft_id', debouncedFlightFilters.flightAircraftFilter.trim());
      if (entity === 'flight_logs' && debouncedFlightFilters.flightRegistrationFilter.trim()) query.set('aircraft_registration', debouncedFlightFilters.flightRegistrationFilter.trim());
      if (entity === 'flight_logs' && debouncedFlightFilters.flightPilotFilter.trim()) query.set('pilot_name', debouncedFlightFilters.flightPilotFilter.trim());
      if (entity === 'flight_logs' && debouncedFlightFilters.flightNumberFilter.trim()) query.set('flight_number', debouncedFlightFilters.flightNumberFilter.trim());
      const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, {
        method: 'GET',
        headers,
        signal: controller?.signal,
      });
      const payload = await parseApiPayload(response);
      if (recordsRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) throw new Error(String(payload.error || 'Failed to load records'));
      let records = getPayloadRecords(payload);
      if (statusFilter !== 'all') {
        records = records.filter(
          (record: Record<string, unknown>) =>
            String(record.status ?? record.is_active ?? record.active).toLowerCase() === statusFilter.toLowerCase(),
        );
      }
      const nextSignature = createRowsRenderSignature(records);
      if (nextSignature !== rowsRenderSignatureRef.current) {
        rowsRenderSignatureRef.current = nextSignature;
        setRows(records);
      }
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }
      toast.error(String((error as Error).message || 'Failed to load records'));
    } finally {
      if (recordsRequestIdRef.current === requestId) {
        recordsRequestControllerRef.current = null;
        if (shouldShowLoading) {
          setLoading(false);
        }
      }
    }
  }, [debouncedFlightFilters, debouncedSearch, entity, page, pageSize, scope, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    setEntity(resolvedRouteEntity);
  }, [resolvedRouteEntity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (entity !== 'flight_logs') {
      setDebouncedFlightFilters({
        flightDateFrom: '',
        flightDateTo: '',
        flightAircraftFilter: '',
        flightRegistrationFilter: '',
        flightPilotFilter: '',
        flightNumberFilter: '',
      });
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedFlightFilters({
        flightDateFrom: flightDateFrom.trim(),
        flightDateTo: flightDateTo.trim(),
        flightAircraftFilter: flightAircraftFilter.trim(),
        flightRegistrationFilter: flightRegistrationFilter.trim(),
        flightPilotFilter: flightPilotFilter.trim(),
        flightNumberFilter: flightNumberFilter.trim(),
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [entity, flightAircraftFilter, flightDateFrom, flightDateTo, flightPilotFilter, flightRegistrationFilter, flightNumberFilter]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    rowsRenderSignatureRef.current = createRowsRenderSignature(rows);
  }, [rows]);

  useEffect(() => {
    setSelectedId(searchParams.get('selected'));
    setSelectedRowIds([]);
    selectionAnchorRef.current = null;
    setFormValues(getInitialFormValues(entity));
    setFormErrors({});
    setBulkText(createDefaultBulkText(entity));
  }, [entity, searchParams]);

  useEffect(() => {
    if (entity !== 'flight_logs') {
      return;
    }
    setFlightDateFrom(searchParams.get('flight_from') || '');
    setFlightDateTo(searchParams.get('flight_to') || '');
    setFlightAircraftFilter(searchParams.get('flight_aircraft') || searchParams.get('aircraft_id') || '');
    setFlightRegistrationFilter(searchParams.get('flight_registration') || searchParams.get('aircraft_registration') || '');
    setFlightPilotFilter(searchParams.get('flight_pilot') || '');
    setFlightNumberFilter(searchParams.get('flight_number') || '');
  }, [entity, searchParams]);

  useEffect(() => {
    if (entity === 'aircraft' || entity === 'assembly_models') {
      const tenantForLoad = entity === 'aircraft'
        ? String(formValues.tenant_id ?? scope.tenantId ?? '').trim()
        : String(scope.tenantId || '').trim();
      void loadManufacturerOptions(tenantForLoad);
    }
  }, [entity, formValues.tenant_id, loadManufacturerOptions, scope.tenantId]);

  useEffect(() => {
    if ((entity === 'aircraft' || entity === 'assembly_models') && modalOpen) {
      const tenantForLoad = entity === 'aircraft'
        ? String(formValues.tenant_id ?? scope.tenantId ?? '').trim()
        : String(scope.tenantId || '').trim();
      void loadManufacturerOptions(tenantForLoad);
    }
  }, [entity, formValues.tenant_id, loadManufacturerOptions, modalOpen, scope.tenantId]);

  useEffect(() => {
    if (entity === 'assembly_models' || entity === 'aircraft') {
      void loadAssemblyTypeOptions();
    }
  }, [entity, loadAssemblyTypeOptions]);

  useEffect(() => {
    if ((entity === 'assembly_models' || entity === 'aircraft') && modalOpen) {
      void loadAssemblyTypeOptions();
    }
  }, [entity, loadAssemblyTypeOptions, modalOpen]);

  useEffect(() => {
    if (entity === 'aircraft') {
      void loadAssemblyModelOptions();
    }
  }, [entity, loadAssemblyModelOptions]);

  useEffect(() => {
    if (entity === 'aircraft' && modalOpen) {
      void loadAssemblyModelOptions();
    }
  }, [entity, loadAssemblyModelOptions, modalOpen]);

  useEffect(() => {
    if (entity === 'aircraft') {
      void loadAircraftCreateListboxOptions();
    }
  }, [entity, loadAircraftCreateListboxOptions]);

  useEffect(() => {
    if (entity === 'aircraft' && modalOpen) {
      void loadAircraftCreateListboxOptions();
    }
  }, [entity, loadAircraftCreateListboxOptions, modalOpen]);

  useEffect(() => {
    if (isAircraftSubModule) {
      return;
    }
    const targetPathname = `${routeBasePath}/${ENTITY_ROUTE_SEGMENT[entity]}`;
    if (location.pathname === targetPathname) {
      return;
    }
    navigate(`${targetPathname}${location.search}`, { replace: true });
  }, [entity, isAircraftSubModule, location.pathname, location.search, navigate, routeBasePath]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (statusFilter !== 'all') next.set('status', statusFilter);
    if (entity === 'flight_logs' && flightDateFrom.trim()) next.set('flight_from', flightDateFrom.trim());
    if (entity === 'flight_logs' && flightDateTo.trim()) next.set('flight_to', flightDateTo.trim());
    if (entity === 'flight_logs' && flightAircraftFilter.trim()) next.set('flight_aircraft', flightAircraftFilter.trim());
    if (entity === 'flight_logs' && flightRegistrationFilter.trim()) next.set('flight_registration', flightRegistrationFilter.trim());
    if (entity === 'flight_logs' && flightPilotFilter.trim()) next.set('flight_pilot', flightPilotFilter.trim());
    if (entity === 'flight_logs' && flightNumberFilter.trim()) next.set('flight_number', flightNumberFilter.trim());
    if (page > 1) next.set('page', String(page));
    if (pageSize !== '25') next.set('page_size', pageSize);
    if (sortColumn !== 'updated_at') next.set('sort_by', sortColumn);
    if (sortDirection !== 'desc') next.set('sort_dir', sortDirection);
    if (selectedId) next.set('selected', selectedId);
    Object.entries(columnFilters).forEach(([column, value]) => {
      if (value.trim()) {
        next.set(`cf_${column}`, value.trim());
      }
    });
    const toSortedQueryString = (params: URLSearchParams) =>
      Array.from(params.entries())
        .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
          if (leftKey === rightKey) {
            return leftValue.localeCompare(rightValue);
          }
          return leftKey.localeCompare(rightKey);
        })
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    const nextQuery = toSortedQueryString(next);
    const currentQuery = toSortedQueryString(searchParams);
    if (nextQuery === currentQuery) {
      return;
    }
    setSearchParams(next, { replace: true });
  }, [columnFilters, entity, flightAircraftFilter, flightDateFrom, flightDateTo, flightPilotFilter, flightRegistrationFilter, flightNumberFilter, page, pageSize, search, searchParams, selectedId, setSearchParams, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    if (modalOpen) {
      return;
    }
    const selectedFromUrl = searchParams.get('selected');
    if (!selectedFromUrl || !rows.length) {
      return;
    }
    const matched = rows.find((row) => row.id === selectedFromUrl);
    if (matched) {
      setSelectedId(matched.id);
      setFormValues(pickFormValuesFromRow(entity, matched));
    }
  }, [entity, modalOpen, rows, searchParams]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const timeout = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeout);
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    const raw = localStorage.getItem(aircraftFormDraftKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        values?: FormValues;
        activeTab?: 'basic' | 'configuration' | 'system';
        savedAt?: string;
      };
      if (parsed.values && typeof parsed.values === 'object') {
        setFormValues((previous) => ({ ...previous, ...parsed.values }));
      }
      if (parsed.activeTab === 'basic' || parsed.activeTab === 'configuration' || parsed.activeTab === 'system') {
        setActiveFormTab(parsed.activeTab);
      }
      if (parsed.savedAt) {
        setAircraftFormLastSavedAt(parsed.savedAt);
      }
      setAircraftFormDraftStatus('restored');
    } catch {
      localStorage.removeItem(aircraftFormDraftKey);
    }
  }, [aircraftFormDraftKey, entity, modalOpen]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    const timer = setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(
        aircraftFormDraftKey,
        JSON.stringify({
          values: formValues,
          activeTab: activeFormTab,
          savedAt,
        }),
      );
      setAircraftFormLastSavedAt(savedAt);
      setAircraftFormDraftStatus('saved');
    }, 550);
    return () => clearTimeout(timer);
  }, [activeFormTab, aircraftFormDraftKey, entity, formValues, modalOpen]);

  useEffect(
    () => () => {
      if (clickDelayTimerRef.current) {
        clearTimeout(clickDelayTimerRef.current);
      }
      recordsRequestControllerRef.current?.abort();
    },
    [],
  );

  const getFormValuesForSubmit = useCallback(
    (values: FormValues): FormValues => {
      if (entity !== 'aircraft') {
        return values;
      }
      const findCounterValue = (key: string): string => {
        const row = aircraftCounterRows.find((entry) => entry.key === key);
        return String(row?.initialValue ?? '').trim();
      };
      const flightHoursValue = findCounterValue('flight_hours');
      const landingValue = findCounterValue('landing');
      const normalizedBase = String(values.base_location ?? aircraftBase ?? '').trim();
      const normalizedOwner = String(values.owner_name ?? aircraftOwner ?? '').trim();
      return {
        ...values,
        line_number: String(values.line_number ?? aircraftLineNumber ?? '').trim(),
        manufacturing_date: String(values.manufacturing_date ?? aircraftManufacturingDate ?? '').trim(),
        base_location: normalizedBase === AIRCRAFT_UNSELECTED_OPTION ? '' : normalizedBase,
        owner_name: normalizedOwner === AIRCRAFT_UNSELECTED_OPTION ? '' : normalizedOwner,
        current_flight_hours: String(values.current_flight_hours ?? flightHoursValue).trim(),
        current_cycles: String(values.current_cycles ?? landingValue).trim(),
      };
    },
    [aircraftBase, aircraftCounterRows, aircraftLineNumber, aircraftManufacturingDate, aircraftOwner, entity],
  );
  const extractValidationErrors = useCallback((responsePayload: Record<string, unknown>): Record<string, string> => {
    const output = responsePayload.output;
    if (!output || typeof output !== 'object') {
      return {};
    }
    const validation = (output as Record<string, unknown>).validation;
    if (!validation || typeof validation !== 'object') {
      return {};
    }
    const issues = (validation as Record<string, unknown>).issues;
    if (!Array.isArray(issues)) {
      return {};
    }
    return issues.reduce<Record<string, string>>((accumulator, issue) => {
      if (!issue || typeof issue !== 'object') return accumulator;
      const field = String((issue as Record<string, unknown>).field || '').trim();
      const message = String((issue as Record<string, unknown>).message || '').trim();
      if (!field || !message || accumulator[field]) return accumulator;
      accumulator[field] = message;
      return accumulator;
    }, {});
  }, []);

  const handleCreate = useCallback(async () => {
    try {
      const submitValues = getFormValuesForSubmit(formValues);
      const { payload, errors } = buildPayloadFromForm(entity, submitValues);
      if (entity === 'aircraft') {
        const selectedTenantId = String(formValues.tenant_id ?? scope.tenantId ?? '').trim();
        const selectedFranchiseId = String(formValues.franchise_id ?? scope.franchiseId ?? '').trim();
        const selectedTemplateId = String(aircraftTemplateModel || '').trim();
        if (!selectedTenantId) {
          errors.tenant_id = 'Tenant is required';
        } else {
          payload.tenant_id = selectedTenantId;
        }
        if (!selectedFranchiseId) {
          errors.franchise_id = 'Franchise is required';
        } else {
          payload.franchise_id = selectedFranchiseId;
        }
        if (!selectedTemplateId || isSystemSelectValue(selectedTemplateId)) {
          errors.aircraft_template = 'Aircraft Model is required';
        }
        const selectedTemplate = selectedTemplateId
          ? systemTemplateModelOptions.find((option) => option.id === selectedTemplateId)
          : null;
        if (selectedTemplate) {
          if (!String(payload.aircraft_type || '').trim() && selectedTemplate.aircraftType) {
            payload.aircraft_type = selectedTemplate.aircraftType;
          }
          if (!String(payload.manufacturer_id || '').trim() && selectedTemplate.manufacturerId) {
            payload.manufacturer_id = selectedTemplate.manufacturerId;
          }
          if (!String(payload.aircraft_model || '').trim() && selectedTemplate.aircraftModel) {
            payload.aircraft_model = selectedTemplate.aircraftModel;
          }
          if (!String(payload.maintenance_program || '').trim() && selectedTemplate.maintenanceProgram) {
            payload.maintenance_program = selectedTemplate.maintenanceProgram;
          }
        }
      }
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast.error('Please resolve form validation errors');
        return false;
      }
      const headers = await buildApiHeaders(scope);
      if (entity === 'aircraft' && payload.manufacturer_id) {
        const exists = await verifyReferenceExists(headers, 'manufacturers', String(payload.manufacturer_id), ['id', 'manufacturer_code', 'name']);
        if (!exists) {
          setFormErrors((previous) => ({ ...previous, manufacturer_id: 'Manufacturer was not found' }));
          toast.error('Manufacturer reference is invalid');
          return false;
        }
      }
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
      if (entity === 'assembly_models') {
        const manufacturerId = String(payload.manufacturer_id || '').trim();
        if (manufacturerId) {
          const exists = await verifyReferenceExists(headers, 'manufacturers', manufacturerId, ['id', 'manufacturer_code', 'name']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, manufacturer_id: 'Manufacturer was not found' }));
            toast.error('Manufacturer reference is invalid');
            return false;
          }
        }
        const assemblyTypeId = String(payload.assembly_type_id || '').trim();
        if (assemblyTypeId) {
          const exists = await verifyReferenceExists(headers, 'assembly_types', assemblyTypeId, ['id', 'assembly_code', 'name']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, assembly_type_id: 'Assembly Type was not found' }));
            toast.error('Assembly Type reference is invalid');
            return false;
          }
        }
      }
      if (entity === 'work_package_templates') {
        const tasksJson = Array.isArray(payload.tasks_json) ? payload.tasks_json : [];
        const selectedTaskTemplateIds = tasksJson
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const row = entry as Record<string, unknown>;
            return String(row.task_template_id || row.taskTemplateId || row.id || '').trim();
          })
          .filter((value): value is string => Boolean(value));
        logger.info('[AMRO Master Data UI] creating work package template request work_package_templates', {
          entity,
          requestUrl: '/api/v2/amro/master-data/work_package_templates',
          templateCode: String(payload.template_code || ''),
          templateName: String(payload.template_name || ''),
          maintenanceType: String(payload.maintenance_type || ''),
          aircraftModel: String(payload.aircraft_model || ''),
          selectedTaskTemplateCount: selectedTaskTemplateIds.length,
          selectedTaskTemplateIds,
          tasksJsonPreview: tasksJson.slice(0, 5),
        });
      }
      const createEndpoint = entity === 'work_package_templates'
        ? '/api/v2/amro/master-data/work_package_templates'
        : `/api/v2/amro/master-data/${entity}`;
      const response = await fetch(createEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const responsePayload = await parseApiPayload(response);
      if (entity === 'work_package_templates') {
        const responseOutput = (responsePayload.output && typeof responsePayload.output === 'object')
          ? (responsePayload.output as Record<string, unknown>)
          : null;
        const createdRecord = (responseOutput?.record && typeof responseOutput.record === 'object')
          ? (responseOutput.record as Record<string, unknown>)
          : null;
        logger.info('[AMRO Master Data UI] work package template create response', {
          entity,
          requestUrl: '/api/v2/amro/master-data/work_package_templates',
          status: response.status,
          ok: response.ok,
          responseError: String(responsePayload.error || ''),
          createdTemplateId: String(createdRecord?.id || ''),
        });
      }
      if (!response.ok) {
        const validationErrors = extractValidationErrors(responsePayload);
        if (Object.keys(validationErrors).length > 0) {
          setFormErrors((previous) => ({ ...previous, ...validationErrors }));
        }
        throw new Error(String(responsePayload.error || 'Create failed'));
      }
      toast.success(`${ENTITY_LABEL[entity]} record created`);
      setFormErrors({});
      setFormValues(getInitialFormValues(entity));
      setSelectedId(null);
      await loadRecords();
      return true;
    } catch (error) {
      const message = String((error as Error).message || 'Create failed');
      if (entity === 'aircraft' && /serial_number|duplicate key|already exists/i.test(message)) {
        setFormErrors((previous) => ({ ...previous, serial_number: 'Serial Number already exists' }));
      }
      toast.error(message);
      return false;
    }
  }, [aircraftTemplateModel, entity, extractValidationErrors, formValues, getFormValuesForSubmit, isSystemSelectValue, loadRecords, scope, systemTemplateModelOptions]);

  const handleUpdate = useCallback(async () => {
    if (!selectedId) {
      toast.error('Select a record first');
      return false;
    }
    try {
      const submitValues = getFormValuesForSubmit(formValues);
      const { payload, errors } = buildPayloadFromForm(entity, submitValues);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast.error('Please resolve form validation errors');
        return false;
      }
      const headers = await buildApiHeaders(scope);
      if (entity === 'aircraft' && payload.manufacturer_id) {
        const exists = await verifyReferenceExists(headers, 'manufacturers', String(payload.manufacturer_id), ['id', 'manufacturer_code', 'name']);
        if (!exists) {
          setFormErrors((previous) => ({ ...previous, manufacturer_id: 'Manufacturer was not found' }));
          toast.error('Manufacturer reference is invalid');
          return false;
        }
      }
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
      if (entity === 'assembly_models') {
        const manufacturerId = String(payload.manufacturer_id || '').trim();
        if (manufacturerId) {
          const exists = await verifyReferenceExists(headers, 'manufacturers', manufacturerId, ['id', 'manufacturer_code', 'name']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, manufacturer_id: 'Manufacturer was not found' }));
            toast.error('Manufacturer reference is invalid');
            return false;
          }
        }
        const assemblyTypeId = String(payload.assembly_type_id || '').trim();
        if (assemblyTypeId) {
          const exists = await verifyReferenceExists(headers, 'assembly_types', assemblyTypeId, ['id', 'assembly_code', 'name']);
          if (!exists) {
            setFormErrors((previous) => ({ ...previous, assembly_type_id: 'Assembly Type was not found' }));
            toast.error('Assembly Type reference is invalid');
            return false;
          }
        }
      }
      if (entity === 'work_package_templates') {
        const tasksJson = Array.isArray(payload.tasks_json) ? payload.tasks_json : [];
        const selectedTaskTemplateIds = tasksJson
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const row = entry as Record<string, unknown>;
            return String(row.task_template_id || row.taskTemplateId || row.id || '').trim();
          })
          .filter((value): value is string => Boolean(value));
        logger.info('[AMRO Master Data UI] updating work package template request', {
          entity,
          requestUrl: `/api/v2/amro/work_package_templates/${selectedId}`,
          workPackageTemplateId: String(selectedId || ''),
          templateCode: String(payload.template_code || ''),
          templateName: String(payload.template_name || ''),
          maintenanceType: String(payload.maintenance_type || ''),
          aircraftModel: String(payload.aircraft_model || ''),
          selectedTaskTemplateCount: selectedTaskTemplateIds.length,
          selectedTaskTemplateIds,
          tasksJsonPreview: tasksJson.slice(0, 5),
        });
      }
      const updateEndpoint = entity === 'work_package_templates'
        ? `/api/v2/amro/work_package_templates/${selectedId}`
        : `/api/v2/amro/master-data/${entity}/${selectedId}`;
      const updateMethod = 'PATCH';
      const response = await fetch(updateEndpoint, {
        method: updateMethod,
        headers,
        body: JSON.stringify(payload),
      });
      const responsePayload = await parseApiPayload(response);
      if (entity === 'work_package_templates') {
        const responseOutput = (responsePayload.output && typeof responsePayload.output === 'object')
          ? (responsePayload.output as Record<string, unknown>)
          : null;
        const updatedRecord = (responseOutput?.record && typeof responseOutput.record === 'object')
          ? (responseOutput.record as Record<string, unknown>)
          : null;
        logger.info('[AMRO Master Data UI] work package template update response', {
          entity,
          requestUrl: `/api/v2/amro/work_package_templates/${selectedId}`,
          status: response.status,
          ok: response.ok,
          responseError: String(responsePayload.error || ''),
          updatedTemplateId: String(updatedRecord?.id || selectedId || ''),
        });
      }
      if (!response.ok) {
        const validationErrors = extractValidationErrors(responsePayload);
        if (Object.keys(validationErrors).length > 0) {
          setFormErrors((previous) => ({ ...previous, ...validationErrors }));
        }
        const baseError = String(responsePayload.error || 'Update failed');
        const correlationId = String(responsePayload.correlationId || '').trim();
        if (entity === 'work_package_templates' && /outside current scope/i.test(baseError)) {
          await loadRecords();
          throw new Error(
            `WPT update target is not available in your current scope. Reloaded records; reselect the template and retry.${correlationId ? ` Correlation ID: ${correlationId}` : ''}`,
          );
        }
        throw new Error(`${baseError}${correlationId ? ` (Correlation ID: ${correlationId})` : ''}`);
      }
      toast.success(`${ENTITY_LABEL[entity]} record updated`);
      setFormErrors({});
      await loadRecords();
      return true;
    } catch (error) {
      const message = String((error as Error).message || 'Update failed');
      if (entity === 'aircraft' && /serial_number|duplicate key|already exists/i.test(message)) {
        setFormErrors((previous) => ({ ...previous, serial_number: 'Serial Number already exists' }));
      }
      toast.error(message);
      return false;
    }
  }, [entity, extractValidationErrors, formValues, getFormValuesForSubmit, loadRecords, scope, selectedId]);

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
      const deleteEndpoint = entity === 'work_package_templates'
        ? `/api/v2/amro/master-data/work_package_templates/${selectedId}`
        : `/api/v2/amro/master-data/${entity}/${selectedId}`;
      const response = await fetch(deleteEndpoint, {
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
    setBusyAction('export');
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
    } finally {
      setBusyAction(null);
    }
  }, [entity, scope, search]);

  const tableColumns = useMemo(() => {
    const preferredColumns = ENTITY_TABLE_COLUMNS[entity];
    const hiddenColumns = new Set(ENTITY_HIDDEN_COLUMNS[entity] || []);
    const visiblePreferredColumns = preferredColumns.filter((column) => !hiddenColumns.has(column));
    if (!rows.length) return visiblePreferredColumns;
    const firstRowColumns = Object.keys(rows[0]);
    const selected = visiblePreferredColumns.filter((column) => firstRowColumns.includes(column));
    const extras = firstRowColumns.filter((column) => !selected.includes(column) && !hiddenColumns.has(column));
    return [...selected, ...extras].slice(0, 10);
  }, [entity, rows]);

  const formFields = ENTITY_FORM_FIELDS[entity];
  const basicSectionFields = useMemo(() => {
    if (entity !== 'aircraft') {
      return formFields.slice(0, Math.min(formFields.length, 4));
    }
    const keyOrder = AIRCRAFT_FORM_SECTION_FIELD_KEYS.basic;
    const mapped = keyOrder
      .map((key) => formFields.find((field) => field.key === key))
      .filter((field): field is EntityFormField => Boolean(field));
    const extras = formFields.filter((field) => !keyOrder.includes(field.key) && !AIRCRAFT_FORM_SECTION_FIELD_KEYS.configuration.includes(field.key));
    return [...mapped, ...extras];
  }, [entity, formFields]);
  const configurationSectionFields = useMemo(() => {
    if (entity !== 'aircraft') {
      return formFields.slice(Math.min(formFields.length, 4));
    }
    const keyOrder = AIRCRAFT_FORM_SECTION_FIELD_KEYS.configuration;
    const mapped = keyOrder
      .map((key) => formFields.find((field) => field.key === key))
      .filter((field): field is EntityFormField => Boolean(field));
    if (entity !== 'aircraft' || canScheduleWorkPackage) {
      return mapped;
    }
    return mapped.filter((field) => !['maintenance_program', 'configuration_code'].includes(field.key));
  }, [canScheduleWorkPackage, entity, formFields]);
  const systemFields = useMemo(
    () =>
      tableColumns.filter(
        (column) =>
          ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(column) &&
          !(ENTITY_HIDDEN_COLUMNS[entity] || []).includes(column),
      ),
    [entity, tableColumns],
  );
  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);
  const selectedRecordLabel = useMemo(() => {
    if (!selectedRow) {
      return 'None';
    }
    if (entity === 'work_package_templates') {
      return String(selectedRow.template_code || selectedRow.template_name || selectedRow.id || 'None');
    }
    if (entity === 'aircraft') {
      return String(selectedRow.tail_number || selectedRow.registration || selectedRow.id || 'None');
    }
    if (entity === 'flight_logs') {
      return String(selectedRow.flight_number || selectedRow.id || 'None');
    }
    return String(selectedRow.id || 'None');
  }, [entity, selectedRow]);
  const selectedAircraft = useMemo(
    () => (entity === 'aircraft' ? (selectedRow || rows[0] || null) : null),
    [entity, rows, selectedRow],
  );
  const selectedWorkPackageTemplate = useMemo(
    () => workPackageTemplateRegistry.find((item) => item.id === selectedWorkPackageTemplateId) || null,
    [selectedWorkPackageTemplateId, workPackageTemplateRegistry],
  );
  const canCreateWorkPackageFromTemplate = useMemo(
    () => canCreateWorkPackage && Boolean(selectedWorkPackageTemplateId),
    [canCreateWorkPackage, selectedWorkPackageTemplateId],
  );
  const selectedFlightLogAircraft = useMemo(
    () =>
      String(flightLogInitialValues.aircraftId || '').trim()
        ? rows.find((row) => row.id === String(flightLogInitialValues.aircraftId || '').trim()) || selectedAircraft
        : selectedAircraft,
    [flightLogInitialValues.aircraftId, rows, selectedAircraft],
  );
  const aircraftRequiredProgress = useMemo(() => {
    if (entity !== 'aircraft') {
      return { total: 0, completed: 0, percent: 0 };
    }
    const requiredFields = formFields.filter((field) => field.required);
    const completed = requiredFields.filter((field) => !isBlank(formValues[field.key])).length;
    const total = requiredFields.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [entity, formFields, formValues]);
  const aircraftValidationSummary = useMemo(() => {
    if (entity !== 'aircraft') {
      return { errorCount: 0 };
    }
    const preview = buildPayloadFromForm('aircraft', formValues);
    return { errorCount: Object.keys(preview.errors).length };
  }, [entity, formValues]);
  const aircraftSectionProgress = useMemo(() => {
    if (entity !== 'aircraft') {
      return {
        basic: { completed: 0, total: 0 },
        configuration: { completed: 0, total: 0 },
      };
    }
    const buildProgress = (fields: EntityFormField[]) => {
      const required = fields.filter((field) => field.required);
      const completed = required.filter((field) => !isBlank(formValues[field.key])).length;
      return { completed, total: required.length };
    };
    return {
      basic: buildProgress(basicSectionFields),
      configuration: buildProgress(configurationSectionFields),
    };
  }, [basicSectionFields, configurationSectionFields, entity, formValues]);
  const aircraftAuditTimeline = useMemo(() => {
    if (entity !== 'aircraft') {
      return [] as Array<{ label: string; value: string }>;
    }
    return [
      { label: 'Created', value: String(selectedRow?.created_at || 'Not available') },
      { label: 'Updated', value: String(selectedRow?.updated_at || 'Not available') },
      {
        label: 'Draft Status',
        value:
          aircraftFormDraftStatus === 'idle'
            ? 'No draft in session'
            : `${aircraftFormDraftStatus === 'restored' ? 'Restored' : 'Saved'} ${aircraftFormLastSavedAt ? new Date(aircraftFormLastSavedAt).toLocaleString() : ''}`,
      },
    ];
  }, [aircraftFormDraftStatus, aircraftFormLastSavedAt, entity, selectedRow?.created_at, selectedRow?.updated_at]);
  const collaborationIndicator = useMemo(() => {
    const activeEditors = Math.max(1, selectedRowIds.length || 1);
    return {
      activeEditors,
      status: loading ? 'Syncing' : 'Live',
      lastSeen: new Date(lastCollaborationPingAt).toLocaleTimeString(),
    };
  }, [lastCollaborationPingAt, loading, selectedRowIds.length]);
  const tabSequence: Array<'basic' | 'configuration' | 'system'> = ['basic', 'configuration', 'system'];
  const cycleFormTab = useCallback(
    (direction: 'next' | 'prev') => {
      const currentIndex = tabSequence.indexOf(activeFormTab);
      const offset = direction === 'next' ? 1 : -1;
      const nextIndex = (currentIndex + offset + tabSequence.length) % tabSequence.length;
      setActiveFormTab(tabSequence[nextIndex]);
    },
    [activeFormTab, tabSequence],
  );
  const toggleFormPanel = useCallback((panel: 'basic' | 'configuration' | 'system') => {
    setCollapsedFormPanels((previous) => ({ ...previous, [panel]: !previous[panel] }));
  }, []);
  const hasRestrictedAircraftFields = entity === 'aircraft' && !canScheduleWorkPackage;
  const manufacturerMetaById = useMemo(() => new Map(manufacturerOptions.map((option) => [option.id, option])), [manufacturerOptions]);
  const manufacturerSelectOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [];
    const seen = new Set<string>();
    const addOption = (value: string, label: string, disabled = false) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) return;
      if (seen.has(normalizedValue)) return;
      seen.add(normalizedValue);
      options.push({ value: normalizedValue, label: String(label || normalizedValue).trim() || normalizedValue, disabled });
    };
    if (entity === 'aircraft' && systemTemplateModelOptions.length > 0) {
      systemTemplateModelOptions.forEach((templateOption) => {
        const manufacturerId = String(templateOption.manufacturerId || '').trim();
        if (!manufacturerId) return;
        const manufacturerMeta = manufacturerMetaById.get(manufacturerId);
        const label = manufacturerMeta?.label || String(templateOption.manufacturerName || '').trim() || manufacturerId;
        addOption(manufacturerId, label, Boolean(manufacturerMeta && !manufacturerMeta.active));
      });
    } else {
      manufacturerOptions.forEach((option) => {
        addOption(option.id, option.label, !option.active);
      });
    }
    const currentManufacturerId = String(formValues.manufacturer_id ?? '').trim();
    if (currentManufacturerId && !options.some((option) => option.value === currentManufacturerId)) {
      addOption(currentManufacturerId, manufacturerMetaById.get(currentManufacturerId)?.label || currentManufacturerId, false);
    }
    return options;
  }, [entity, formValues.manufacturer_id, manufacturerMetaById, manufacturerOptions, systemTemplateModelOptions]);
  const manufacturerLabelById = useMemo(
    () => new Map(manufacturerOptions.map((option) => [option.id, option.label])),
    [manufacturerOptions],
  );
  const assemblyTypeSelectOptions = useMemo<SelectOption[]>(
    () =>
      assemblyTypeOptions.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: !option.active,
      })),
    [assemblyTypeOptions],
  );
  const assemblyTypeLabelById = useMemo(
    () => new Map(assemblyTypeOptions.map((option) => [option.id, option.label])),
    [assemblyTypeOptions],
  );
  const aircraftModelSelectOptions = useMemo<SelectOption[]>(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    const manufacturerId = String(formValues.manufacturer_id ?? '').trim();
    const modelSourceOptions = entity === 'aircraft' ? franchiseAssemblyModels : assemblyModelOptions;
    const manufacturer = manufacturerMetaById.get(manufacturerId);
    const manufacturerTokens = [manufacturerId, manufacturer?.id, manufacturer?.code, manufacturer?.name, manufacturer?.label]
      .filter(Boolean)
      .map((token) => normalize(String(token)));
    const manufacturerTokenSet = new Set(manufacturerTokens);
    const filtered = manufacturerId
      ? modelSourceOptions.filter((option) => {
          if (!option.manufacturerTokens.length) {
            const fallback = normalize(option.manufacturerId || '');
            return fallback ? manufacturerTokenSet.has(fallback) : false;
          }
          return option.manufacturerTokens.some((token) => manufacturerTokenSet.has(token));
        })
      : [];
    let options = filtered.map((option) => ({
      value: option.modelValue,
      label: option.label,
      disabled: !option.active,
    }));
    const currentModel = String(formValues.aircraft_model ?? '').trim();
    if (currentModel && !options.some((option) => option.value === currentModel)) {
      options = [{ value: currentModel, label: currentModel, disabled: false }, ...options];
    }
    return options;
  }, [assemblyModelOptions, entity, formValues.aircraft_model, formValues.manufacturer_id, franchiseAssemblyModels, manufacturerMetaById]);
  const aircraftTypeSelectOptions = useMemo<SelectOption[]>(
    () =>
      (aircraftTypeOptions.length > 0 ? aircraftTypeOptions : AIRCRAFT_TYPE_FALLBACK_OPTIONS).map((option) => ({
        value: option,
        label: option,
      })),
    [aircraftTypeOptions],
  );
  const aircraftStatusSelectOptions = useMemo<SelectOption[]>(
    () =>
      (aircraftStatusOptions.length > 0 ? aircraftStatusOptions : [...AIRCRAFT_STATUS_OPTIONS]).map((option) => ({
        value: option,
        label: option,
      })),
    [aircraftStatusOptions],
  );
  const activeAircraftTenantId = useMemo(
    () => String(formValues.tenant_id ?? scope.tenantId ?? '').trim(),
    [formValues.tenant_id, scope.tenantId],
  );
  const activeAircraftFranchiseId = useMemo(
    () => String(formValues.franchise_id ?? scope.franchiseId ?? '').trim(),
    [formValues.franchise_id, scope.franchiseId],
  );
  const activeAircraftManufacturerId = useMemo(
    () => String(formValues.manufacturer_id ?? '').trim(),
    [formValues.manufacturer_id],
  );
  const filteredSystemTemplateModelOptions = useMemo<AircraftTempOption[]>(
    () =>
      systemTemplateModelOptions.filter((option) => {
        const optionTenantId = String(option.tenantId || '').trim();
        const optionFranchiseId = String(option.franchiseId || '').trim();
        const tenantMatched = !optionTenantId || optionTenantId === activeAircraftTenantId;
        if (!tenantMatched) {
          return false;
        }
        if (!activeAircraftFranchiseId) {
          return true;
        }
        return !optionFranchiseId || optionFranchiseId === activeAircraftFranchiseId;
      }),
    [activeAircraftFranchiseId, activeAircraftTenantId, systemTemplateModelOptions],
  );
  const systemTemplateModelSelectOptions = useMemo<SelectOption[]>(
    () => {
      if (filteredSystemTemplateModelOptions.length === 0) {
        return [{ value: '__empty_aircraft_templates__', label: 'No aircraft templates available', disabled: true }];
      }
      return filteredSystemTemplateModelOptions.map((option) => ({
        value: option.id,
        label: option.name,
      }));
    },
    [filteredSystemTemplateModelOptions],
  );
  const franchiseAssemblyModelSelectOptions = useMemo<SelectOption[]>(
    () => {
      if (franchiseAssemblyModelsLoading) {
        return [{ value: '__loading_assembly_models__', label: 'Loading models...', disabled: true }];
      }
      if (franchiseAssemblyModels.length === 0) {
        return [{ value: '__empty_assembly_models__', label: 'No models available for selected franchise', disabled: true }];
      }
      return franchiseAssemblyModels.map((option) => ({
        value: option.id,
        label: option.label,
      }));
    },
    [franchiseAssemblyModels, franchiseAssemblyModelsLoading],
  );
  const aircraftTenantSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: aircraftTenantOptionsLoading ? 'Loading tenants...' : 'Select tenant', disabled: true },
      ...aircraftTenantOptions,
    ],
    [aircraftTenantOptions, aircraftTenantOptionsLoading],
  );
  const aircraftFranchiseSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: aircraftFranchiseOptionsLoading ? 'Loading franchises...' : 'Select franchise', disabled: true },
      ...aircraftFranchiseOptions,
    ],
    [aircraftFranchiseOptions, aircraftFranchiseOptionsLoading],
  );
  const aircraftBaseSelectOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SelectOption[] = [];
    const addOption = (rawValue: unknown) => {
      const value = String(rawValue ?? '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value, label: value });
    };
    addOption(AIRCRAFT_UNSELECTED_OPTION);
    aircraftBaseCatalogOptions.forEach((option) => addOption(option));
    rows.forEach((row) => addOption(row.base_location));
    addOption(formValues.base_location);
    return options;
  }, [aircraftBaseCatalogOptions, formValues.base_location, rows]);
  const aircraftOwnerSelectOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SelectOption[] = [];
    const addOption = (rawValue: unknown) => {
      const value = String(rawValue ?? '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value, label: value });
    };
    addOption(AIRCRAFT_UNSELECTED_OPTION);
    aircraftOwnerCatalogOptions.forEach((option) => addOption(option));
    rows.forEach((row) => addOption(row.owner_name));
    addOption(formValues.owner_name);
    return options;
  }, [aircraftOwnerCatalogOptions, formValues.owner_name, rows]);

  const setFieldValue = useCallback((fieldKey: string, value: unknown) => {
    setFormValues((previous) => ({ ...previous, [fieldKey]: value }));
    setFormErrors((previous) => ({ ...previous, [fieldKey]: '' }));
  }, []);
  const setSelectFieldValue = useCallback((fieldKey: string, value: string) => {
    if (isSystemSelectValue(value)) {
      return;
    }
    setFormValues((previous) => ({
      ...previous,
      [fieldKey]: value,
      ...(fieldKey === 'manufacturer_id' ? { aircraft_model: '' } : {}),
    }));
    setFormErrors((previous) => ({
      ...previous,
      [fieldKey]: '',
      ...(fieldKey === 'manufacturer_id' ? { aircraft_model: '' } : {}),
    }));
  }, []);
  const setAircraftCounterValue = useCallback((key: string, field: 'initialValue' | 'initialDate', value: string) => {
    setAircraftCounterRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }, []);
  const handleAircraftNoSerialChange = useCallback(
    (checked: boolean) => {
      setAircraftNoSerialNumber(checked);
      if (checked) {
        setFieldValue('serial_number', 'N/A');
        return;
      }
      if (String(formValues.serial_number ?? '').trim().toUpperCase() === 'N/A') {
        setFieldValue('serial_number', '');
      }
    },
    [formValues.serial_number, setFieldValue],
  );
  const setAircraftAuxField = useCallback(
    (key: string, value: string) => {
      setFieldValue(key, value);
    },
    [setFieldValue],
  );
  const setAircraftTenantValue = useCallback(
    (value: string) => {
      if (isSystemSelectValue(value)) {
        return;
      }
      const normalizedTenantId = String(value || '').trim();
      const currentTenantId = String(formValues.tenant_id ?? scope.tenantId ?? '').trim();
      if (normalizedTenantId === currentTenantId) {
        return;
      }
      setFieldValue('tenant_id', normalizedTenantId);
      setFieldValue('franchise_id', '');
      setFieldValue('manufacturer_id', '');
      setAircraftTemplateModel('');
      setFieldValue('aircraft_template', '');
      setAircraftFranchiseOptions([]);
      setFranchiseAssemblyModels([]); // Clear franchise assembly models when tenant changes
      void loadManufacturerOptions(normalizedTenantId);
    },
    [formValues.tenant_id, isSystemSelectValue, loadManufacturerOptions, scope.tenantId, setFieldValue],
  );
  const setAircraftFranchiseValue = useCallback(
    (value: string) => {
      if (isSystemSelectValue(value)) {
        return;
      }
      const normalizedFranchiseId = String(value || '').trim();
      const currentFranchiseId = String(formValues.franchise_id ?? scope.franchiseId ?? '').trim();
      if (normalizedFranchiseId === currentFranchiseId) {
        return;
      }
      setFieldValue('franchise_id', normalizedFranchiseId);
      setAircraftTemplateModel('');
      setFieldValue('aircraft_template', '');
      setFieldValue('aircraft_model', '');
    },
    [formValues.franchise_id, isSystemSelectValue, scope.franchiseId, setFieldValue],
  );
  
  const loadFranchiseAssemblyModels = useCallback(
    async (tenantId: string, franchiseId: string, manufacturerId: string) => {
      const scopedTenantId = String(tenantId || '').trim();
      const scopedFranchiseId = String(franchiseId || '').trim();
      const scopedManufacturerId = String(manufacturerId || '').trim();
      if (entity !== 'aircraft' || !scopedDb || !scopedTenantId || !scopedFranchiseId || !scopedManufacturerId) {
        setFranchiseAssemblyModels([]);
        return;
      }
      setFranchiseAssemblyModelsLoading(true);
      try {
        let query = (scopedDb as any)
          .from('assembly_models')
          .select('id, name, model_code, manufacturer_id, franchise_id, is_active')
          .eq('tenant_id', scopedTenantId)
          .eq('manufacturer_id', scopedManufacturerId)
          .eq('is_active', true)
          .order('name', { ascending: true });
        query = query.or(`franchise_id.is.null,franchise_id.eq.${scopedFranchiseId}`);
        const { data: modelRows, error: modelError } = await query;
        
        if (modelError) {
          throw new Error(String(modelError.message || 'Failed to load assembly models'));
        }
        
        const filteredModels = (Array.isArray(modelRows) ? modelRows : [])
          .map((row: Record<string, unknown>) => {
            const id = String(row.id || '').trim();
            const name = String(row.name || '').trim();
            const code = String(row.model_code || '').trim();
            const manufacturerId = String(row.manufacturer_id || '').trim();
            const manufacturerMeta = manufacturerMetaById.get(manufacturerId);
            const manufacturerName = String(manufacturerMeta?.name || manufacturerMeta?.code || '').trim();
            const label = name && code && name !== code ? `${name} (${code})` : name || code || id;
            const manufacturerTokens = [manufacturerId, manufacturerName]
              .filter(Boolean)
              .map((token: string) => token.toLowerCase());
            
            return {
              id,
              label,
              modelValue: name || code || id,
              manufacturerId,
              manufacturerTokens,
              active: String(row.is_active ?? 'true').toLowerCase() !== 'false',
            } as AssemblyModelOption;
          });
        
        setFranchiseAssemblyModels(filteredModels);
      } catch (error) {
        const message = String((error as Error).message || 'Failed to load assembly models for franchise');
        toast.error(message);
        setFranchiseAssemblyModels([]);
      } finally {
        setFranchiseAssemblyModelsLoading(false);
      }
    },
    [entity, manufacturerMetaById, scopedDb],
  );
  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    if (!activeAircraftTenantId || !activeAircraftFranchiseId || !activeAircraftManufacturerId) {
      setFranchiseAssemblyModels([]);
      return;
    }
    void loadFranchiseAssemblyModels(activeAircraftTenantId, activeAircraftFranchiseId, activeAircraftManufacturerId);
  }, [
    activeAircraftFranchiseId,
    activeAircraftManufacturerId,
    activeAircraftTenantId,
    entity,
    loadFranchiseAssemblyModels,
    modalOpen,
  ]);
  const loadAircraftTenantAndFranchiseOptions = useCallback(async () => {
    if (entity !== 'aircraft' || !scopedDb) {
      return;
    }
    setAircraftTenantOptionsLoading(true);
    setAircraftFranchiseOptionsLoading(true);
    setAircraftTenantOptionsError('');
    setAircraftFranchiseOptionsError('');
    try {
      const { data: tenantRows, error: tenantError } = await (scopedDb as any)
        .from('tenants')
        .select('id,name,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (tenantError) {
        throw new Error(String(tenantError.message || 'Failed to load tenants'));
      }
      const tenantOptions = (Array.isArray(tenantRows) ? tenantRows : [])
        .map((row) => ({
          value: String((row as Record<string, unknown>).id || '').trim(),
          label: String((row as Record<string, unknown>).name || (row as Record<string, unknown>).id || '').trim(),
        }))
        .filter((option) => option.value.length > 0);
      setAircraftTenantOptions(tenantOptions);

      if (!activeAircraftTenantId) {
        setAircraftFranchiseOptions([]);
        return;
      }
      const { data: franchiseRows, error: franchiseError } = await (scopedDb as any)
        .from('franchises')
        .select('id,name,is_active,tenant_id')
        .eq('tenant_id', activeAircraftTenantId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (franchiseError) {
        throw new Error(String(franchiseError.message || 'Failed to load franchises'));
      }
      const franchiseOptions = (Array.isArray(franchiseRows) ? franchiseRows : [])
        .map((row) => ({
          value: String((row as Record<string, unknown>).id || '').trim(),
          label: String((row as Record<string, unknown>).name || (row as Record<string, unknown>).id || '').trim(),
        }))
        .filter((option) => option.value.length > 0);
      setAircraftFranchiseOptions(franchiseOptions);
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load tenant/franchise options');
      setAircraftTenantOptionsError(message);
      setAircraftFranchiseOptionsError(message);
      setAircraftTenantOptions([]);
      setAircraftFranchiseOptions([]);
    } finally {
      setAircraftTenantOptionsLoading(false);
      setAircraftFranchiseOptionsLoading(false);
    }
  }, [activeAircraftTenantId, entity, scopedDb]);
  const hydrateAircraftCountersFromTemplate = useCallback(
    async (templateId: string) => {
      if (entity !== 'aircraft') {
        return;
      }
      const nextRows = await fetchAircraftTemplateCounterRows(templateId);
      setAircraftCounterRows(nextRows);
    },
    [entity, fetchAircraftTemplateCounterRows],
  );

  const resolveSelectOptions = useCallback(
    (field: EntityFormField): SelectOption[] => {
      if (field.key === 'manufacturer_id') {
        if (manufacturerOptionsLoading) {
          return [{ value: '__loading_manufacturers__', label: 'Loading manufacturers...', disabled: true }];
        }
        if (manufacturerOptionsError) {
          return [{ value: '__error_manufacturers__', label: 'Unable to load manufacturers', disabled: true }];
        }
        if (manufacturerSelectOptions.length === 0) {
          return [{ value: '__empty_manufacturers__', label: 'No manufacturers available', disabled: true }];
        }
        return manufacturerSelectOptions;
      }
      if (field.key === 'assembly_type_id') {
        if (assemblyTypeOptionsLoading) {
          return [{ value: '__loading_assembly_types__', label: 'Loading assembly types...', disabled: true }];
        }
        if (assemblyTypeOptionsError) {
          return [{ value: '__error_assembly_types__', label: 'Unable to load assembly types', disabled: true }];
        }
        if (assemblyTypeSelectOptions.length === 0) {
          return [{ value: '__empty_assembly_types__', label: 'No assembly types available', disabled: true }];
        }
        return assemblyTypeSelectOptions;
      }
      if (field.key === 'aircraft_model') {
        const manufacturerId = String(formValues.manufacturer_id ?? '').trim();
        if (!manufacturerId) {
          return [{ value: '__select_manufacturer__', label: 'Select manufacturer first', disabled: true }];
        }
        if (assemblyModelOptionsLoading) {
          return [{ value: '__loading_assembly_models__', label: 'Loading aircraft models...', disabled: true }];
        }
        if (assemblyModelOptionsError) {
          return [{ value: '__error_assembly_models__', label: 'Unable to load aircraft models', disabled: true }];
        }
        if (aircraftModelSelectOptions.length === 0) {
          return [{ value: '__empty_assembly_models__', label: 'No aircraft models available', disabled: true }];
        }
        return aircraftModelSelectOptions;
      }
      if (field.key === 'aircraft_type') {
        return aircraftTypeSelectOptions;
      }
      if (field.key === 'status') {
        return aircraftStatusSelectOptions;
      }
      return (field.options || []).map((option) => ({ value: option, label: option }));
    },
    [
      aircraftStatusSelectOptions,
      aircraftTypeSelectOptions,
      aircraftModelSelectOptions,
      assemblyTypeOptionsError,
      assemblyTypeOptionsLoading,
      assemblyTypeSelectOptions,
      assemblyModelOptionsError,
      assemblyModelOptionsLoading,
      formValues.manufacturer_id,
      manufacturerOptionsError,
      manufacturerOptionsLoading,
      manufacturerSelectOptions,
    ],
  );

  useEffect(() => {
    if (entity !== 'aircraft') {
      return;
    }
    if (assemblyModelOptionsLoading || assemblyModelOptionsError) {
      return;
    }
    const manufacturerId = String(formValues.manufacturer_id ?? '').trim();
    const currentModel = String(formValues.aircraft_model ?? '').trim();
    if (!manufacturerId) {
      if (currentModel) {
        setFieldValue('aircraft_model', '');
      }
      return;
    }
    if (!currentModel) {
      return;
    }
    const manufacturer = manufacturerMetaById.get(manufacturerId);
    const normalize = (value: string) => value.trim().toLowerCase();
    const manufacturerTokens = [manufacturerId, manufacturer?.id, manufacturer?.code, manufacturer?.name, manufacturer?.label]
      .filter(Boolean)
      .map((token) => normalize(String(token)));
    const manufacturerTokenSet = new Set(manufacturerTokens);
    const match = assemblyModelOptions.some((option) => {
      const manufacturerMatch =
        option.manufacturerTokens.length > 0
          ? option.manufacturerTokens.some((token) => manufacturerTokenSet.has(token))
          : manufacturerTokenSet.has(normalize(option.manufacturerId || ''));
      return manufacturerMatch && option.modelValue === currentModel;
    });
    if (!match) {
      setFieldValue('aircraft_model', '');
    }
  }, [
    assemblyModelOptions,
    assemblyModelOptionsError,
    assemblyModelOptionsLoading,
    entity,
    formValues.aircraft_model,
    formValues.manufacturer_id,
    manufacturerMetaById,
    setFieldValue,
  ]);

  const supportsColumnHeaderFilters = entity === 'aircraft' || entity === 'flight_logs';

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const columnMatch = Object.entries(columnFilters).every(([column, rawValue]) => {
        const value = rawValue.trim().toLowerCase();
        if (!value) return true;
        if (entity === 'flight_logs') {
          if (column === 'aircraft_id') {
            return resolveFlightLogAircraftLabel(row).toLowerCase().includes(value);
          }
          if (column === 'departure_airport') {
            return resolveFlightLogAirportLabel(row, 'departure_airport_label', 'departure_airport_ref', 'departure_airport').toLowerCase().includes(value);
          }
          if (column === 'arrival_airport') {
            return resolveFlightLogAirportLabel(row, 'arrival_airport_label', 'arrival_airport_ref', 'arrival_airport').toLowerCase().includes(value);
          }
        }
        if (!(column in row)) return true;
        return String(row[column] ?? '').toLowerCase().includes(value);
      });
      if (!columnMatch) return false;
      if (entity === 'flight_logs') {
        const flightDate = String(row.flight_date || '').slice(0, 10);
        if (flightDateFrom.trim() && (!flightDate || flightDate < flightDateFrom.trim())) return false;
        if (flightDateTo.trim() && (!flightDate || flightDate > flightDateTo.trim())) return false;
        if (flightAircraftFilter.trim() && !String(row.aircraft_id || '').toLowerCase().includes(flightAircraftFilter.trim().toLowerCase())) return false;
        if (flightRegistrationFilter.trim() && !String(row.aircraft_registration || '').toLowerCase().includes(flightRegistrationFilter.trim().toLowerCase())) return false;
        if (flightPilotFilter.trim() && !String(row.pilot_name || '').toLowerCase().includes(flightPilotFilter.trim().toLowerCase())) return false;
        if (flightNumberFilter.trim() && !String(row.flight_number || '').toLowerCase().includes(flightNumberFilter.trim().toLowerCase())) return false;
      }
      if (entity === 'suppliers' && supplierTypeFilter !== 'all') {
        const normalizedType = String(
          row.supplier_type
          || row.supplier_category
          || row.vendor_type
          || row.type
          || '',
        ).trim().toLowerCase();
        if (normalizedType !== supplierTypeFilter) return false;
      }
      if (entity === 'maintenance_facilities' && facilityStationFilter !== 'all') {
        const normalizedStation = String(
          row.station_code
          || row.station
          || row.facility_station
          || '',
        ).trim().toLowerCase();
        if (normalizedStation !== facilityStationFilter) return false;
      }
      if (entity === 'work_centers' && workCenterTypeFilter !== 'all') {
        const normalizedCenterType = String(
          row.center_type
          || row.work_center_type
          || row.type
          || '',
        ).trim().toLowerCase();
        if (normalizedCenterType !== workCenterTypeFilter) return false;
      }
      return true;
    });
  }, [
    columnFilters,
    entity,
    facilityStationFilter,
    flightAircraftFilter,
    flightDateFrom,
    flightDateTo,
    flightNumberFilter,
    flightPilotFilter,
    flightRegistrationFilter,
    rows,
    supplierTypeFilter,
    workCenterTypeFilter,
  ]);

  const renderedRows = filteredRows;
  const renderedRowIds = useMemo(() => renderedRows.map((row) => row.id), [renderedRows]);
  const renderedRowIdSet = useMemo(() => new Set(renderedRowIds), [renderedRowIds]);

  const aircraftHeaderColumns = useMemo(() => {
    const availableColumns = new Set(tableColumns);
    const selectedColumns = (aircraftSelectedColumns.length > 0 ? aircraftSelectedColumns : tableColumns)
      .filter((column) => availableColumns.has(column));
    if (selectedColumns.length === 0) {
      return tableColumns;
    }
    return tableColumns.filter((column) => selectedColumns.includes(column));
  }, [aircraftSelectedColumns, tableColumns]);
  const aircraftColumnSelectionSet = useMemo(() => new Set(aircraftHeaderColumns), [aircraftHeaderColumns]);

  useEffect(() => {
    if (entity === 'aircraft') {
      return;
    }
    aircraftColumnPreferencesHydratedRef.current = false;
    setAircraftSelectedColumns([]);
  }, [entity]);

  useEffect(() => {
    if (entity !== 'aircraft') {
      return;
    }
    if (tableColumns.length === 0) {
      return;
    }
    setAircraftSelectedColumns((previous) => {
      const availableColumns = new Set(tableColumns);
      if (!aircraftColumnPreferencesHydratedRef.current) {
        aircraftColumnPreferencesHydratedRef.current = true;
        try {
          const raw = localStorage.getItem(aircraftColumnPreferenceStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const normalized = parsed
                .map((value) => String(value))
                .filter((column) => availableColumns.has(column));
              if (normalized.length > 0) {
                return tableColumns.filter((column) => normalized.includes(column));
              }
            }
          }
        } catch (error) {
          logger.warn('Unable to load aircraft column preferences', {
            component: 'AmroSettingsMasterDataPage',
            error: String((error as Error)?.message || error),
          });
        }
        return [...tableColumns];
      }
      const normalizedPrevious = (previous.length > 0 ? previous : tableColumns).filter((column) => availableColumns.has(column));
      if (normalizedPrevious.length > 0) {
        return normalizedPrevious;
      }
      return [...tableColumns];
    });
  }, [aircraftColumnPreferenceStorageKey, entity, tableColumns]);

  useEffect(() => {
    if (entity !== 'aircraft') {
      return;
    }
    if (!aircraftColumnPreferencesHydratedRef.current) {
      return;
    }
    if (aircraftHeaderColumns.length === 0) {
      return;
    }
    try {
      localStorage.setItem(aircraftColumnPreferenceStorageKey, JSON.stringify(aircraftHeaderColumns));
    } catch (error) {
      logger.warn('Unable to persist aircraft column preferences', {
        component: 'AmroSettingsMasterDataPage',
        error: String((error as Error)?.message || error),
      });
    }
  }, [aircraftColumnPreferenceStorageKey, aircraftHeaderColumns, entity]);

  const handleAircraftColumnToggle = useCallback(
    (column: string, checked: boolean) => {
      if (!tableColumns.includes(column)) {
        return;
      }
      setAircraftSelectedColumns((previous) => {
        const normalizedPrevious = previous.length > 0 ? previous : [...tableColumns];
        if (checked) {
          if (normalizedPrevious.includes(column)) {
            return normalizedPrevious;
          }
          const nextSet = new Set([...normalizedPrevious, column]);
          return tableColumns.filter((item) => nextSet.has(item));
        }
        if (!normalizedPrevious.includes(column)) {
          return normalizedPrevious;
        }
        const next = normalizedPrevious.filter((item) => item !== column);
        if (next.length === 0) {
          toast.error('At least one field must remain selected');
          return normalizedPrevious;
        }
        return next;
      });
    },
    [tableColumns],
  );

  const resetAircraftColumnSelection = useCallback(() => {
    setAircraftSelectedColumns([...tableColumns]);
  }, [tableColumns]);

  useEffect(() => {
    if (entity !== 'aircraft') {
      setAircraftPresenceByRowId({});
      setAircraftPresenceError('');
      return;
    }
    const aircraftRows = renderedRows;
    const aircraftIds = aircraftRows.map((row) => String(row.id || '')).filter(Boolean);
    if (aircraftIds.length === 0) {
      setAircraftPresenceByRowId({});
      setAircraftPresenceError('');
      return;
    }
    const sortedIds = [...aircraftIds].sort();
    const cacheKey = `amro:aircraft-presence:${scope.tenantId || 'tenant'}:${scope.franchiseId || 'franchise'}:${sortedIds.join(',')}`;
    const now = Date.now();
    const inMemoryCache = aircraftPresenceCacheRef.current;
    if (inMemoryCache && inMemoryCache.key === cacheKey && now - inMemoryCache.fetchedAt < AIRCRAFT_PRESENCE_CACHE_TTL_MS) {
      setAircraftPresenceByRowId(inMemoryCache.map);
      setAircraftPresenceError('');
      return;
    }
    try {
      const cachedValue = sessionStorage.getItem(cacheKey);
      if (cachedValue) {
        const parsed = JSON.parse(cachedValue) as { fetchedAt: number; map: Record<string, AircraftPresenceCollaborator[]> };
        if (now - Number(parsed.fetchedAt || 0) < AIRCRAFT_PRESENCE_CACHE_TTL_MS) {
          aircraftPresenceCacheRef.current = { key: cacheKey, fetchedAt: parsed.fetchedAt, map: parsed.map || {} };
          setAircraftPresenceByRowId(parsed.map || {});
          setAircraftPresenceError('');
          return;
        }
      }
    } catch (error) {
      logger.warn('Failed to parse aircraft collaborator cache', {
        component: 'AmroSettingsMasterDataPage',
        error: String((error as Error)?.message || error),
      });
    }

    let cancelled = false;
    const loadPresence = async () => {
      setAircraftPresenceLoading(true);
      setAircraftPresenceError('');
      const startedAt = performance.now();
      try {
        const headers = await buildApiHeaders(scope, {
          fallbackAccessToken: sessionAccessToken,
          requestTag: 'aircraft-collaborator-presence',
          requestUrl: '/api/v2/amro/master-data/flight_logs',
          requestMethod: 'GET',
        });
        const authorizationHeader = String(headers.get('Authorization') || '');
        if (!authorizationHeader) {
          throw new Error('Authentication required to load aircraft collaborator presence');
        }
        const query = new URLSearchParams({ page: '1', page_size: '1000', sort_by: 'flight_date', sort_dir: 'desc' });
        const response = await fetch(`/api/v2/amro/master-data/flight_logs?${query.toString()}`, { method: 'GET', headers });
        const payload = await parseApiPayload(response);
        if (!response.ok) throw new Error(String(payload.error || 'Failed to load flight logs for collaborators'));
        const flightLogs = getPayloadRecords(payload);
        const map = Object.fromEntries(
          aircraftRows.map((row) => {
            const rowId = String(row.id || '');
            const rowLogs = flightLogs.filter((log) => String(log.aircraft_id || '') === rowId);
            return [rowId, buildAircraftPresenceCollaborators(row, rowLogs)];
          }),
        ) as Record<string, AircraftPresenceCollaborator[]>;
        if (cancelled) return;
        setAircraftPresenceByRowId(map);
        aircraftPresenceCacheRef.current = { key: cacheKey, fetchedAt: Date.now(), map };
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), map }));
        } catch (error) {
          logger.warn('Failed to persist aircraft collaborator cache', {
            component: 'AmroSettingsMasterDataPage',
            error: String((error as Error)?.message || error),
          });
        }
        logger.info('Aircraft collaborator presence loaded', {
          component: 'AmroSettingsMasterDataPage',
          aircraftCount: aircraftRows.length,
          flightLogCount: flightLogs.length,
          durationMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        const message = String((error as Error).message || 'Failed to load collaborator presence');
        if (cancelled) return;
        setAircraftPresenceError(message);
        const fallback = Object.fromEntries(aircraftRows.map((row) => [String(row.id || ''), buildAircraftPresenceCollaborators(row, [])])) as Record<string, AircraftPresenceCollaborator[]>;
        setAircraftPresenceByRowId(fallback);
        logger.warn('Aircraft collaborator presence fallback applied', { component: 'AmroSettingsMasterDataPage', message, aircraftCount: aircraftRows.length });
      } finally {
        if (!cancelled) setAircraftPresenceLoading(false);
      }
    };
    void loadPresence();
    return () => {
      cancelled = true;
    };
  }, [entity, renderedRows, scope, sessionAccessToken]);

  const toggleSort = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortColumn(column);
      setSortDirection('asc');
    },
    [sortColumn],
  );

  const setColumnFilterValue = useCallback((column: string, value: string) => {
    setColumnFilters((previous) => ({ ...previous, [column]: value }));
    setPage(1);
  }, []);

  const toggleRowSelection = useCallback((rowId: string, checked: boolean) => {
    setSelectedRowIds((previous) => {
      if (checked) {
        return previous.includes(rowId) ? previous : [...previous, rowId];
      }
      return previous.filter((id) => id !== rowId);
    });
  }, []);

  const toggleRowSelectionRange = useCallback(
    (startRowId: string, endRowId: string, checked: boolean) => {
      const startIndex = renderedRows.findIndex((row) => row.id === startRowId);
      const endIndex = renderedRows.findIndex((row) => row.id === endRowId);
      if (startIndex < 0 || endIndex < 0) {
        toggleRowSelection(endRowId, checked);
        return;
      }
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeIds = renderedRows.slice(from, to + 1).map((row) => row.id);
      setSelectedRowIds((previous) => {
        const next = new Set(previous);
        rangeIds.forEach((id) => {
          if (checked) {
            next.add(id);
          } else {
            next.delete(id);
          }
        });
        return Array.from(next);
      });
    },
    [renderedRows, toggleRowSelection],
  );

  const toggleSelectAllRows = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedRowIds((previous) => Array.from(new Set([...previous, ...renderedRowIds])));
        return;
      }
      setSelectedRowIds((previous) => previous.filter((id) => !renderedRowIdSet.has(id)));
    },
    [renderedRowIdSet, renderedRowIds],
  );

  const handleInlineEditStart = useCallback((rowId: string, column: string, currentValue: unknown) => {
    setInlineEditingCell({ rowId, column });
    setInlineEditValue(String(currentValue ?? ''));
  }, []);

  const handleInlineEditCommit = useCallback(async () => {
    if (!inlineEditingCell) return;
    try {
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}/${inlineEditingCell.rowId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [inlineEditingCell.column]: inlineEditValue }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Inline update failed'));
      toast.success('Cell updated');
      setInlineEditingCell(null);
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Inline update failed'));
    }
  }, [entity, inlineEditValue, inlineEditingCell, loadRecords, scope]);

  const cancelInlineEdit = useCallback(() => {
    setInlineEditingCell(null);
    setInlineEditValue('');
  }, []);
  const resolveTableCellValue = useCallback(
    (row: RecordRow, column: string) => {
      if (entity === 'assembly_models') {
        if (column === 'manufacturer_id') {
          const raw = String(row[column] ?? '').trim();
          return manufacturerLabelById.get(raw) ?? raw;
        }
        if (column === 'assembly_type_id') {
          const raw = String(row[column] ?? '').trim();
          return assemblyTypeLabelById.get(raw) ?? raw;
        }
      }
      if (entity === 'flight_logs') {
        if (column === 'aircraft_id') {
          return resolveFlightLogAircraftLabel(row);
        }
        if (column === 'departure_airport') {
          return resolveFlightLogAirportLabel(row, 'departure_airport_label', 'departure_airport_ref', 'departure_airport');
        }
        if (column === 'arrival_airport') {
          return resolveFlightLogAirportLabel(row, 'arrival_airport_label', 'arrival_airport_ref', 'arrival_airport');
        }
      }
      return String(row[column] ?? '');
    },
    [assemblyTypeLabelById, entity, manufacturerLabelById],
  );

  const handleRowSingleClick = useCallback(
    (row: RecordRow, event: MouseEvent<HTMLTableRowElement>) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        const checked = !selectedRowIds.includes(row.id);
        if (event.shiftKey && selectionAnchorRef.current) {
          toggleRowSelectionRange(selectionAnchorRef.current, row.id, checked);
        } else {
          toggleRowSelection(row.id, checked);
        }
        selectionAnchorRef.current = row.id;
        setSelectedId(row.id);
        setFormValues(pickFormValuesFromRow(entity, row));
        setFormErrors({});
        return;
      }
      if (clickDelayTimerRef.current) {
        clearTimeout(clickDelayTimerRef.current);
      }
      clickDelayTimerRef.current = setTimeout(() => {
        setSelectedRowIds([row.id]);
        selectionAnchorRef.current = row.id;
        setSelectedId(row.id);
        setFormValues(pickFormValuesFromRow(entity, row));
        setFormErrors({});
      }, 300);
    },
    [entity, selectedRowIds, toggleRowSelection, toggleRowSelectionRange],
  );

  const openUpdateModal = useCallback(
    (row: RecordRow) => {
      if (clickDelayTimerRef.current) {
        clearTimeout(clickDelayTimerRef.current);
      }
      try {
        const rowId = String(row.id || '').trim();
        if (!rowId) {
          throw new Error('Unable to open form for this record');
        }
        setSelectedId(rowId);
        setFormValues(pickFormValuesFromRow(entity, row));
        setFormErrors({});
        setModalMode('update');
        setActiveFormTab('basic');
        setModalOpen(true);
      } catch (error) {
        const message = String((error as Error).message || 'Unable to open form');
        logger.warn('Master data row open failed', {
          component: 'AmroSettingsMasterDataPage',
          entity,
          rowId: String(row.id || ''),
          message,
        });
        toast.error(message);
      }
    },
    [entity],
  );

  const handleRowDoubleClick = useCallback(
    (row: RecordRow) => {
      if (entity === 'flight_logs') {
        if (clickDelayTimerRef.current) {
          clearTimeout(clickDelayTimerRef.current);
        }
        setFlightLogDetailRow(row);
        setFlightLogDetailOpen(true);
        return;
      }
      openUpdateModal(row);
    },
    [entity, openUpdateModal],
  );

  const handleOpenCreateModal = useCallback(() => {
    if (!canCreateAircraftRecords) {
      toast.error('You do not have permission to create records');
      return;
    }
    setBusyAction('create');
    if (entity === 'flight_logs') {
      const aircraftIdHint = flightAircraftFilter.trim();
      setFlightLogMode('new');
      setFlightLogInitialValues(getDefaultFlightLogFormValues({ aircraftId: aircraftIdHint }));
      setFlightLogSubmitting(false);
      setFlightLogDialogInstance((previous) => previous + 1);
      setFlightLogDialogOpen(true);
      setBusyAction(null);
      return;
    }
    setModalMode('create');
    setSelectedId(null);
    setFormValues(getInitialFormValues(entity));
    setFormErrors({});
    setActiveFormTab('basic');
    setModalOpen(true);
    setBusyAction(null);
  }, [canCreateAircraftRecords, entity, flightAircraftFilter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleOpenCreateModal();
      }
      if (event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        void handleExport();
      }
      if (event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setBusyAction('refresh');
        void loadRecords().finally(() => setBusyAction(null));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExport, handleOpenCreateModal, loadRecords]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    const timer = window.setInterval(() => {
      setLastCollaborationPingAt(new Date().toISOString());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [entity, modalOpen]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    if (!String(formValues.tenant_id ?? '').trim() && scope.tenantId) {
      setFieldValue('tenant_id', scope.tenantId);
    }
    if (!String(formValues.franchise_id ?? '').trim() && scope.franchiseId) {
      setFieldValue('franchise_id', scope.franchiseId);
    }
  }, [entity, formValues.franchise_id, formValues.tenant_id, modalOpen, scope.franchiseId, scope.tenantId, setFieldValue]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    void loadAircraftTenantAndFranchiseOptions();
  }, [entity, loadAircraftTenantAndFranchiseOptions, modalOpen]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    const currentTemplateModel = String(aircraftTemplateModel || '').trim();
    if (!currentTemplateModel) {
      return;
    }
    const templateStillAvailable = filteredSystemTemplateModelOptions.some((option) => option.id === currentTemplateModel);
    if (templateStillAvailable) {
      return;
    }
    setAircraftTemplateModel('');
    setFieldValue('aircraft_template', '');
  }, [aircraftTemplateModel, entity, filteredSystemTemplateModelOptions, modalOpen, setFieldValue]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    const registration = String(formValues.registration ?? '').trim().toUpperCase();
    const serialNumber = String(formValues.serial_number ?? '').trim().toUpperCase();
    setAircraftNoSerialNumber(serialNumber === 'N/A');
    const canHydrateTemplate = Boolean(activeAircraftTenantId && activeAircraftFranchiseId);
    const defaultTemplateModel = canHydrateTemplate
      ? systemTemplateModelSelectOptions.find((option) => !option.disabled && !isSystemSelectValue(option.value))?.value || ''
      : '';
    const templateModelSource = canHydrateTemplate ? (formValues.aircraft_template ?? defaultTemplateModel) : '';
    setAircraftTemplateModel(String(templateModelSource).trim() || defaultTemplateModel);
    setAircraftManufacturingDate(String(formValues.manufacturing_date ?? '').trim());
    const baseSource = formValues.base_location ?? AIRCRAFT_UNSELECTED_OPTION;
    setAircraftBase(String(baseSource).trim() || AIRCRAFT_UNSELECTED_OPTION);
    const ownerSource = formValues.owner_name ?? AIRCRAFT_UNSELECTED_OPTION;
    setAircraftOwner(String(ownerSource).trim() || AIRCRAFT_UNSELECTED_OPTION);
    setAircraftLineNumber(String(formValues.line_number ?? '').trim());
    setAircraftVariableNumber(String(formValues.variable_number ?? registration).trim());
    setAircraftMaintenanceRevisionNumber(String(formValues.maintenance_revision_number ?? '').trim());
    setAircraftMaintenanceRevisionDate(String(formValues.maintenance_revision_date ?? '').trim());
    setAircraftAmendmentNumber(String(formValues.amendment_number ?? '').trim());
    setAircraftAmendmentDate(String(formValues.amendment_date ?? '').trim());
    setAircraftCounterRows(getDefaultAircraftCounterRows());
    setFormValues((previous) => {
      const fallbackTailNumber = String(previous.tail_number ?? '').trim() || String(previous.registration ?? '').trim() || String(previous.variable_number ?? '').trim();
      return {
        ...previous,
        tail_number: fallbackTailNumber ? fallbackTailNumber.toUpperCase() : previous.tail_number,
        aircraft_type: String(previous.aircraft_type ?? '').trim() || aircraftTypeSelectOptions[0]?.value || AIRCRAFT_TYPE_FALLBACK_OPTIONS[0],
        status: String(previous.status ?? '').trim() || aircraftStatusSelectOptions[0]?.value || AIRCRAFT_STATUS_OPTIONS[0],
      };
    });
  }, [aircraftStatusSelectOptions, aircraftTypeSelectOptions, entity, modalMode, modalOpen, selectedId, systemTemplateModelSelectOptions]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    const selectedManufacturerId = String(formValues.manufacturer_id ?? '').trim();
    if (!selectedManufacturerId) {
      return;
    }
    if (manufacturerOptions.some((option) => option.id === selectedManufacturerId)) {
      return;
    }
    setFieldValue('manufacturer_id', '');
    setFormErrors((previous) => ({
      ...previous,
      manufacturer_id: 'Manufacturer is not available for selected tenant',
    }));
  }, [entity, formValues.manufacturer_id, manufacturerOptions, modalOpen, setFieldValue]);

  useEffect(() => {
    if (!modalOpen || entity !== 'aircraft') {
      return;
    }
    void hydrateAircraftCountersFromTemplate(aircraftTemplateModel);
  }, [aircraftTemplateModel, entity, hydrateAircraftCountersFromTemplate, modalOpen]);

  const handleSubmitModal = useCallback(async () => {
    const ok = modalMode === 'create' ? await handleCreate() : await handleUpdate();
    if (ok) {
      if (entity === 'aircraft') {
        localStorage.removeItem(aircraftFormDraftKey);
        setAircraftFormDraftStatus('idle');
        setAircraftFormLastSavedAt('');
      }
      setModalOpen(false);
    }
  }, [aircraftFormDraftKey, entity, handleCreate, handleUpdate, modalMode]);

  const loadAircraftWorkPackageSnapshot = useCallback(async () => {
    if (!aircraftEnhancementEnabled || entity !== 'aircraft') {
      return;
    }
    const aircraftId = String(selectedAircraft?.id || '').trim();
    if (!aircraftId) {
      setAircraftWorkPackageSnapshot({
        open: 0,
        inProgress: 0,
        deferred: 0,
        completed: 0,
        rtsBlockers: 0,
        slaRisk: 0,
      });
      return;
    }
    try {
      const headers = await buildApiHeaders(scope, {
        fallbackAccessToken: sessionAccessToken,
        requestTag: 'aircraft-work-package-snapshot',
        requestUrl: '/api/v2/amro/work-packages',
        requestMethod: 'GET',
      });
      const authorizationHeader = String(headers.get('Authorization') || '');
      if (!authorizationHeader) {
        logger.warn('Aircraft row click snapshot skipped: Authorization header missing', {
          component: 'AmroSettingsMasterDataPage',
          requestPath: '/api/v2/amro/work-packages',
          requestMethod: 'GET',
          aircraftId,
          selectedId: String(selectedId || ''),
          authorizationHeader,
        });
        if (!aircraftSnapshotAuthToastShownRef.current) {
          aircraftSnapshotAuthToastShownRef.current = true;
          toast.error('Your session has expired. Sign in again to load aircraft details.');
        }
        setAircraftWorkPackageSnapshot({
          open: 0,
          inProgress: 0,
          deferred: 0,
          completed: 0,
          rtsBlockers: 0,
          slaRisk: 0,
        });
        return;
      }
      const query = new URLSearchParams({
        aircraft_id: aircraftId,
        page: '1',
        page_size: '50',
      });
      const response = await fetch(`/api/v2/amro/work-packages?${query.toString()}`, {
        method: 'GET',
        headers,
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        const responseError = String(payload.error || '');
        logger.warn('Aircraft row click snapshot request failed', {
          component: 'AmroSettingsMasterDataPage',
          requestPath: '/api/v2/amro/work-packages',
          requestMethod: 'GET',
          statusCode: response.status,
          aircraftId,
          selectedId: String(selectedId || ''),
          authorizationHeader,
          responseError,
        });
        if (response.status === 401 && (responseError.includes('Authorization header') || responseError.includes('Invalid or expired token'))) {
          if (!aircraftSnapshotAuthToastShownRef.current) {
            aircraftSnapshotAuthToastShownRef.current = true;
            toast.error('Authentication failed while loading aircraft details. Please sign in again.');
          }
        }
        setAircraftWorkPackageSnapshot({
          open: 0,
          inProgress: 0,
          deferred: 0,
          completed: 0,
          rtsBlockers: 0,
          slaRisk: 0,
        });
        return;
      }
      aircraftSnapshotAuthToastShownRef.current = false;
      setAircraftWorkPackageSnapshot(buildAircraftWorkPackageSnapshot(parseWorkPackageItems(payload)));
    } catch (error) {
      logger.warn('Aircraft row click snapshot request error', {
        component: 'AmroSettingsMasterDataPage',
        requestPath: '/api/v2/amro/work-packages',
        requestMethod: 'GET',
        aircraftId,
        selectedId: String(selectedId || ''),
        message: String((error as Error).message || error),
      });
      setAircraftWorkPackageSnapshot({
        open: 0,
        inProgress: 0,
        deferred: 0,
        completed: 0,
        rtsBlockers: 0,
        slaRisk: 0,
      });
    }
  }, [aircraftEnhancementEnabled, entity, scope, selectedAircraft, selectedId, sessionAccessToken]);

  const loadAircraftLeadDashboard = useCallback(async () => {
    if (!aircraftEnhancementEnabled || entity !== 'aircraft') {
      return;
    }
    const aircraftId = String(selectedAircraft?.id || '').trim();
    if (!aircraftId) {
      setAircraftDashboard(null);
      setAircraftDashboardError('');
      return;
    }
    setAircraftDashboardLoading(true);
    setAircraftDashboardError('');
    try {
      const headers = await buildApiHeaders(scope, {
        fallbackAccessToken: sessionAccessToken,
        requestTag: 'aircraft-lead-dashboard',
        requestUrl: '/api/v2/amro/aircraft-dashboard',
        requestMethod: 'GET',
      });
      const query = new URLSearchParams({
        aircraft_id: aircraftId,
        status: aircraftDashboardStatusFilter,
        due_within_days: aircraftDashboardDueWindowDays,
        trend_days: aircraftDashboardTrendDays,
        module: aircraftDashboardModule,
      });
      if (aircraftDashboardSearch.trim()) {
        query.set('search', aircraftDashboardSearch.trim());
      }
      const response = await fetch(`/api/v2/amro/aircraft-dashboard?${query.toString()}`, {
        method: 'GET',
        headers,
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to load aircraft dashboard'));
      }
      const output = payload.output && typeof payload.output === 'object' ? (payload.output as AircraftDashboardOutput) : null;
      setAircraftDashboard(output);
      try {
        const engineAssetsResponse = await fetch('/api/v2/amro/engine-assets', {
          method: 'GET',
          headers,
        });
        const engineAssetsPayload = await parseApiPayload(engineAssetsResponse);
        if (!engineAssetsResponse.ok) {
          throw new Error(String(engineAssetsPayload.error || 'Failed to load engine assets read model'));
        }
        const scopedAssets = Array.isArray((engineAssetsPayload.output as Record<string, unknown> | undefined)?.assets)
          ? (((engineAssetsPayload.output as Record<string, unknown>).assets || []) as EngineAssetReadModel[])
          : [];
        setAircraftEngineAssets(scopedAssets);
        const selectedAsset =
          scopedAssets.find((asset) => String(asset.tailNumber || '').toLowerCase().includes(String(selectedAircraft?.registration || '').toLowerCase()))
          || scopedAssets[0];
        if (!selectedAsset?.id) {
          setAircraftEnginePerformanceHistory([]);
        } else {
          const perfResponse = await fetch(`/api/v2/amro/engine-assets/${encodeURIComponent(selectedAsset.id)}/performance-history`, {
            method: 'GET',
            headers,
          });
          const perfPayload = await parseApiPayload(perfResponse);
          if (!perfResponse.ok) {
            throw new Error(String(perfPayload.error || 'Failed to load engine performance history'));
          }
          const series = Array.isArray((perfPayload.output as Record<string, unknown> | undefined)?.series)
            ? (((perfPayload.output as Record<string, unknown>).series || []) as EnginePerformanceHistoryPoint[])
            : [];
          setAircraftEnginePerformanceHistory(series);
        }
        setAircraftEngineReadModelError('');
      } catch (engineReadError) {
        setAircraftEngineAssets([]);
        setAircraftEnginePerformanceHistory([]);
        setAircraftEngineReadModelError(String((engineReadError as Error).message || 'Engine read model unavailable'));
      }
      trackWorkPackageTemplateAdoption('dashboard_loaded', {
        selectedAircraftId: aircraftId,
        cacheState: String(output?.metadata?.cache || 'unknown'),
      });
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load aircraft dashboard');
      setAircraftDashboard(null);
      setAircraftEngineAssets([]);
      setAircraftEnginePerformanceHistory([]);
      setAircraftEngineReadModelError(message);
      setAircraftDashboardError(message);
      trackWorkPackageTemplateAdoption('dashboard_load_failed', {
        errorMessage: message,
        selectedAircraftId: aircraftId,
      });
    } finally {
      setAircraftDashboardLoading(false);
    }
  }, [
    aircraftDashboardDueWindowDays,
    aircraftDashboardModule,
    aircraftDashboardSearch,
    aircraftDashboardStatusFilter,
    aircraftDashboardTrendDays,
    aircraftEnhancementEnabled,
    entity,
    scope,
    selectedAircraft,
    sessionAccessToken,
    trackWorkPackageTemplateAdoption,
  ]);

  const loadWorkPackageTemplateRegistry = useCallback(async () => {
    if (entity !== 'aircraft' || !canCreateWorkPackage) {
      return;
    }
    setWorkPackageTemplateRegistryLoading(true);
    setWorkPackageTemplateRegistryError('');
    try {
      const headers = await buildApiHeaders(scope, {
        fallbackAccessToken: sessionAccessToken,
        requestTag: 'aircraft-work-package-template-registry',
        requestUrl: '/api/v2/amro/master-data/work_package_templates',
        requestMethod: 'GET',
      });
      const query = new URLSearchParams({
        page: '1',
        page_size: '100',
        sort_by: 'updated_at',
        sort_dir: 'desc',
      });
      const controller = new AbortController();
      const timeoutHandle = window.setTimeout(() => controller.abort(), TEMPLATE_REGISTRY_TIMEOUT_MS);
      const response = await fetch(`/api/v2/amro/master-data/work_package_templates?${query.toString()}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      window.clearTimeout(timeoutHandle);
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        const statusMessage = response.status >= 500
          ? 'Template registry is temporarily unavailable. Please retry.'
          : String(payload.error || `Failed to load work package templates (${response.status})`);
        throw new Error(statusMessage);
      }
      const registry = extractTemplateRegistryRecords(payload)
        .map((record) => {
          const id = String(record.id || record.template_id || record.uuid || record.template_code || '').trim();
          if (!id) {
            return null;
          }
          const taskRows = normalizeTemplateTaskRows(record.tasks_json).map((taskRow, index) => ({
            id: `${id}-task-${index + 1}`,
            ...taskRow,
          }));
          const maintenanceTypeText = String(record.maintenance_type || '').trim().toLowerCase();
          const maintenanceType = (['line', 'base', 'hangar', 'shop'].includes(maintenanceTypeText) ? maintenanceTypeText : 'line') as WorkPackageTemplateRegistryItem['maintenanceType'];
          return {
            id,
            templateCode: String(record.template_code || '').trim(),
            templateName: String(record.template_name || '').trim(),
            description: String(record.description || record.template_description || '').trim(),
            maintenanceType,
            version: String(record.version || '1').trim() || '1',
            active: Boolean(record.active ?? true),
            scopeItems: normalizeTemplateScopeItems(record.scope_json),
            taskRows,
          };
        })
        .filter((item): item is WorkPackageTemplateRegistryItem => Boolean(item) && item.active);
      setWorkPackageTemplateRegistry(registry);
      trackWorkPackageTemplateAdoption('registry_loaded', {
        activeTemplateCount: registry.length,
      });
      setSelectedWorkPackageTemplateId((previous) => {
        if (previous && registry.some((item) => item.id === previous)) {
          return previous;
        }
        return '';
      });
    } catch (error) {
      const message = resolveWorkPackageApiErrorMessage(error, 'Failed to load template registry');
      setWorkPackageTemplateRegistry([]);
      setSelectedWorkPackageTemplateId('');
      setWorkPackageTemplateRegistryError(message);
      trackWorkPackageTemplateAdoption('registry_load_failed', {
        errorMessage: message,
      });
    } finally {
      setWorkPackageTemplateRegistryLoading(false);
    }
  }, [canCreateWorkPackage, entity, scope, sessionAccessToken, trackWorkPackageTemplateAdoption]);

  const loadAircraftTemplateAssociatedTasks = useCallback(async (templateId: string) => {
    const normalizedTemplateId = String(templateId || '').trim();
    if (!normalizedTemplateId || !scope.tenantId || !scopedDb) {
      setAircraftTemplateAssociatedTasks([]);
      setAircraftTemplateAssociatedTasksError('');
      setAircraftTemplateAssociatedTasksLoading(false);
      return;
    }
    setAircraftTemplateAssociatedTasksLoading(true);
    setAircraftTemplateAssociatedTasksError('');
    try {
      const isMissingFranchiseColumnError = (error: unknown) => {
        const message = String((error as { message?: string })?.message || '').toLowerCase();
        return message.includes('franchise_id') && (message.includes('column') || message.includes('does not exist'));
      };
      const queryRelationships = async (withFranchiseScope: boolean) => {
        let query = (scopedDb as any)
          .from('work_package_template_task_templates')
          .select('task_template_id')
          .eq('tenant_id', scope.tenantId)
          .eq('work_package_template_id', normalizedTemplateId);
        if (withFranchiseScope && scope.franchiseId) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${scope.franchiseId}`);
        }
        return query;
      };
      let { data: relationshipRows, error: relationshipError } = await queryRelationships(true);
      if (relationshipError && isMissingFranchiseColumnError(relationshipError) && scope.franchiseId) {
        ({ data: relationshipRows, error: relationshipError } = await queryRelationships(false));
      }
      if (relationshipError) {
        throw new Error(String(relationshipError.message || 'Failed to load template associations'));
      }
      const taskTemplateIds = Array.from(new Set(
        (Array.isArray(relationshipRows) ? relationshipRows : [])
          .map((row) => String((row as Record<string, unknown>).task_template_id || '').trim())
          .filter((value) => value.length > 0),
      ));
      if (taskTemplateIds.length === 0) {
        setAircraftTemplateAssociatedTasks([]);
        return;
      }
      const queryTaskTemplates = async (columnName: 'id' | 'task_template_id', withFranchiseScope: boolean) => {
        let query = (scopedDb as any)
          .from('task_templates')
          .select('id,task_template_id,code_form_no,ata_code,reference_amp,description,category_code,estimated_man_hours,is_mandatory,task_template_detail_json')
          .eq('tenant_id', scope.tenantId)
          .in(columnName, taskTemplateIds);
        if (withFranchiseScope && scope.franchiseId) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${scope.franchiseId}`);
        }
        return query;
      };
      let { data: taskRowsById, error: taskRowsByIdError } = await queryTaskTemplates('id', true);
      if (taskRowsByIdError && isMissingFranchiseColumnError(taskRowsByIdError) && scope.franchiseId) {
        ({ data: taskRowsById, error: taskRowsByIdError } = await queryTaskTemplates('id', false));
      }
      if (taskRowsByIdError) {
        throw new Error(String(taskRowsByIdError.message || 'Failed to load associated task templates'));
      }
      let taskRows = Array.isArray(taskRowsById) ? [...taskRowsById] : [];
      const matchedById = new Set(taskRows.map((row) => String((row as Record<string, unknown>).id || '').trim()));
      const unmatchedIds = taskTemplateIds.filter((id) => !matchedById.has(id));
      if (unmatchedIds.length > 0) {
        let { data: taskRowsByTemplateId, error: taskRowsByTemplateIdError } = await queryTaskTemplates('task_template_id', true);
        if (taskRowsByTemplateIdError && isMissingFranchiseColumnError(taskRowsByTemplateIdError) && scope.franchiseId) {
          ({ data: taskRowsByTemplateId, error: taskRowsByTemplateIdError } = await queryTaskTemplates('task_template_id', false));
        }
        if (!taskRowsByTemplateIdError && Array.isArray(taskRowsByTemplateId)) {
          taskRows = [...taskRows, ...taskRowsByTemplateId];
        }
      }
      const byId = new Map<string, AircraftTemplateAssociatedTaskRow>();
      taskRows.forEach((row) => {
        const record = row as Record<string, unknown>;
        const id = String(record.id || record.task_template_id || '').trim();
        if (!id || byId.has(id)) {
          return;
        }
        byId.set(id, {
          id,
          codeFormNo: String(record.code_form_no || '').trim(),
          ataCode: String(record.ata_code || '').trim(),
          referenceAmp: String(record.reference_amp || '').trim(),
          description: String(record.description || '').trim(),
          categoryCode: String(record.category_code || '').trim(),
          estimatedManHours: String(record.estimated_man_hours || '').trim(),
          isMandatory: Boolean(record.is_mandatory),
          jsonDetails: (() => {
            const detailPayload = record.task_template_detail_json;
            if (typeof detailPayload === 'string') return detailPayload;
            if (detailPayload == null) return '';
            try {
              return JSON.stringify(detailPayload);
            } catch {
              return '';
            }
          })(),
        });
      });
      const orderedRows = taskTemplateIds
        .map((taskTemplateId) => byId.get(taskTemplateId) || null)
        .filter((row): row is AircraftTemplateAssociatedTaskRow => Boolean(row));
      setAircraftTemplateAssociatedTasks(orderedRows);
      setAircraftWorkPackageSelectedTaskIds(orderedRows.map((row) => row.id));
      setAircraftWorkPackageErrors((previous) => ({ ...previous, selectedTaskDescription: '' }));
    } catch (error) {
      setAircraftTemplateAssociatedTasks([]);
      setAircraftTemplateAssociatedTasksError(String((error as Error).message || 'Failed to load associated task templates'));
    } finally {
      setAircraftTemplateAssociatedTasksLoading(false);
    }
  }, [scope.franchiseId, scope.tenantId, scopedDb]);


  useEffect(() => {
    void loadAircraftWorkPackageSnapshot();
  }, [loadAircraftWorkPackageSnapshot]);

  useEffect(() => {
    void loadAircraftLeadDashboard();
  }, [loadAircraftLeadDashboard]);

  useEffect(() => {
    if (entity !== 'aircraft') {
      return;
    }
    const stationHint = String(selectedAircraft?.station_code || '').trim();
    setAircraftWorkPackageValues(getDefaultAircraftWorkPackageValues(stationHint));
    setAircraftWorkPackageErrors({});
  }, [entity, selectedAircraft]);

  useEffect(() => {
    if (entity !== 'aircraft' || !aircraftWorkPackageDialogOpen) {
      return;
    }
    if (workPackageTemplateRegistry.length > 0) {
      return;
    }
    void loadWorkPackageTemplateRegistry();
  }, [aircraftWorkPackageDialogOpen, entity, loadWorkPackageTemplateRegistry, workPackageTemplateRegistry.length]);

  const loadAircraftExistingWorkPackages = useCallback(async () => {
    if (entity !== 'aircraft' || !aircraftWorkPackageDialogOpen || !selectedAircraft?.id) {
      setAircraftExistingWorkPackages([]);
      setAircraftSelectedExistingWorkPackageId('');
      return;
    }
    setAircraftExistingWorkPackagesLoading(true);
    setAircraftExistingWorkPackagesError('');
    try {
      const headers = await buildApiHeaders(scope, {
        fallbackAccessToken: sessionAccessToken,
        requestTag: 'aircraft-work-package-dialog-existing-records',
        requestUrl: '/api/v2/amro/work-packages',
        requestMethod: 'GET',
      });
      const query = new URLSearchParams({
        aircraft_id: String(selectedAircraft.id),
        page: '1',
        page_size: '100',
      });
      const response = await fetch(`/api/v2/amro/work-packages?${query.toString()}`, {
        method: 'GET',
        headers,
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to load existing work packages'));
      }
      const normalizedRows = parseWorkPackageItems(payload)
        .map(normalizeWorkPackageRecordSummary)
        .filter((row): row is AircraftWorkPackageRecordSummary => Boolean(row));
      setAircraftExistingWorkPackages(normalizedRows);
      setAircraftSelectedExistingWorkPackageId((previous) => {
        if (previous && normalizedRows.some((item) => item.id === previous)) {
          return previous;
        }
        return normalizedRows[0]?.id || '';
      });
    } catch (error) {
      setAircraftExistingWorkPackages([]);
      setAircraftSelectedExistingWorkPackageId('');
      setAircraftExistingWorkPackagesError(String((error as Error).message || 'Failed to load existing work packages'));
    } finally {
      setAircraftExistingWorkPackagesLoading(false);
    }
  }, [aircraftWorkPackageDialogOpen, entity, scope, selectedAircraft, sessionAccessToken]);

  useEffect(() => {
    if (!aircraftWorkPackageDialogOpen) {
      return;
    }
    if (!['existing-wp', 'non-performed-tasks', 'all-tasks'].includes(aircraftWorkPackageActiveTab)) {
      return;
    }
    void loadAircraftExistingWorkPackages();
  }, [aircraftWorkPackageActiveTab, aircraftWorkPackageDialogOpen, loadAircraftExistingWorkPackages]);

  useEffect(() => {
    if (!aircraftWorkPackageDialogOpen) {
      return;
    }
    if (aircraftWorkPackageActiveTab !== 'new-wp') {
      return;
    }
    if (workPackageTemplateRegistryLoading) {
      return;
    }
    if (workPackageTemplateRegistryError) {
      return;
    }
    if (workPackageTemplateRegistry.length > 0) {
      return;
    }
    void loadWorkPackageTemplateRegistry();
  }, [
    aircraftWorkPackageActiveTab,
    aircraftWorkPackageDialogOpen,
    loadWorkPackageTemplateRegistry,
    workPackageTemplateRegistryError,
    workPackageTemplateRegistry.length,
    workPackageTemplateRegistryLoading,
  ]);

  const handleAircraftContextNavigation = useCallback(
    (path: string) => {
      const query = new URLSearchParams();
      if (selectedAircraft?.id) {
        query.set('aircraft_id', String(selectedAircraft.id));
      }
      const target = query.toString() ? `${path}?${query.toString()}` : path;
      navigate(target);
    },
    [navigate, selectedAircraft],
  );

  const openAircraftFlightLogsList = useCallback(
    (aircraftId: string) => {
      const normalizedAircraftId = aircraftId.trim();
      if (!normalizedAircraftId) {
        toast.error('Select an aircraft record first');
        return;
      }
      const query = new URLSearchParams(location.search);
      query.set('aircraft_id', normalizedAircraftId);
      query.set('flight_aircraft', normalizedAircraftId);
      query.delete('selected');
      query.set('page', '1');
      navigate(`/dashboard/amro/settings/master-data/${ENTITY_ROUTE_SEGMENT.flight_logs}?${query.toString()}`);
    },
    [location.search, navigate],
  );

  const openAircraftWorkPackageDialog = useCallback(() => {
    if (!canCreateWorkPackage) {
      toast.error('You do not have permission to create work packages');
      return;
    }
    const stationHint = String(selectedAircraft?.station_code || '').trim();
    setAircraftWorkPackageValues(getDefaultAircraftWorkPackageValues(stationHint));
    setAircraftWorkPackageErrors({});
    setAircraftWorkPackageActiveTab('new-wp');
    setAircraftWorkPackageTaskSearch('');
    setAircraftWorkPackageTaskSort('taskNumber');
    setAircraftWorkPackageTaskSortDirection('asc');
    setAircraftWorkPackageTaskPage(1);
    setAircraftWorkPackageSelectedTaskIds([]);
    setAircraftExistingWorkPackages([]);
    setAircraftExistingWorkPackagesError('');
    setAircraftSelectedExistingWorkPackageId('');
    setAircraftTemplateAssociatedTasks([]);
    setAircraftTemplateAssociatedTasksLoading(false);
    setAircraftTemplateAssociatedTasksError('');
    setSelectedWorkPackageTemplateId((previous) => previous || '');
    setAircraftWorkPackageDialogOpen(true);
    trackWorkPackageTemplateAdoption('dialog_opened', {
      hasTemplateRegistry: workPackageTemplateRegistry.length > 0,
      preselectedTemplateId: selectedWorkPackageTemplateId || workPackageTemplateRegistry[0]?.id || '',
    });
  }, [canCreateWorkPackage, selectedAircraft, selectedWorkPackageTemplateId, trackWorkPackageTemplateAdoption, workPackageTemplateRegistry]);

  const setAircraftWorkPackageField = useCallback((key: keyof AircraftWorkPackageFormValues, value: string) => {
    setAircraftWorkPackageValues((previous) => {
      const nextValues = { ...previous, [key]: value };
      const normalizedValue = value.trim();
      let nextError = '';
      if (['workPackageNumber', 'topic', 'openingDate', 'revisionNumber', 'status', 'validationState', 'transmissionDate', 'expectedReceptionDate', 'maintenanceReleaseDate', 'workReceptionDate', 'source'].includes(key)) {
        nextError = normalizedValue ? '' : `${String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())} is required`;
      }
      if (['openingDate', 'revisionDate', 'transmissionDate', 'expectedReceptionDate', 'maintenanceReleaseDate', 'workReceptionDate', 'plannedStart', 'plannedEnd'].includes(key) && normalizedValue) {
        if (Number.isNaN(Date.parse(normalizedValue))) {
          nextError = `${String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())} must be a valid date`;
        }
      }
      if (key === 'ttafHours' && normalizedValue) {
        const numericValue = Number(normalizedValue);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
          nextError = 'TTAF must be a non-negative number';
        }
      }
      if (key === 'scopeItemsText' && normalizedValue) {
        nextError = '';
      }
      setAircraftWorkPackageErrors((previousErrors) => ({ ...previousErrors, [key]: nextError }));
      return nextValues;
    });
  }, []);

  const handleAircraftWorkPackageTemplateSelect = useCallback(
    (templateId: string) => {
      setSelectedWorkPackageTemplateId(templateId);
      setAircraftTemplateAssociatedTasks([]);
      setAircraftTemplateAssociatedTasksError('');
      const template = workPackageTemplateRegistry.find((item) => item.id === templateId);
      if (!template) {
        setAircraftWorkPackageSelectedTaskIds([]);
        return;
      }
      setAircraftWorkPackageValues((previous) => {
        const firstTask = template.taskRows[0];
        return {
          ...previous,
          maintenanceType: template.maintenanceType,
          scopeItemsText: template.scopeItems.length > 0 ? template.scopeItems.join('\n') : previous.scopeItemsText,
          selectedTaskNumber: firstTask?.taskNumber || previous.selectedTaskNumber,
          selectedTaskAtaCode: firstTask?.ataCode || previous.selectedTaskAtaCode,
          selectedTaskSerialNumber: firstTask?.serialNumber || previous.selectedTaskSerialNumber,
          selectedTaskPartNumber: firstTask?.partNumber || previous.selectedTaskPartNumber,
          selectedTaskDescription: firstTask?.description || previous.selectedTaskDescription,
        };
      });
      setAircraftWorkPackageSelectedTaskIds(template.taskRows.length > 0 ? template.taskRows.map((task) => task.id) : []);
      void loadAircraftTemplateAssociatedTasks(template.id);
      setAircraftWorkPackageErrors((previous) => ({ ...previous, selectedTaskDescription: '', scopeItemsText: '' }));
      trackWorkPackageTemplateAdoption('template_selected', {
        templateId: template.id,
        templateCode: template.templateCode,
        taskCount: template.taskRows.length,
      });
    },
    [loadAircraftTemplateAssociatedTasks, trackWorkPackageTemplateAdoption, workPackageTemplateRegistry],
  );

  useEffect(() => {
    if (!aircraftWorkPackageDialogOpen) {
      return;
    }
    if (!selectedWorkPackageTemplateId) {
      return;
    }
    if (aircraftWorkPackageSelectedTaskIds.length > 0) {
      return;
    }
    handleAircraftWorkPackageTemplateSelect(selectedWorkPackageTemplateId);
  }, [
    aircraftWorkPackageDialogOpen,
    aircraftWorkPackageSelectedTaskIds.length,
    handleAircraftWorkPackageTemplateSelect,
    selectedWorkPackageTemplateId,
  ]);

  const handleAircraftWorkPackageSubmit = useCallback(
    async (action: WorkPackageCreateAction) => {
      if (!canCreateWorkPackage) {
        toast.error('You do not have permission to create work packages');
        trackWorkPackageTemplateAdoption('submit_denied_permission', {
          action,
        });
        return;
      }
      if (action === 'create_schedule' && !canScheduleWorkPackage) {
        toast.error('You do not have permission to schedule work packages');
        trackWorkPackageTemplateAdoption('submit_denied_schedule_permission', {
          action,
        });
        return;
      }
      if (!selectedAircraft?.id) {
        toast.error('Select an aircraft record first');
        return;
      }
      const errors: Record<string, string> = {};
      if (!selectedWorkPackageTemplateId.trim()) {
        errors.templateRegistry = 'Select a template before creating a new work package';
      }
      if (!aircraftWorkPackageValues.workPackageNumber.trim()) {
        errors.workPackageNumber = 'Work package number is required';
      }
      if (!aircraftWorkPackageValues.topic.trim()) {
        errors.topic = 'Topic is required';
      }
      if (!aircraftWorkPackageValues.openingDate.trim()) {
        errors.openingDate = 'Opening date is required';
      }
      if (!aircraftWorkPackageValues.revisionNumber.trim()) {
        errors.revisionNumber = 'Revision number is required';
      }
      if (!aircraftWorkPackageValues.ttafHours.trim()) {
        errors.ttafHours = 'TTAF is required';
      }
      if (!aircraftWorkPackageValues.status) {
        errors.status = 'Status is required';
      }
      if (!aircraftWorkPackageValues.validationState) {
        errors.validationState = 'Validation is required';
      }
      if (!aircraftWorkPackageValues.transmissionDate.trim()) {
        errors.transmissionDate = 'Transmission date is required';
      }
      if (!aircraftWorkPackageValues.expectedReceptionDate.trim()) {
        errors.expectedReceptionDate = 'Expected reception date is required';
      }
      if (!aircraftWorkPackageValues.maintenanceReleaseDate.trim()) {
        errors.maintenanceReleaseDate = 'Maintenance release date is required';
      }
      if (!aircraftWorkPackageValues.workReceptionDate.trim()) {
        errors.workReceptionDate = 'Work reception date is required';
      }
      if (!['schedule_due', 'defect', 'campaign', 'predictive_alert'].includes(aircraftWorkPackageValues.source)) {
        errors.source = 'Trigger source is required';
      }
      const scopeItems = aircraftWorkPackageValues.scopeItemsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      const templateScopeItems = selectedWorkPackageTemplate?.scopeItems || [];
      if (scopeItems.length === 0 && templateScopeItems.length > 0) {
        scopeItems.push(...templateScopeItems);
      }
      if (scopeItems.length === 0 && aircraftWorkPackageValues.selectedTaskDescription.trim()) {
        scopeItems.push(aircraftWorkPackageValues.selectedTaskDescription.trim());
      }
      if (scopeItems.length === 0 && aircraftWorkPackageValues.comments.trim()) {
        scopeItems.push(aircraftWorkPackageValues.comments.trim());
      }
      if (scopeItems.length === 0) {
        errors.scopeItemsText = 'Add at least one scope item';
      }
      const openingDateTime = Date.parse(aircraftWorkPackageValues.openingDate);
      if (Number.isNaN(openingDateTime)) {
        errors.openingDate = 'Opening date must be a valid date';
      }
      const revisionDateTime = Date.parse(aircraftWorkPackageValues.revisionDate);
      if (aircraftWorkPackageValues.revisionDate.trim() && Number.isNaN(revisionDateTime)) {
        errors.revisionDate = 'Revision date must be a valid date';
      }
      const ttafValue = Number(aircraftWorkPackageValues.ttafHours);
      if (!Number.isFinite(ttafValue) || ttafValue < 0) {
        errors.ttafHours = 'TTAF must be a non-negative number';
      }
      const transmissionDateTime = Date.parse(aircraftWorkPackageValues.transmissionDate);
      if (Number.isNaN(transmissionDateTime)) {
        errors.transmissionDate = 'Transmission date must be a valid date';
      }
      const maintenanceReleaseDateTime = Date.parse(aircraftWorkPackageValues.maintenanceReleaseDate);
      if (Number.isNaN(maintenanceReleaseDateTime)) {
        errors.maintenanceReleaseDate = 'Maintenance release date must be a valid date';
      }
      const expectedReceptionDateTime = Date.parse(aircraftWorkPackageValues.expectedReceptionDate);
      if (Number.isNaN(expectedReceptionDateTime)) {
        errors.expectedReceptionDate = 'Expected reception date must be a valid date';
      }
      const workReceptionDateTime = Date.parse(aircraftWorkPackageValues.workReceptionDate);
      if (Number.isNaN(workReceptionDateTime)) {
        errors.workReceptionDate = 'Work reception date must be a valid date';
      }
      if (aircraftWorkPackageSelectedTaskIds.length === 0) {
        errors.selectedTaskDescription = 'Select at least one task';
      }
      setAircraftWorkPackageErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast.error('Please resolve aircraft work package validation errors');
        trackWorkPackageTemplateAdoption('submit_validation_failed', {
          action,
          errorCount: Object.keys(errors).length,
          usesTemplate: Boolean(selectedWorkPackageTemplate?.id),
        });
        return;
      }

      const workPackagePayload = {
        aircraft_id: String(selectedAircraft.id),
        work_order_number: aircraftWorkPackageValues.workPackageNumber.trim(),
        title: aircraftWorkPackageValues.topic.trim(),
        opening_date: new Date(aircraftWorkPackageValues.openingDate).toISOString(),
        revision_number: aircraftWorkPackageValues.revisionNumber.trim(),
        revision_date: aircraftWorkPackageValues.revisionDate.trim()
          ? new Date(aircraftWorkPackageValues.revisionDate).toISOString()
          : null,
        transmission_date: new Date(aircraftWorkPackageValues.transmissionDate).toISOString(),
        expected_reception_date: new Date(aircraftWorkPackageValues.expectedReceptionDate).toISOString(),
        maintenance_release_date: new Date(aircraftWorkPackageValues.maintenanceReleaseDate).toISOString(),
        work_reception_date: new Date(aircraftWorkPackageValues.workReceptionDate).toISOString(),
        work_report_number: aircraftWorkPackageValues.workReportNumber.trim(),
        comments: aircraftWorkPackageValues.comments.trim(),
        ttaf_hours: Number(aircraftWorkPackageValues.ttafHours),
        validation_state: aircraftWorkPackageValues.validationState,
        selected_task: {
          task_number: aircraftWorkPackageValues.selectedTaskNumber.trim(),
          ata_code: aircraftWorkPackageValues.selectedTaskAtaCode.trim(),
          serial_number: aircraftWorkPackageValues.selectedTaskSerialNumber.trim(),
          part_number: aircraftWorkPackageValues.selectedTaskPartNumber.trim(),
          description: aircraftWorkPackageValues.selectedTaskDescription.trim() || scopeItems[0] || '',
        },
        source: aircraftWorkPackageValues.source,
        trigger_source: aircraftWorkPackageValues.source,
        maintenance_type: aircraftWorkPackageValues.maintenanceType,
        station: aircraftWorkPackageValues.station.trim(),
        priority: aircraftWorkPackageValues.priority,
        status: aircraftWorkPackageValues.status,
        planned_window: `${new Date(aircraftWorkPackageValues.plannedStart).toISOString()}|${new Date(aircraftWorkPackageValues.plannedEnd).toISOString()}`,
        scope_items: scopeItems,
        selected_task_ids: aircraftWorkPackageSelectedTaskIds,
        template_id: selectedWorkPackageTemplate?.id || undefined,
        template_code: selectedWorkPackageTemplate?.templateCode || undefined,
        reference_id: String(selectedAircraft.id),
        trigger_reference_id: String(selectedAircraft.id),
        triggered_at: new Date().toISOString(),
      };

      if (action === 'save_draft') {
        localStorage.setItem(`amro:aircraft-wp-draft:${selectedAircraft.id}`, JSON.stringify(workPackagePayload));
        toast.success('Aircraft work package draft saved');
        trackWorkPackageTemplateAdoption('draft_saved', {
          usesTemplate: Boolean(selectedWorkPackageTemplate?.id),
          selectedTaskCount: aircraftWorkPackageSelectedTaskIds.length,
        });
        setAircraftWorkPackageDialogOpen(false);
        return;
      }

      setAircraftWorkPackageSubmitting(true);
      const now = Date.now();
      const transactionId = `aircraft-wp-tx-${selectedAircraft.id}-${now}`;
      const requestIdempotencyKey = `aircraft-wp-create-${now}`;
      let committedWorkPackageId = '';
      try {
        const headers = await buildApiHeaders(scope, {
          fallbackAccessToken: sessionAccessToken,
          requestTag: 'aircraft-work-package-create',
          requestUrl: '/api/v2/amro/work-packages?interface=create-work-package',
          requestMethod: 'POST',
        });
        const controller = new AbortController();
        const timeoutHandle = window.setTimeout(() => controller.abort(), WORK_PACKAGE_CREATE_TIMEOUT_MS);
        const response = await fetch('/api/v2/amro/work-packages?interface=create-work-package', {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            ...workPackagePayload,
            idempotency_key: requestIdempotencyKey,
            decision_trace_id: `aircraft-wp-${selectedAircraft.id}-${now}`,
            transaction_id: transactionId,
            scope_context: {
              domain_id: 'amro',
            },
            audit_trail: {
              action: action === 'create_schedule' ? 'create_and_schedule' : 'create',
              actor_scope: scope.userId || '',
              trigger_tab: aircraftWorkPackageActiveTab,
              created_at: new Date(now).toISOString(),
            },
            version_info: {
              revision_number: aircraftWorkPackageValues.revisionNumber.trim(),
              revision_date: aircraftWorkPackageValues.revisionDate.trim()
                ? new Date(aircraftWorkPackageValues.revisionDate).toISOString()
                : null,
            },
          }),
        });
        window.clearTimeout(timeoutHandle);
        const payload = await parseApiPayload(response);
        const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
        committedWorkPackageId = String(output.work_package_id || output.id || '');
        if (!response.ok) {
          const statusMessage = response.status >= 500
            ? 'Work package service is temporarily unavailable. Try again shortly.'
            : String(payload.error || `Failed to create work package from aircraft (${response.status})`);
          throw new Error(statusMessage);
        }
        toast.success('Aircraft work package created');
        trackWorkPackageTemplateAdoption('submit_succeeded', {
          action,
          usesTemplate: Boolean(selectedWorkPackageTemplate?.id),
          templateId: selectedWorkPackageTemplate?.id || '',
          selectedTaskCount: aircraftWorkPackageSelectedTaskIds.length,
          workPackageId: committedWorkPackageId,
        });
        setAircraftWorkPackageDialogOpen(false);
        await loadAircraftWorkPackageSnapshot();
        void loadAircraftExistingWorkPackages();
        if (action === 'create_schedule') {
          const query = new URLSearchParams();
          query.set('aircraft_id', String(selectedAircraft.id));
          if (committedWorkPackageId) query.set('work_package_id', committedWorkPackageId);
          navigate(`/dashboard/amro/scheduling?${query.toString()}`);
          return;
        }
        if (action === 'create_open') {
          const query = new URLSearchParams();
          query.set('aircraft_id', String(selectedAircraft.id));
          if (committedWorkPackageId) query.set('focus', committedWorkPackageId);
          navigate(`/dashboard/amro/aircraft/work-packages?${query.toString()}`);
        }
      } catch (error) {
        if (committedWorkPackageId) {
          try {
            const rollbackHeaders = await buildApiHeaders(scope, {
              fallbackAccessToken: sessionAccessToken,
              requestTag: 'aircraft-work-package-rollback',
              requestUrl: `/api/v2/amro/work-packages/${committedWorkPackageId}`,
              requestMethod: 'DELETE',
            });
            await fetch(`/api/v2/amro/work-packages/${committedWorkPackageId}?rollback=1`, {
              method: 'DELETE',
              headers: rollbackHeaders,
              body: JSON.stringify({
                transaction_id: transactionId,
                rollback_reason: String((error as Error).message || 'Create work package failed'),
              }),
            });
          } catch (rollbackError) {
            trackWorkPackageTemplateAdoption('rollback_failed', {
              action,
              workPackageId: committedWorkPackageId,
              errorMessage: String((rollbackError as Error).message || rollbackError),
            });
          }
        }
        localStorage.setItem(
          `amro:aircraft-wp-draft:${selectedAircraft.id}`,
          JSON.stringify(workPackagePayload),
        );
        toast.error(resolveWorkPackageApiErrorMessage(error, 'Work package service degraded. Draft captured locally.'));
        trackWorkPackageTemplateAdoption('submit_failed', {
          action,
          usesTemplate: Boolean(selectedWorkPackageTemplate?.id),
          templateId: selectedWorkPackageTemplate?.id || '',
          selectedTaskCount: aircraftWorkPackageSelectedTaskIds.length,
          errorMessage: String((error as Error).message || error),
        });
      } finally {
        setAircraftWorkPackageSubmitting(false);
      }
    },
    [aircraftWorkPackageActiveTab, aircraftWorkPackageSelectedTaskIds, aircraftWorkPackageValues, canCreateWorkPackage, canScheduleWorkPackage, loadAircraftExistingWorkPackages, loadAircraftWorkPackageSnapshot, navigate, scope, selectedAircraft, selectedWorkPackageTemplate, sessionAccessToken, trackWorkPackageTemplateAdoption],
  );

  const aircraftWorkPackageSelectedTasks = useMemo(() => {
    const templateRows = aircraftTemplateAssociatedTasks.length > 0
      ? aircraftTemplateAssociatedTasks.map((task) => ({
          id: task.id,
          taskNumber: task.codeFormNo || task.id,
          ataCode: task.ataCode,
          serialNumber: '',
          partNumber: '',
          description: task.description,
        }))
      : (selectedWorkPackageTemplate?.taskRows || []);
    const scopeRows = aircraftWorkPackageValues.scopeItemsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((description, index) => ({
        id: `scope-${index + 1}`,
        taskNumber: aircraftWorkPackageValues.selectedTaskNumber || `TASK-${index + 1}`,
        ataCode: aircraftWorkPackageValues.selectedTaskAtaCode || '05-20-TIME LIMITS/MAINTENANCE CHECKS',
        serialNumber: aircraftWorkPackageValues.selectedTaskSerialNumber || '',
        partNumber: aircraftWorkPackageValues.selectedTaskPartNumber || '',
        description,
      }));

    const selectedRowDescription = aircraftWorkPackageValues.selectedTaskDescription.trim();
    const merged = [...templateRows];
    const seenKeys = new Set(
      merged.map((item) => `${item.taskNumber}|${item.ataCode}|${item.serialNumber}|${item.partNumber}|${item.description}`.toLowerCase()),
    );
    if (selectedRowDescription) {
      const selectedTaskRow = {
        id: 'selected-task',
        taskNumber: aircraftWorkPackageValues.selectedTaskNumber || 'Choose One',
        ataCode: aircraftWorkPackageValues.selectedTaskAtaCode || '05-20-TIME LIMITS/MAINTENANCE CHECKS',
        serialNumber: aircraftWorkPackageValues.selectedTaskSerialNumber || '',
        partNumber: aircraftWorkPackageValues.selectedTaskPartNumber || '',
        description: selectedRowDescription,
      };
      const key = `${selectedTaskRow.taskNumber}|${selectedTaskRow.ataCode}|${selectedTaskRow.serialNumber}|${selectedTaskRow.partNumber}|${selectedTaskRow.description}`.toLowerCase();
      if (!seenKeys.has(key)) {
        merged.push(selectedTaskRow);
        seenKeys.add(key);
      }
    }
    scopeRows.forEach((row) => {
      const key = `${row.taskNumber}|${row.ataCode}|${row.serialNumber}|${row.partNumber}|${row.description}`.toLowerCase();
      if (!seenKeys.has(key)) {
        merged.push(row);
        seenKeys.add(key);
      }
    });
    return merged;
  }, [aircraftTemplateAssociatedTasks, aircraftWorkPackageValues, selectedWorkPackageTemplate]);

  const aircraftWorkPackageFilteredTasks = useMemo(() => {
    const normalizedSearch = aircraftWorkPackageTaskSearch.trim().toLowerCase();
    const next = normalizedSearch
      ? aircraftWorkPackageSelectedTasks.filter((task) =>
          [task.taskNumber, task.ataCode, task.serialNumber, task.partNumber, task.description]
            .some((value) => value.toLowerCase().includes(normalizedSearch)),
        )
      : aircraftWorkPackageSelectedTasks;
    const sorted = [...next].sort((left, right) => {
      const leftValue = String(left[aircraftWorkPackageTaskSort] || '').toLowerCase();
      const rightValue = String(right[aircraftWorkPackageTaskSort] || '').toLowerCase();
      if (leftValue === rightValue) {
        return left.id.localeCompare(right.id);
      }
      return aircraftWorkPackageTaskSortDirection === 'asc'
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });
    return sorted;
  }, [
    aircraftWorkPackageSelectedTasks,
    aircraftWorkPackageTaskSearch,
    aircraftWorkPackageTaskSort,
    aircraftWorkPackageTaskSortDirection,
  ]);

  const aircraftWorkPackageTaskPageSize = 5;
  const aircraftWorkPackageTaskTotalPages = Math.max(1, Math.ceil(aircraftWorkPackageFilteredTasks.length / aircraftWorkPackageTaskPageSize));
  useEffect(() => {
    setAircraftWorkPackageTaskPage((previous) => Math.min(previous, aircraftWorkPackageTaskTotalPages));
  }, [aircraftWorkPackageTaskTotalPages]);
  const aircraftWorkPackagePagedTasks = useMemo(() => {
    const normalizedPage = Math.min(Math.max(aircraftWorkPackageTaskPage, 1), aircraftWorkPackageTaskTotalPages);
    const start = (normalizedPage - 1) * aircraftWorkPackageTaskPageSize;
    return aircraftWorkPackageFilteredTasks.slice(start, start + aircraftWorkPackageTaskPageSize);
  }, [aircraftWorkPackageFilteredTasks, aircraftWorkPackageTaskPage, aircraftWorkPackageTaskTotalPages]);

  const aircraftExistingWorkPackageSelectedRecord = useMemo(
    () => aircraftExistingWorkPackages.find((item) => item.id === aircraftSelectedExistingWorkPackageId) || null,
    [aircraftExistingWorkPackages, aircraftSelectedExistingWorkPackageId],
  );

  const aircraftExistingWorkPackageList = useMemo(() => {
    return [...aircraftExistingWorkPackages].sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || '') || 0;
      const rightTime = Date.parse(right.updatedAt || '') || 0;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.workPackageNumber.localeCompare(right.workPackageNumber);
    });
  }, [aircraftExistingWorkPackages]);

  const aircraftNonPerformedTasks = useMemo(() => {
    const source = aircraftExistingWorkPackageSelectedRecord
      ? aircraftExistingWorkPackageSelectedRecord.tasks
      : aircraftExistingWorkPackages.flatMap((item) => item.tasks);
    return source.filter((item) => isTaskNonPerformedStatus(item.status));
  }, [aircraftExistingWorkPackageSelectedRecord, aircraftExistingWorkPackages]);

  const aircraftAllWorkPackageTasks = useMemo(() => {
    const merged = new Map<string, AircraftWorkPackageTaskListItem>();
    const templateRows = aircraftTemplateAssociatedTasks.length > 0
      ? aircraftTemplateAssociatedTasks.map((task) => ({
          id: task.id,
          taskNumber: task.codeFormNo || task.id,
          ataCode: task.ataCode,
          serialNumber: '',
          partNumber: '',
          description: task.description,
        }))
      : (selectedWorkPackageTemplate?.taskRows || []);
    templateRows.forEach((item, index) => {
      const id = item.id || `template-${index + 1}`;
      merged.set(id, {
        id,
        taskNumber: item.taskNumber,
        ataCode: item.ataCode,
        serialNumber: item.serialNumber,
        partNumber: item.partNumber,
        description: item.description,
        status: 'pending',
        selectable: true,
        source: 'template',
      });
    });
    aircraftExistingWorkPackages.forEach((workPackage) => {
      workPackage.tasks.forEach((task) => {
        const key = `${task.taskNumber}|${task.ataCode}|${task.serialNumber}|${task.partNumber}|${task.description}|${workPackage.id}`.toLowerCase();
        if (!merged.has(key)) {
          merged.set(key, task);
        }
      });
    });
    aircraftWorkPackageSelectedTasks.forEach((item) => {
      const id = `selected-${item.id}`;
      if (!merged.has(id)) {
        merged.set(id, {
          id,
          taskNumber: item.taskNumber,
          ataCode: item.ataCode,
          serialNumber: item.serialNumber,
          partNumber: item.partNumber,
          description: item.description,
          status: 'pending',
          selectable: true,
          source: 'selected',
        });
      }
    });
    return Array.from(merged.values());
  }, [aircraftExistingWorkPackages, aircraftTemplateAssociatedTasks, aircraftWorkPackageSelectedTasks, selectedWorkPackageTemplate]);

  const aircraftTaskGridRows = useMemo<AircraftWorkPackageTaskListItem[]>(() => {
    if (aircraftWorkPackageActiveTab === 'non-performed-tasks') {
      return aircraftNonPerformedTasks;
    }
    if (aircraftWorkPackageActiveTab === 'all-tasks') {
      return aircraftAllWorkPackageTasks;
    }
    return aircraftWorkPackagePagedTasks.map((item) => ({
      id: item.id,
      taskNumber: item.taskNumber,
      ataCode: item.ataCode,
      serialNumber: item.serialNumber,
      partNumber: item.partNumber,
      description: item.description,
      status: 'pending',
      selectable: true,
      source: 'selected' as const,
      parentWorkPackageNumber: undefined,
    }));
  }, [
    aircraftAllWorkPackageTasks,
    aircraftNonPerformedTasks,
    aircraftWorkPackageActiveTab,
    aircraftWorkPackagePagedTasks,
  ]);

  const aircraftTaskGridFilteredRows = useMemo(() => {
    const normalizedSearch = aircraftWorkPackageTaskSearch.trim().toLowerCase();
    const rows = normalizedSearch
      ? aircraftTaskGridRows.filter((item) =>
          [item.taskNumber, item.ataCode, item.serialNumber, item.partNumber, item.description, item.status]
            .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
        )
      : aircraftTaskGridRows;
    return [...rows].sort((left, right) => {
      const leftValue = String(left[aircraftWorkPackageTaskSort] || '').toLowerCase();
      const rightValue = String(right[aircraftWorkPackageTaskSort] || '').toLowerCase();
      if (leftValue === rightValue) {
        return left.id.localeCompare(right.id);
      }
      return aircraftWorkPackageTaskSortDirection === 'asc'
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });
  }, [aircraftTaskGridRows, aircraftWorkPackageTaskSearch, aircraftWorkPackageTaskSort, aircraftWorkPackageTaskSortDirection]);

  const handleAircraftWorkPackageTaskSelection = useCallback((task: AircraftWorkPackageTaskListItem, checked: boolean) => {
    if (!task.selectable) {
      return;
    }
    setAircraftWorkPackageSelectedTaskIds((previous) => {
      if (checked) {
        return Array.from(new Set([...previous, task.id]));
      }
      return previous.filter((id) => id !== task.id);
    });
    if (checked) {
      setAircraftWorkPackageValues((previous) => ({
        ...previous,
        selectedTaskNumber: task.taskNumber || previous.selectedTaskNumber,
        selectedTaskAtaCode: task.ataCode || previous.selectedTaskAtaCode,
        selectedTaskSerialNumber: task.serialNumber || previous.selectedTaskSerialNumber,
        selectedTaskPartNumber: task.partNumber || previous.selectedTaskPartNumber,
        selectedTaskDescription: task.description || previous.selectedTaskDescription,
      }));
    }
    setAircraftWorkPackageErrors((previous) => ({ ...previous, selectedTaskDescription: '' }));
  }, []);

  const handleApplyExistingWorkPackageSelection = useCallback(() => {
    const selectedRecord = aircraftExistingWorkPackages.find((item) => item.id === aircraftSelectedExistingWorkPackageId);
    if (!selectedRecord) {
      toast.error('Select an existing work package first');
      return;
    }
    setAircraftWorkPackageValues((previous) => {
      const normalizedStatus = String(selectedRecord.status || '').toLowerCase();
      const nextStatus = (
        ['', 'planning', 'scheduled', 'in_progress', 'blocked'].includes(normalizedStatus)
          ? normalizedStatus
          : previous.status
      ) as AircraftWorkPackageFormValues['status'];
      const normalizedPriority = String(selectedRecord.priority || '').toLowerCase();
      const nextPriority = (
        ['low', 'medium', 'high', 'critical'].includes(normalizedPriority)
          ? normalizedPriority
          : previous.priority
      ) as AircraftWorkPackageFormValues['priority'];
      return {
        ...previous,
        workPackageNumber: selectedRecord.workPackageNumber || previous.workPackageNumber,
        topic: selectedRecord.title || previous.topic,
        maintenanceType: (selectedRecord.maintenanceType || previous.maintenanceType) as AircraftWorkPackageFormValues['maintenanceType'],
        station: selectedRecord.station || previous.station,
        status: nextStatus,
        priority: nextPriority,
        selectedTaskNumber: selectedRecord.tasks[0]?.taskNumber || previous.selectedTaskNumber,
        selectedTaskAtaCode: selectedRecord.tasks[0]?.ataCode || previous.selectedTaskAtaCode,
        selectedTaskSerialNumber: selectedRecord.tasks[0]?.serialNumber || previous.selectedTaskSerialNumber,
        selectedTaskPartNumber: selectedRecord.tasks[0]?.partNumber || previous.selectedTaskPartNumber,
        selectedTaskDescription: selectedRecord.tasks[0]?.description || previous.selectedTaskDescription,
        scopeItemsText: selectedRecord.tasks.map((task) => task.description).filter(Boolean).join('\n') || previous.scopeItemsText,
      };
    });
    setAircraftWorkPackageSelectedTaskIds(selectedRecord.tasks.map((task) => task.id));
    setAircraftWorkPackageErrors((previous) => ({ ...previous, selectedTaskDescription: '', scopeItemsText: '' }));
    setAircraftWorkPackageActiveTab('selected-task');
    toast.success('Existing work package loaded');
  }, [aircraftExistingWorkPackages, aircraftSelectedExistingWorkPackageId]);

  useEffect(() => {
    setAircraftWorkPackageTaskPage(1);
  }, [aircraftWorkPackageActiveTab]);

  const openFlightLogDialog = useCallback((rowId: string) => {
    const aircraftId = rowId.trim();
    if (!aircraftId) {
      toast.error('Select an aircraft record first');
      return;
    }
    setFlightLogMode('add');
    setFlightLogInitialValues(getDefaultFlightLogFormValues({ aircraftId }));
    setFlightLogSubmitting(false);
    setFlightLogDialogInstance((previous) => previous + 1);
    setFlightLogDialogOpen(true);
  }, []);

  const handleFlightLogSubmit = useCallback(async ({ mode, payload, values }: FlightLogFormSubmitInput) => {
    const errors = validateFlightLogFormValues(values);
    if (Object.keys(errors).length > 0) {
      toast.error('Please resolve flight log validation errors');
      throw new Error('Please resolve flight log validation errors');
    }
    setFlightLogSubmitting(true);
    try {
      const headers = await buildApiHeaders(scope);
      const normalizedPayload = buildFlightLogPayload(values, payload.metadata.source);
      const endpoints = mode === 'add'
        ? ['/api/v2/amro/flight-logs', '/api/v2/amro/master-data/flight_logs']
        : ['/api/v2/amro/master-data/flight_logs'];
      let saved = false;
      let lastErrorMessage = 'Failed to save flight log';
      for (let index = 0; index < endpoints.length; index += 1) {
        const endpoint = endpoints[index];
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(normalizedPayload),
        });
        const parsedPayload = await parseApiPayload(response);
        if (response.ok) {
          saved = true;
          break;
        }
        const apiMessage = String(parsedPayload.error || 'Failed to save flight log');
        if (response.status === 404 && index < endpoints.length - 1) {
          logger.warn('Primary flight log endpoint unavailable, retrying fallback endpoint', {
            component: 'AmroSettingsMasterDataPage',
            endpoint,
            fallbackEndpoint: endpoints[index + 1],
            aircraftId: String(normalizedPayload.aircraft_id || ''),
          });
          continue;
        }
        if (response.status === 404) {
          lastErrorMessage = `Aircraft ${String(normalizedPayload.aircraft_id || '').trim() || 'record'} was not found or is outside your access scope`;
          throw new Error(lastErrorMessage);
        }
        lastErrorMessage = apiMessage;
        throw new Error(apiMessage);
      }
      if (!saved) {
        throw new Error(lastErrorMessage);
      }
      toast.success(mode === 'add' ? 'Flight log recorded' : 'Flight Logs record created');
      setFlightLogDialogOpen(false);
      await loadRecords();
      if (mode === 'add') {
        await loadAircraftWorkPackageSnapshot();
      }
    } catch (error) {
      logger.error('Flight log save failed', {
        component: 'AmroSettingsMasterDataPage',
        mode,
        aircraftId: String(values.aircraftId || ''),
        error: error as Error,
      });
      toast.error(String((error as Error).message || 'Failed to save flight log'));
    } finally {
      setFlightLogSubmitting(false);
    }
  }, [loadAircraftWorkPackageSnapshot, loadRecords, scope]);

  const aircraftDashboardKpis = useMemo<AircraftDashboardKpis>(() => {
    const source = aircraftDashboard?.kpis || {};
    return {
      fleet_size: Number(source.fleet_size || 0),
      open_work_packages: Number(source.open_work_packages || 0),
      due_within_window: Number(source.due_within_window || 0),
      overdue_work_packages: Number(source.overdue_work_packages || 0),
      open_defects: Number(source.open_defects || 0),
      total_flight_hours: Number(source.total_flight_hours || 0),
      total_cycles: Number(source.total_cycles || 0),
      compliance_ready_pct: Number(source.compliance_ready_pct || 0),
    };
  }, [aircraftDashboard]);
  const aircraftDashboardFlightHoursTrend = useMemo(
    () => (Array.isArray(aircraftDashboard?.performance_metrics?.flight_hours_trend) ? aircraftDashboard?.performance_metrics?.flight_hours_trend : []),
    [aircraftDashboard],
  );
  const aircraftDashboardDefectTrend = useMemo(
    () => (Array.isArray(aircraftDashboard?.performance_metrics?.defect_trend) ? aircraftDashboard?.performance_metrics?.defect_trend : []),
    [aircraftDashboard],
  );
  const aircraftDashboardDefectRows = useMemo(
    () => (Array.isArray(aircraftDashboard?.defect_tracking) ? aircraftDashboard.defect_tracking.slice(0, 5) : []),
    [aircraftDashboard],
  );
  const aircraftDashboardMaintenanceRows = useMemo(
    () => (Array.isArray(aircraftDashboard?.maintenance_schedule) ? aircraftDashboard.maintenance_schedule.slice(0, 6) : []),
    [aircraftDashboard],
  );
  const aircraftDashboardAlerts = useMemo<AircraftDashboardAlert[]>(
    () => (Array.isArray(aircraftDashboard?.alerts) ? aircraftDashboard.alerts : []),
    [aircraftDashboard],
  );
  const aircraftDashboardEngineModule = useMemo<AircraftDashboardEngineModule | null>(() => {
    if (!aircraftDashboard?.engine_module || typeof aircraftDashboard.engine_module !== 'object') {
      return null;
    }
    return aircraftDashboard.engine_module;
  }, [aircraftDashboard]);
  const aircraftDashboardComponentsModule = useMemo<AircraftDashboardComponentsModule | null>(() => {
    if (!aircraftDashboard?.components_module || typeof aircraftDashboard.components_module !== 'object') {
      return null;
    }
    return aircraftDashboard.components_module;
  }, [aircraftDashboard]);
  const aircraftEngineTrend = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.trend) ? aircraftDashboardEngineModule.trend : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftComponentsTrend = useMemo(
    () => (Array.isArray(aircraftDashboardComponentsModule?.trend) ? aircraftDashboardComponentsModule.trend : []),
    [aircraftDashboardComponentsModule],
  );
  const aircraftComponentLifecycleRows = useMemo(
    () => (Array.isArray(aircraftDashboardComponentsModule?.lifecycle_tracking) ? aircraftDashboardComponentsModule.lifecycle_tracking.slice(0, 6) : []),
    [aircraftDashboardComponentsModule],
  );
  const aircraftComponentReplacementRows = useMemo(
    () => (Array.isArray(aircraftDashboardComponentsModule?.replacement_history) ? aircraftDashboardComponentsModule.replacement_history.slice(0, 6) : []),
    [aircraftDashboardComponentsModule],
  );
  const aircraftEngineDefectDrivers = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.drilldown?.defect_drivers) ? aircraftDashboardEngineModule.drilldown.defect_drivers.slice(0, 6) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineLifecycleRows = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.lifecycle_management) ? aircraftDashboardEngineModule.lifecycle_management.slice(0, 6) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineSerializedTrackingRows = useMemo(
    () =>
      Array.isArray(aircraftDashboardEngineModule?.serialized_engine_tracking)
        ? aircraftDashboardEngineModule.serialized_engine_tracking.slice(0, 8)
        : [],
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineThrustRatingRows = useMemo(
    () =>
      Array.isArray(aircraftDashboardEngineModule?.thrust_rating_management)
        ? aircraftDashboardEngineModule.thrust_rating_management.slice(0, 8)
        : [],
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineOnWingLifecycleRows = useMemo(
    () =>
      Array.isArray(aircraftDashboardEngineModule?.on_wing_lifecycle)
        ? aircraftDashboardEngineModule.on_wing_lifecycle.slice(0, 10)
        : [],
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineMaintenanceRows = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.maintenance_schedule) ? aircraftDashboardEngineModule.maintenance_schedule.slice(0, 8) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineWorkOrderTotals = useMemo(() => {
    const totals = aircraftDashboardEngineModule?.work_orders?.totals || {};
    return {
      open: Number(totals.open || 0),
      in_progress: Number(totals.in_progress || 0),
      blocked: Number(totals.blocked || 0),
      completed: Number(totals.completed || 0),
    };
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineRecentWorkOrders = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.work_orders?.recent) ? aircraftDashboardEngineModule.work_orders.recent.slice(0, 6) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineComplianceSummary = useMemo(() => {
    const source = aircraftDashboardEngineModule?.compliance_tracking || {};
    return {
      readyCount: Number(source.ready_count || 0),
      pendingCount: Number(source.pending_count || 0),
      overdueCount: Number(source.overdue_count || 0),
      compliancePct: Number(source.compliance_pct || 0),
    };
  }, [aircraftDashboardEngineModule]);
  const aircraftEnginePerformanceSummary = useMemo(() => {
    const source = aircraftDashboardEngineModule?.performance_analytics || {};
    return {
      utilizationPct: Number(source.utilization_pct || 0),
      anomalyIndex: Number(source.anomaly_index || 0),
      forecastRisk: String(source.forecast_risk || 'stable'),
      trendSummary: Array.isArray(source.trend_summary) ? source.trend_summary.slice(0, 6) : [],
    };
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineIntegrationRows = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.integration_capabilities) ? aircraftDashboardEngineModule.integration_capabilities.slice(0, 6) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineRealtimeStatuses = useMemo(() => {
    const source = aircraftDashboardEngineModule?.component_monitoring?.statuses || {};
    return Object.entries(source).slice(0, 6);
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineConfigurationRows = useMemo(() => {
    const cfg = (aircraftDashboardEngineModule
      ? ((aircraftDashboardEngineModule as unknown as Record<string, unknown>).configuration_management as { entries?: unknown[] } | undefined)
      : undefined)?.entries || [];
    return Array.isArray(cfg) ? (cfg as Array<Record<string, unknown>>).slice(0, 6) : [];
  }, [aircraftDashboardEngineModule]);
  const aircraftEnginePerformanceSeries = useMemo(
    () =>
      aircraftEnginePerformanceHistory.length > 0
        ? aircraftEnginePerformanceHistory.map((point) => ({
            ts: point.ts,
            value: Number(point.value || 0),
          }))
        : aircraftEngineTrend
            .map((row) => ({
              ts: String(row.day || ''),
              value: Number(row.vibration_ips || row.oil_consumption_lph || 0),
            }))
            .filter((point) => point.ts),
    [aircraftEnginePerformanceHistory, aircraftEngineTrend],
  );
  const aircraftEnginePerformanceMiniChartRows = useMemo(() => {
    if (aircraftEnginePerformanceSeries.length === 0) return [];
    const maxValue = aircraftEnginePerformanceSeries.reduce((max, row) => Math.max(max, row.value), 0) || 1;
    return aircraftEnginePerformanceSeries.slice(-8).map((row) => {
      const barSize = Math.max(1, Math.round((row.value / maxValue) * 12));
      return `${String(row.ts).slice(5, 10)} | ${'#'.repeat(barSize)} ${row.value.toFixed(2)}`;
    });
  }, [aircraftEnginePerformanceSeries]);
  const engineUsabilitySessionIdRef = useRef<string>('');
  const engineUsabilityTaskStartRef = useRef<Partial<Record<EngineUsabilityTaskId, number>>>({});
  const pushEngineUsabilityMarker = useCallback(
    (
      eventType: 'task_start' | 'task_end',
      taskId: EngineUsabilityTaskId,
      payload?: {
        outcome?: 'completed' | 'failed' | 'abandoned';
        durationMs?: number;
        metadata?: Record<string, unknown>;
      },
    ) => {
      if (typeof window === 'undefined') return;
      if (!engineUsabilitySessionIdRef.current) {
        engineUsabilitySessionIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `engine-usability-${Date.now()}`;
      }

      const marker = {
        session_id: engineUsabilitySessionIdRef.current,
        event_type: eventType,
        task_id: taskId,
        timestamp: new Date().toISOString(),
        outcome: payload?.outcome,
        duration_ms: payload?.durationMs,
        metadata: payload?.metadata || {},
      };

      logger.info('AMRO Engine usability task marker', {
        component: 'AmroSettingsMasterDataPage',
        marker,
      });

      try {
        const existingRaw = window.localStorage.getItem(ENGINE_USABILITY_STORAGE_KEY);
        const existing = existingRaw ? (JSON.parse(existingRaw) as Array<Record<string, unknown>>) : [];
        const next = [...existing.slice(-299), marker];
        window.localStorage.setItem(ENGINE_USABILITY_STORAGE_KEY, JSON.stringify(next));
      } catch (storageError) {
        logger.warn('Unable to persist engine usability marker', {
          component: 'AmroSettingsMasterDataPage',
          message: String((storageError as Error).message || storageError),
        });
      }

      window.dispatchEvent(new CustomEvent('amro:engine-usability-marker', { detail: marker }));
    },
    [],
  );
  const startEngineUsabilityTask = useCallback(
    (taskId: EngineUsabilityTaskId, metadata?: Record<string, unknown>) => {
      if (engineUsabilityTaskStartRef.current[taskId]) return;
      engineUsabilityTaskStartRef.current[taskId] = Date.now();
      pushEngineUsabilityMarker('task_start', taskId, { metadata });
    },
    [pushEngineUsabilityMarker],
  );
  const endEngineUsabilityTask = useCallback(
    (
      taskId: EngineUsabilityTaskId,
      outcome: 'completed' | 'failed' | 'abandoned' = 'completed',
      metadata?: Record<string, unknown>,
    ) => {
      const startedAt = engineUsabilityTaskStartRef.current[taskId];
      const durationMs = startedAt ? Math.max(0, Date.now() - startedAt) : undefined;
      delete engineUsabilityTaskStartRef.current[taskId];
      pushEngineUsabilityMarker('task_end', taskId, { outcome, durationMs, metadata });
    },
    [pushEngineUsabilityMarker],
  );
  const handleEngineLaneNavigation = useCallback(
    (laneId: string) => {
      if (laneId === 'engine-lane-maintenance') {
        endEngineUsabilityTask('engine_risk_scan', 'completed', { trigger: 'lane_navigation' });
        startEngineUsabilityTask('engine_maintenance_next_due', { lane: laneId });
        return;
      }
      if (laneId === 'engine-lane-compliance') {
        startEngineUsabilityTask('engine_compliance_readiness', { lane: laneId });
        return;
      }
      if (laneId === 'engine-lane-analytics') {
        startEngineUsabilityTask('engine_anomaly_review', { lane: laneId });
      }
    },
    [endEngineUsabilityTask, startEngineUsabilityTask],
  );
  const handleExportEngineUsabilityEvents = useCallback(
    (format: 'json' | 'csv') => {
      if (typeof window === 'undefined') return;

      let events: Array<Record<string, unknown>> = [];
      try {
        const stored = window.localStorage.getItem(ENGINE_USABILITY_STORAGE_KEY);
        events = stored ? (JSON.parse(stored) as Array<Record<string, unknown>>) : [];
      } catch (error) {
        logger.warn('Engine usability export failed to parse localStorage payload', {
          component: 'AmroSettingsMasterDataPage',
          message: String((error as Error).message || error),
        });
        toast.error('Unable to parse usability events for export');
        return;
      }

      if (!Array.isArray(events) || events.length === 0) {
        toast.error('No usability session events available to export');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileNameBase = `amro-engine-usability-events-${timestamp}`;
      let blob: Blob;
      let fileName: string;

      if (format === 'json') {
        fileName = `${fileNameBase}.json`;
        blob = new Blob([`${JSON.stringify(events, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      } else {
        const headers = ['session_id', 'event_type', 'task_id', 'timestamp', 'outcome', 'duration_ms', 'metadata'];
        const escapeCsvCell = (value: unknown): string => {
          const text = value == null ? '' : String(value).replace(/"/g, '""');
          return `"${text}"`;
        };
        const csvRows = [
          headers.join(','),
          ...events.map((row) =>
            [
              escapeCsvCell(row.session_id),
              escapeCsvCell(row.event_type),
              escapeCsvCell(row.task_id),
              escapeCsvCell(row.timestamp),
              escapeCsvCell(row.outcome),
              escapeCsvCell(row.duration_ms),
              escapeCsvCell(typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata || {})),
            ].join(',')
          ),
        ];
        fileName = `${fileNameBase}.csv`;
        blob = new Blob([`${csvRows.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      logger.info('Engine usability events exported', {
        component: 'AmroSettingsMasterDataPage',
        format,
        rows: events.length,
      });
      toast.success(`Exported ${events.length} usability events as ${format.toUpperCase()}`);
    },
    [],
  );
  useEffect(() => {
    if (!showAircraftEngineWorkspace) {
      (Object.keys(engineUsabilityTaskStartRef.current) as EngineUsabilityTaskId[]).forEach((taskId) => {
        endEngineUsabilityTask(taskId, 'abandoned', { reason: 'engine_workspace_exit' });
      });
      return;
    }
    startEngineUsabilityTask('engine_risk_scan', { source: 'engine_workspace_entry' });
  }, [endEngineUsabilityTask, showAircraftEngineWorkspace, startEngineUsabilityTask]);
  useEffect(() => {
    if (engineEntrySerial.trim()) return;
    const primaryAsset = aircraftEngineAssets[0];
    if (!primaryAsset?.engineSerialNumber) return;
    setEngineEntrySerial(String(primaryAsset.engineSerialNumber));
    const pos = String(primaryAsset.position || 'L').toUpperCase();
    if (pos === 'L' || pos === 'R' || pos === 'C' || pos === 'AUX') {
      setEngineEntryPosition(pos);
    }
  }, [aircraftEngineAssets, engineEntrySerial]);
  const handleSubmitEngineDataEntry = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextErrors: Record<string, string> = {};
      const serial = engineEntrySerial.trim().toUpperCase();
      const tsn = Number(engineEntryTsn.trim());
      const csn = Number(engineEntryCsn.trim());
      if (!serial) nextErrors.serial = 'Engine serial number is required';
      if (!engineEntryModule.trim()) nextErrors.module = 'Engine module is required';
      if (!Number.isFinite(tsn) || tsn < 0) nextErrors.tsn = 'TSN must be a positive number';
      if (!Number.isFinite(csn) || csn < 0) nextErrors.csn = 'CSN must be a positive number';
      if (Object.keys(nextErrors).length > 0) {
        setEngineEntryErrors(nextErrors);
        endEngineUsabilityTask('engine_data_entry_validation', 'failed', {
          error_fields: Object.keys(nextErrors),
        });
        return;
      }
      setEngineEntryErrors({});
      setEngineEntrySubmitting(true);
      window.setTimeout(() => {
        setEngineEntrySubmitting(false);
        endEngineUsabilityTask('engine_data_entry_validation', 'completed', {
          engine_serial: serial,
          position: engineEntryPosition,
        });
        toast.success(`Engine data validated for ${serial} (${engineEntryPosition})`);
      }, 250);
    },
    [
      endEngineUsabilityTask,
      engineEntryCsn,
      engineEntryModule,
      engineEntryPosition,
      engineEntrySerial,
      engineEntryTsn,
    ],
  );
  const aircraftEngineAnomalies = useMemo(
    () =>
      Array.isArray((aircraftDashboardEngineModule?.component_monitoring?.anomaly_detection as { anomalies?: unknown[] } | undefined)?.anomalies)
        ? (((aircraftDashboardEngineModule?.component_monitoring?.anomaly_detection as { anomalies?: unknown[] }).anomalies || []) as Array<Record<string, unknown>>).slice(0, 4)
        : [],
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineDigitalSignatures = useMemo(() => {
    const workflow = aircraftDashboardEngineModule?.work_orders?.digital_signature_workflow || {};
    return {
      totalRequired: Number((workflow as Record<string, unknown>).total_required || 0),
      completed: Number((workflow as Record<string, unknown>).completed || 0),
      pending: Number((workflow as Record<string, unknown>).pending || 0),
    };
  }, [aircraftDashboardEngineModule]);
  const aircraftEnginePartsTracking = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.work_orders?.parts_tracking) ? aircraftDashboardEngineModule.work_orders.parts_tracking.slice(0, 4) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineRegulatoryProfiles = useMemo(() => {
    const profiles = aircraftDashboardEngineModule?.compliance_tracking?.regulatory_profiles;
    return profiles && typeof profiles === 'object' ? (profiles as Record<string, unknown>) : {};
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineAdSbTracking = useMemo(() => {
    const source = aircraftDashboardEngineModule?.compliance_tracking?.ad_sb_tracking;
    return source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineComplianceStandards = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.compliance_tracking?.standards) ? aircraftDashboardEngineModule.compliance_tracking.standards.slice(0, 4) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineFailurePrediction = useMemo(() => {
    const prediction = aircraftDashboardEngineModule?.performance_analytics?.failure_prediction;
    return prediction && typeof prediction === 'object' ? (prediction as Record<string, unknown>) : {};
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineMaintenanceConflicts = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.maintenance_planning?.conflicts) ? aircraftDashboardEngineModule.maintenance_planning.conflicts.slice(0, 4) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineResourceAllocation = useMemo(
    () => (Array.isArray(aircraftDashboardEngineModule?.maintenance_planning?.resource_allocation) ? aircraftDashboardEngineModule.maintenance_planning.resource_allocation.slice(0, 4) : []),
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineIntegrationResilience = useMemo(() => {
    const resilience = aircraftDashboardEngineModule?.integration_resilience;
    return resilience && typeof resilience === 'object' ? (resilience as Record<string, unknown>) : {};
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineStandardsAlignment = useMemo(() => {
    const standards = aircraftDashboardEngineModule?.standards_alignment;
    return standards && typeof standards === 'object' ? (standards as Record<string, string>) : {};
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineValidationLayers = useMemo(() => {
    const validation = aircraftDashboardEngineModule?.validation;
    if (!validation || typeof validation !== 'object') return {};
    const layers = (validation as Record<string, unknown>).validation_layers;
    return layers && typeof layers === 'object' ? (layers as Record<string, unknown>) : {};
  }, [aircraftDashboardEngineModule]);
  const aircraftEngineHeadlineKpis = useMemo(
    () => [
      {
        label: 'TBO Remaining',
        value: `${String(aircraftDashboardEngineModule?.kpis?.tbo_remaining_hours ?? 0)}h`,
        tone: 'default',
      },
      {
        label: 'LLP Remaining',
        value: String(aircraftDashboardEngineModule?.kpis?.llp_avg_remaining_cycles ?? 0),
        tone: 'default',
      },
      {
        label: 'Oil Consumption',
        value: `${String(aircraftDashboardEngineModule?.kpis?.oil_consumption_lph ?? 0)} L/H`,
        tone: Number(aircraftDashboardEngineModule?.kpis?.oil_consumption_lph ?? 0) > 6 ? 'warning' : 'default',
      },
      {
        label: 'Vibration',
        value: `${String(aircraftDashboardEngineModule?.kpis?.vibration_ips ?? 0)} IPS`,
        tone: Number(aircraftDashboardEngineModule?.kpis?.vibration_ips ?? 0) > 2.8 ? 'warning' : 'default',
      },
    ],
    [aircraftDashboardEngineModule],
  );
  const aircraftEngineWorkflowLanes = useMemo(
    () => [
      {
        id: 'engine-lane-maintenance',
        title: 'Maintenance Lane',
        count: aircraftEngineMaintenanceRows.length,
        total: aircraftEngineMaintenanceRows.length,
      },
      {
        id: 'engine-lane-work-orders',
        title: 'Work Order Lane',
        count: aircraftEngineRecentWorkOrders.length,
        total: Number(aircraftEngineWorkOrderTotals.open || 0) + Number(aircraftEngineWorkOrderTotals.in_progress || 0) + Number(aircraftEngineWorkOrderTotals.blocked || 0) + Number(aircraftEngineWorkOrderTotals.completed || 0),
      },
      {
        id: 'engine-lane-compliance',
        title: 'Compliance Lane',
        count: Number(aircraftEngineComplianceSummary.readyCount || 0),
        total: Number(aircraftEngineComplianceSummary.readyCount || 0) + Number(aircraftEngineComplianceSummary.pendingCount || 0) + Number(aircraftEngineComplianceSummary.overdueCount || 0),
      },
      {
        id: 'engine-lane-analytics',
        title: 'Performance Lane',
        count: aircraftEngineAnomalies.length,
        total: aircraftEnginePerformanceSeries.length,
      },
    ],
    [
      aircraftEngineAnomalies.length,
      aircraftEngineComplianceSummary.overdueCount,
      aircraftEngineComplianceSummary.pendingCount,
      aircraftEngineComplianceSummary.readyCount,
      aircraftEngineMaintenanceRows.length,
      aircraftEnginePerformanceSeries.length,
      aircraftEngineRecentWorkOrders.length,
      aircraftEngineWorkOrderTotals.blocked,
      aircraftEngineWorkOrderTotals.completed,
      aircraftEngineWorkOrderTotals.in_progress,
      aircraftEngineWorkOrderTotals.open,
    ],
  );
  const aircraftComponentsOpenDefects = useMemo(
    () => (Array.isArray(aircraftDashboardComponentsModule?.drilldown?.open_defects) ? aircraftDashboardComponentsModule.drilldown.open_defects.slice(0, 6) : []),
    [aircraftDashboardComponentsModule],
  );
  const aircraftDocumentRows = useMemo(
    () => [
      ...aircraftDashboardMaintenanceRows.map((row) => ({
        title: String(row.title || 'Maintenance Scope Document'),
        category: 'Maintenance',
        status: String(row.status || 'open'),
        date: String(row.updated_at || row.due_at || '').slice(0, 10),
      })),
      ...aircraftComponentReplacementRows.map((row) => ({
        title: String(row.title || 'Component Replacement Record'),
        category: 'Component',
        status: String(row.status || 'open'),
        date: String(row.reported_at || row.updated_at || '').slice(0, 10),
      })),
      ...aircraftDashboardDefectRows.map((row) => ({
        title: String(row.title || 'Defect Report'),
        category: 'Defect',
        status: String(row.status || 'open'),
        date: String(row.reported_at || row.updated_at || '').slice(0, 10),
      })),
    ].slice(0, 12),
    [aircraftComponentReplacementRows, aircraftDashboardDefectRows, aircraftDashboardMaintenanceRows],
  );
  const aircraftAdSbRows = useMemo(
    () => aircraftComponentLifecycleRows.filter((row) => String(row.compliance_state || '').toLowerCase() !== 'compliant').slice(0, 10),
    [aircraftComponentLifecycleRows],
  );
  const visibleAircraftAlerts = useMemo(() => {
    if (showAircraftAdSbWorkspace) {
      return aircraftDashboardAlerts.filter((alert) => String(alert.module || '').toLowerCase() === 'components' || String(alert.code || '').toUpperCase().includes('AD_SB'));
    }
    if (showAircraftDocumentsWorkspace) {
      return [] as AircraftDashboardAlert[];
    }
    if (showAircraftEngineWorkspace && !showAircraftComponentsWorkspace) {
      return aircraftDashboardAlerts.filter((alert) => String(alert.module || '').toLowerCase() === 'engine');
    }
    if (showAircraftComponentsWorkspace && !showAircraftEngineWorkspace) {
      return aircraftDashboardAlerts.filter((alert) => String(alert.module || '').toLowerCase() === 'components');
    }
    return [] as AircraftDashboardAlert[];
  }, [
    aircraftDashboardAlerts,
    showAircraftAdSbWorkspace,
    showAircraftComponentsWorkspace,
    showAircraftDocumentsWorkspace,
    showAircraftEngineWorkspace,
  ]);
  const mapStatusToBadgeVariant = useCallback((statusValue: unknown): 'secondary' | 'destructive' => {
    const normalized = String(statusValue || '').trim().toLowerCase();
    if (normalized === 'critical' || normalized === 'warning' || normalized === 'at_risk' || normalized === 'blocked') {
      return 'destructive';
    }
    return 'secondary';
  }, []);
  const aircraftOpsReportRows = useMemo<AircraftDashboardReportSection[]>(() => {
    const engineKpis = aircraftDashboardEngineModule?.kpis || {};
    const componentKpis = aircraftDashboardComponentsModule?.kpis || {};
    return [
      { section: 'Engine', metric: 'Monitored Engines', value: String(engineKpis.monitored_engines ?? '0') },
      { section: 'Engine', metric: 'TBO Remaining Hours', value: String(engineKpis.tbo_remaining_hours ?? '0') },
      { section: 'Engine', metric: 'LLP Remaining Cycles', value: String(engineKpis.llp_avg_remaining_cycles ?? '0') },
      { section: 'Engine', metric: 'Oil Consumption (L/H)', value: String(engineKpis.oil_consumption_lph ?? '0') },
      { section: 'Engine', metric: 'Vibration (IPS)', value: String(engineKpis.vibration_ips ?? '0') },
      { section: 'Components', metric: 'Tracked Components', value: String(componentKpis.tracked_components ?? '0') },
      { section: 'Components', metric: 'AD/SB Compliance %', value: String(componentKpis.ad_sb_compliance_pct ?? '0') },
      { section: 'Components', metric: 'AD/SB Pending', value: String(componentKpis.ad_sb_pending_count ?? '0') },
      { section: 'Components', metric: 'MTBUR Hours', value: String(componentKpis.mtbur_hours ?? '0') },
      { section: 'Components', metric: 'Repeat Discrepancy %', value: String(componentKpis.repeat_discrepancy_rate ?? '0') },
    ];
  }, [aircraftDashboardComponentsModule, aircraftDashboardEngineModule]);

  const aircraftRiskScore = useMemo(() => {
    const status = String(selectedAircraft?.status || '').toLowerCase();
    if (status === 'grounded') return 0.86;
    if (status === 'maintenance') return 0.72;
    if (status === 'inactive') return 0.55;
    return 0.32;
  }, [selectedAircraft]);
  const aircraftRiskConfidence = useMemo(() => {
    const status = String(selectedAircraft?.status || '').toLowerCase();
    if (status === 'grounded') return 0.9;
    if (status === 'maintenance') return 0.84;
    if (status === 'inactive') return 0.79;
    return 0.68;
  }, [selectedAircraft]);
  const aircraftRiskMessage = useMemo(() => {
    const status = String(selectedAircraft?.status || '').toLowerCase();
    if (status === 'grounded') return 'Immediate attention required before release-to-service';
    if (status === 'maintenance') return 'Hydraulic trend monitoring recommends prioritized scope checks';
    if (status === 'inactive') return 'Dormant fleet profile indicates schedule-due campaign review';
    return 'Operationally stable with low anomaly confidence';
  }, [selectedAircraft]);
  const flightLogDialogConfig = useMemo<FlightLogFormConfig>(() => {
    if (flightLogMode === 'new') {
      return {
        mode: 'new',
        title: 'New Flight Logs',
        description: 'Create an AMRO flight log master record with complete sector and usage details.',
        submitLabel: 'Create Flight Logs Record',
        metadataSource: 'amro.flight-logs.master-data.ui',
      };
    }
    return {
      mode: 'add',
      title: `Add Flight Logs (Aircraft: ${String(selectedFlightLogAircraft?.tail_number || selectedFlightLogAircraft?.id || 'N/A')})`,
      description: 'Record operational totals, sector details, and pilot discrepancy reports for MRO maintenance tracking.',
      submitLabel: 'Save Flight Log',
      metadataSource: 'amro.aircraft.master-data.ui',
      aircraftReadOnly: true,
    };
  }, [flightLogMode, selectedFlightLogAircraft?.id, selectedFlightLogAircraft?.tail_number]);

  const sectionGridClass = 'mdm-template-form-grid';
  const sectionFieldClass = 'mdm-template-form-field';
  const fullWidthSectionFieldClass = 'mdm-template-form-field-full';

  const tabLabelClass = (tab: 'basic' | 'configuration' | 'system') =>
    cn(
      'mdm-template-tab mdm-template-tab-inline',
      activeFormTab === tab ? 'text-[hsl(var(--mdm-template-heading))]' : 'text-[hsl(var(--mdm-template-muted))]',
    );

  const clearAircraftDraft = useCallback(() => {
    localStorage.removeItem(aircraftFormDraftKey);
    setAircraftFormDraftStatus('idle');
    setAircraftFormLastSavedAt('');
    setFormValues(getInitialFormValues(entity));
    setFormErrors({});
    setActiveFormTab('basic');
  }, [aircraftFormDraftKey, entity]);

  const renderEditableField = useCallback(
    (field: EntityFormField, section: FormSectionKey, index?: number) => {
      const fieldId = `master-data-${section}-${field.key}`;
      const fieldErrorId = `${fieldId}-error`;
      const fieldClass = field.type === 'textarea' || field.type === 'json' ? fullWidthSectionFieldClass : sectionFieldClass;
      const hasError = Boolean(formErrors[field.key]);

      return (
        <div key={field.key} className={fieldClass}>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={fieldId} className="mdm-template-label">
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            {AIRCRAFT_FIELD_HELP[field.key] ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" aria-label={`Help for ${field.label}`}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{AIRCRAFT_FIELD_HELP[field.key]}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {field.type === 'select' && (
            <Select value={String(formValues[field.key] ?? '')} onValueChange={(value) => setSelectFieldValue(field.key, value)}>
              <SelectTrigger
                id={fieldId}
                className={cn('mdm-template-input', hasError && 'border-destructive')}
                aria-invalid={hasError}
                aria-describedby={hasError ? fieldErrorId : undefined}
              >
                <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {resolveSelectOptions(field).map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field.type === 'boolean' && (
            <div className="mdm-template-input flex items-center rounded-md px-3">
              <Switch
                id={fieldId}
                checked={Boolean(formValues[field.key])}
                onCheckedChange={(checked) => setFieldValue(field.key, checked)}
                aria-describedby={hasError ? fieldErrorId : undefined}
              />
            </div>
          )}
          {(field.type === 'textarea' || field.type === 'json') && (
            <Textarea
              id={fieldId}
              rows={field.type === 'json' ? 6 : 4}
              value={String(formValues[field.key] ?? '')}
              onChange={(event) => setFieldValue(field.key, event.target.value)}
              placeholder={field.placeholder}
              className={cn('mdm-template-input min-h-[110px]', hasError && 'border-destructive')}
              aria-invalid={hasError}
              aria-describedby={hasError ? fieldErrorId : undefined}
            />
          )}
          {['text', 'email', 'number', 'date', 'time'].includes(field.type) && (
            <Input
              id={fieldId}
              ref={index === 0 && section === 'basic' ? firstFieldRef : undefined}
              type={field.type === 'number' ? 'number' : field.type}
              value={String(formValues[field.key] ?? '')}
              onChange={(event) => setFieldValue(field.key, event.target.value)}
              placeholder={field.placeholder}
              min={typeof field.min === 'number' ? field.min : undefined}
              step={field.type === 'number' ? 'any' : undefined}
              className={cn('mdm-template-input', hasError && 'border-destructive')}
              aria-invalid={hasError}
              aria-describedby={hasError ? fieldErrorId : undefined}
            />
          )}
          {formErrors[field.key] ? (
            <p id={fieldErrorId} className="mdm-template-danger">
              {formErrors[field.key]}
            </p>
          ) : null}
          {field.type === 'select' && field.key === 'manufacturer_id' && manufacturerOptionsError ? (
            <p className="mdm-template-danger">{manufacturerOptionsError}</p>
          ) : null}
          {field.type === 'select' && field.key === 'assembly_type_id' && assemblyTypeOptionsError ? (
            <p className="mdm-template-danger">{assemblyTypeOptionsError}</p>
          ) : null}
        </div>
      );
    },
    [
      assemblyTypeOptionsError,
      firstFieldRef,
      formErrors,
      formValues,
      fullWidthSectionFieldClass,
      manufacturerOptionsError,
      resolveSelectOptions,
      sectionFieldClass,
      setSelectFieldValue,
      setFieldValue,
    ],
  );

  const getColumnLabel = useCallback((column: string) => {
    if (COLUMN_LABEL_OVERRIDES[column]) {
      return COLUMN_LABEL_OVERRIDES[column];
    }
    return column
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }, []);

  const handleExportPdf = useCallback(async () => {
    setBusyAction('export_pdf');
    try {
      const pdfColumns = (entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).filter((column) => column !== 'id');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(12);
      doc.text(`AMRO ${ENTITY_LABEL[entity]} Export`, 40, 36);
      autoTable(doc, {
        startY: 48,
        head: [pdfColumns.map((column) => getColumnLabel(column))],
        body: renderedRows.map((row) => pdfColumns.map((column) => String(resolveTableCellValue(row, column) || ''))),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [17, 24, 39] },
      });
      doc.save(`amro-${entity}.pdf`);
      toast.success(`Exported ${ENTITY_LABEL[entity]} PDF`);
    } catch (error) {
      toast.error(String((error as Error).message || 'PDF export failed'));
    } finally {
      setBusyAction(null);
    }
  }, [aircraftHeaderColumns, entity, getColumnLabel, renderedRows, resolveTableCellValue, tableColumns]);
  const handleExportAircraftOpsReport = useCallback(async () => {
    setBusyAction('export_pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(12);
      doc.text('Aircraft Operations Snapshot Report', 40, 36);
      doc.setFontSize(9);
      doc.text(`Generated ${new Date().toISOString()}`, 40, 52);
      autoTable(doc, {
        startY: 64,
        head: [['Section', 'Metric', 'Value']],
        body: aircraftOpsReportRows.map((row) => [row.section, row.metric, row.value]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [17, 24, 39] },
      });
      autoTable(doc, {
        startY: ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 110) + 16,
        head: [['Module', 'Severity', 'Code', 'Message', 'Due (Days)']],
        body: aircraftDashboardAlerts.slice(0, 12).map((alert) => [
          String(alert.module || ''),
          String(alert.severity || ''),
          String(alert.code || ''),
          String(alert.message || ''),
          String(alert.due_in_days ?? ''),
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [51, 65, 85] },
      });
      doc.save(`amro-aircraft-operations-${String(selectedAircraft?.id || 'snapshot')}.pdf`);
      toast.success('Exported Aircraft Operations Snapshot report');
    } catch (error) {
      toast.error(String((error as Error).message || 'Operations report export failed'));
    } finally {
      setBusyAction(null);
    }
  }, [aircraftDashboardAlerts, aircraftOpsReportRows, selectedAircraft?.id]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedRowIds.includes(row.id)), [rows, selectedRowIds]);
  const allRowsSelected = renderedRowIds.length > 0 && renderedRowIds.every((id) => selectedRowIds.includes(id));
  const someRowsSelected = renderedRowIds.some((id) => selectedRowIds.includes(id)) && !allRowsSelected;

  const handleExportSelectedCsv = useCallback(() => {
    if (!selectedRows.length) {
      toast.error('Select at least one record to export');
      return;
    }
    const csvColumns = (entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).filter((column) => column !== 'id');
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = csvColumns.map((column) => escapeCell(getColumnLabel(column))).join(',');
    const body = selectedRows
      .map((row) => csvColumns.map((column) => escapeCell(String(resolveTableCellValue(row, column) || ''))).join(','))
      .join('\n');
    const csvText = `${header}\n${body}`;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `amro-${entity}-selected.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedRows.length} selected ${ENTITY_LABEL[entity]} records`);
  }, [aircraftHeaderColumns, entity, getColumnLabel, resolveTableCellValue, selectedRows, tableColumns]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedRowIds.length) {
      toast.error('Select at least one record to delete');
      return;
    }
    try {
      const headers = await buildApiHeaders(scope);
      const results = await Promise.allSettled(
        selectedRowIds.map(async (rowId) => {
          const response = await fetch(`/api/v2/amro/master-data/${entity}/${rowId}`, {
            method: 'DELETE',
            headers,
          });
          const payload = await parseApiPayload(response);
          if (!response.ok) {
            throw new Error(String(payload.error || `Delete failed for ${rowId}`));
          }
        }),
      );
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      const deletedCount = results.length - failedCount;
      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} ${ENTITY_LABEL[entity]} records`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} record deletions failed`);
      }
      setSelectedRowIds((previous) => previous.filter((id) => !selectedRowIds.includes(id)));
      selectionAnchorRef.current = null;
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Bulk delete failed'));
    }
  }, [entity, loadRecords, scope, selectedRowIds]);

  const renderSortIcon = useCallback(
    (column: string) => {
      if (sortColumn !== column) {
        return <ArrowUpDown className="h-3.5 w-3.5 text-[hsl(var(--mdm-template-muted))]" aria-hidden="true" />;
      }
      if (sortDirection === 'asc') {
        return <ArrowUp className="h-3.5 w-3.5 text-[hsl(var(--mdm-template-focus))]" aria-hidden="true" />;
      }
      return <ArrowDown className="h-3.5 w-3.5 text-[hsl(var(--mdm-template-focus))]" aria-hidden="true" />;
    },
    [sortColumn, sortDirection],
  );
  const headerPaletteActions = useMemo<AircraftPaletteAction[]>(
    () => {
      const hideAircraftUtilityActions = entity === 'aircraft';
      if (entity === 'aircraft' && aircraftEnhancementEnabled) {
        const resolveAircraftViewActive = (tab: AircraftLeadsTab): boolean => (tab === 'list'
          ? aircraftNavigationView === 'module'
          : aircraftNavigationView === tab);
        const legacyActions: AircraftPaletteAction[] = [
          {
            id: 'view-list',
            label: 'List',
            icon: <List className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: resolveAircraftViewActive('list'),
            ariaLabel: 'List view',
            onAction: async () => {
              handleAircraftViewNavigation('list');
            },
          },
          {
            id: 'new-record',
            label: 'New',
            icon: <Plus className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'default',
            loading: busyAction === 'create',
            ariaLabel: 'New aircraft record',
            onAction: async () => {
              handleOpenCreateModal();
            },
          },
          {
            id: 'aircraft-templates',
            label: 'Template',
            icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            permission: 'edit_aircraft_records',
            disabled: !canManageAircraftTemplates,
            active: isAircraftSubModule && aircraftSubModuleSegment === 'templates',
            ariaLabel: 'Aircraft template workspace',
            onAction: async () => {
              navigate(`/dashboard/amro/aircraft/templates${location.search}`, { replace: true });
            },
          },
          {
            id: 'view-grid',
            label: 'Grid',
            icon: <LayoutGrid className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: resolveAircraftViewActive('grid'),
            ariaLabel: 'Grid view',
            onAction: async () => {
              handleAircraftViewNavigation('grid');
            },
          },
          {
            id: 'view-card',
            label: 'Card',
            icon: <CreditCard className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: resolveAircraftViewActive('card'),
            ariaLabel: 'Card view',
            onAction: async () => {
              handleAircraftViewNavigation('card');
            },
          },
          {
            id: 'refresh-records',
            label: 'Refresh',
            icon: <RefreshCw className={cn('h-4 w-4', busyAction === 'refresh' && 'animate-spin')} aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            disabled: loading,
            loading: busyAction === 'refresh',
            ariaLabel: 'Refresh records',
            onAction: async () => {
              setBusyAction('refresh');
              await loadRecords();
              setBusyAction(null);
            },
            errorMessage: 'Refresh failed',
          },
          {
            id: 'view-pipeline',
            label: 'Pipeline',
            icon: <Workflow className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: resolveAircraftViewActive('pipeline'),
            ariaLabel: 'Pipeline view',
            onAction: async () => {
              handleAircraftViewNavigation('pipeline');
            },
          },
          {
            id: 'view-analytics',
            label: 'Analytics',
            icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: resolveAircraftViewActive('analytics'),
            ariaLabel: 'Analytics view',
            onAction: async () => {
              handleAircraftViewNavigation('analytics');
            },
          },
          {
            id: 'view-import-export',
            label: 'Import/Export',
            icon: <ArrowUpDown className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: resolveAircraftViewActive('import_export'),
            ariaLabel: 'Import and export workspace',
            onAction: async () => {
              handleAircraftViewNavigation('import_export');
            },
          },
          {
            id: 'export-csv',
            label: 'Export CSV',
            icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            loading: busyAction === 'export',
            disabled: busyAction === 'export_pdf',
            ariaLabel: 'Export records CSV',
            onAction: async () => {
              await handleExport();
            },
          },
          {
            id: 'export-pdf',
            label: 'Export PDF',
            icon: <FileText className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            loading: busyAction === 'export_pdf',
            disabled: busyAction === 'export',
            ariaLabel: 'Export records PDF',
            onAction: async () => {
              await handleExportPdf();
            },
          },
        ];
        const nextHeaderNavigationActions: AircraftPaletteAction[] = AIRCRAFT_NAV_RAIL.map((item) => {
          const segment = item.path.split('/').pop();
          const isActive = isAircraftSubModule && aircraftSubModuleSegment === segment;
          return {
            id: `aircraft-nav-${segment}`,
            label: item.label,
            icon: <item.icon className="h-4 w-4" aria-hidden="true" />,
            group: 'primary',
            variant: 'outline',
            active: isActive,
            ariaLabel: `Go to ${item.label}`,
            onAction: async () => {
              handleAircraftContextNavigation(item.path);
            },
          };
        });
        const useLegacyAircraftHeaderActions = false;
        return useLegacyAircraftHeaderActions
          ? (hideAircraftUtilityActions
            ? legacyActions.filter((action) => action.id !== 'refresh-records' && action.id !== 'export-csv' && action.id !== 'export-pdf')
            : legacyActions)
          : nextHeaderNavigationActions;
      }
      const actions: AircraftPaletteAction[] = hideAircraftUtilityActions
        ? []
        : [
          {
            id: 'refresh-records',
            label: 'Refresh',
            icon: <RefreshCw className={cn('h-4 w-4', busyAction === 'refresh' && 'animate-spin')} aria-hidden="true" />,
            group: 'contextual',
            variant: 'secondary',
            disabled: loading,
            loading: busyAction === 'refresh',
            ariaLabel: 'Refresh records',
            onAction: async () => {
              setBusyAction('refresh');
              await loadRecords();
              setBusyAction(null);
            },
            errorMessage: 'Refresh failed',
          },
          {
            id: 'export-csv',
            label: 'Export CSV',
            icon: <FileUp className="h-4 w-4" aria-hidden="true" />,
            group: 'secondary',
            variant: 'outline',
            loading: busyAction === 'export',
            disabled: busyAction === 'export_pdf',
            ariaLabel: 'Export records CSV',
            onAction: async () => {
              await handleExport();
            },
          },
          {
            id: 'export-pdf',
            label: 'Export PDF',
            icon: <FileText className="h-4 w-4" aria-hidden="true" />,
            group: 'secondary',
            variant: 'outline',
            loading: busyAction === 'export_pdf',
            disabled: busyAction === 'export',
            ariaLabel: 'Export records PDF',
            onAction: async () => {
              await handleExportPdf();
            },
          },
        ];
      actions.push({
        id: 'new-record',
        label: `New ${ENTITY_LABEL[entity]}`,
        icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        group: 'primary',
        loading: busyAction === 'create',
        ariaLabel: `New ${ENTITY_LABEL[entity]}`,
        onAction: async () => {
          handleOpenCreateModal();
        },
      });
      return actions;
    },
    [
      aircraftEnhancementEnabled,
      aircraftNavigationView,
      aircraftSubModuleSegment,
      busyAction,
      canManageAircraftTemplates,
      entity,
      handleAircraftViewNavigation,
      handleExport,
      handleExportPdf,
      handleOpenCreateModal,
      isAircraftSubModule,
      loadRecords,
      location.search,
      loading,
      navigate,
    ],
  );
  const aircraftStatusPaletteActions = useMemo<AircraftPaletteAction[]>(
    () => [
      {
        id: 'create-work-package',
        label: 'Create Work Package',
        icon: <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'primary',
        variant: 'default',
        permission: 'create_maintenance_request',
        onAction: async () => {
          openAircraftWorkPackageDialog();
        },
      },
      {
        id: 'view-flight-logs',
        label: 'View Logs',
        icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'secondary',
        permission: 'edit_aircraft_records',
        onAction: async () => {
          openAircraftFlightLogsList(String(selectedAircraft?.id || ''));
        },
      },
      {
        id: 'add-flight-log',
        label: 'Add Log',
        icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'secondary',
        permission: 'create_maintenance_request',
        onAction: async () => {
          openFlightLogDialog(String(selectedAircraft?.id || ''));
        },
      },
      {
        id: 'view-active-packages',
        label: 'View Active Packages',
        icon: <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'contextual',
        permission: 'edit_aircraft_records',
        onAction: async () => {
          handleAircraftContextNavigation('/dashboard/amro/aircraft/work-packages');
        },
      },
    ],
    [handleAircraftContextNavigation, openAircraftFlightLogsList, openAircraftWorkPackageDialog, openFlightLogDialog, selectedAircraft?.id],
  );
  const aircraftKpiPaletteActions = useMemo<AircraftPaletteAction[]>(
    () => [
      {
        id: 'replan',
        label: 'Replan',
        icon: <TimerReset className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'secondary',
        permission: 'edit_aircraft_records',
        onAction: async () => {
          handleAircraftContextNavigation('/dashboard/amro/scheduling');
        },
      },
      {
        id: 'escalate',
        label: 'Escalate',
        icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'secondary',
        permission: 'approve_work_orders',
        onAction: async () => {
          handleAircraftContextNavigation('/dashboard/amro/compliance');
        },
      },
      {
        id: 'export-kpi',
        label: 'Export',
        icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
        group: 'contextual',
        permission: 'delete_flight_logs',
        onAction: async () => {
          await handleExportAircraftOpsReport();
        },
      },
    ],
    [handleAircraftContextNavigation, handleExportAircraftOpsReport],
  );
  const activeAircraftUnifiedModuleKey = useMemo<AircraftUnifiedLayoutModuleKey>(() => {
    if (aircraftSubModuleSegment === 'templates') return 'templates';
    if (aircraftSubModuleSegment === 'engine') return 'engine';
    if (aircraftSubModuleSegment === 'components') return 'components';
    if (aircraftSubModuleSegment === 'documents') return 'documents';
    if (aircraftSubModuleSegment === 'ad-sb') return 'ad-sb';
    if (aircraftSubModuleSegment === 'work-packages') return 'work-packages';
    return 'list';
  }, [aircraftSubModuleSegment]);
  const canOpenAircraftSubModuleCreateAction = useMemo(() => {
    if (activeAircraftUnifiedModuleKey === 'templates') {
      return canManageAircraftTemplates;
    }
    if (activeAircraftUnifiedModuleKey === 'work-packages') {
      return canCreateWorkPackage;
    }
    return canCreateAircraftRecords;
  }, [activeAircraftUnifiedModuleKey, canCreateAircraftRecords, canCreateWorkPackage, canManageAircraftTemplates]);
  const aircraftSubModuleCreateActionLabel = useMemo(() => {
    if (activeAircraftUnifiedModuleKey === 'templates') {
      return 'New Template';
    }
    if (activeAircraftUnifiedModuleKey === 'work-packages') {
      return 'New Work Package';
    }
    return 'New Aircraft Record';
  }, [activeAircraftUnifiedModuleKey]);
  const isAircraftSubModuleCreateActionLoading = useMemo(() => {
    if (activeAircraftUnifiedModuleKey === 'templates') {
      return aircraftTemplateDialogSubmitting;
    }
    if (activeAircraftUnifiedModuleKey === 'work-packages') {
      return aircraftWorkPackageSubmitting;
    }
    return busyAction === 'create';
  }, [activeAircraftUnifiedModuleKey, aircraftTemplateDialogSubmitting, aircraftWorkPackageSubmitting, busyAction]);
  const handleAircraftSubModuleCreateAction = useCallback(() => {
    if (activeAircraftUnifiedModuleKey === 'templates') {
      openCreateAircraftTemplateDialog();
      return;
    }
    if (activeAircraftUnifiedModuleKey === 'work-packages') {
      openAircraftWorkPackageDialog();
      return;
    }
    handleOpenCreateModal();
  }, [activeAircraftUnifiedModuleKey, handleOpenCreateModal, openAircraftWorkPackageDialog, openCreateAircraftTemplateDialog]);
  useEffect(() => {
    if (activeAircraftUnifiedModuleKey !== 'list') {
      return;
    }
    if (aircraftUnifiedSearch !== search) {
      setSearch(aircraftUnifiedSearch);
    }
  }, [activeAircraftUnifiedModuleKey, aircraftUnifiedSearch, search]);
  useEffect(() => {
    if (activeAircraftUnifiedModuleKey !== 'list') {
      return;
    }
    if (aircraftUnifiedStatusFilter !== statusFilter) {
      setStatusFilter(aircraftUnifiedStatusFilter);
    }
  }, [activeAircraftUnifiedModuleKey, aircraftUnifiedStatusFilter, statusFilter]);
  useEffect(() => {
    if (activeAircraftUnifiedModuleKey !== 'list') {
      return;
    }
    if (search !== aircraftUnifiedSearch) {
      setAircraftUnifiedSearch(search);
    }
  }, [activeAircraftUnifiedModuleKey, aircraftUnifiedSearch, search]);
  useEffect(() => {
    if (activeAircraftUnifiedModuleKey !== 'list') {
      return;
    }
    if (statusFilter !== aircraftUnifiedStatusFilter) {
      setAircraftUnifiedStatusFilter(statusFilter);
    }
  }, [activeAircraftUnifiedModuleKey, aircraftUnifiedStatusFilter, statusFilter]);
  const aircraftTemplateTypeOptions = useMemo<AircraftUnifiedFilterOption[]>(
    () => [
      { value: 'all', label: 'All Types' },
      ...Array.from(
        new Set(
          aircraftTemplateRows
            .map((row) => String(row.aircraft_type || '').trim())
            .filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value: value.toLowerCase(), label: value })),
    ],
    [aircraftTemplateRows],
  );
  const aircraftTemplateManufacturerOptions = useMemo<AircraftUnifiedFilterOption[]>(
    () => [
      { value: 'all', label: 'All Makers' },
      ...Array.from(
        new Set(
          aircraftTemplateRows
            .map((row) => String(row.manufacturer || '').trim())
            .filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value: value.toLowerCase(), label: value })),
    ],
    [aircraftTemplateRows],
  );
  const aircraftDocumentCategoryOptions = useMemo<AircraftUnifiedFilterOption[]>(
    () => [
      { value: 'all', label: 'All Categories' },
      ...Array.from(
        new Set(
          aircraftDocumentRows
            .map((row) => String(row.category || '').trim())
            .filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value: value.toLowerCase(), label: value })),
    ],
    [aircraftDocumentRows],
  );
  const aircraftAdSbComplianceOptions = useMemo<AircraftUnifiedFilterOption[]>(
    () => [
      { value: 'all', label: 'All Compliance' },
      ...Array.from(
        new Set(
          aircraftAdSbRows
            .map((row) => String(row.compliance_state || '').trim())
            .filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value: value.toLowerCase(), label: value })),
    ],
    [aircraftAdSbRows],
  );
  const filteredAircraftTemplateRows = useMemo(
    () => filterUnifiedModuleRows(
      aircraftTemplateRows,
      deferredAircraftUnifiedSearch,
      aircraftUnifiedStatusFilter,
      (row) => [
        String(row.template_name || ''),
        String(row.aircraft_type || ''),
        String(row.manufacturer || ''),
        String(row.aircraft_model || ''),
        String(row.maintenance_program || ''),
      ],
      (row) => String((row as Record<string, unknown>).status || (row as Record<string, unknown>).is_active || 'active'),
    ).filter((row) => {
      const normalizedType = String(row.aircraft_type || '').trim().toLowerCase();
      const normalizedManufacturer = String(row.manufacturer || '').trim().toLowerCase();
      return (aircraftUnifiedTemplateTypeFilter === 'all' || normalizedType === aircraftUnifiedTemplateTypeFilter)
        && (aircraftUnifiedTemplateManufacturerFilter === 'all' || normalizedManufacturer === aircraftUnifiedTemplateManufacturerFilter);
    }),
    [
      aircraftTemplateRows,
      aircraftUnifiedStatusFilter,
      aircraftUnifiedTemplateManufacturerFilter,
      aircraftUnifiedTemplateTypeFilter,
      deferredAircraftUnifiedSearch,
    ],
  );
  const filteredAircraftDocumentRows = useMemo(
    () => filterUnifiedModuleRows(
      aircraftDocumentRows,
      deferredAircraftUnifiedSearch,
      aircraftUnifiedStatusFilter,
      (row) => [String(row.title || ''), String(row.category || ''), String(row.date || '')],
      (row) => String(row.status || 'open'),
    ).filter((row) => aircraftUnifiedDocumentCategoryFilter === 'all'
      || String(row.category || '').trim().toLowerCase() === aircraftUnifiedDocumentCategoryFilter),
    [aircraftDocumentRows, aircraftUnifiedDocumentCategoryFilter, aircraftUnifiedStatusFilter, deferredAircraftUnifiedSearch],
  );
  const filteredAircraftAdSbRows = useMemo(
    () => filterUnifiedModuleRows(
      aircraftAdSbRows,
      deferredAircraftUnifiedSearch,
      aircraftUnifiedStatusFilter,
      (row) => [
        String(row.component_name || row.title || ''),
        String(row.ad_sb_reference || row.reference || ''),
        String(row.compliance_state || ''),
      ],
      (row) => String(row.compliance_state || 'open'),
    ).filter((row) => aircraftUnifiedAdSbComplianceFilter === 'all'
      || String(row.compliance_state || '').trim().toLowerCase() === aircraftUnifiedAdSbComplianceFilter),
    [aircraftAdSbRows, aircraftUnifiedAdSbComplianceFilter, aircraftUnifiedStatusFilter, deferredAircraftUnifiedSearch],
  );
  const filteredAircraftEngineMaintenanceRows = useMemo(
    () => filterUnifiedModuleRows(
      aircraftEngineMaintenanceRows,
      deferredAircraftUnifiedSearch,
      aircraftUnifiedStatusFilter,
      (row) => [
        String(row.work_package_number || ''),
        String(row.title || ''),
        String(row.status || ''),
      ],
      (row) => String(row.status || 'open'),
    ),
    [aircraftEngineMaintenanceRows, aircraftUnifiedStatusFilter, deferredAircraftUnifiedSearch],
  );
  const filteredAircraftComponentLifecycleRows = useMemo(
    () => filterUnifiedModuleRows(
      aircraftComponentLifecycleRows,
      deferredAircraftUnifiedSearch,
      aircraftUnifiedStatusFilter,
      (row) => [
        String(row.component_name || ''),
        String(row.part_number || ''),
        String(row.compliance_state || ''),
      ],
      (row) => String(row.compliance_state || row.status || 'open'),
    ),
    [aircraftComponentLifecycleRows, aircraftUnifiedStatusFilter, deferredAircraftUnifiedSearch],
  );
  const aircraftUnifiedLabels = useMemo<AircraftUnifiedLayoutLabels>(
    () => AIRCRAFT_UNIFIED_LAYOUT_I18N[aircraftUnifiedLocale] || AIRCRAFT_UNIFIED_LAYOUT_I18N.en,
    [aircraftUnifiedLocale],
  );
  const masterDataControlsLabels = useMemo<AircraftUnifiedLayoutLabels>(
    () => MASTER_DATA_CONTROLS_I18N[aircraftUnifiedLocale] || MASTER_DATA_CONTROLS_I18N.en,
    [aircraftUnifiedLocale],
  );
  const aircraftUnifiedStatusOptions = useMemo<AircraftUnifiedFilterOption[]>(() => {
    if (aircraftUnifiedLocale === 'es') {
      return [
        { value: 'all', label: 'Todos los estados' },
        { value: 'open', label: 'Abierto' },
        { value: 'in_progress', label: 'En progreso' },
        { value: 'active', label: 'Activo' },
        { value: 'critical', label: 'Crítico' },
        { value: 'compliant', label: 'Conforme' },
      ];
    }
    if (aircraftUnifiedLocale === 'fr') {
      return [
        { value: 'all', label: 'Tous les statuts' },
        { value: 'open', label: 'Ouvert' },
        { value: 'in_progress', label: 'En cours' },
        { value: 'active', label: 'Actif' },
        { value: 'critical', label: 'Critique' },
        { value: 'compliant', label: 'Conforme' },
      ];
    }
    return AIRCRAFT_UNIFIED_STATUS_OPTIONS;
  }, [aircraftUnifiedLocale]);
  const masterDataStatusOptions = useMemo<AircraftUnifiedFilterOption[]>(() => {
    if (aircraftUnifiedLocale === 'es') {
      return [
        { value: 'all', label: 'Todos los estados' },
        { value: 'active', label: 'Activo' },
        { value: 'inactive', label: 'Inactivo' },
      ];
    }
    if (aircraftUnifiedLocale === 'fr') {
      return [
        { value: 'all', label: 'Tous les statuts' },
        { value: 'active', label: 'Actif' },
        { value: 'inactive', label: 'Inactif' },
      ];
    }
    return [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ];
  }, [aircraftUnifiedLocale]);
  const supplierTypeOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      const value = String(row.supplier_type || row.supplier_category || row.vendor_type || row.type || '').trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const facilityStationOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      const value = String(row.station_code || row.station || row.facility_station || '').trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const workCenterTypeOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      const value = String(row.center_type || row.work_center_type || row.type || '').trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const clearAircraftUnifiedFilters = useCallback(() => {
    setAircraftUnifiedSearch('');
    setAircraftUnifiedStatusFilter('all');
    setAircraftUnifiedTemplateTypeFilter('all');
    setAircraftUnifiedTemplateManufacturerFilter('all');
    setAircraftUnifiedDocumentCategoryFilter('all');
    setAircraftUnifiedAdSbComplianceFilter('all');
  }, []);
  const clearMasterDataControls = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setSupplierTypeFilter('all');
    setFacilityStationFilter('all');
    setWorkCenterTypeFilter('all');
    if (entity === 'suppliers') {
      setColumnFilterValue('supplier_type', '');
    }
    if (entity === 'maintenance_facilities') {
      setColumnFilterValue('station_code', '');
    }
    if (entity === 'work_centers') {
      setColumnFilterValue('center_type', '');
    }
  }, [entity, setColumnFilterValue]);
  const masterDataSecondaryControls = useMemo(() => {
    if (entity === 'suppliers') {
      return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="w-full">
            <Select value={supplierTypeFilter} onValueChange={setSupplierTypeFilter}>
              <SelectTrigger aria-label="Supplier type filter">
                <SelectValue placeholder="Supplier type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Supplier Types</SelectItem>
                {supplierTypeOptions.map((option) => (
                  <SelectItem key={`supplier-type-option-${option}`} value={option.toLowerCase()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }
    if (entity === 'maintenance_facilities') {
      return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="w-full">
            <Select value={facilityStationFilter} onValueChange={setFacilityStationFilter}>
              <SelectTrigger aria-label="Facility station filter">
                <SelectValue placeholder="Facility station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                {facilityStationOptions.map((option) => (
                  <SelectItem key={`facility-station-option-${option}`} value={option.toLowerCase()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }
    if (entity === 'work_centers') {
      return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="w-full">
            <Select value={workCenterTypeFilter} onValueChange={setWorkCenterTypeFilter}>
              <SelectTrigger aria-label="Work center type filter">
                <SelectValue placeholder="Work center type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Work Center Types</SelectItem>
                {workCenterTypeOptions.map((option) => (
                  <SelectItem key={`work-center-type-option-${option}`} value={option.toLowerCase()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }
    return null;
  }, [
    entity,
    facilityStationFilter,
    facilityStationOptions,
    supplierTypeFilter,
    supplierTypeOptions,
    workCenterTypeFilter,
    workCenterTypeOptions,
  ]);
  const aircraftUnifiedResultSummary = useMemo(() => {
    if (activeAircraftUnifiedModuleKey === 'templates') {
      return { visible: filteredAircraftTemplateRows.length, total: aircraftTemplateRows.length };
    }
    if (activeAircraftUnifiedModuleKey === 'documents') {
      return { visible: filteredAircraftDocumentRows.length, total: aircraftDocumentRows.length };
    }
    if (activeAircraftUnifiedModuleKey === 'ad-sb') {
      return { visible: filteredAircraftAdSbRows.length, total: aircraftAdSbRows.length };
    }
    if (activeAircraftUnifiedModuleKey === 'engine') {
      return { visible: filteredAircraftEngineMaintenanceRows.length, total: aircraftEngineMaintenanceRows.length };
    }
    if (activeAircraftUnifiedModuleKey === 'components') {
      return { visible: filteredAircraftComponentLifecycleRows.length, total: aircraftComponentLifecycleRows.length };
    }
    if (activeAircraftUnifiedModuleKey === 'work-packages') {
      const total = aircraftWorkPackageSnapshot.open
        + aircraftWorkPackageSnapshot.inProgress
        + aircraftWorkPackageSnapshot.deferred
        + aircraftWorkPackageSnapshot.completed;
      return { visible: total, total };
    }
    return { visible: renderedRows.length, total: rows.length };
  }, [
    activeAircraftUnifiedModuleKey,
    aircraftAdSbRows.length,
    aircraftComponentLifecycleRows.length,
    aircraftDocumentRows.length,
    aircraftEngineMaintenanceRows.length,
    aircraftTemplateRows.length,
    aircraftWorkPackageSnapshot.completed,
    aircraftWorkPackageSnapshot.deferred,
    aircraftWorkPackageSnapshot.inProgress,
    aircraftWorkPackageSnapshot.open,
    filteredAircraftAdSbRows.length,
    filteredAircraftComponentLifecycleRows.length,
    filteredAircraftDocumentRows.length,
    filteredAircraftEngineMaintenanceRows.length,
    filteredAircraftTemplateRows.length,
    renderedRows.length,
    rows.length,
  ]);

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={300}>
        <div className="mdm-template-page" data-testid="amro-master-data-template">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <nav className="mb-1 flex items-center gap-1 text-xs text-[hsl(var(--mdm-template-muted))]" aria-label="Breadcrumb">
              <Link className="transition-colors hover:text-[hsl(var(--mdm-template-focus))]" to="/dashboard">Dashboard</Link>
              <span>/</span>
              <Link className="transition-colors hover:text-[hsl(var(--mdm-template-focus))]" to={breadcrumbParentPath}>{breadcrumbParentLabel}</Link>
              <span>/</span>
              <span className="font-medium text-[hsl(var(--mdm-template-heading))]">{breadcrumbCurrentLabel}</span>
            </nav>
            <h1 className="mdm-template-header-title">{pageTitle}</h1>
            {hideAircraftModuleHeaderMeta ? null : <p className="mdm-template-header-subtitle">{pageSubtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hideAircraftModuleHeaderMeta ? null : <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>}
            {hideAircraftModuleHeaderMeta ? null : (
              <Button variant="ghost" asChild>
                <Link to={breadcrumbParentPath} className="underline-offset-4 hover:underline">
                  {homeActionLabel}
                </Link>
              </Button>
            )}
            <AircraftActionPalette
              actions={headerPaletteActions}
              hasPermission={hasPermission}
              toolbarLabel={entity === 'aircraft' && aircraftEnhancementEnabled ? 'Aircraft header actions' : `${ENTITY_LABEL[entity]} header actions`}
              className={cn(
                'order-2 rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/10 p-1.5',
                entity === 'aircraft' && aircraftEnhancementEnabled ? 'max-w-full justify-end' : undefined,
              )}
              compact
              buttonClassName="h-9 px-3 transition-all duration-200"
            />
          </div>
        </div>

        {!isAircraftSubModule ? (
          <Tabs value={entity} onValueChange={(next) => setEntity(next as MasterEntity)}>
            <TabsList className="mdm-template-tab-rail h-auto">
              {MASTER_ENTITY_SEQUENCE.map((key) => (
                <TabsTrigger key={key} value={key} className="mdm-template-tab data-[state=active]:bg-[hsl(var(--mdm-template-focus))/0.14] data-[state=active]:text-[hsl(var(--mdm-template-heading))]">
                  {ENTITY_LABEL[key]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
        {entity === 'aircraft' && aircraftEnhancementEnabled ? (
          <Card className="mdm-template-panel">
            <CardHeader className="mdm-template-panel-head">
              <CardTitle className="mdm-template-panel-title">Aircraft Operations Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="mdm-template-panel-body space-y-4">
              {showAircraftUnifiedControlsInOperationsCard ? (
                <AircraftListingControls
                  searchValue={aircraftUnifiedSearch}
                  onSearchChange={setAircraftUnifiedSearch}
                  searchPlaceholder={aircraftUnifiedLabels.searchPlaceholder}
                  searchAriaLabel={aircraftUnifiedLabels.searchAriaLabel}
                  statusValue={aircraftUnifiedStatusFilter}
                  onStatusChange={setAircraftUnifiedStatusFilter}
                  statusAriaLabel={aircraftUnifiedLabels.statusAriaLabel}
                  statusOptions={aircraftUnifiedStatusOptions}
                  clearFiltersLabel={aircraftUnifiedLabels.clearFilters}
                  onClearFilters={clearAircraftUnifiedFilters}
                  createLabel="New"
                  createAriaLabel={aircraftSubModuleCreateActionLabel}
                  onCreate={handleAircraftSubModuleCreateAction}
                  createDisabled={!canOpenAircraftSubModuleCreateAction}
                  createLoading={isAircraftSubModuleCreateActionLoading}
                  resultSummaryText={`${aircraftUnifiedResultSummary.visible}/${aircraftUnifiedResultSummary.total} ${aircraftUnifiedLabels.resultLabel}`}
                />
              ) : null}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                  <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">Aircraft Identity Sheet</h3>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <p className="text-[hsl(var(--mdm-template-muted))]">Tail Number</p>
                      <p className="font-medium text-[hsl(var(--mdm-template-heading))]">{String(selectedAircraft?.tail_number || '-')}</p>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--mdm-template-muted))]">Registration</p>
                      <p className="font-medium text-[hsl(var(--mdm-template-heading))]">{String(selectedAircraft?.registration || '-')}</p>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--mdm-template-muted))]">Type</p>
                      <p className="font-medium text-[hsl(var(--mdm-template-heading))]">{String(selectedAircraft?.aircraft_type || '-')}</p>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--mdm-template-muted))]">Model</p>
                      <p className="font-medium text-[hsl(var(--mdm-template-heading))]">{String(selectedAircraft?.aircraft_model || '-')}</p>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--mdm-template-muted))]">Manufacturer</p>
                      <p className="font-medium text-[hsl(var(--mdm-template-heading))]">{String(selectedAircraft?.manufacturer || '-')}</p>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--mdm-template-muted))]">Program</p>
                      <p className="font-medium text-[hsl(var(--mdm-template-heading))]">{String(selectedAircraft?.maintenance_program || '-')}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                  <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">Aircraft Status & Risk</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Health: {String(selectedAircraft?.status || 'unknown')}</Badge>
                    <Badge variant={aircraftRiskScore >= 0.7 ? 'destructive' : 'secondary'}>Risk: {aircraftRiskScore.toFixed(2)}</Badge>
                  </div>
                  <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">
                    Confidence {Math.round(aircraftRiskConfidence * 100)}% · {aircraftRiskMessage}
                  </p>
                  <AircraftActionPalette actions={aircraftStatusPaletteActions} hasPermission={hasPermission} compact buttonClassName="h-8" className="pt-2" />
                </div>
                <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                  <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">KPI Cards</h3>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-md bg-muted/40 p-2">Open WP: <span className="font-semibold">{aircraftWorkPackageSnapshot.open}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">In Progress: <span className="font-semibold">{aircraftWorkPackageSnapshot.inProgress}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">Deferred: <span className="font-semibold">{aircraftWorkPackageSnapshot.deferred}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">Completed: <span className="font-semibold">{aircraftWorkPackageSnapshot.completed}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">RTS Blockers: <span className="font-semibold">{aircraftWorkPackageSnapshot.rtsBlockers}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">SLA Risk: <span className="font-semibold">{aircraftWorkPackageSnapshot.slaRisk}</span></div>
                  </div>
                  <AircraftActionPalette actions={aircraftKpiPaletteActions} hasPermission={hasPermission} compact buttonClassName="h-8" className="pt-1" />
                </div>
              </div>
              {!showAircraftOperationsOverview || showAircraftOperationsOverviewSection ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">
                      {showAircraftDocumentsWorkspace
                        ? 'Documents Management'
                        : showAircraftAdSbWorkspace
                          ? 'AD/SB Management'
                          : showAircraftEngineWorkspace && !showAircraftComponentsWorkspace
                            ? 'Engine Operations'
                            : showAircraftComponentsWorkspace && !showAircraftEngineWorkspace
                              ? 'Components Monitoring'
                              : 'Aircraft Operations Overview'}
                    </h3>
                    <Badge variant="secondary">View: {aircraftDashboardModule}</Badge>
                  </div>
                  {aircraftDashboardLoading ? (
                    <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">Loading operations telemetry…</p>
                  ) : null}
                  {aircraftDashboardError ? (
                    <p className="text-[12px] text-destructive">{aircraftDashboardError}</p>
                  ) : null}
                </div>
              ) : null}
              {showAircraftOperationsOverviewSection && showAircraftOperationsOverview ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                    <h4 className="text-[13px] font-semibold text-[hsl(var(--mdm-template-heading))]">Maintenance Schedule</h4>
                    {aircraftDashboardMaintenanceRows.length === 0 ? (
                      <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">No maintenance packages in the selected window.</p>
                    ) : (
                      <div className="grid gap-2 text-[12px]">
                        {aircraftDashboardMaintenanceRows.map((row, index) => (
                          <div key={`ops-maintenance-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1">
                            {String(row.work_package_number || row.title || 'Work package')} · {String(row.status || 'open')} · due {String(row.due_in_days ?? '-')}d
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                    <h4 className="text-[13px] font-semibold text-[hsl(var(--mdm-template-heading))]">Defect Tracking</h4>
                    {aircraftDashboardDefectRows.length === 0 ? (
                      <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">No defects reported in the selected window.</p>
                    ) : (
                      <div className="grid gap-2 text-[12px]">
                        {aircraftDashboardDefectRows.map((row, index) => (
                          <div key={`ops-defect-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1">
                            {String(row.title || 'Defect')} · {String(row.severity || 'medium')} · {String(row.status || 'open')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              {showAircraftEngineWorkspace || showAircraftComponentsWorkspace ? (
                <div className={`grid gap-4 ${showAircraftEngineWorkspace && showAircraftComponentsWorkspace ? 'xl:grid-cols-2' : ''}`}>
                  {showAircraftEngineWorkspace ? (
                    <section className="space-y-4 rounded-xl border border-[hsl(var(--mdm-template-border))] bg-gradient-to-b from-background via-background to-muted/10 p-3 md:p-4" aria-label="Engine operations workspace">
                      <div className="rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold tracking-tight text-[hsl(var(--mdm-template-heading))]">Engine Operations Command Center</h4>
                            <p className="text-xs text-[hsl(var(--mdm-template-muted))]">
                              Unified lifecycle, reliability, compliance, and performance cockpit for certified engine operations.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleExportEngineUsabilityEvents('json')}
                              aria-label="Export engine usability session events as JSON"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              Export JSON
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleExportEngineUsabilityEvents('csv')}
                              aria-label="Export engine usability session events as CSV"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                              Export CSV
                            </Button>
                            {Object.entries(aircraftDashboardEngineModule?.statuses || {}).slice(0, 3).map(([key, value]) => (
                              <Badge key={`engine-status-${key}`} variant={mapStatusToBadgeVariant(value)} className="text-[11px]">
                                {key.replace(/_/g, ' ')}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {aircraftEngineHeadlineKpis.map((item) => (
                            <div
                              key={item.label}
                              className={cn(
                                'rounded-lg border px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                                item.tone === 'warning'
                                  ? 'border-amber-300/70 bg-amber-50/70 text-amber-950'
                                  : 'border-[hsl(var(--mdm-template-border))] bg-muted/40'
                              )}
                            >
                              <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--mdm-template-muted))]">{item.label}</p>
                              <p className="mt-0.5 text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Engine workflow navigation">
                          {aircraftEngineWorkflowLanes.map((lane) => (
                            <a
                              key={lane.id}
                              href={`#${lane.id}`}
                              onClick={() => handleEngineLaneNavigation(lane.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--mdm-template-border))] bg-background px-3 py-1 text-[11px] font-medium text-[hsl(var(--mdm-template-heading))] transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span>{lane.title}</span>
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{lane.count}/{lane.total}</Badge>
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(var(--mdm-template-muted))]">Performance trend</p>
                          <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">
                            Source {String(aircraftDashboardEngineModule?.component_monitoring?.source || 'aircraft-dashboard')} ·
                            Updated {String(aircraftDashboardEngineModule?.component_monitoring?.realtime_updated_at || aircraftDashboard?.metadata?.generated_at || '').slice(0, 19).replace('T', ' ')}
                          </p>
                        </div>
                        <div className="mt-2 h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={aircraftEngineTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" />
                              <YAxis />
                              <RechartsTooltip />
                              <Line type="monotone" dataKey="tbo_remaining_hours" stroke="#2563EB" strokeWidth={2.25} dot={false} />
                              <Line type="monotone" dataKey="vibration_ips" stroke="#DC2626" strokeWidth={2.25} dot={false} />
                              <Line type="monotone" dataKey="oil_consumption_lph" stroke="#0891B2" strokeWidth={2.25} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <section id="engine-lane-maintenance" className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Maintenance Scheduling & Tracking</p>
                              <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">Prioritized queue, due horizon, conflict detection, and resource assignment control.</p>
                            </div>
                            <Badge variant="outline">Planner View</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Visible <span className="font-semibold">{filteredAircraftEngineMaintenanceRows.length}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Total <span className="font-semibold">{aircraftEngineMaintenanceRows.length}</span></div>
                          </div>
                          {filteredAircraftEngineMaintenanceRows.length === 0 ? (
                            <p className="rounded-md border border-dashed border-[hsl(var(--mdm-template-border))] px-2.5 py-2 text-[11px] text-[hsl(var(--mdm-template-muted))]">No engine schedule rows in selected window.</p>
                          ) : (
                            <div className="grid gap-1.5">
                              {filteredAircraftEngineMaintenanceRows.map((row, index) => (
                                <article
                                  key={`engine-maintenance-row-${index + 1}`}
                                  className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-2 transition-all duration-200 hover:border-primary/40 hover:bg-background"
                                  onClick={() =>
                                    endEngineUsabilityTask('engine_maintenance_next_due', 'completed', {
                                      work_package: String(row.work_package_number || row.title || ''),
                                      status: String(row.status || 'open'),
                                    })
                                  }
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">
                                      {String(row.work_package_number || row.title || `Engine work order ${index + 1}`)}
                                    </p>
                                    <Badge variant={mapStatusToBadgeVariant(String(row.status || 'open'))}>{String(row.status || 'open')}</Badge>
                                  </div>
                                  <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-[hsl(var(--mdm-template-muted))]">
                                    <span>Due in <span className="font-semibold text-foreground">{String(row.due_in_days ?? '-')}d</span></span>
                                    <span>Compliance <span className="font-semibold text-foreground">{String(row.compliance_state || 'pending')}</span></span>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            Conflicts <span className="font-semibold">{aircraftEngineMaintenanceConflicts.length}</span> · Allocations <span className="font-semibold">{aircraftEngineResourceAllocation.length}</span>
                          </div>
                          {aircraftEngineMaintenanceConflicts.length > 0 ? (
                            <div className="grid gap-1.5" role="status" aria-live="polite" aria-label="Engine maintenance conflicts">
                              {aircraftEngineMaintenanceConflicts.map((row, index) => (
                                <div key={`engine-conflict-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                                  {String(row.conflict_type || 'conflict')} · resolution {String(row.resolution || 'monitor')} · {String(row.auto_resolution_status || 'queued')}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </section>

                        <section className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Component Monitoring</p>
                              <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">Live telemetry status for dispatch readiness and predictive reliability alerts.</p>
                            </div>
                            <Badge variant="outline">Live Signal View</Badge>
                          </div>
                          {aircraftEngineRealtimeStatuses.length === 0 ? (
                            <p className="rounded-md border border-dashed border-[hsl(var(--mdm-template-border))] px-2.5 py-2 text-[11px] text-[hsl(var(--mdm-template-muted))]">No live component signals received.</p>
                          ) : (
                            <div className="grid gap-1.5">
                              {aircraftEngineRealtimeStatuses.map(([key, value], index) => (
                                <div key={`engine-realtime-status-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 transition-colors duration-150 hover:bg-background">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">{key.replace(/_/g, ' ')}</p>
                                    <Badge variant={mapStatusToBadgeVariant(String(value))}>{String(value)}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <section id="engine-lane-work-orders" className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Work Order Management</p>
                              <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">Execution flow with signature workflow and parts readiness indicators.</p>
                            </div>
                            <Badge variant="outline">Operations View</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Open <span className="font-semibold">{aircraftEngineWorkOrderTotals.open}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">In Progress <span className="font-semibold">{aircraftEngineWorkOrderTotals.in_progress}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Blocked <span className="font-semibold">{aircraftEngineWorkOrderTotals.blocked}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Completed <span className="font-semibold">{aircraftEngineWorkOrderTotals.completed}</span></div>
                          </div>
                          {aircraftEngineRecentWorkOrders.length > 0 ? (
                            <div className="grid gap-1.5">
                              {aircraftEngineRecentWorkOrders.map((row, index) => (
                                <div key={`engine-work-order-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">
                                      {String(row.work_package_number || row.title || `Work order ${index + 1}`)}
                                    </p>
                                    <Badge variant={mapStatusToBadgeVariant(String(row.status || 'open'))}>{String(row.status || 'open')}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            Digital signatures <span className="font-semibold">{aircraftEngineDigitalSignatures.completed}/{aircraftEngineDigitalSignatures.totalRequired}</span> · pending {aircraftEngineDigitalSignatures.pending}
                          </div>
                          {aircraftEnginePartsTracking.length > 0 ? (
                            <div className="grid gap-1.5">
                              {aircraftEnginePartsTracking.map((row, index) => (
                                <div key={`engine-part-track-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">{String(row.part_number || `Part ${index + 1}`)}</p>
                                    <Badge variant={mapStatusToBadgeVariant(String(row.status || 'reserved'))}>{String(row.status || 'reserved')}</Badge>
                                  </div>
                                  <p className="mt-1 text-[11px] text-[hsl(var(--mdm-template-muted))]">Quantity {String(row.quantity_issued ?? 0)}/{String(row.quantity_required ?? 0)}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </section>

                        <section id="engine-lane-compliance" className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Compliance Tracking</p>
                              <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">AD/SB obligations, regulator profile state, and standards alignment view.</p>
                            </div>
                            <Badge variant="outline">Governance View</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Ready <span className="font-semibold">{aircraftEngineComplianceSummary.readyCount}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Pending <span className="font-semibold">{aircraftEngineComplianceSummary.pendingCount}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Overdue <span className="font-semibold">{aircraftEngineComplianceSummary.overdueCount}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Compliance <span className="font-semibold">{aircraftEngineComplianceSummary.compliancePct}%</span></div>
                          </div>
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            Forecast risk <span className="font-semibold">{aircraftEnginePerformanceSummary.forecastRisk}</span> · utilization {aircraftEnginePerformanceSummary.utilizationPct}%
                          </div>
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            AD/SB pending <span className="font-semibold">{String(aircraftEngineAdSbTracking.pending_obligations ?? 0)}</span> of {String(aircraftEngineAdSbTracking.total_obligations ?? 0)}
                          </div>
                          <div className="grid gap-1.5">
                            {Object.entries(aircraftEngineRegulatoryProfiles).slice(0, 3).map(([authority, details]) => (
                              <div
                                key={`engine-regulatory-${authority}`}
                                className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5"
                                onClick={() =>
                                  endEngineUsabilityTask('engine_compliance_readiness', 'completed', {
                                    authority,
                                    status: String(((details as Record<string, unknown>) || {}).status || 'monitoring'),
                                  })
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">{authority.toUpperCase()}</p>
                                  <Badge variant={mapStatusToBadgeVariant(String(((details as Record<string, unknown>) || {}).status || 'monitoring'))}>
                                    {String(((details as Record<string, unknown>) || {}).status || 'monitoring')}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                          {aircraftEngineComplianceStandards.length > 0 ? (
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                              Standards {aircraftEngineComplianceStandards.join(', ')}
                            </div>
                          ) : null}
                        </section>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <section id="engine-lane-analytics" className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Performance Analytics</p>
                              <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">Predictive failure profile, anomaly trend, and read-model coverage.</p>
                            </div>
                            <Badge variant="outline">Intelligence View</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Anomaly Index <span className="font-semibold">{aircraftEnginePerformanceSummary.anomalyIndex}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Trend Points <span className="font-semibold">{aircraftEnginePerformanceSummary.trendSummary.length || aircraftEngineTrend.length}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Prediction <span className="font-semibold">{String(aircraftEngineFailurePrediction.risk_score || 0)}</span></div>
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2">Confidence <span className="font-semibold">{String(aircraftEngineFailurePrediction.confidence_pct || 0)}%</span></div>
                          </div>
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            Detected anomalies <span className="font-semibold">{aircraftEngineAnomalies.length}</span> · read model assets <span className="font-semibold">{aircraftEngineAssets.length}</span>
                          </div>
                          {aircraftEnginePerformanceMiniChartRows.length > 0 ? (
                            <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5" role="img" aria-label="Engine performance mini chart">
                              <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">Performance History Mini-Chart</p>
                              <div className="grid gap-0.5 font-mono text-[11px]">
                                {aircraftEnginePerformanceMiniChartRows.map((row, index) => (
                                  <div key={`engine-mini-chart-row-${index + 1}`}>{row}</div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {aircraftEngineReadModelError ? (
                            <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                              Engine read-model warning: {aircraftEngineReadModelError}
                            </div>
                          ) : null}
                          {aircraftEngineAnomalies.length > 0 ? (
                            <div className="grid gap-1.5" role="status" aria-live="polite" aria-label="Engine anomaly detections">
                              {aircraftEngineAnomalies.map((row, index) => (
                                <div
                                  key={`engine-anomaly-row-${index + 1}`}
                                  className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]"
                                  onClick={() =>
                                    endEngineUsabilityTask('engine_anomaly_review', 'completed', {
                                      signal_type: String(row.signal_type || 'signal'),
                                      anomaly_score: String(row.anomaly_score || 0),
                                    })
                                  }
                                >
                                  {String(row.signal_type || 'signal')} · score {String(row.anomaly_score || 0)} · z {String(row.z_score || 0)}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </section>

                        <section className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                          <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Integration & Validation Mesh</p>
                          {aircraftEngineIntegrationRows.length === 0 ? (
                            <p className="rounded-md border border-dashed border-[hsl(var(--mdm-template-border))] px-2.5 py-2 text-[11px] text-[hsl(var(--mdm-template-muted))]">No integration adapters reported.</p>
                          ) : (
                            <div className="grid gap-1.5">
                              {aircraftEngineIntegrationRows.map((row, index) => (
                                <div key={`engine-integration-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                                  {String(row.system || row.name || 'Integration')} · {String(row.direction || 'bi-directional')} · {String(row.protocol || 'rest')} · {String(row.status || 'active')} · latency {String(row.latency_ms ?? '-')}ms
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            Channels REST {String(aircraftEngineIntegrationResilience.rest_channels || 0)} · MQ {String(aircraftEngineIntegrationResilience.message_queue_channels || 0)} · retry backlog {String(aircraftEngineIntegrationResilience.retry_backlog || 0)}
                          </div>
                          <div className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/40 px-2.5 py-2 text-[11px]">
                            Circuit breaker {String(((aircraftEngineIntegrationResilience.circuit_breaker as Record<string, unknown>) || {}).state || 'closed')} · threshold {String(((aircraftEngineIntegrationResilience.circuit_breaker as Record<string, unknown>) || {}).failure_threshold || 0)} · retry {String(((aircraftEngineIntegrationResilience.retry_policy as Record<string, unknown>) || {}).attempts || 0)}
                          </div>
                          {Object.keys(aircraftEngineStandardsAlignment).length > 0 ? (
                            <div className="grid gap-1.5">
                              {Object.entries(aircraftEngineStandardsAlignment).map(([key, value]) => (
                                <div key={`engine-standard-alignment-${key}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                                  {key.replace(/_/g, ' ').toUpperCase()}: {String(value)}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {Object.keys(aircraftEngineValidationLayers).length > 0 ? (
                            <div className="grid gap-1.5">
                              {Object.entries(aircraftEngineValidationLayers).map(([key, value]) => (
                                <div key={`engine-validation-layer-${key}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                                  {key.replace(/_/g, ' ')}: {String(value)}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </section>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <section className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm">
                          <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Lifecycle & Configuration Records</p>
                          {aircraftEngineLifecycleRows.length === 0 ? (
                            <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">No lifecycle records in selected window.</p>
                          ) : (
                            <div className="grid gap-1.5">
                              {aircraftEngineLifecycleRows.map((row, index) => (
                                <div key={`engine-lifecycle-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                                  {String(row.asset || row.registration || row.aircraft_id || 'Engine asset')} · {String(row.phase || row.lifecycle_stage || 'active')} · due {String(row.next_event_due_in_days ?? '-')}d · health {String(row.health_score ?? '-')}
                                </div>
                              ))}
                            </div>
                          )}
                          {aircraftEngineConfigurationRows.length === 0 ? (
                            <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">No engine configuration entries available.</p>
                          ) : (
                            <div className="grid gap-1.5">
                              {aircraftEngineConfigurationRows.map((row, index) => (
                                <div key={`engine-configuration-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2.5 py-1.5 text-[11px]">
                                  {String(row.engine_serial_number || row.serial_number || row.engine || `Engine ${index + 1}`)}
                                  {' · '}position {String(row.engine_position || row.position || '-')}
                                  {' · '}TSN {String(row.tsn ?? '-')}
                                  {' · '}CSN {String(row.csn ?? '-')}
                                  {' · '}module {String(row.module || row.module_name || '-')}
                                </div>
                              ))}
                            </div>
                          )}
                        </section>

                        <section className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm">
                          <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Serialized Tracking & Thrust Records</p>
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="space-y-1 rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 p-2">
                              <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">Serialized Engines</p>
                              {aircraftEngineSerializedTrackingRows.length === 0 ? (
                                <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">No serialized records.</p>
                              ) : (
                                aircraftEngineSerializedTrackingRows.map((row, index) => (
                                  <div key={`engine-serialized-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1 text-[11px]">
                                    {String(row.engine_serial_number || row.serial_number || `Engine ${index + 1}`)} · {String(row.engine_position || 'position n/a')}
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-1 rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 p-2">
                              <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">Thrust Rating Changes</p>
                              {aircraftEngineThrustRatingRows.length === 0 ? (
                                <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">No thrust changes.</p>
                              ) : (
                                aircraftEngineThrustRatingRows.map((row, index) => (
                                  <div key={`engine-thrust-rating-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1 text-[11px]">
                                    {String(row.engine_serial_number || `Engine ${index + 1}`)} · {String(row.rated_thrust ?? '-')} · {String(row.derate_mode || 'normal')}
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-1 rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 p-2">
                              <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">On-Wing Timeline</p>
                              {aircraftEngineOnWingLifecycleRows.length === 0 ? (
                                <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">No on-wing events.</p>
                              ) : (
                                aircraftEngineOnWingLifecycleRows.map((row, index) => (
                                  <div key={`engine-on-wing-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1 text-[11px]">
                                    {String(row.engine_serial_number || row.asset || `Engine ${index + 1}`)} · {String(row.event_type || 'event')} · {String(row.event_status || 'logged')}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 text-[12px]">
                            <p className="text-[11px] font-medium text-[hsl(var(--mdm-template-heading))]">Engine Drill-down</p>
                            {aircraftEngineDefectDrivers.length === 0 ? (
                              <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">No defect drivers in selected window.</p>
                            ) : (
                              aircraftEngineDefectDrivers.map((row, index) => (
                                <div key={`engine-driver-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 px-2 py-1 text-[11px]">
                                  {String(row.title || 'Engine anomaly')} · {String(row.severity || 'medium')} · due {String(row.due_in_days ?? '-')}d
                                </div>
                              ))
                            )}
                          </div>
                        </section>
                      </div>

                      <section className="space-y-2 rounded-lg border border-[hsl(var(--mdm-template-border))] bg-card/80 p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[hsl(var(--mdm-template-heading))]">Engine Data Entry (Validated)</p>
                          <Badge variant="outline">Operator Assisted</Badge>
                        </div>
                        <form
                          className="grid gap-2 md:grid-cols-5"
                          onSubmit={handleSubmitEngineDataEntry}
                          onFocusCapture={() => startEngineUsabilityTask('engine_data_entry_validation', { source: 'form_focus' })}
                        >
                          <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="engine-entry-serial" className="text-[11px]">Engine Serial</Label>
                            <Input
                              id="engine-entry-serial"
                              value={engineEntrySerial}
                              onChange={(event) => setEngineEntrySerial(event.target.value)}
                              placeholder="ENG-1001"
                              aria-label="Engine serial input"
                              className="transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            {engineEntryErrors.serial ? <p className="text-[11px] text-destructive">{engineEntryErrors.serial}</p> : null}
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="engine-entry-position" className="text-[11px]">Position</Label>
                            <Select value={engineEntryPosition} onValueChange={(value) => setEngineEntryPosition(value as 'L' | 'R' | 'C' | 'AUX')}>
                              <SelectTrigger id="engine-entry-position" aria-label="Engine position input" className="focus-visible:ring-2 focus-visible:ring-primary">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="L">L</SelectItem>
                                <SelectItem value="R">R</SelectItem>
                                <SelectItem value="C">C</SelectItem>
                                <SelectItem value="AUX">AUX</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="engine-entry-module" className="text-[11px]">Module</Label>
                            <Input
                              id="engine-entry-module"
                              value={engineEntryModule}
                              onChange={(event) => setEngineEntryModule(event.target.value)}
                              placeholder="CORE"
                              aria-label="Engine module input"
                              className="transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            {engineEntryErrors.module ? <p className="text-[11px] text-destructive">{engineEntryErrors.module}</p> : null}
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="engine-entry-tsn" className="text-[11px]">TSN</Label>
                            <Input
                              id="engine-entry-tsn"
                              value={engineEntryTsn}
                              onChange={(event) => setEngineEntryTsn(event.target.value)}
                              placeholder="12440"
                              aria-label="Engine TSN input"
                              className="transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            {engineEntryErrors.tsn ? <p className="text-[11px] text-destructive">{engineEntryErrors.tsn}</p> : null}
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="engine-entry-csn" className="text-[11px]">CSN</Label>
                            <Input
                              id="engine-entry-csn"
                              value={engineEntryCsn}
                              onChange={(event) => setEngineEntryCsn(event.target.value)}
                              placeholder="8421"
                              aria-label="Engine CSN input"
                              className="transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            {engineEntryErrors.csn ? <p className="text-[11px] text-destructive">{engineEntryErrors.csn}</p> : null}
                          </div>
                          <div className="md:col-span-5 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-[hsl(var(--mdm-template-muted))]">
                              Validate engine identity and usage counters before generating regulated maintenance tasks.
                            </p>
                            <Button type="submit" size="sm" disabled={engineEntrySubmitting} aria-busy={engineEntrySubmitting}>
                              {engineEntrySubmitting ? 'Validating…' : 'Validate Entry'}
                            </Button>
                          </div>
                        </form>
                      </section>
                    </section>
                  ) : null}
                  {showAircraftComponentsWorkspace ? (
                    <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[13px] font-semibold text-[hsl(var(--mdm-template-heading))]">Components Monitoring</h4>
                        <div className="flex items-center gap-1">
                          {Object.entries(aircraftDashboardComponentsModule?.statuses || {}).slice(0, 3).map(([key, value]) => (
                            <Badge key={`component-status-${key}`} variant={mapStatusToBadgeVariant(value)}>
                              {key.replace(/_/g, ' ')}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[12px]">
                        <div className="rounded-md bg-muted/40 p-2">AD/SB Compliance: <span className="font-semibold">{String(aircraftDashboardComponentsModule?.kpis?.ad_sb_compliance_pct ?? 0)}%</span></div>
                        <div className="rounded-md bg-muted/40 p-2">AD/SB Pending: <span className="font-semibold">{String(aircraftDashboardComponentsModule?.kpis?.ad_sb_pending_count ?? 0)}</span></div>
                        <div className="rounded-md bg-muted/40 p-2">MTBUR: <span className="font-semibold">{String(aircraftDashboardComponentsModule?.kpis?.mtbur_hours ?? 0)}h</span></div>
                        <div className="rounded-md bg-muted/40 p-2">Repeat Defect: <span className="font-semibold">{String(aircraftDashboardComponentsModule?.kpis?.repeat_discrepancy_rate ?? 0)}%</span></div>
                      </div>
                      <div className="h-[210px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aircraftComponentsTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="replacements" fill="#0EA5E9" />
                            <Bar dataKey="compliance_breaches" fill="#F97316" />
                            <Bar dataKey="defects_opened" fill="#EF4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid gap-2 text-[12px] md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="font-medium text-[hsl(var(--mdm-template-heading))]">Lifecycle Tracking</p>
                          {filteredAircraftComponentLifecycleRows.length === 0 ? (
                            <p className="text-[hsl(var(--mdm-template-muted))]">No lifecycle rows in selected window.</p>
                          ) : (
                            filteredAircraftComponentLifecycleRows.map((row, index) => (
                              <div key={`component-lifecycle-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1">
                                {String(row.title || 'Component')} · {String(row.compliance_state || 'pending')} · due {String(row.due_in_days ?? '-')}d
                              </div>
                            ))
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-[hsl(var(--mdm-template-heading))]">Replacement History</p>
                          {aircraftComponentReplacementRows.length === 0 ? (
                            <p className="text-[hsl(var(--mdm-template-muted))]">No replacement history in selected window.</p>
                          ) : (
                            aircraftComponentReplacementRows.map((row, index) => (
                              <div key={`component-replacement-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1">
                                {String(row.title || 'Replacement')} · {String(row.status || 'open')} · {String(row.reported_at || '').slice(0, 10)}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showAircraftDocumentsWorkspace ? (
                <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[13px] font-semibold text-[hsl(var(--mdm-template-heading))]">Document Repository</h4>
                    <Badge variant="secondary">{filteredAircraftDocumentRows.length} records</Badge>
                  </div>
                  <div className="grid gap-2 text-[12px] md:grid-cols-3">
                    <div className="rounded-md bg-muted/40 p-2">Maintenance Docs: <span className="font-semibold">{aircraftDashboardMaintenanceRows.length}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">Component Records: <span className="font-semibold">{aircraftComponentReplacementRows.length}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">Defect Reports: <span className="font-semibold">{aircraftDashboardDefectRows.length}</span></div>
                  </div>
                  <div className="grid gap-2 text-[12px]">
                    {filteredAircraftDocumentRows.length === 0 ? (
                      <p className="text-[hsl(var(--mdm-template-muted))]">No documents available in the selected window.</p>
                    ) : (
                      filteredAircraftDocumentRows.map((row, index) => (
                        <div key={`doc-row-${index + 1}`} className="grid grid-cols-12 gap-2 rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1">
                          <span className="col-span-6">{row.title}</span>
                          <span className="col-span-2 text-[hsl(var(--mdm-template-muted))]">{row.category}</span>
                          <span className="col-span-2 text-[hsl(var(--mdm-template-muted))]">{row.status}</span>
                          <span className="col-span-2 text-right text-[hsl(var(--mdm-template-muted))]">{row.date || '-'}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => handleAircraftContextNavigation('/dashboard/amro/settings/work-package-templates')}>
                      Open Template Records
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportAircraftOpsReport}>
                      Export Document Snapshot
                    </Button>
                  </div>
                </div>
              ) : null}
              {showAircraftAdSbWorkspace ? (
                <div className="space-y-3 rounded-md border border-[hsl(var(--mdm-template-border))] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[13px] font-semibold text-[hsl(var(--mdm-template-heading))]">AD/SB Compliance Management</h4>
                    <Badge variant={Number(aircraftDashboardComponentsModule?.kpis?.ad_sb_pending_count || 0) > 0 ? 'destructive' : 'secondary'}>
                      Pending {String(aircraftDashboardComponentsModule?.kpis?.ad_sb_pending_count ?? 0)}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-[12px] md:grid-cols-3">
                    <div className="rounded-md bg-muted/40 p-2">Compliance %: <span className="font-semibold">{String(aircraftDashboardComponentsModule?.kpis?.ad_sb_compliance_pct ?? 0)}%</span></div>
                    <div className="rounded-md bg-muted/40 p-2">Tracked Components: <span className="font-semibold">{String(aircraftDashboardComponentsModule?.kpis?.tracked_components ?? 0)}</span></div>
                    <div className="rounded-md bg-muted/40 p-2">Pending Directives: <span className="font-semibold">{filteredAircraftAdSbRows.length}</span></div>
                  </div>
                  <div className="space-y-1 text-[12px]">
                    {filteredAircraftAdSbRows.length === 0 ? (
                      <p className="text-[hsl(var(--mdm-template-muted))]">No pending AD/SB directives in the selected window.</p>
                    ) : (
                      filteredAircraftAdSbRows.map((row, index) => (
                        <div key={`ad-sb-row-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1">
                          {String(row.title || 'Directive')} · {String(row.compliance_state || 'pending')} · due {String(row.due_in_days ?? '-')}d
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => handleAircraftContextNavigation('/dashboard/amro/compliance')}>
                      Open AD/SB Registry
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportAircraftOpsReport}>
                      Export AD/SB Report
                    </Button>
                  </div>
                </div>
              ) : null}
              {visibleAircraftAlerts.length > 0 ? (
                <div className="space-y-2 rounded-md border border-[hsl(var(--mdm-template-border))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[13px] font-semibold text-[hsl(var(--mdm-template-heading))]">Automated Alerts</h4>
                  <Badge variant="secondary">{visibleAircraftAlerts.length} active</Badge>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {visibleAircraftAlerts.slice(0, 8).map((alert, index) => (
                    <div key={`alert-${index + 1}`} className="rounded-md border border-[hsl(var(--mdm-template-border))] px-2 py-1 text-[12px]">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={mapStatusToBadgeVariant(alert.severity)}>{String(alert.severity || 'normal')}</Badge>
                        <span className="text-[hsl(var(--mdm-template-muted))]">Due {String(alert.due_in_days ?? '-')}d</span>
                      </div>
                      <p className="pt-1 text-[hsl(var(--mdm-template-heading))]">{String(alert.message || '')}</p>
                    </div>
                  ))}
                </div>
                {aircraftComponentsOpenDefects.length > 0 && showAircraftComponentsWorkspace ? (
                  <div className="rounded-md border border-[hsl(var(--mdm-template-border))] p-2 text-[12px]">
                    <p className="font-medium text-[hsl(var(--mdm-template-heading))]">Reliability Drill-down</p>
                    <div className="grid gap-1 pt-1 md:grid-cols-2">
                      {aircraftComponentsOpenDefects.slice(0, 4).map((row, index) => (
                        <span key={`component-defect-${index + 1}`}>
                          {String(row.title || 'Component discrepancy')} · {String(row.severity || 'medium')} · {String(row.status || 'open')}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {showAircraftLeadWorkspace ? (
          <AircraftLeadsManager
            scope={scope}
            sessionAccessToken={sessionAccessToken}
            canManage={canManageAircraftLeads}
            canDelete={canDeleteAircraftLeads}
            activeTab={aircraftLeadsActiveTab}
            onActiveTabChange={setAircraftLeadsActiveTab}
          />
        ) : null}
        {showAircraftTemplatesWorkspace ? (
          <Card className="mdm-template-panel">
            <CardHeader className="mdm-template-panel-head">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="mdm-template-panel-title">Aircraft Template Registry</CardTitle>
                <Badge variant="secondary">{filteredAircraftTemplateRows.length} templates</Badge>
              </div>
            </CardHeader>
            <CardContent className="mdm-template-panel-body space-y-3">
              <AircraftListingControls
                searchValue={aircraftUnifiedSearch}
                onSearchChange={setAircraftUnifiedSearch}
                searchPlaceholder={aircraftUnifiedLabels.searchPlaceholder}
                searchAriaLabel={aircraftUnifiedLabels.searchAriaLabel}
                statusValue={aircraftUnifiedStatusFilter}
                onStatusChange={setAircraftUnifiedStatusFilter}
                statusAriaLabel={aircraftUnifiedLabels.statusAriaLabel}
                statusOptions={aircraftUnifiedStatusOptions}
                clearFiltersLabel={aircraftUnifiedLabels.clearFilters}
                onClearFilters={clearAircraftUnifiedFilters}
                createLabel="New"
                createAriaLabel={aircraftSubModuleCreateActionLabel}
                onCreate={handleAircraftSubModuleCreateAction}
                createDisabled={!canOpenAircraftSubModuleCreateAction}
                createLoading={isAircraftSubModuleCreateActionLoading}
                resultSummaryText={`${aircraftUnifiedResultSummary.visible}/${aircraftUnifiedResultSummary.total} ${aircraftUnifiedLabels.resultLabel}`}
              />
              {aircraftTemplateError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {aircraftTemplateError}
                </div>
              ) : null}
              <div className="overflow-auto rounded-md border">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead className="w-[220px] px-3 py-2">Template Name</TableHead>
                      <TableHead className="w-[120px] px-3 py-2">Aircraft Type</TableHead>
                      <TableHead className="w-[160px] px-3 py-2">Manufacturer</TableHead>
                      <TableHead className="w-[160px] px-3 py-2">Model</TableHead>
                      <TableHead className="w-[140px] px-3 py-2">Program</TableHead>
                      <TableHead className="w-[120px] px-3 py-2">Revision</TableHead>
                      <TableHead className="w-[130px] px-3 py-2">Amendment</TableHead>
                      <TableHead className="w-[150px] px-3 py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAircraftTemplateRows.length === 0 && !aircraftTemplateLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No aircraft templates found.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {filteredAircraftTemplateRows.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="px-3 py-2">{template.template_name || '-'}</TableCell>
                        <TableCell className="px-3 py-2">{template.aircraft_type || '-'}</TableCell>
                        <TableCell className="px-3 py-2">{template.manufacturer || '-'}</TableCell>
                        <TableCell className="px-3 py-2">{template.aircraft_model || '-'}</TableCell>
                        <TableCell className="px-3 py-2">{template.maintenance_program || '-'}</TableCell>
                        <TableCell className="px-3 py-2">{template.revision_number || '-'}</TableCell>
                        <TableCell className="px-3 py-2">{template.amendment_number || '-'}</TableCell>
                        <TableCell className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => openEditAircraftTemplateDialog(template)} disabled={!canManageAircraftTemplates}>
                              Edit
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => openDeleteAircraftTemplateDialog(template)} disabled={!canDeleteAircraftTemplates}>
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {showAircraftMasterRecords && !(entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule) ? (
        <Card className="mdm-template-panel">
          <CardHeader className="mdm-template-panel-head">
            <CardTitle className="mdm-template-panel-title">{ENTITY_LABEL[entity]} Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="mdm-template-panel-body mdm-template-grid-five">
            {entity === 'flight_logs' ? (
              <FlightLogsFilters
                flightDateFrom={flightDateFrom}
                setFlightDateFrom={setFlightDateFrom}
                flightDateTo={flightDateTo}
                setFlightDateTo={setFlightDateTo}
                flightAircraftFilter={flightAircraftFilter}
                setFlightAircraftFilter={setFlightAircraftFilter}
                flightPilotFilter={flightPilotFilter}
                setFlightPilotFilter={setFlightPilotFilter}
                flightRegistrationFilter={flightRegistrationFilter}
                setFlightRegistrationFilter={setFlightRegistrationFilter}
                flightNumberFilter={flightNumberFilter}
                setFlightNumberFilter={setFlightNumberFilter}
              />
            ) : null}
          </CardContent>
        </Card>
        ) : null}

        {showAircraftMasterRecords ? (
        <Card className="mdm-template-panel">
          <CardHeader className="mdm-template-panel-head">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="mdm-template-panel-title">{ENTITY_LABEL[entity]} Records</CardTitle>
              {entity === 'aircraft' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8 w-full sm:w-auto" aria-label="Select aircraft fields">
                      <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Fields
                      <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                        {aircraftHeaderColumns.length}/{tableColumns.length}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[280px]">
                    <DropdownMenuLabel>Select visible fields</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {tableColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={`aircraft-column-${column}`}
                        checked={aircraftColumnSelectionSet.has(column)}
                        onCheckedChange={(checked) => handleAircraftColumnToggle(column, Boolean(checked))}
                        onSelect={(event) => event.preventDefault()}
                      >
                        {getColumnLabel(column)}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        resetAircraftColumnSelection();
                      }}
                    >
                      Reset to default fields
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="mdm-template-panel-body space-y-3">
            <AircraftDataTableFrame
              controls={
                entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule
                  ? (
                    <AircraftListingControls
                      searchValue={aircraftUnifiedSearch}
                      onSearchChange={setAircraftUnifiedSearch}
                      searchPlaceholder={aircraftUnifiedLabels.searchPlaceholder}
                      searchAriaLabel={aircraftUnifiedLabels.searchAriaLabel}
                      statusValue={aircraftUnifiedStatusFilter}
                      onStatusChange={setAircraftUnifiedStatusFilter}
                      statusAriaLabel={aircraftUnifiedLabels.statusAriaLabel}
                      statusOptions={aircraftUnifiedStatusOptions}
                      clearFiltersLabel={aircraftUnifiedLabels.clearFilters}
                      onClearFilters={clearAircraftUnifiedFilters}
                      createLabel="New"
                      createAriaLabel={aircraftSubModuleCreateActionLabel}
                      onCreate={handleAircraftSubModuleCreateAction}
                      createDisabled={!canOpenAircraftSubModuleCreateAction}
                      createLoading={isAircraftSubModuleCreateActionLoading}
                      resultSummaryText={`${aircraftUnifiedResultSummary.visible}/${aircraftUnifiedResultSummary.total} ${aircraftUnifiedLabels.resultLabel}`}
                    />
                  )
                  : (
                    <AircraftListingControls
                      searchValue={search}
                      onSearchChange={setSearch}
                      searchPlaceholder={masterDataControlsLabels.searchPlaceholder}
                      searchAriaLabel={masterDataControlsLabels.searchAriaLabel}
                      statusValue={statusFilter}
                      onStatusChange={setStatusFilter}
                      statusAriaLabel={masterDataControlsLabels.statusAriaLabel}
                      statusOptions={masterDataStatusOptions}
                      clearFiltersLabel={masterDataControlsLabels.clearFilters}
                      onClearFilters={clearMasterDataControls}
                      createLabel={`New ${ENTITY_LABEL[entity]}`}
                      createAriaLabel={`New ${ENTITY_LABEL[entity]}`}
                      onCreate={handleOpenCreateModal}
                      createLoading={busyAction === 'create'}
                      resultSummaryText={`${renderedRows.length}/${rows.length} ${masterDataControlsLabels.resultLabel}`}
                    />
                  )
              }
              beforeContent={
                !(entity === 'aircraft' && aircraftEnhancementEnabled && isAircraftSubModule) && masterDataSecondaryControls ? (
                  <div className="border-b border-[hsl(var(--mdm-template-border))] bg-background/60 p-2">
                    {masterDataSecondaryControls}
                  </div>
                ) : null
              }
            >
                <Table className="table-fixed">
                  <colgroup>
                    <col className="w-[52px]" />
                    {entity === 'aircraft' ? <col className="w-[180px]" /> : null}
                    {(entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).map((column) => (
                      <col key={`col-${column}`} className="w-[180px]" />
                    ))}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead className="sticky top-0 z-20 w-[52px] bg-[#F8FAFC] px-3 py-2">
                        <Checkbox
                          checked={allRowsSelected ? true : someRowsSelected ? 'indeterminate' : false}
                          onCheckedChange={(value) => toggleSelectAllRows(Boolean(value))}
                          aria-label="Select all rows"
                        />
                      </TableHead>
                      {entity === 'aircraft' ? (
                        <TableHead className="sticky top-0 z-20 h-auto w-[180px] bg-[#F8FAFC] px-3 py-2 text-left text-[13px] font-semibold text-[#64748B]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center">
                                <ListChecks className="h-4 w-4" aria-label="Flight Logs column" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Flight Logs</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      ) : null}
                      {(entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).map((column) => (
                        <TableHead key={column} className="sticky top-0 z-20 h-auto w-[180px] bg-[#F8FAFC] px-3 py-2 text-left text-[13px] font-semibold text-[#64748B]">
                          <button type="button" className="flex w-full items-center justify-between gap-2 text-left transition-colors hover:text-[hsl(var(--mdm-template-focus))]" onClick={() => toggleSort(column)}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate">{getColumnLabel(column)}</span>
                              </TooltipTrigger>
                              <TooltipContent>{getColumnLabel(column)}</TooltipContent>
                            </Tooltip>
                            {renderSortIcon(column)}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                    {supportsColumnHeaderFilters ? (
                      <TableRow className="bg-white">
                        <TableHead className="sticky top-[41px] z-10 bg-white px-3 py-2 text-[12px] font-medium text-[#94A3B8]">Filter</TableHead>
                        {entity === 'aircraft' ? <TableHead className="sticky top-[41px] z-10 bg-white px-3 py-2" /> : null}
                        {(entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).map((column) => (
                          <TableHead key={`filter-${column}`} className="sticky top-[41px] z-10 bg-white px-3 py-2">
                            <Input
                              value={columnFilters[column] || ''}
                              onChange={(event) => setColumnFilterValue(column, event.target.value)}
                              placeholder={`Filter ${getColumnLabel(column)}`}
                              className="h-8 mdm-template-input"
                              aria-label={`Filter ${getColumnLabel(column)}`}
                            />
                          </TableHead>
                        ))}
                      </TableRow>
                    ) : null}
                  </TableHeader>
                  <TableBody>
                    {renderedRows.map((row, rowIndex) => (
                      <TableRow
                        key={row.id}
                        data-state={row.id === selectedId ? 'selected' : undefined}
                        className={cn(
                          'cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#F1F7FF]',
                          rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]',
                          row.id === selectedId && 'bg-[hsl(var(--mdm-template-focus))/0.12]',
                          selectedRowIds.includes(row.id) && 'ring-1 ring-[hsl(var(--mdm-template-focus))/0.55] ring-inset',
                        )}
                        onClick={(event) => handleRowSingleClick(row, event)}
                        onDoubleClick={() => handleRowDoubleClick(row)}
                      >
                        <TableCell className="px-3 py-2 align-middle">
                          <Checkbox
                            checked={selectedRowIds.includes(row.id)}
                            onCheckedChange={(value) => toggleRowSelection(row.id, Boolean(value))}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Select row ${row.id}`}
                          />
                        </TableCell>
                        {entity === 'aircraft' ? (
                          <TableCell className="px-3 py-2 align-middle">
                            <div className="flex items-center gap-2">
                              <DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={`Flight Logs actions for ${String(row.tail_number || row.registration || row.id)}`}
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <ListChecks className="h-4 w-4" aria-hidden="true" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>Flight Logs</TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      openAircraftFlightLogsList(String(row.id));
                                    }}
                                  >
                                    <Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                    View Logs
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      openFlightLogDialog(String(row.id));
                                    }}
                                  >
                                    <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                    Add Log
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <div
                                className="flex items-center -space-x-2"
                                role="group"
                                aria-label={`Collaborators for aircraft ${String(row.tail_number || row.registration || row.id)}`}
                                aria-busy={aircraftPresenceLoading}
                                data-presence-error={aircraftPresenceError ? 'true' : 'false'}
                              >
                                {(aircraftPresenceByRowId[row.id] || []).map((collaborator) => (
                                  <Tooltip key={`${row.id}-${collaborator.id}`}>
                                    <TooltipTrigger asChild>
                                      <Avatar className={cn('h-7 w-7 border-2 border-white', collaborator.badgeClass)}>
                                        <AvatarFallback className={cn('text-[10px] font-semibold text-white', collaborator.badgeClass)}>
                                          {collaborator.initials}
                                        </AvatarFallback>
                                      </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="flex flex-col gap-0.5">
                                        <span>{collaborator.name} · {collaborator.role}</span>
                                        {collaborator.latestFlightNumber || collaborator.latestFlightDate || collaborator.latestRoute ? (
                                          <span className="text-[11px] text-[hsl(var(--mdm-template-muted))]">
                                            {[collaborator.latestFlightNumber, collaborator.latestFlightDate, collaborator.latestRoute].filter(Boolean).join(' • ')}
                                          </span>
                                        ) : null}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        ) : null}
                        {(entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).map((column) => (
                          <TableCell key={column} className="w-[180px] px-3 py-2 text-left align-middle text-[13px] text-[#1F2937]">
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="group w-full" onDoubleClick={(event) => {
                                  if (entity === 'aircraft' && AIRCRAFT_EDITABLE_COLUMNS.has(column)) {
                                    event.stopPropagation();
                                    handleInlineEditStart(row.id, column, row[column]);
                                  }
                                }}>
                                  {inlineEditingCell?.rowId === row.id && inlineEditingCell.column === column ? (
                                    <Input
                                      value={inlineEditValue}
                                      onChange={(event) => setInlineEditValue(event.target.value)}
                                      onBlur={() => void handleInlineEditCommit()}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                          void handleInlineEditCommit();
                                        }
                                        if (event.key === 'Escape') {
                                          event.preventDefault();
                                          cancelInlineEdit();
                                        }
                                      }}
                                      autoFocus
                                      className="h-8 mdm-template-input"
                                    />
                                  ) : column === 'id' ? (
                                    <Link
                                      to={`/dashboard/amro/settings/master-data/${ENTITY_ROUTE_SEGMENT[entity]}?selected=${row.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex max-w-full items-center gap-1 truncate text-[hsl(var(--mdm-template-focus))] underline-offset-4 transition-colors hover:underline"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <span className="truncate">{resolveTableCellValue(row, column)}</span>
                                    </Link>
                                  ) : (
                                    <span className="block truncate">{resolveTableCellValue(row, column)}</span>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuLabel>{getColumnLabel(column)}</ContextMenuLabel>
                                <ContextMenuItem onSelect={() => handleRowDoubleClick(row)}>
                                  {entity === 'flight_logs' ? 'Open Detail' : 'Open Form'}
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onSelect={() => {
                                    void navigator.clipboard?.writeText(String(row[column] ?? ''));
                                    toast.success('Cell value copied');
                                  }}
                                >
                                  Copy Value
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onSelect={() => {
                                    if (entity === 'aircraft' && AIRCRAFT_EDITABLE_COLUMNS.has(column)) {
                                      handleInlineEditStart(row.id, column, row[column]);
                                    }
                                  }}
                                >
                                  Inline Edit
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </AircraftDataTableFrame>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Selection Summary: Active Record {selectedRecordLabel} | Checked: {selectedRowIds.length} | Records: {renderedRows.length}
              </p>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleExportSelectedCsv} disabled={!selectedRowIds.length} aria-label="Export selected records">
                      <FileUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export Selected</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setSelectedRowIds([])} disabled={!selectedRowIds.length} aria-label="Clear selected records">
                      <CheckSquare className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear Selection</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" onClick={() => void handleDeleteSelected()} disabled={!selectedRowIds.length} aria-label="Delete selected records">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Selected</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage((previous) => Math.max(1, previous - 1))}>Previous</Button>
                <Badge variant="secondary">Page {page}</Badge>
                <Button variant="outline" onClick={() => setPage((previous) => previous + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        ) : null}

        <div className="grid gap-4">
          <Card className="mdm-template-panel">
            <CardHeader className="mdm-template-panel-head">
              <CardTitle className="mdm-template-panel-title">{ENTITY_LABEL[entity]} Bulk Import</CardTitle>
            </CardHeader>
            <CardContent className="mdm-template-panel-body space-y-3">
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
              <Textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} rows={14} className="mdm-template-input min-h-[200px]" />
              <Button onClick={() => void handleBulkImport()}>Run Bulk Import</Button>
            </CardContent>
          </Card>
        </div>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="mdm-template-dialog mdm-template-dialog-large" data-testid="amro-master-data-form-dialog">
            <DialogHeader className="border-b border-[hsl(var(--mdm-template-border))] px-6 py-4">
              <DialogTitle className="text-[15px] font-semibold text-[hsl(var(--mdm-template-heading))]">
                {modalMode === 'create' ? `Create ${ENTITY_LABEL[entity]}` : `Update ${ENTITY_LABEL[entity]}`}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[hsl(var(--mdm-template-muted))]">
                Double-click row behavior and CRUD flow mirrors Leads Management interaction patterns.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 px-6 pb-6 pt-4">
              {entity === 'aircraft' ? (
                <AircraftCreateDialogSection
                  aircraftRequiredProgress={aircraftRequiredProgress}
                  collaborationIndicator={collaborationIndicator}
                  aircraftValidationSummary={aircraftValidationSummary}
                  aircraftTemplateModel={aircraftTemplateModel}
                  aircraftTenantValue={activeAircraftTenantId}
                  aircraftFranchiseValue={activeAircraftFranchiseId}
                  aircraftListboxOptionsLoading={aircraftListboxOptionsLoading}
                  aircraftTenantOptionsLoading={aircraftTenantOptionsLoading}
                  aircraftFranchiseOptionsLoading={aircraftFranchiseOptionsLoading}
                  aircraftTenantOptionsError={aircraftTenantOptionsError}
                  aircraftFranchiseOptionsError={aircraftFranchiseOptionsError}
                  isSystemSelectValue={isSystemSelectValue}
                  setAircraftTemplateModel={setAircraftTemplateModel}
                  setAircraftTenantValue={setAircraftTenantValue}
                  setAircraftFranchiseValue={setAircraftFranchiseValue}
                  setAircraftAuxField={setAircraftAuxField}
                  systemTemplateModelOptions={systemTemplateModelOptions}
                  franchiseAssemblyModelOptions={franchiseAssemblyModels}
                  setFieldValue={setFieldValue}
                  hydrateAircraftCountersFromTemplate={hydrateAircraftCountersFromTemplate}
                  systemTemplateModelSelectOptions={systemTemplateModelSelectOptions}
                  franchiseAssemblyModelSelectOptions={franchiseAssemblyModelSelectOptions}
                  aircraftTenantSelectOptions={aircraftTenantSelectOptions}
                  aircraftFranchiseSelectOptions={aircraftFranchiseSelectOptions}
                  disableAircraftFranchiseSelection={!activeAircraftTenantId}
                  disableAircraftModelSelection={!activeAircraftTenantId || !activeAircraftFranchiseId}
                  formValues={formValues}
                  formErrors={formErrors}
                  firstFieldRef={firstFieldRef}
                  aircraftTypeSelectOptions={aircraftTypeSelectOptions}
                  aircraftStatusSelectOptions={aircraftStatusSelectOptions}
                  setSelectFieldValue={setSelectFieldValue}
                  resolveSelectOptions={resolveSelectOptions}
                  aircraftNoSerialNumber={aircraftNoSerialNumber}
                  handleAircraftNoSerialChange={handleAircraftNoSerialChange}
                  aircraftManufacturingDate={aircraftManufacturingDate}
                  setAircraftManufacturingDate={setAircraftManufacturingDate}
                  aircraftBase={aircraftBase}
                  setAircraftBase={setAircraftBase}
                  aircraftBaseSelectOptions={aircraftBaseSelectOptions}
                  aircraftOwner={aircraftOwner}
                  setAircraftOwner={setAircraftOwner}
                  aircraftOwnerSelectOptions={aircraftOwnerSelectOptions}
                  aircraftLineNumber={aircraftLineNumber}
                  setAircraftLineNumber={setAircraftLineNumber}
                  aircraftVariableNumber={aircraftVariableNumber}
                  setAircraftVariableNumber={setAircraftVariableNumber}
                  aircraftCounterRows={aircraftCounterRows}
                  setAircraftCounterValue={setAircraftCounterValue}
                  aircraftMaintenanceRevisionNumber={aircraftMaintenanceRevisionNumber}
                  setAircraftMaintenanceRevisionNumber={setAircraftMaintenanceRevisionNumber}
                  aircraftAmendmentNumber={aircraftAmendmentNumber}
                  setAircraftAmendmentNumber={setAircraftAmendmentNumber}
                  aircraftMaintenanceRevisionDate={aircraftMaintenanceRevisionDate}
                  setAircraftMaintenanceRevisionDate={setAircraftMaintenanceRevisionDate}
                  aircraftAmendmentDate={aircraftAmendmentDate}
                  setAircraftAmendmentDate={setAircraftAmendmentDate}
                  aircraftAuditTimeline={aircraftAuditTimeline}
                  selectedAssemblyModelName={(() => {
                    const selectedModel = franchiseAssemblyModels.find(m => m.id === aircraftTemplateModel);
                    return selectedModel ? selectedModel.label : '';
                  })()}
                />
              ) : entity === 'work_package_templates' ? (
                workPackageTemplateStandardEnabled ? (
                  <AmroWorkPackageTemplateAdapter
                    mode={modalMode}
                    loading={false}
                    formValues={formValues}
                    formErrors={formErrors}
                    setFieldValue={setFieldValue}
                    firstFieldRef={firstFieldRef}
                    modalOpen={modalOpen}
                    modalMode={modalMode}
                    selectedTemplateId={selectedId}
                    scopedDb={scopedDb}
                    scope={scope}
                  />
                ) : (
                  <WorkPackageTemplateCreateSection
                    formValues={formValues}
                    formErrors={formErrors}
                    setFieldValue={setFieldValue}
                    firstFieldRef={firstFieldRef}
                    modalOpen={modalOpen}
                    modalMode={modalMode}
                    selectedTemplateId={selectedId}
                    scopedDb={scopedDb}
                    scope={scope}
                  />
                )
              ) : (
                <>
                  <div
                    className="mdm-template-tab-rail mdm-template-tab-rail-inline"
                    role="tablist"
                    aria-label="Master data form sections"
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        cycleFormTab('next');
                      }
                      if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        cycleFormTab('prev');
                      }
                    }}
                  >
                    <button
                      type="button"
                      role="tab"
                      id="master-data-tab-basic"
                      aria-selected={activeFormTab === 'basic'}
                      aria-controls="master-data-panel-basic"
                      className={tabLabelClass('basic')}
                      data-state={activeFormTab === 'basic' ? 'active' : 'inactive'}
                      onClick={() => setActiveFormTab('basic')}
                    >
                      Basic Information
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="master-data-tab-configuration"
                      aria-selected={activeFormTab === 'configuration'}
                      aria-controls="master-data-panel-configuration"
                      className={tabLabelClass('configuration')}
                      data-state={activeFormTab === 'configuration' ? 'active' : 'inactive'}
                      onClick={() => setActiveFormTab('configuration')}
                    >
                      Configuration Settings
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="master-data-tab-system"
                      aria-selected={activeFormTab === 'system'}
                      aria-controls="master-data-panel-system"
                      className={tabLabelClass('system')}
                      data-state={activeFormTab === 'system' ? 'active' : 'inactive'}
                      onClick={() => setActiveFormTab('system')}
                    >
                      System Information
                    </button>
                  </div>
                  {activeFormTab === 'basic' && (
                    <div className="space-y-6" role="tabpanel" id="master-data-panel-basic" aria-labelledby="master-data-tab-basic">
                      {!collapsedFormPanels.basic ? (
                        <div className={sectionGridClass} data-testid="amro-master-data-basic-grid">
                          {basicSectionFields.map((field, index) => renderEditableField(field, 'basic', index))}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {activeFormTab === 'configuration' && (
                    <div className="space-y-6" role="tabpanel" id="master-data-panel-configuration" aria-labelledby="master-data-tab-configuration">
                      {!collapsedFormPanels.configuration ? (
                        <div className={sectionGridClass} data-testid="amro-master-data-configuration-grid">
                          {configurationSectionFields.map((field) => renderEditableField(field, 'configuration'))}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {activeFormTab === 'system' && (
                    <div className="space-y-6" role="tabpanel" id="master-data-panel-system" aria-labelledby="master-data-tab-system">
                      {!collapsedFormPanels.system ? (
                        <div className={sectionGridClass}>
                          {systemFields.map((field) => (
                            <div key={field} className={sectionFieldClass}>
                              <Label htmlFor={`master-data-system-${field}`} className="mdm-template-label">{field}</Label>
                              <Input id={`master-data-system-${field}`} value={String(selectedRow?.[field] ?? '')} readOnly className="mdm-template-readonly" />
                            </div>
                          ))}
                          {!systemFields.length && (
                            <p className="text-sm text-muted-foreground">Select a row to view system metadata.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[hsl(var(--mdm-template-border))] pt-4">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                {entity === 'aircraft' ? (
                  <Button variant="outline" onClick={clearAircraftDraft}>
                    Discard Draft
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => void handleDelete()} disabled={!selectedId}>Delete</Button>
                <Button onClick={() => void handleSubmitModal()}>
                  {modalMode === 'create' ? 'Save' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <AddWorkPackageDialog
          aircraftWorkPackageDialogOpen={aircraftWorkPackageDialogOpen}
          setAircraftWorkPackageDialogOpen={setAircraftWorkPackageDialogOpen}
          aircraftWorkPackageActiveTab={aircraftWorkPackageActiveTab}
          setAircraftWorkPackageActiveTab={setAircraftWorkPackageActiveTab}
          aircraftWorkPackageValues={aircraftWorkPackageValues}
          aircraftWorkPackageErrors={aircraftWorkPackageErrors}
          setAircraftWorkPackageField={setAircraftWorkPackageField}
          selectedWorkPackageTemplateId={selectedWorkPackageTemplateId}
          handleAircraftWorkPackageTemplateSelect={handleAircraftWorkPackageTemplateSelect}
          workPackageTemplateRegistryLoading={workPackageTemplateRegistryLoading}
          workPackageTemplateRegistry={workPackageTemplateRegistry}
          workPackageTemplateRegistryError={workPackageTemplateRegistryError}
          selectedWorkPackageTemplate={selectedWorkPackageTemplate}
          aircraftWorkPackagePagedTasks={aircraftWorkPackagePagedTasks}
          aircraftWorkPackageSelectedTaskIds={aircraftWorkPackageSelectedTaskIds}
          handleAircraftWorkPackageTaskSelection={handleAircraftWorkPackageTaskSelection}
          setAircraftWorkPackageSelectedTaskIds={setAircraftWorkPackageSelectedTaskIds}
          aircraftWorkPackageTaskSort={aircraftWorkPackageTaskSort}
          setAircraftWorkPackageTaskSort={setAircraftWorkPackageTaskSort}
          setAircraftWorkPackageTaskSortDirection={setAircraftWorkPackageTaskSortDirection}
          aircraftWorkPackageTaskPage={aircraftWorkPackageTaskPage}
          setAircraftWorkPackageTaskPage={setAircraftWorkPackageTaskPage}
          aircraftWorkPackageTaskTotalPages={aircraftWorkPackageTaskTotalPages}
          loadWorkPackageTemplateRegistry={loadWorkPackageTemplateRegistry}
          aircraftSelectedExistingWorkPackageId={aircraftSelectedExistingWorkPackageId}
          setAircraftSelectedExistingWorkPackageId={setAircraftSelectedExistingWorkPackageId}
          aircraftExistingWorkPackagesError={aircraftExistingWorkPackagesError}
          aircraftExistingWorkPackagesLoading={aircraftExistingWorkPackagesLoading}
          aircraftExistingWorkPackageList={aircraftExistingWorkPackageList}
          handleApplyExistingWorkPackageSelection={handleApplyExistingWorkPackageSelection}
          aircraftTaskGridFilteredRows={aircraftTaskGridFilteredRows}
          aircraftWorkPackageSubmitting={aircraftWorkPackageSubmitting}
          handleAircraftWorkPackageSubmit={handleAircraftWorkPackageSubmit}
          canCreateWorkPackageFromTemplate={canCreateWorkPackageFromTemplate}
          associatedTemplateTasks={aircraftTemplateAssociatedTasks}
          associatedTemplateTasksLoading={aircraftTemplateAssociatedTasksLoading}
          associatedTemplateTasksError={aircraftTemplateAssociatedTasksError}
        />
        <Dialog open={flightLogDialogOpen} onOpenChange={setFlightLogDialogOpen}>
          <DialogContent className="mdm-template-dialog mdm-template-dialog-large">
            <FlightLogForm
              key={flightLogDialogInstance}
              config={flightLogDialogConfig}
              initialValues={flightLogInitialValues}
              onCancel={() => setFlightLogDialogOpen(false)}
              onSubmit={handleFlightLogSubmit}
              submitting={flightLogSubmitting}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={flightLogDetailOpen} onOpenChange={setFlightLogDetailOpen}>
          <DialogContent className="mdm-template-dialog mdm-template-dialog-large">
            <DialogHeader className="border-b border-[hsl(var(--mdm-template-border))] px-6 py-4">
              <DialogTitle className="text-[15px] font-semibold text-[hsl(var(--mdm-template-heading))]">Flight Log Detail</DialogTitle>
              <DialogDescription className="text-[12px] text-[hsl(var(--mdm-template-muted))]">
                Detailed operational and discrepancy view for the selected flight log record.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 pb-6 pt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mdm-template-label">Flight Date</Label>
                  <Input value={String(flightLogDetailRow?.flight_date || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Flight Number</Label>
                  <Input value={String(flightLogDetailRow?.flight_number || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Pilot Name</Label>
                  <Input value={String(flightLogDetailRow?.pilot_name || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Aircraft Id</Label>
                  <Input value={String(flightLogDetailRow?.aircraft_id || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Departure</Label>
                  <Input value={String(flightLogDetailRow?.departure_airport || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Arrival</Label>
                  <Input value={String(flightLogDetailRow?.arrival_airport || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Flight Hours</Label>
                  <Input value={String(flightLogDetailRow?.flight_hours || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Block Hours</Label>
                  <Input value={String(flightLogDetailRow?.block_hours || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Flight Cycles</Label>
                  <Input value={String(flightLogDetailRow?.flight_cycles || '')} readOnly className="mdm-template-readonly" />
                </div>
                <div>
                  <Label className="mdm-template-label">Fuel Burn (Kg)</Label>
                  <Input value={String(flightLogDetailRow?.fuel_burn_kg || '')} readOnly className="mdm-template-readonly" />
                </div>
              </div>
              <div>
                <Label className="mdm-template-label">Crew Details</Label>
                <Textarea value={String(flightLogDetailRow?.crew_details || '')} readOnly className="mdm-template-readonly min-h-[90px]" />
              </div>
              <div>
                <Label className="mdm-template-label">PIREP / Discrepancy</Label>
                <Textarea value={String(flightLogDetailRow?.pirep_discrepancy || '')} readOnly className="mdm-template-readonly min-h-[110px]" />
              </div>
              <div className="flex justify-end border-t border-[hsl(var(--mdm-template-border))] pt-4">
                <Button variant="outline" onClick={() => setFlightLogDetailOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <AircraftTemplateDialog
          open={aircraftTemplateDialogOpen}
          mode={aircraftTemplateDialogMode}
          submitting={aircraftTemplateDialogSubmitting}
          formValues={aircraftTemplateFormValues}
          formErrors={aircraftTemplateFormErrors}
          setFormValues={setAircraftTemplateFormValues}
          setFormErrors={setAircraftTemplateFormErrors}
          onClose={resetAircraftTemplateDialog}
          onSubmit={submitAircraftTemplateDialog}
          setOpen={setAircraftTemplateDialogOpen}
        />
        <AlertDialog open={aircraftTemplateDeleteDialogOpen} onOpenChange={setAircraftTemplateDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete aircraft template?</AlertDialogTitle>
              <AlertDialogDescription>
                This action permanently removes the template from the registry.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={aircraftTemplateDeleteSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmDeleteAircraftTemplate()} disabled={aircraftTemplateDeleteSubmitting}>
                {aircraftTemplateDeleteSubmitting ? 'Deleting...' : 'Delete Template'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
      </TooltipProvider>
    </DashboardLayout>
  );
}

export default AmroSettingsMasterDataPage;

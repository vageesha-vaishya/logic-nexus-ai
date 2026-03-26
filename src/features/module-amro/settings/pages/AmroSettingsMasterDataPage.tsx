import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckSquare,
  Eye,
  FileCheck,
  FileDown,
  FileText,
  FileUp,
  ListChecks,
  Plus,
  RefreshCw,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

type InlineEditingCell = {
  rowId: string;
  column: string;
} | null;

type ManufacturerOption = {
  id: string;
  label: string;
  code: string;
  name: string;
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
  work_package_templates: ['id', 'template_code', 'template_name', 'maintenance_type', 'version', 'active', 'updated_at'],
};

const ENTITY_HIDDEN_COLUMNS: Partial<Record<MasterEntity, string[]>> = {
  aircraft: ['id', 'created_at', 'updated_at', 'tenant_id', 'franchise_id'],
  flight_logs: ['tenant_id', 'franchise_id', 'is_deleted', 'deleted_at', 'deleted_by', 'created_by', 'updated_by', 'metadata'],
};

const AIRCRAFT_EDITABLE_COLUMNS = new Set(['registration', 'tail_number', 'serial_number', 'aircraft_type', 'aircraft_model', 'maintenance_program', 'status']);

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
  plannedStart: string;
  plannedEnd: string;
  station: string;
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

const AIRCRAFT_NAV_RAIL = [
  { label: 'Overview', path: '/dashboard/amro/overview' },
  { label: 'Work Packages', path: '/dashboard/amro/work-packages' },
  { label: 'Scheduling', path: '/dashboard/amro/scheduling' },
  { label: 'Compliance', path: '/dashboard/amro/compliance' },
  { label: 'Task Execution', path: '/dashboard/amro/task-execution' },
  { label: 'Audit', path: '/dashboard/amro/audit' },
] as const;

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

const AIRCRAFT_TYPE_OPTIONS = ['NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded'];

const ENTITY_FORM_FIELDS: Record<MasterEntity, EntityFormField[]> = {
  aircraft: [
    { key: 'registration', label: 'Registration', type: 'text' },
    { key: 'tail_number', label: 'Tail Number', type: 'text', required: true },
    { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
    { key: 'aircraft_type', label: 'Aircraft Type', type: 'select', required: true, options: AIRCRAFT_TYPE_OPTIONS },
    { key: 'manufacturer_id', label: 'Manufacturer', type: 'select', required: true },
    { key: 'aircraft_model', label: 'Aircraft Model', type: 'select', required: true },
    { key: 'configuration_code', label: 'Configuration Code', type: 'text' },
    { key: 'maintenance_program', label: 'Maintenance Program', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'inactive', 'grounded', 'maintenance'] },
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
    aircraft_model: '',
    manufacturer_id: '',
    configuration_code: '',
    maintenance_program: '',
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
  if (entity === 'manufacturers') {
    const seen = new Set<string>();
    const records = MANUFACTURER_SEED_NAMES.map((name) => {
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
    }).filter(
      (record): record is { manufacturer_code: string; name: string; is_active: boolean; metadata: { source: string } } =>
        Boolean(record),
    );
    return records as Record<string, unknown>[];
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

function normalizeFeatureFlag(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
  return fallback;
}

function toDateTimeInputValue(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getDefaultAircraftWorkPackageValues(stationHint?: string): AircraftWorkPackageFormValues {
  const now = new Date();
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return {
    source: 'schedule_due',
    maintenanceType: 'line',
    priority: 'medium',
    plannedStart: toDateTimeInputValue(now),
    plannedEnd: toDateTimeInputValue(end),
    station: stationHint || '',
    scopeItemsText: 'General inspection',
  };
}

function parseWorkPackageItems(payload: Record<string, unknown>): Record<string, unknown>[] {
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

function buildAircraftWorkPackageSnapshot(items: Record<string, unknown>[]): AircraftWorkPackageSnapshot {
  let open = 0;
  let inProgress = 0;
  let deferred = 0;
  let completed = 0;
  let rtsBlockers = 0;
  let slaRisk = 0;

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

  rtsBlockers = deferred;
  slaRisk = items.filter((item) => String(item.priority || '').toLowerCase() === 'critical').length;
  return { open, inProgress, deferred, completed, rtsBlockers, slaRisk };
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

type ReferenceEntity = MasterEntity | 'assembly_types';

export async function verifyReferenceExists(headers: Headers, entity: ReferenceEntity, searchTerm: string, fieldKeys: string[]): Promise<boolean> {
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
    const label = (ENTITY_LABEL as Record<string, string>)[entity] ?? 'reference';
    throw new Error(String(payload.error || `Failed to validate ${label} reference`));
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
  const { hasPermission } = useAuth();
  const { entity: entityParam } = useParams<{ entity?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [flightDateFrom, setFlightDateFrom] = useState(searchParams.get('flight_from') || '');
  const [flightDateTo, setFlightDateTo] = useState(searchParams.get('flight_to') || '');
  const [flightAircraftFilter, setFlightAircraftFilter] = useState(searchParams.get('flight_aircraft') || searchParams.get('aircraft_id') || '');
  const [flightRegistrationFilter, setFlightRegistrationFilter] = useState(searchParams.get('flight_registration') || searchParams.get('aircraft_registration') || '');
  const [flightPilotFilter, setFlightPilotFilter] = useState(searchParams.get('flight_pilot') || '');
  const [flightNumberFilter, setFlightNumberFilter] = useState(searchParams.get('flight_number') || '');
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
  const [manufacturerOptions, setManufacturerOptions] = useState<ManufacturerOption[]>([]);
  const [manufacturerOptionsLoading, setManufacturerOptionsLoading] = useState(false);
  const [manufacturerOptionsError, setManufacturerOptionsError] = useState('');
  const [assemblyTypeOptions, setAssemblyTypeOptions] = useState<AssemblyTypeOption[]>([]);
  const [assemblyTypeOptionsLoading, setAssemblyTypeOptionsLoading] = useState(false);
  const [assemblyTypeOptionsError, setAssemblyTypeOptionsError] = useState('');
  const [assemblyModelOptions, setAssemblyModelOptions] = useState<AssemblyModelOption[]>([]);
  const [assemblyModelOptionsLoading, setAssemblyModelOptionsLoading] = useState(false);
  const [assemblyModelOptionsError, setAssemblyModelOptionsError] = useState('');
  const [aircraftWorkPackageDialogOpen, setAircraftWorkPackageDialogOpen] = useState(false);
  const [aircraftWorkPackageValues, setAircraftWorkPackageValues] = useState<AircraftWorkPackageFormValues>(getDefaultAircraftWorkPackageValues());
  const [aircraftWorkPackageErrors, setAircraftWorkPackageErrors] = useState<Record<string, string>>({});
  const [aircraftWorkPackageSubmitting, setAircraftWorkPackageSubmitting] = useState(false);
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
  const clickDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const manufacturerSeedAttemptedRef = useRef(false);
  const selectionAnchorRef = useRef<string | null>(null);
  const aircraftEnhancementEnabled = normalizeFeatureFlag(import.meta.env.VITE_AMRO_AIRCRAFT_FORM_ENHANCEMENTS, true);
  const canCreateWorkPackage = hasPermission('create_maintenance_request');
  const canScheduleWorkPackage = hasPermission('edit_aircraft_records');
  const canExportAircraftOps = hasPermission('delete_flight_logs');
  const canEscalateAircraftOps = hasPermission('approve_work_orders');

  const scope = useMemo(
    () => ({
      tenantId: context.tenantId,
      franchiseId: context.franchiseId,
      userId: context.userId,
    }),
    [context.franchiseId, context.tenantId, context.userId],
  );

  const fetchManufacturerOptions = useCallback(async (headers: Headers): Promise<ManufacturerOption[]> => {
    const query = new URLSearchParams({
      page: '1',
      page_size: '200',
      sort_by: 'name',
      sort_dir: 'asc',
    });
    const response = await fetch(`/api/v2/amro/master-data/manufacturers?${query.toString()}`, { method: 'GET', headers });
    const payload = await parseApiPayload(response);
    if (!response.ok) throw new Error(String(payload.error || 'Failed to load manufacturers'));
    const records = getPayloadRecords(payload);
    return records
      .map((record) => {
        const id = String(record.id || '').trim();
        if (!id) return null;
        const code = String(record.manufacturer_code || '').trim();
        const name = String(record.name || '').trim();
        const label = name && code ? `${name} (${code})` : name || code || id;
        const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
        return { id, label, code, name, active };
      })
      .filter((option): option is ManufacturerOption => Boolean(option));
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

  const loadManufacturerOptions = useCallback(async () => {
    setManufacturerOptionsLoading(true);
    setManufacturerOptionsError('');
    try {
      const headers = await buildApiHeaders(scope);
      let options = await fetchManufacturerOptions(headers);
      if (options.length === 0) {
        const seeded = await seedManufacturersIfNeeded(headers);
        if (seeded) {
          options = await fetchManufacturerOptions(headers);
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
  }, [fetchManufacturerOptions, scope, seedManufacturersIfNeeded]);

  const loadAssemblyTypeOptions = useCallback(async () => {
    setAssemblyTypeOptionsLoading(true);
    setAssemblyTypeOptionsError('');
    try {
      const headers = await buildApiHeaders(scope);
      const options = await fetchAssemblyTypeOptions(headers);
      setAssemblyTypeOptions(options);
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load assembly types');
      setAssemblyTypeOptionsError(message);
      toast.error(message);
    } finally {
      setAssemblyTypeOptionsLoading(false);
    }
  }, [fetchAssemblyTypeOptions, scope]);

  const loadAssemblyModelOptions = useCallback(async () => {
    setAssemblyModelOptionsLoading(true);
    setAssemblyModelOptionsError('');
    try {
      const headers = await buildApiHeaders(scope);
      const options = await fetchAssemblyModelOptions(headers);
      setAssemblyModelOptions(options);
    } catch (error) {
      const message = String((error as Error).message || 'Failed to load aircraft models');
      setAssemblyModelOptionsError(message);
      toast.error(message);
    } finally {
      setAssemblyModelOptionsLoading(false);
    }
  }, [fetchAssemblyModelOptions, scope]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await buildApiHeaders(scope);
      const query = new URLSearchParams({
        search,
        page: String(page),
        page_size: pageSize,
        sort_by: sortColumn,
        sort_dir: sortDirection,
      });
      if (entity === 'flight_logs' && flightDateFrom.trim()) query.set('flight_from', flightDateFrom.trim());
      if (entity === 'flight_logs' && flightDateTo.trim()) query.set('flight_to', flightDateTo.trim());
      if (entity === 'flight_logs' && flightAircraftFilter.trim()) query.set('aircraft_id', flightAircraftFilter.trim());
      if (entity === 'flight_logs' && flightRegistrationFilter.trim()) query.set('aircraft_registration', flightRegistrationFilter.trim());
      if (entity === 'flight_logs' && flightPilotFilter.trim()) query.set('pilot_name', flightPilotFilter.trim());
      if (entity === 'flight_logs' && flightNumberFilter.trim()) query.set('flight_number', flightNumberFilter.trim());
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
  }, [entity, flightAircraftFilter, flightDateFrom, flightDateTo, flightPilotFilter, flightRegistrationFilter, flightNumberFilter, page, pageSize, scope, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    setEntity(resolvedRouteEntity);
  }, [resolvedRouteEntity]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

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
      void loadManufacturerOptions();
    }
  }, [entity, loadManufacturerOptions]);

  useEffect(() => {
    if ((entity === 'aircraft' || entity === 'assembly_models') && modalOpen) {
      void loadManufacturerOptions();
    }
  }, [entity, loadManufacturerOptions, modalOpen]);

  useEffect(() => {
    if (entity === 'assembly_models') {
      void loadAssemblyTypeOptions();
    }
  }, [entity, loadAssemblyTypeOptions]);

  useEffect(() => {
    if (entity === 'assembly_models' && modalOpen) {
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
    navigate(`/dashboard/amro/settings/master-data/${ENTITY_ROUTE_SEGMENT[entity]}${location.search}`, { replace: true });
  }, [entity, location.search, navigate]);

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
    setSearchParams(next, { replace: true });
  }, [columnFilters, entity, flightAircraftFilter, flightDateFrom, flightDateTo, flightPilotFilter, flightRegistrationFilter, flightNumberFilter, page, pageSize, search, selectedId, setSearchParams, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    const selectedFromUrl = searchParams.get('selected');
    if (!selectedFromUrl || !rows.length) {
      return;
    }
    const matched = rows.find((row) => row.id === selectedFromUrl);
    if (matched) {
      setSelectedId(matched.id);
      setFormValues(pickFormValuesFromRow(entity, matched));
    }
  }, [entity, rows, searchParams]);

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
  const basicSectionFields = useMemo(() => formFields.slice(0, Math.min(formFields.length, 4)), [formFields]);
  const configurationSectionFields = useMemo(() => formFields.slice(Math.min(formFields.length, 4)), [formFields]);
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
  const selectedAircraft = useMemo(
    () => (entity === 'aircraft' ? (selectedRow || rows[0] || null) : null),
    [entity, rows, selectedRow],
  );
  const selectedFlightLogAircraft = useMemo(
    () =>
      String(flightLogInitialValues.aircraftId || '').trim()
        ? rows.find((row) => row.id === String(flightLogInitialValues.aircraftId || '').trim()) || selectedAircraft
        : selectedAircraft,
    [flightLogInitialValues.aircraftId, rows, selectedAircraft],
  );
  const manufacturerSelectOptions = useMemo<SelectOption[]>(
    () =>
      manufacturerOptions.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: !option.active,
      })),
    [manufacturerOptions],
  );
  const manufacturerMetaById = useMemo(() => new Map(manufacturerOptions.map((option) => [option.id, option])), [manufacturerOptions]);
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
    const manufacturer = manufacturerMetaById.get(manufacturerId);
    const manufacturerTokens = manufacturer
      ? [manufacturer.id, manufacturer.code, manufacturer.name, manufacturer.label].filter(Boolean).map(normalize)
      : [];
    const manufacturerTokenSet = new Set(manufacturerTokens);
    const filtered = manufacturerId
      ? assemblyModelOptions.filter((option) => {
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
  }, [assemblyModelOptions, formValues.aircraft_model, formValues.manufacturer_id, manufacturerMetaById]);

  const setFieldValue = useCallback((fieldKey: string, value: unknown) => {
    setFormValues((previous) => ({ ...previous, [fieldKey]: value }));
    setFormErrors((previous) => ({ ...previous, [fieldKey]: '' }));
  }, []);

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
      return (field.options || []).map((option) => ({ value: option, label: option }));
    },
    [
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
    const manufacturerTokens = manufacturer
      ? [manufacturer.id, manufacturer.code, manufacturer.name, manufacturer.label].filter(Boolean).map(normalize)
      : [];
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

  const supportsColumnFilters = entity === 'aircraft' || entity === 'flight_logs';

  const filteredRows = useMemo(() => {
    if (!supportsColumnFilters) {
      return rows;
    }
    return rows.filter((row) => {
      const columnMatch = Object.entries(columnFilters).every(([column, rawValue]) => {
        const value = rawValue.trim().toLowerCase();
        if (!value) return true;
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
      return true;
    });
  }, [columnFilters, entity, flightAircraftFilter, flightDateFrom, flightDateTo, flightPilotFilter, flightRegistrationFilter, flightNumberFilter, rows, supportsColumnFilters]);

  const renderedRows = supportsColumnFilters ? filteredRows : rows;
  const renderedRowIds = useMemo(() => renderedRows.map((row) => row.id), [renderedRows]);
  const renderedRowIdSet = useMemo(() => new Set(renderedRowIds), [renderedRowIds]);

  const aircraftHeaderColumns = useMemo(() => tableColumns, [tableColumns]);

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
      setSelectedId(row.id);
      setFormValues(pickFormValuesFromRow(entity, row));
      setFormErrors({});
      setModalMode('update');
      setActiveFormTab('basic');
      setModalOpen(true);
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
  }, [entity, flightAircraftFilter]);

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

  const handleSubmitModal = useCallback(async () => {
    const ok = modalMode === 'create' ? await handleCreate() : await handleUpdate();
    if (ok) {
      setModalOpen(false);
    }
  }, [handleCreate, handleUpdate, modalMode]);

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
      const headers = await buildApiHeaders(scope);
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
      setAircraftWorkPackageSnapshot(buildAircraftWorkPackageSnapshot(parseWorkPackageItems(payload)));
    } catch {
      setAircraftWorkPackageSnapshot({
        open: 0,
        inProgress: 0,
        deferred: 0,
        completed: 0,
        rtsBlockers: 0,
        slaRisk: 0,
      });
    }
  }, [aircraftEnhancementEnabled, entity, scope, selectedAircraft]);

  useEffect(() => {
    void loadAircraftWorkPackageSnapshot();
  }, [loadAircraftWorkPackageSnapshot]);

  useEffect(() => {
    if (entity !== 'aircraft') {
      return;
    }
    const stationHint = String(selectedAircraft?.station_code || '').trim();
    setAircraftWorkPackageValues(getDefaultAircraftWorkPackageValues(stationHint));
    setAircraftWorkPackageErrors({});
  }, [entity, selectedAircraft]);

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
      setEntity('flight_logs');
      setFlightAircraftFilter(normalizedAircraftId);
      setSelectedId(null);
      setPage(1);
    },
    [],
  );

  const openAircraftWorkPackageDialog = useCallback(() => {
    const stationHint = String(selectedAircraft?.station_code || '').trim();
    setAircraftWorkPackageValues(getDefaultAircraftWorkPackageValues(stationHint));
    setAircraftWorkPackageErrors({});
    setAircraftWorkPackageDialogOpen(true);
  }, [selectedAircraft]);

  const setAircraftWorkPackageField = useCallback((key: keyof AircraftWorkPackageFormValues, value: string) => {
    setAircraftWorkPackageValues((previous) => ({ ...previous, [key]: value }));
    setAircraftWorkPackageErrors((previous) => ({ ...previous, [key]: '' }));
  }, []);

  const handleAircraftWorkPackageSubmit = useCallback(
    async (action: WorkPackageCreateAction) => {
      if (!selectedAircraft?.id) {
        toast.error('Select an aircraft record first');
        return;
      }
      const errors: Record<string, string> = {};
      if (!aircraftWorkPackageValues.station.trim()) {
        errors.station = 'Station is required';
      }
      if (!aircraftWorkPackageValues.plannedStart.trim()) {
        errors.plannedStart = 'Planned start is required';
      }
      if (!aircraftWorkPackageValues.plannedEnd.trim()) {
        errors.plannedEnd = 'Planned end is required';
      }
      const startTime = Date.parse(aircraftWorkPackageValues.plannedStart);
      const endTime = Date.parse(aircraftWorkPackageValues.plannedEnd);
      if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        errors.plannedEnd = 'Planned window must be valid date-time values';
      } else if (startTime >= endTime) {
        errors.plannedEnd = 'Planned end must be after planned start';
      }
      const scopeItems = aircraftWorkPackageValues.scopeItemsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      if (scopeItems.length === 0) {
        errors.scopeItemsText = 'Add at least one scope item';
      }
      setAircraftWorkPackageErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast.error('Please resolve aircraft work package validation errors');
        return;
      }

      if (action === 'save_draft') {
        const draft = {
          aircraft_id: String(selectedAircraft.id),
          source: aircraftWorkPackageValues.source,
          maintenance_type: aircraftWorkPackageValues.maintenanceType,
          station: aircraftWorkPackageValues.station.trim(),
          priority: aircraftWorkPackageValues.priority,
          planned_window: `${new Date(aircraftWorkPackageValues.plannedStart).toISOString()}|${new Date(aircraftWorkPackageValues.plannedEnd).toISOString()}`,
          scope_items: scopeItems,
          reference_id: String(selectedAircraft.id),
          triggered_at: new Date().toISOString(),
        };
        localStorage.setItem(`amro:aircraft-wp-draft:${selectedAircraft.id}`, JSON.stringify(draft));
        toast.success('Aircraft work package draft saved');
        setAircraftWorkPackageDialogOpen(false);
        return;
      }

      setAircraftWorkPackageSubmitting(true);
      try {
        const headers = await buildApiHeaders(scope);
        const now = Date.now();
        const response = await fetch('/api/v2/amro/work-packages?interface=create-work-package', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            aircraft_id: String(selectedAircraft.id),
            maintenance_type: aircraftWorkPackageValues.maintenanceType,
            planned_window: `${new Date(aircraftWorkPackageValues.plannedStart).toISOString()}|${new Date(aircraftWorkPackageValues.plannedEnd).toISOString()}`,
            station: aircraftWorkPackageValues.station.trim(),
            priority: aircraftWorkPackageValues.priority,
            scope_items: scopeItems,
            source: aircraftWorkPackageValues.source,
            reference_id: String(selectedAircraft.id),
            triggered_at: new Date().toISOString(),
            idempotency_key: `aircraft-wp-create-${now}`,
            decision_trace_id: `aircraft-wp-${selectedAircraft.id}-${now}`,
            scope_context: {
              domain_id: 'amro',
            },
          }),
        });
        const payload = await parseApiPayload(response);
        if (!response.ok) {
          throw new Error(String(payload.error || 'Failed to create work package from aircraft'));
        }
        const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
        const workPackageId = String(output.work_package_id || output.id || '');
        toast.success('Aircraft work package created');
        setAircraftWorkPackageDialogOpen(false);
        await loadAircraftWorkPackageSnapshot();
        if (action === 'create_schedule') {
          const query = new URLSearchParams();
          query.set('aircraft_id', String(selectedAircraft.id));
          if (workPackageId) query.set('work_package_id', workPackageId);
          navigate(`/dashboard/amro/scheduling?${query.toString()}`);
          return;
        }
        if (action === 'create_open') {
          const query = new URLSearchParams();
          query.set('aircraft_id', String(selectedAircraft.id));
          if (workPackageId) query.set('focus', workPackageId);
          navigate(`/dashboard/amro/work-packages?${query.toString()}`);
        }
      } catch (error) {
        localStorage.setItem(
          `amro:aircraft-wp-draft:${selectedAircraft.id}`,
          JSON.stringify({
            aircraft_id: String(selectedAircraft.id),
            source: aircraftWorkPackageValues.source,
            maintenance_type: aircraftWorkPackageValues.maintenanceType,
            station: aircraftWorkPackageValues.station.trim(),
            priority: aircraftWorkPackageValues.priority,
            planned_window: `${new Date(aircraftWorkPackageValues.plannedStart).toISOString()}|${new Date(aircraftWorkPackageValues.plannedEnd).toISOString()}`,
            scope_items: scopeItems,
            reference_id: String(selectedAircraft.id),
            triggered_at: new Date().toISOString(),
          }),
        );
        toast.error(String((error as Error).message || 'Work package service degraded. Draft captured locally.'));
      } finally {
        setAircraftWorkPackageSubmitting(false);
      }
    },
    [aircraftWorkPackageValues, loadAircraftWorkPackageSnapshot, navigate, scope, selectedAircraft],
  );

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
      const endpoint = mode === 'add' ? '/api/v2/amro/flight-logs' : '/api/v2/amro/master-data/flight_logs';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(normalizedPayload),
      });
      const parsedPayload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(parsedPayload.error || 'Failed to save flight log'));
      }
      toast.success(mode === 'add' ? 'Flight log recorded' : 'Flight Logs record created');
      setFlightLogDialogOpen(false);
      await loadRecords();
      if (mode === 'add') {
        await loadAircraftWorkPackageSnapshot();
      }
    } catch (error) {
      toast.error(String((error as Error).message || 'Failed to save flight log'));
      throw error;
    } finally {
      setFlightLogSubmitting(false);
    }
  }, [loadAircraftWorkPackageSnapshot, loadRecords, scope]);

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

  const renderEditableField = useCallback(
    (field: EntityFormField, section: FormSectionKey, index?: number) => {
      const fieldId = `master-data-${section}-${field.key}`;
      const fieldClass = field.type === 'textarea' || field.type === 'json' ? fullWidthSectionFieldClass : sectionFieldClass;
      const hasError = Boolean(formErrors[field.key]);

      return (
        <div key={field.key} className={fieldClass}>
          <Label htmlFor={fieldId} className="mdm-template-label">
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          {field.type === 'select' && (
            <Select value={String(formValues[field.key] ?? '')} onValueChange={(value) => setFieldValue(field.key, value)}>
              <SelectTrigger id={fieldId} className={cn('mdm-template-input', hasError && 'border-destructive')} aria-invalid={hasError}>
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
              <Switch id={fieldId} checked={Boolean(formValues[field.key])} onCheckedChange={(checked) => setFieldValue(field.key, checked)} />
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
            />
          )}
          {formErrors[field.key] ? <p className="mdm-template-danger">{formErrors[field.key]}</p> : null}
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

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={300}>
        <div className="mdm-template-page" data-testid="amro-master-data-template">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <nav className="mb-1 flex items-center gap-1 text-xs text-[hsl(var(--mdm-template-muted))]" aria-label="Breadcrumb">
              <Link className="transition-colors hover:text-[hsl(var(--mdm-template-focus))]" to="/dashboard">Dashboard</Link>
              <span>/</span>
              <Link className="transition-colors hover:text-[hsl(var(--mdm-template-focus))]" to="/dashboard/amro/settings">AMRO Settings</Link>
              <span>/</span>
              <span className="font-medium text-[hsl(var(--mdm-template-heading))]">Master Data</span>
            </nav>
            <h1 className="mdm-template-header-title">AMRO Settings · Master Data</h1>
            <p className="mdm-template-header-subtitle">
              Tenant-scoped CRUD management for fleet, inventory, manufacturers, suppliers, facilities, workforce, compliance profiles,
              shift capacity, and work package templates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>
            <Button variant="ghost" asChild>
              <Link to="/dashboard/amro/settings" className="underline-offset-4 hover:underline">
                Settings Dashboard
              </Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => {
                    setBusyAction('refresh');
                    void loadRecords().finally(() => setBusyAction(null));
                  }}
                  disabled={loading || busyAction === 'refresh'}
                  aria-label="Refresh records"
                >
                  <RefreshCw className={cn('h-4 w-4', busyAction === 'refresh' && 'animate-spin')} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => void handleExport()} disabled={busyAction === 'export'} aria-label="Export records CSV">
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => void handleExportPdf()} disabled={busyAction === 'export_pdf'} aria-label="Export records PDF">
                  <FileDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="bg-[hsl(var(--mdm-template-focus))] text-white hover:bg-[hsl(var(--mdm-template-focus))/0.9]"
                  size="icon"
                  onClick={handleOpenCreateModal}
                  disabled={busyAction === 'create'}
                  aria-label={`New ${ENTITY_LABEL[entity]}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{`New ${ENTITY_LABEL[entity]}`}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Tabs value={entity} onValueChange={(next) => setEntity(next as MasterEntity)}>
          <TabsList className="mdm-template-tab-rail h-auto">
            {MASTER_ENTITY_SEQUENCE.map((key) => (
              <TabsTrigger key={key} value={key} className="mdm-template-tab data-[state=active]:bg-[hsl(var(--mdm-template-focus))/0.14] data-[state=active]:text-[hsl(var(--mdm-template-heading))]">
                {ENTITY_LABEL[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {entity === 'aircraft' && aircraftEnhancementEnabled ? (
          <Card className="mdm-template-panel">
            <CardHeader className="mdm-template-panel-head">
              <CardTitle className="mdm-template-panel-title">Aircraft Operations Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="mdm-template-panel-body space-y-4">
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
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" onClick={openAircraftWorkPackageDialog} disabled={!canCreateWorkPackage}>
                      Create Work Package
                    </Button>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" aria-label="Flight Logs">
                              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Flight Logs</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => openAircraftFlightLogsList(String(selectedAircraft?.id || ''))}>
                          <Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                          View Logs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openFlightLogDialog(String(selectedAircraft?.id || ''))}>
                          <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                          Add Log
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" variant="outline" onClick={() => handleAircraftContextNavigation('/dashboard/amro/work-packages')}>
                      View Active Packages
                    </Button>
                  </div>
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
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => handleAircraftContextNavigation('/dashboard/amro/scheduling')} disabled={!canScheduleWorkPackage}>
                      <TimerReset className="mr-1 h-3.5 w-3.5" />
                      Replan
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAircraftContextNavigation('/dashboard/amro/compliance')} disabled={!canEscalateAircraftOps}>
                      <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                      Escalate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleExport()} disabled={!canExportAircraftOps}>
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/20 p-2">
                {AIRCRAFT_NAV_RAIL.map((item) => {
                  const Icon =
                    item.label === 'Work Packages'
                      ? CheckSquare
                      : item.label === 'Scheduling'
                        ? CalendarDays
                        : item.label === 'Compliance'
                          ? FileCheck
                          : item.label === 'Task Execution'
                            ? CheckSquare
                            : item.label === 'Audit'
                              ? FileText
                              : TimerReset;
                  return (
                    <Button
                      key={item.path}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleAircraftContextNavigation(item.path)}
                    >
                      <Icon className="mr-1 h-3.5 w-3.5" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mdm-template-panel">
          <CardHeader className="mdm-template-panel-head">
            <CardTitle className="mdm-template-panel-title">{ENTITY_LABEL[entity]} Search and Filter</CardTitle>
          </CardHeader>
          <CardContent className="mdm-template-panel-body mdm-template-grid-five">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="amro-master-search" className="mdm-template-label">Search</Label>
              <Input id="amro-master-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="mdm-template-input" />
            </div>
            <div className="space-y-2">
              <Label className="mdm-template-label">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mdm-template-input">
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
              <Label className="mdm-template-label">Page Size</Label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="mdm-template-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {entity === 'flight_logs' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="flight-date-from-filter" className="mdm-template-label">Flight Date From</Label>
                  <Input
                    id="flight-date-from-filter"
                    type="date"
                    value={flightDateFrom}
                    onChange={(event) => setFlightDateFrom(event.target.value)}
                    className="mdm-template-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flight-date-to-filter" className="mdm-template-label">Flight Date To</Label>
                  <Input
                    id="flight-date-to-filter"
                    type="date"
                    value={flightDateTo}
                    onChange={(event) => setFlightDateTo(event.target.value)}
                    className="mdm-template-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flight-aircraft-filter" className="mdm-template-label">Aircraft Id</Label>
                  <Input
                    id="flight-aircraft-filter"
                    value={flightAircraftFilter}
                    onChange={(event) => setFlightAircraftFilter(event.target.value)}
                    className="mdm-template-input"
                    placeholder="Filter by aircraft id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flight-pilot-filter" className="mdm-template-label">Pilot</Label>
                  <Input
                    id="flight-pilot-filter"
                    value={flightPilotFilter}
                    onChange={(event) => setFlightPilotFilter(event.target.value)}
                    className="mdm-template-input"
                    placeholder="Filter by pilot name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flight-registration-filter" className="mdm-template-label">Aircraft Registration</Label>
                  <Input
                    id="flight-registration-filter"
                    value={flightRegistrationFilter}
                    onChange={(event) => setFlightRegistrationFilter(event.target.value)}
                    className="mdm-template-input"
                    placeholder="Filter by tail number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flight-number-filter" className="mdm-template-label">Flight Number</Label>
                  <Input
                    id="flight-number-filter"
                    value={flightNumberFilter}
                    onChange={(event) => setFlightNumberFilter(event.target.value)}
                    className="mdm-template-input"
                    placeholder="Filter by flight number"
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="mdm-template-panel">
          <CardHeader className="mdm-template-panel-head">
            <CardTitle className="mdm-template-panel-title">{ENTITY_LABEL[entity]} Records</CardTitle>
          </CardHeader>
          <CardContent className="mdm-template-panel-body space-y-3">
            <div className="overflow-auto rounded-md border max-h-[560px]">
                <Table>
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
                        <TableHead className="sticky top-0 z-20 h-auto min-w-[180px] bg-[#F8FAFC] px-3 py-2 text-left text-[13px] font-semibold text-[#64748B]">
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
                        <TableHead key={column} className="sticky top-0 z-20 h-auto min-w-[180px] bg-[#F8FAFC] px-3 py-2 text-left text-[13px] font-semibold text-[#64748B]">
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
                    {supportsColumnFilters ? (
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
                            </div>
                          </TableCell>
                        ) : null}
                        {(entity === 'aircraft' ? aircraftHeaderColumns : tableColumns).map((column) => (
                          <TableCell key={column} className="max-w-[260px] px-3 py-2 text-left align-middle text-[13px] text-[#1F2937]">
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
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Selected: {selectedId || 'none'} | Checked: {selectedRowIds.length} | Records: {renderedRows.length}
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
              <div className="mdm-template-tab-rail mdm-template-tab-rail-inline">
                <button type="button" className={tabLabelClass('basic')} data-state={activeFormTab === 'basic' ? 'active' : 'inactive'} onClick={() => setActiveFormTab('basic')}>Basic Information</button>
                <button type="button" className={tabLabelClass('configuration')} data-state={activeFormTab === 'configuration' ? 'active' : 'inactive'} onClick={() => setActiveFormTab('configuration')}>Configuration Settings</button>
                <button type="button" className={tabLabelClass('system')} data-state={activeFormTab === 'system' ? 'active' : 'inactive'} onClick={() => setActiveFormTab('system')}>System Information</button>
              </div>
              {activeFormTab === 'basic' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">Basic Information</h3>
                    <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">Use the same required-field and validation flow as the Leads form.</p>
                  </div>
                  <div className={sectionGridClass} data-testid="amro-master-data-basic-grid">
                    {basicSectionFields.map((field, index) => renderEditableField(field, 'basic', index))}
                  </div>
                </div>
              )}
              {activeFormTab === 'configuration' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">Configuration Settings</h3>
                    <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">Keep layout, spacing, and error presentation consistent with Leads.</p>
                  </div>
                  <div className={sectionGridClass} data-testid="amro-master-data-configuration-grid">
                    {configurationSectionFields.map((field) => renderEditableField(field, 'configuration'))}
                  </div>
                </div>
              )}
              {activeFormTab === 'system' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[hsl(var(--mdm-template-heading))]">System Information</h3>
                    <p className="text-[12px] text-[hsl(var(--mdm-template-muted))]">Read-only fields follow the same grid and spacing contract.</p>
                  </div>
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
                </div>
              )}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[hsl(var(--mdm-template-border))] pt-4">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => void handleDelete()} disabled={!selectedId}>Delete</Button>
                <Button onClick={() => void handleSubmitModal()}>
                  {modalMode === 'create' ? 'Save' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={aircraftWorkPackageDialogOpen} onOpenChange={setAircraftWorkPackageDialogOpen}>
          <DialogContent className="mdm-template-dialog">
            <DialogHeader className="border-b border-[hsl(var(--mdm-template-border))] px-6 py-4">
              <DialogTitle className="text-[15px] font-semibold text-[hsl(var(--mdm-template-heading))]">
                Create Work Package (Aircraft: {String(selectedAircraft?.tail_number || 'N/A')})
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[hsl(var(--mdm-template-muted))]">
                Aircraft context is pre-bound with trigger metadata for auditable package creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 px-6 pb-6 pt-4">
              <div className="mdm-template-form-grid">
                <div className={sectionFieldClass}>
                  <Label className="mdm-template-label">Source Trigger</Label>
                  <Select value={aircraftWorkPackageValues.source} onValueChange={(value) => setAircraftWorkPackageField('source', value)}>
                    <SelectTrigger className="mdm-template-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="schedule_due">Schedule Due</SelectItem>
                      <SelectItem value="defect">Defect</SelectItem>
                      <SelectItem value="campaign">Campaign</SelectItem>
                      <SelectItem value="predictive_alert">Predictive Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={sectionFieldClass}>
                  <Label className="mdm-template-label">Maintenance Type</Label>
                  <Select value={aircraftWorkPackageValues.maintenanceType} onValueChange={(value) => setAircraftWorkPackageField('maintenanceType', value)}>
                    <SelectTrigger className="mdm-template-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="hangar">Hangar</SelectItem>
                      <SelectItem value="shop">Shop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={sectionFieldClass}>
                  <Label className="mdm-template-label">Priority</Label>
                  <Select value={aircraftWorkPackageValues.priority} onValueChange={(value) => setAircraftWorkPackageField('priority', value)}>
                    <SelectTrigger className="mdm-template-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={sectionFieldClass}>
                  <Label className="mdm-template-label">Station</Label>
                  <Input
                    value={aircraftWorkPackageValues.station}
                    onChange={(event) => setAircraftWorkPackageField('station', event.target.value)}
                    className={cn('mdm-template-input', aircraftWorkPackageErrors.station && 'border-destructive')}
                    aria-invalid={Boolean(aircraftWorkPackageErrors.station)}
                  />
                  {aircraftWorkPackageErrors.station ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.station}</p> : null}
                </div>
                <div className={sectionFieldClass}>
                  <Label className="mdm-template-label">Planned Start</Label>
                  <Input
                    type="datetime-local"
                    value={aircraftWorkPackageValues.plannedStart}
                    onChange={(event) => setAircraftWorkPackageField('plannedStart', event.target.value)}
                    className={cn('mdm-template-input', aircraftWorkPackageErrors.plannedStart && 'border-destructive')}
                    aria-invalid={Boolean(aircraftWorkPackageErrors.plannedStart)}
                  />
                  {aircraftWorkPackageErrors.plannedStart ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.plannedStart}</p> : null}
                </div>
                <div className={sectionFieldClass}>
                  <Label className="mdm-template-label">Planned End</Label>
                  <Input
                    type="datetime-local"
                    value={aircraftWorkPackageValues.plannedEnd}
                    onChange={(event) => setAircraftWorkPackageField('plannedEnd', event.target.value)}
                    className={cn('mdm-template-input', aircraftWorkPackageErrors.plannedEnd && 'border-destructive')}
                    aria-invalid={Boolean(aircraftWorkPackageErrors.plannedEnd)}
                  />
                  {aircraftWorkPackageErrors.plannedEnd ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.plannedEnd}</p> : null}
                </div>
                <div className={fullWidthSectionFieldClass}>
                  <Label className="mdm-template-label">Scope Builder</Label>
                  <Textarea
                    value={aircraftWorkPackageValues.scopeItemsText}
                    onChange={(event) => setAircraftWorkPackageField('scopeItemsText', event.target.value)}
                    className={cn('mdm-template-input min-h-[130px]', aircraftWorkPackageErrors.scopeItemsText && 'border-destructive')}
                    placeholder="One scope item per line"
                    aria-invalid={Boolean(aircraftWorkPackageErrors.scopeItemsText)}
                  />
                  {aircraftWorkPackageErrors.scopeItemsText ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.scopeItemsText}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[hsl(var(--mdm-template-border))] pt-4">
                <Button variant="outline" onClick={() => setAircraftWorkPackageDialogOpen(false)} disabled={aircraftWorkPackageSubmitting}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={() => void handleAircraftWorkPackageSubmit('save_draft')} disabled={aircraftWorkPackageSubmitting || !canCreateWorkPackage}>
                  Save Draft
                </Button>
                <Button variant="outline" onClick={() => void handleAircraftWorkPackageSubmit('create_schedule')} disabled={aircraftWorkPackageSubmitting || !canScheduleWorkPackage}>
                  Create & Schedule
                </Button>
                <Button onClick={() => void handleAircraftWorkPackageSubmit('create_open')} disabled={aircraftWorkPackageSubmitting || !canCreateWorkPackage}>
                  Create & Open Work Package
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { logger } from '@/lib/logger';
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
  Users,
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
import { buildApiHeaders, parseApiPayload, verifyReferenceExists } from './amro-settings-master-data/services';
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
  isBlank,
  parseWorkPackageItems,
  pickFormValuesFromRow,
} from './amro-settings-master-data/utils';
import { FlightLogsFilters } from './amro-settings-master-data/components/FlightLogsFilters';

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

const AIRCRAFT_NAV_RAIL = [
  { label: 'Overview', path: '/dashboard/amro/overview' },
  { label: 'Work Packages', path: '/dashboard/amro/aircraft/work-packages' },
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
const AIRCRAFT_STATUS_OPTIONS = ['active', 'inactive', 'grounded', 'maintenance'] as const;
const AIRCRAFT_FORM_SECTION_FIELD_KEYS: Record<FormSectionKey, string[]> = {
  basic: ['tail_number', 'registration', 'serial_number', 'aircraft_type', 'manufacturer_id'],
  configuration: ['aircraft_model', 'configuration_code', 'maintenance_program', 'status'],
};
const AIRCRAFT_FIELD_HELP: Partial<Record<string, string>> = {
  tail_number: 'Use 3-12 uppercase letters, numbers, or hyphen.',
  registration: 'Registration should align with authority records and paint scheme.',
  serial_number: 'Enter manufacturer serial number with at least 3 characters.',
  manufacturer_id: 'Choose the approved manufacturer before selecting aircraft model.',
  aircraft_model: 'Model list is filtered by selected manufacturer.',
  maintenance_program: 'Attach approved program code used by planning and compliance teams.',
  status: 'Status drives risk scoring and available operational quick actions.',
};
const SYSTEM_TEMPLATE_MODEL_OPTIONS = ['B737-800 template', 'A320neo template', 'ATR72 template', 'B787-9 template'];
const AIRCRAFT_BASE_OPTIONS = ['Nothing selected', 'DXB', 'LHR', 'JFK', 'SIN'];
const AIRCRAFT_OWNER_OPTIONS = ['Nothing selected', 'Owned', 'Leased', 'Wet Lease'];
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
  { key: 'calendar', name: 'Calendar', serialNumber: '-', model: 'Nose Gear Assy', initialValue: 'since', initialDate: '', unit: 'Manufacturing date' },
  { key: 'flight_hours', name: 'Flight hours', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'hours' },
  { key: 'landing', name: 'Landing', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'cycles' },
  { key: 'n1', name: 'N1', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'value' },
  { key: 'n2', name: 'N2', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'value' },
];

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

type AmroSettingsMasterDataPageProps = {
  entityOverride?: MasterEntity;
  variant?: 'master-data' | 'aircraft-sub-module';
};

export function AmroSettingsMasterDataPage({ entityOverride, variant = 'master-data' }: AmroSettingsMasterDataPageProps = {}) {
  const { context } = useCRM();
  const { hasPermission, session } = useAuth();
  const { entity: entityParam } = useParams<{ entity?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAircraftSubModule = variant === 'aircraft-sub-module';
  const routeBasePath = isAircraftSubModule ? '/dashboard/amro' : '/dashboard/amro/settings/master-data';
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
  const [aircraftPresenceByRowId, setAircraftPresenceByRowId] = useState<Record<string, AircraftPresenceCollaborator[]>>({});
  const [aircraftPresenceLoading, setAircraftPresenceLoading] = useState(false);
  const [aircraftPresenceError, setAircraftPresenceError] = useState('');
  const aircraftPresenceCacheRef = useRef<{ key: string; fetchedAt: number; map: Record<string, AircraftPresenceCollaborator[]> } | null>(null);
  const clickDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const recordsRequestControllerRef = useRef<AbortController | null>(null);
  const recordsRequestIdRef = useRef(0);
  const rowsRenderSignatureRef = useRef('');
  const manufacturerSeedAttemptedRef = useRef(false);
  const selectionAnchorRef = useRef<string | null>(null);
  const aircraftSnapshotAuthToastShownRef = useRef(false);
  const aircraftEnhancementEnabled = normalizeFeatureFlag(import.meta.env.VITE_AMRO_AIRCRAFT_FORM_ENHANCEMENTS, true);
  const aircraftFormDraftKey = useMemo(
    () => `amro:aircraft-form-draft:${modalMode}:${selectedId || 'new'}`,
    [modalMode, selectedId],
  );
  const [aircraftFormDraftStatus, setAircraftFormDraftStatus] = useState<'idle' | 'restored' | 'saved'>('idle');
  const [aircraftFormLastSavedAt, setAircraftFormLastSavedAt] = useState('');
  const [lastCollaborationPingAt, setLastCollaborationPingAt] = useState(new Date().toISOString());
  const [aircraftNoSerialNumber, setAircraftNoSerialNumber] = useState(false);
  const [aircraftTemplateModel, setAircraftTemplateModel] = useState(SYSTEM_TEMPLATE_MODEL_OPTIONS[0]);
  const [aircraftManufacturingDate, setAircraftManufacturingDate] = useState('');
  const [aircraftBase, setAircraftBase] = useState(AIRCRAFT_BASE_OPTIONS[0]);
  const [aircraftOwner, setAircraftOwner] = useState(AIRCRAFT_OWNER_OPTIONS[0]);
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

  const scope = useMemo(
    () => ({
      tenantId: context.tenantId,
      franchiseId: context.franchiseId,
      userId: context.userId,
    }),
    [context.franchiseId, context.tenantId, context.userId],
  );
  const sessionAccessToken = useMemo(() => String(session?.access_token || '').trim(), [session?.access_token]);

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
      if ((error as Error).name === 'AbortError') {
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
    const registration = String(formValues.registration ?? '').trim().toUpperCase();
    const serialNumber = String(formValues.serial_number ?? '').trim().toUpperCase();
    setAircraftNoSerialNumber(serialNumber === 'N/A');
    const templateModelSource = formValues.system_template_model ?? SYSTEM_TEMPLATE_MODEL_OPTIONS[0] ?? '';
    setAircraftTemplateModel(String(templateModelSource).trim() || SYSTEM_TEMPLATE_MODEL_OPTIONS[0]);
    setAircraftManufacturingDate(String(formValues.manufacturing_date ?? '').trim());
    const baseSource = formValues.base_location ?? AIRCRAFT_BASE_OPTIONS[0] ?? '';
    setAircraftBase(String(baseSource).trim() || AIRCRAFT_BASE_OPTIONS[0]);
    const ownerSource = formValues.owner_name ?? AIRCRAFT_OWNER_OPTIONS[0] ?? '';
    setAircraftOwner(String(ownerSource).trim() || AIRCRAFT_OWNER_OPTIONS[0]);
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
        aircraft_type: String(previous.aircraft_type ?? '').trim() || AIRCRAFT_TYPE_OPTIONS[0],
        status: String(previous.status ?? '').trim() || 'active',
      };
    });
  }, [entity, modalMode, modalOpen, selectedId]);

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
          navigate(`/dashboard/amro/aircraft/work-packages?${query.toString()}`);
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
            <Select value={String(formValues[field.key] ?? '')} onValueChange={(value) => setFieldValue(field.key, value)}>
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
              <Link className="transition-colors hover:text-[hsl(var(--mdm-template-focus))]" to={breadcrumbParentPath}>{breadcrumbParentLabel}</Link>
              <span>/</span>
              <span className="font-medium text-[hsl(var(--mdm-template-heading))]">{breadcrumbCurrentLabel}</span>
            </nav>
            <h1 className="mdm-template-header-title">{pageTitle}</h1>
            <p className="mdm-template-header-subtitle">{pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>
            <Button variant="ghost" asChild>
              <Link to={breadcrumbParentPath} className="underline-offset-4 hover:underline">
                {homeActionLabel}
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
                    <Button size="sm" variant="outline" onClick={() => handleAircraftContextNavigation('/dashboard/amro/aircraft/work-packages')}>
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
              {entity === 'aircraft' ? (
                <div className="space-y-3 rounded-md bg-[#08a8bd] p-3 text-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-white">
                    <p className="font-semibold">
                      Required Completion {aircraftRequiredProgress.completed}/{aircraftRequiredProgress.total} ({aircraftRequiredProgress.percent}%)
                    </p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <Users className="h-3.5 w-3.5" />
                      <span>{collaborationIndicator.status} · {collaborationIndicator.activeEditors} active</span>
                      <span>Last sync {collaborationIndicator.lastSeen}</span>
                      <span>Errors {aircraftValidationSummary.errorCount}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <section className="space-y-2 rounded bg-white p-3">
                      <p className="text-[11px] text-slate-600">System Template Model</p>
                      <Label className="text-[12px] font-medium text-slate-800">System template model</Label>
                      <Select
                        value={aircraftTemplateModel}
                        onValueChange={(value) => {
                          setAircraftTemplateModel(value);
                          setAircraftAuxField('system_template_model', value);
                        }}
                      >
                        <SelectTrigger className="h-8 border-slate-300 text-[12px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_TEMPLATE_MODEL_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </section>
                    <section className="rounded bg-white p-3">
                      <p className="mb-2 text-[11px] text-slate-600">System Template Details</p>
                      <div className="grid grid-cols-[1fr_1fr_1.5fr] border border-slate-200 text-[12px]">
                        <div className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Name</div>
                        <div className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Serial number</div>
                        <div className="px-3 py-2 font-semibold text-slate-800">System Details</div>
                        <div className="border-r border-t border-slate-200 px-3 py-2 text-slate-700">{String(formValues.registration || '') || 'p'}</div>
                        <div className="border-r border-t border-slate-200 px-3 py-2 text-slate-700">{String(formValues.serial_number || '') || '-'}</div>
                        <div className="border-t border-slate-200 px-3 py-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Select value={String(formValues.aircraft_type ?? '')} onValueChange={(value) => setFieldValue('aircraft_type', value)}>
                              <SelectTrigger className={cn('h-8 text-[12px]', formErrors.aircraft_type && 'border-destructive')}>
                                <SelectValue placeholder="Aircraft type" />
                              </SelectTrigger>
                              <SelectContent>
                                {AIRCRAFT_TYPE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={String(formValues.status ?? '')} onValueChange={(value) => setFieldValue('status', value)}>
                              <SelectTrigger className={cn('h-8 text-[12px]', formErrors.status && 'border-destructive')}>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {AIRCRAFT_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={String(formValues.manufacturer_id ?? '')} onValueChange={(value) => setFieldValue('manufacturer_id', value)}>
                              <SelectTrigger className={cn('h-8 text-[12px]', formErrors.manufacturer_id && 'border-destructive')}>
                                <SelectValue placeholder="Manufacturer" />
                              </SelectTrigger>
                              <SelectContent>
                                {resolveSelectOptions({ key: 'manufacturer_id', label: 'Manufacturer', type: 'select' }).map((option) => (
                                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={String(formValues.aircraft_model ?? '')} onValueChange={(value) => setFieldValue('aircraft_model', value)}>
                              <SelectTrigger className={cn('h-8 text-[12px]', formErrors.aircraft_model && 'border-destructive')}>
                                <SelectValue placeholder="Aircraft model" />
                              </SelectTrigger>
                              <SelectContent>
                                {resolveSelectOptions({ key: 'aircraft_model', label: 'Aircraft Model', type: 'select' }).map((option) => (
                                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <section className="space-y-2 rounded bg-white p-3">
                      <p className="text-[11px] text-slate-600">Aircraft definition</p>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-registration" className="text-[12px]">Registration</Label>
                        <Input
                          id="aircraft-registration"
                          ref={firstFieldRef}
                          value={String(formValues.registration ?? '')}
                          onChange={(event) => {
                            const value = event.target.value.toUpperCase();
                            setFieldValue('registration', value);
                            if (!String(formValues.tail_number ?? '').trim()) {
                              setFieldValue('tail_number', value);
                            }
                          }}
                          className={cn('h-8 text-[12px]', formErrors.registration && 'border-destructive')}
                        />
                        {formErrors.registration ? <p className="mdm-template-danger">{formErrors.registration}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="aircraft-no-serial" checked={aircraftNoSerialNumber} onCheckedChange={(value) => handleAircraftNoSerialChange(Boolean(value))} />
                        <Label htmlFor="aircraft-no-serial" className="text-[12px] font-normal">No Serial number</Label>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-serial" className="text-[12px]">Serial number</Label>
                        <Input
                          id="aircraft-serial"
                          value={String(formValues.serial_number ?? '')}
                          onChange={(event) => setFieldValue('serial_number', event.target.value.toUpperCase())}
                          disabled={aircraftNoSerialNumber}
                          className={cn('h-8 text-[12px]', formErrors.serial_number && 'border-destructive')}
                        />
                        {formErrors.serial_number ? <p className="mdm-template-danger">{formErrors.serial_number}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-manufacturing-date" className="text-[12px]">Manufacturing Date</Label>
                        <div className="relative">
                          <Input
                            id="aircraft-manufacturing-date"
                            type="date"
                            value={aircraftManufacturingDate}
                            onChange={(event) => {
                              setAircraftManufacturingDate(event.target.value);
                              setAircraftAuxField('manufacturing_date', event.target.value);
                            }}
                            className="h-8 pr-8 text-[12px]"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[12px]">Base</Label>
                        <Select
                          value={aircraftBase}
                          onValueChange={(value) => {
                            setAircraftBase(value);
                            setAircraftAuxField('base_location', value);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AIRCRAFT_BASE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[12px]">Owner</Label>
                        <Select
                          value={aircraftOwner}
                          onValueChange={(value) => {
                            setAircraftOwner(value);
                            setAircraftAuxField('owner_name', value);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AIRCRAFT_OWNER_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-line-number" className="text-[12px]">Line number</Label>
                        <Input
                          id="aircraft-line-number"
                          value={aircraftLineNumber}
                          onChange={(event) => {
                            setAircraftLineNumber(event.target.value);
                            setAircraftAuxField('line_number', event.target.value);
                          }}
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-variable-number" className="text-[12px]">Variable number</Label>
                        <Input
                          id="aircraft-variable-number"
                          value={aircraftVariableNumber}
                          onChange={(event) => {
                            setAircraftVariableNumber(event.target.value);
                            setAircraftAuxField('variable_number', event.target.value);
                            if (!String(formValues.tail_number ?? '').trim()) {
                              setFieldValue('tail_number', event.target.value.toUpperCase());
                            }
                          }}
                          className={cn('h-8 text-[12px]', formErrors.tail_number && 'border-destructive')}
                        />
                        {formErrors.tail_number ? <p className="mdm-template-danger">{formErrors.tail_number}</p> : null}
                      </div>
                    </section>
                    <section className="rounded bg-white p-3">
                      <p className="mb-2 text-[11px] text-slate-600">Counters</p>
                      <div className="overflow-x-auto border border-slate-200">
                        <table className="w-full text-[12px]">
                          <thead className="bg-slate-50">
                            <tr className="text-left text-slate-800">
                              <th className="px-2 py-2 font-semibold">Name</th>
                              <th className="px-2 py-2 font-semibold">Serial number</th>
                              <th className="px-2 py-2 font-semibold">Model</th>
                              <th className="px-2 py-2 font-semibold">Initial Value / Initial Date</th>
                              <th className="px-2 py-2 font-semibold"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {aircraftCounterRows.map((row) => (
                              <tr key={row.key} className="border-t border-slate-100 align-top">
                                <td className="px-2 py-2 text-slate-700">{row.name}</td>
                                <td className="px-2 py-2 text-slate-700">{row.serialNumber}</td>
                                <td className="px-2 py-2 text-slate-700">{row.model}</td>
                                <td className="px-2 py-1">
                                  <div className="grid gap-1 sm:grid-cols-[130px_150px]">
                                    <Input
                                      value={row.initialValue}
                                      onChange={(event) => setAircraftCounterValue(row.key, 'initialValue', event.target.value)}
                                      className="h-8 text-[12px]"
                                    />
                                    <div className="relative">
                                      <Input
                                        type="date"
                                        value={row.initialDate}
                                        onChange={(event) => setAircraftCounterValue(row.key, 'initialDate', event.target.value)}
                                        className="h-8 pr-8 text-[12px]"
                                      />
                                      <CalendarDays className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-slate-600">{row.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                  <section className="space-y-2 rounded bg-white p-3">
                    <p className="text-[11px] text-slate-600">Approved maintenance program</p>
                    <div className="space-y-1">
                      <Label htmlFor="aircraft-maintenance-program" className="text-[12px]">Maintenance Program</Label>
                      <Input
                        id="aircraft-maintenance-program"
                        value={String(formValues.maintenance_program ?? '')}
                        onChange={(event) => setFieldValue('maintenance_program', event.target.value)}
                        className={cn('h-8 text-[12px]', formErrors.maintenance_program && 'border-destructive')}
                      />
                      {formErrors.maintenance_program ? <p className="mdm-template-danger">{formErrors.maintenance_program}</p> : null}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-maintenance-revision-number" className="text-[12px]">Revision number</Label>
                        <Input
                          id="aircraft-maintenance-revision-number"
                          value={aircraftMaintenanceRevisionNumber}
                          onChange={(event) => {
                            setAircraftMaintenanceRevisionNumber(event.target.value);
                            setAircraftAuxField('maintenance_revision_number', event.target.value);
                          }}
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-maintenance-amendment-number" className="text-[12px]">Amendment number</Label>
                        <Input
                          id="aircraft-maintenance-amendment-number"
                          value={aircraftAmendmentNumber}
                          onChange={(event) => {
                            setAircraftAmendmentNumber(event.target.value);
                            setAircraftAuxField('amendment_number', event.target.value);
                          }}
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-maintenance-revision-date" className="text-[12px]">Revision date</Label>
                        <Input
                          id="aircraft-maintenance-revision-date"
                          type="date"
                          value={aircraftMaintenanceRevisionDate}
                          onChange={(event) => {
                            setAircraftMaintenanceRevisionDate(event.target.value);
                            setAircraftAuxField('maintenance_revision_date', event.target.value);
                          }}
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-maintenance-amendment-date" className="text-[12px]">Amendment date</Label>
                        <Input
                          id="aircraft-maintenance-amendment-date"
                          type="date"
                          value={aircraftAmendmentDate}
                          onChange={(event) => {
                            setAircraftAmendmentDate(event.target.value);
                            setAircraftAuxField('amendment_date', event.target.value);
                          }}
                          className="h-8 text-[12px]"
                        />
                      </div>
                    </div>
                  </section>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {aircraftAuditTimeline.map((item) => (
                      <div key={item.label} className="rounded border border-white/40 bg-white/90 px-2 py-1 text-slate-700">
                        <p className="text-[10px]">{item.label}</p>
                        <p className="text-[11px] font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
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

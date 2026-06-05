// Phase 8h.3 — domain types extracted from AmroSettingsMasterDataPage.tsx.
// Aircraft work-order + dashboard + template + presence option shapes
// that were defined inline in the host page. Pure type declarations
// with no runtime code; lifted to keep the page module focused on
// component logic.

import type { AircraftDashboardKpis } from './aircraft-ui-constants';

// ── List view / sort + inline edit ─────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export type AircraftWorkOrderTab =
  | 'new-wp' | 'existing-wp' | 'non-performed-tasks'
  | 'selected-task' | 'all-tasks';

export type InlineEditingCell = {
  rowId: string;
  column: string;
} | null;

// ── Master-data selection option shapes ────────────────────────────────

export type ManufacturerOption = {
  id: string;
  label: string;
  code: string;
  name: string;
  tenantId: string;
  active: boolean;
};

export type AssemblyTypeOption = {
  id: string;
  label: string;
  active: boolean;
};

export type AssemblyModelOption = {
  id: string;
  label: string;
  name: string;
  modelValue: string;
  aircraftType: string;
  tenantId?: string;
  franchiseId?: string;
  manufacturerId: string;
  manufacturerTokens: string[];
  active: boolean;
};

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  depth?: number;
};

export type AircraftTempOption = {
  id: string;
  name: string;
  tenantId: string;
  franchiseId: string;
  assemblyModelId: string;
  maintenanceProgram: string;
  revisionNumber: string;
  amendmentNumber: string;
  modelJson: unknown;
};

// ── Form section + work-order trigger enums ────────────────────────────

export type FormSectionKey = 'basic' | 'configuration';
export type WorkOrderTrigger = 'schedule_due' | 'defect' | 'campaign' | 'predictive_alert';
export type WorkOrderCreateAction = 'save_draft' | 'create_schedule' | 'create_open';

export type AircraftWorkOrderFormValues = {
  source: WorkOrderTrigger;
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: '' | 'planning' | 'scheduled' | 'in_progress' | 'blocked';
  validationState: '' | 'pending' | 'validated' | 'not_validated';
  plannedStart: string;
  plannedEnd: string;
  station: string;
  workOrderNumber: string;
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

export type AircraftWorkOrderSnapshot = {
  open: number;
  inProgress: number;
  deferred: number;
  completed: number;
  rtsBlockers: number;
  slaRisk: number;
};

export type AircraftPresenceCollaborator = {
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

// ── Work-order template registry ───────────────────────────────────────

export type WorkOrderTemplateRegistryItem = {
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

export type AircraftTemplateAssociatedTaskRow = {
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

// ── Aircraft dashboard schemas ─────────────────────────────────────────

export type AircraftDashboardTrendPoint = {
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

export type AircraftDashboardAlert = {
  module?: string;
  code?: string;
  severity?: string;
  message?: string;
  due_in_days?: number | null;
};

export type AircraftDashboardEngineModule = {
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

export type AircraftDashboardComponentsModule = {
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

export type AircraftDashboardModuleFilter = 'overview' | 'engine' | 'components' | 'all';

export type EngineUsabilityTaskId =
  | 'engine_risk_scan'
  | 'engine_maintenance_next_due'
  | 'engine_compliance_readiness'
  | 'engine_anomaly_review'
  | 'engine_data_entry_validation';

export type AircraftDashboardReportSection = {
  section: string;
  metric: string;
  value: string;
};

export type AircraftDashboardOutput = {
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

// ── Engine read models ─────────────────────────────────────────────────

export type EngineAssetReadModel = {
  id: string;
  tailNumber?: string;
  engineSerialNumber?: string;
  position?: string;
  tsn?: number;
  csn?: number;
  status?: string;
};

export type EnginePerformanceHistoryPoint = {
  ts: string;
  metric: string;
  value: number;
  unit?: string;
};

// ── Aircraft form section keys + counter defaults ──────────────────────

export const AIRCRAFT_FORM_SECTION_FIELD_KEYS: Record<FormSectionKey, string[]> = {
  basic: ['tail_number', 'registration', 'serial_number', 'aircraft_type', 'engine_type', 'manufacturer_id'],
  configuration: ['aircraft_model', 'configuration_code', 'maintenance_program', 'status'],
};

export type AircraftCounterRow = {
  key: string;
  name: string;
  serialNumber: string;
  model: string;
  initialValue: string;
  initialDate: string;
  unit: string;
};

export const getDefaultAircraftCounterRows = (): AircraftCounterRow[] => [
  { key: 'calendar', name: 'Calendar', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'flight_hours', name: 'Flight hours', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'landing', name: 'Landing', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'n1', name: 'N1', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
  { key: 'n2', name: 'N2', serialNumber: '', model: '', initialValue: '', initialDate: '', unit: '' },
];

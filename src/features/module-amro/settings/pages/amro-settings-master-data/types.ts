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

export type RecordRow = {
  id: string;
  [key: string]: unknown;
};

export type SortDirection = 'asc' | 'desc';

export type InlineEditingCell = {
  rowId: string;
  column: string;
} | null;

export type ManufacturerOption = {
  id: string;
  label: string;
  code: string;
  name: string;
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
  modelValue: string;
  manufacturerId: string;
  manufacturerTokens: string[];
  active: boolean;
};

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type FormFieldType = 'text' | 'email' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'boolean' | 'json';

export type EntityFormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
};

export type FormValues = Record<string, unknown>;
export type FormSectionKey = 'basic' | 'configuration';
export type WorkPackageTrigger = 'schedule_due' | 'defect' | 'campaign' | 'predictive_alert';
export type WorkPackageCreateAction = 'save_draft' | 'create_schedule' | 'create_open';

export type AircraftWorkPackageFormValues = {
  source: WorkPackageTrigger;
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  priority: 'low' | 'medium' | 'high' | 'critical';
  plannedStart: string;
  plannedEnd: string;
  station: string;
  scopeItemsText: string;
};

export type AircraftWorkPackageSnapshot = {
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

export type ReferenceEntity = MasterEntity | 'assembly_types';

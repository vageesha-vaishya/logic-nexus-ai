// Constants + types + small helpers extracted from
// AmroSettingsMasterDataPage.tsx (Slice E continuation). All static
// content — no React, no module-level mutable state.

// ── Master entity catalog ───────────────────────────────────────────────────

export type MasterEntity =
  | 'aircraft'
  | 'ata_codes'
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
  | 'work_order_templates';

export const ENTITY_LABEL: Record<MasterEntity, string> = {
  aircraft: 'Aircraft',
  ata_codes: 'ATA',
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
  work_order_templates: 'Work Package Templates',
};

// ── Table column maps (per-entity) ──────────────────────────────────────────

export const ENTITY_TABLE_COLUMNS: Record<MasterEntity, string[]> = {
  aircraft: [
    'registration',
    'serial_number',
    'aircraft_operators_id',
    'aircraft_owners_id',
    'aircraft_base_location_id',
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
  ata_codes: ['code', 'description', 'level', 'chapter_code', 'parent_code_ref', 'is_active', 'updated_at'],
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
  assembly_models: ['id', 'model_code', 'name', 'planning_capability', 'directive_capability', 'manufacturer_id', 'assembly_type_id', 'is_active', 'updated_at'],
  regulator_profiles: ['id', 'regulator_code', 'regulator_name', 'jurisdiction', 'policy_version', 'effective_from', 'is_active', 'updated_at'],
  shift_calendars: ['id', 'station_code', 'shift_name', 'shift_start_time', 'shift_end_time', 'capacity', 'is_active', 'updated_at'],
  work_order_templates: ['id', 'template_code', 'template_name', 'model_id', 'aircraft_model', 'maintenance_type', 'version', 'active', 'updated_at'],
};

export const ENTITY_HIDDEN_COLUMNS: Partial<Record<MasterEntity, string[]>> = {
  aircraft: ['id', 'created_at', 'updated_at', 'tenant_id', 'franchise_id'],
  flight_logs: ['tenant_id', 'franchise_id', 'is_deleted', 'deleted_at', 'deleted_by', 'created_by', 'updated_by', 'metadata'],
  work_order_templates: ['id', 'created_at', 'updated_at', 'tenant_id', 'franchise_id', 'scope_json'],
};

export const AIRCRAFT_EDITABLE_COLUMNS = new Set([
  'registration', 'tail_number', 'serial_number', 'aircraft_type',
  'engine_type', 'aircraft_model', 'maintenance_program', 'status',
]);

export const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
  id: 'ID',
  tail_number: 'Tail Number',
  serial_number: 'Serial Number',
  aircraft_operators_id: 'Operator Owner',
  aircraft_owners_id: 'Aircraft Owner',
  aircraft_base_location_id: 'Base Location',
  owner_name: 'Owner',
  base_location: 'Model Name',
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
  planning_capability: 'No of Planning Capability',
  directive_capability: 'No of Directive Capability',
};

// ── Validation / runtime constants ──────────────────────────────────────────

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TEMPLATE_REGISTRY_TIMEOUT_MS = 12000;
export const ENGINE_USABILITY_STORAGE_KEY = 'amro.engine.usability.session.events.v1';
export const WORK_PACKAGE_CREATE_TIMEOUT_MS = 20000;

// ── Aircraft sub-module constants ───────────────────────────────────────────

export const AIRCRAFT_TYPE_FALLBACK_OPTIONS = [
  'NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded',
];

export const AIRCRAFT_STATUS_OPTIONS = [
  'active', 'pending', 'maintenance', 'grounded', 'retired', 'storage',
] as const;

export const AIRCRAFT_FIELD_HELP: Partial<Record<string, string>> = {
  tail_number: 'Use 3-12 uppercase letters, numbers, or hyphen.',
  registration: 'Registration should align with authority records and paint scheme.',
  serial_number: 'Enter manufacturer serial number with at least 3 characters.',
  engine_type: 'Capture the installed engine family or model code for planning and traceability.',
  manufacturer_id: 'Choose the approved manufacturer before selecting aircraft model.',
  aircraft_model: 'Model list is filtered by selected manufacturer.',
  maintenance_program: 'Attach approved program code used by planning and compliance teams.',
  status: 'Status drives risk scoring and available operational quick actions.',
};

export const AIRCRAFT_UNSELECTED_OPTION = 'Nothing selected';
export const AIRCRAFT_PRESENCE_CACHE_TTL_MS = 120000;

// ── Manufacturer seed list (used by initial-data bootstrap) ────────────────

export const MANUFACTURER_SEED_NAMES = [
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

// ── Helpers ─────────────────────────────────────────────────────────────────

export const isAbortLikeError = (error: unknown): boolean => {
  if (!error) return false;
  const name = String((error as { name?: unknown }).name ?? '').toLowerCase();
  if (name === 'aborterror') return true;
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return message.includes('aborted') || message.includes('signal is aborted');
};

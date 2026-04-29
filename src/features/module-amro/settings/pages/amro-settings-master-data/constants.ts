import type {
  AircraftCounterRow,
  EntityFormField,
  FormSectionKey,
  FormValues,
  MasterEntity,
} from './types';

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

export const ENTITY_TABLE_COLUMNS: Record<MasterEntity, string[]> = {
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
  ata_codes: ['code', 'description', 'level', 'chapter_code', 'parent_code_ref', 'is_active', 'updated_at'],
  flight_logs: ['aircraft_id', 'flight_date', 'flight_number', 'departure_airport', 'arrival_airport', 'pilot_name', 'flight_hours', 'block_hours', 'flight_cycles', 'regulatory_authority'],
  parts_inventory: ['id', 'part_number', 'serial_number', 'description', 'quantity_available', 'warehouse_location', 'status', 'updated_at'],
  suppliers: ['id', 'supplier_code', 'name', 'contact_name', 'email', 'phone', 'is_active', 'updated_at'],
  maintenance_facilities: ['id', 'facility_code', 'name', 'facility_type', 'station_code', 'location_city', 'is_active', 'updated_at'],
  work_centers: ['id', 'work_center_code', 'name', 'center_type', 'station_code', 'capacity_hours_per_day', 'is_active', 'updated_at'],
  skill_codes: ['id', 'skill_code', 'description', 'skill_family', 'license_authority', 'is_certification_required', 'is_active', 'updated_at'],
  manufacturers: ['id', 'manufacturer_code', 'name', 'country', 'is_active', 'updated_at'],
  assembly_models: ['id', 'model_code', 'name', 'manufacturer_id', 'assembly_type_id', 'is_active', 'updated_at'],
  regulator_profiles: ['id', 'regulator_code', 'regulator_name', 'jurisdiction', 'policy_version', 'effective_from', 'is_active', 'updated_at'],
  shift_calendars: ['id', 'station_code', 'shift_name', 'shift_start_time', 'shift_end_time', 'capacity', 'is_active', 'updated_at'],
  work_order_templates: ['id', 'template_code', 'template_name', 'model_id', 'maintenance_type', 'version', 'active', 'updated_at'],
};

export const ENTITY_HIDDEN_COLUMNS: Partial<Record<MasterEntity, string[]>> = {
  aircraft: ['id', 'created_at', 'updated_at', 'tenant_id', 'franchise_id'],
  flight_logs: ['tenant_id', 'franchise_id', 'is_deleted', 'deleted_at', 'deleted_by', 'created_by', 'updated_by', 'metadata'],
};

export const AIRCRAFT_EDITABLE_COLUMNS = new Set(['registration', 'tail_number', 'serial_number', 'aircraft_type', 'engine_type', 'aircraft_model', 'maintenance_program', 'status']);

export const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
  id: 'ID',
  part_number: 'Item Number',
  item_number: 'Item Number',
  description: 'Item Details',
  quantity_available: 'Available Qty',
  warehouse_location: 'Storage Location',
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

export const AIRCRAFT_NAV_RAIL = [
  { label: 'Overview', path: '/dashboard/amro/overview' },
  { label: 'Work Orders', path: '/dashboard/amro/work-orders' },
  { label: 'Scheduling', path: '/dashboard/amro/scheduling' },
  { label: 'Compliance', path: '/dashboard/amro/compliance' },
  { label: 'Task Execution', path: '/dashboard/amro/task-execution' },
  { label: 'Audit', path: '/dashboard/amro/audit' },
] as const;

export const AIRCRAFT_PRESENCE_BADGE_CLASSES = ['bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600'] as const;

export const MANUFACTURER_SEED_NAMES = [
  'AIRBUS', 'ATR', 'ATR 72', 'Beech Aircraft Corporation, Wichita, Kansas, USA', 'BELL HELICOPTER TEXTRON', 'Bombardier', 'CENTRAL GEARBOX', 'CESSNA AIRCRAFT COMPANY', 'CESSNA CARAVAN 208B', 'CESSNA CITATION', 'DASSAULT AVIATION', 'De Havilland Aircraft Company of Canada', 'EMBRAER', 'EUROCOPTER', 'FZM', 'Hartzell', 'HARTZELL PROPELLER INC', 'HAWKER BEECHCRAFT', 'HINDUSTAN AERONAUTICS LTD', 'HONEYWELL', 'Keystone Helicopter', 'KING AIR', 'Learjet Inc. (Bombardier)', 'Lycoming Textron', 'McCAULEY', 'PARTHENAVIA', 'PIAGGIO AERO', 'Pilatus', 'PILATUS PC-12', 'Pratt & Whittney', 'RAYTHEON AIRCRAFT COMPANY', 'ROLLS ROYCE', 'Schweizer', 'SGST', 'SUPER KING AIR', 'TAAL', 'TURBOMECA', 'VULCAN AIR', 'Westland Agusta', 'WESTLAND AUGUSTA', 'WILLIAMS INTERNATIONAL',
];

export const AIRCRAFT_TYPE_OPTIONS = ['NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded'];
export const AIRCRAFT_STATUS_OPTIONS = ['active', 'maintenance', 'grounded', 'retired', 'storage'] as const;
export const AIRCRAFT_FORM_SECTION_FIELD_KEYS: Record<FormSectionKey, string[]> = {
  basic: ['tail_number', 'registration', 'serial_number', 'aircraft_type', 'engine_type', 'manufacturer_id'],
  configuration: ['aircraft_model', 'configuration_code', 'maintenance_program', 'status'],
};
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
export const SYSTEM_TEMPLATE_MODEL_OPTIONS = ['B737-800 template', 'A320neo template', 'ATR72 template', 'B787-9 template'];
export const AIRCRAFT_BASE_OPTIONS = ['Nothing selected', 'DXB', 'LHR', 'JFK', 'SIN'];
export const AIRCRAFT_OWNER_OPTIONS = ['Nothing selected', 'Owned', 'Leased', 'Wet Lease'];

export const getDefaultAircraftCounterRows = (): AircraftCounterRow[] => [
  { key: 'calendar', name: 'Calendar', serialNumber: '-', model: 'Nose Gear Assy', initialValue: 'since', initialDate: '', unit: 'Manufacturing date' },
  { key: 'flight_hours', name: 'Flight hours', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'hours' },
  { key: 'landing', name: 'Landing', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'cycles' },
  { key: 'n1', name: 'N1', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'value' },
  { key: 'n2', name: 'N2', serialNumber: '-', model: '-', initialValue: '0.0', initialDate: '', unit: 'value' },
];

export const ENTITY_FORM_FIELDS: Record<MasterEntity, EntityFormField[]> = {
  aircraft: [
    { key: 'registration', label: 'Registration', type: 'text' },
    { key: 'tail_number', label: 'Tail Number', type: 'text', required: true },
    { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
    // Aircraft type is derived from template/model metadata in the aircraft create flow.
    { key: 'aircraft_type', label: 'Aircraft Type', type: 'select', required: false, options: AIRCRAFT_TYPE_OPTIONS },
    { key: 'engine_type', label: 'Engine Type', type: 'text' },
    { key: 'aircraft_template', label: 'Aircraft Template', type: 'select', required: true },
    { key: 'aircraft_model', label: 'Aircraft Model', type: 'text' }, // Populated from template's assembly_models
    { key: 'manufacturer_id', label: 'Manufacturer', type: 'text' }, // Populated from template's assembly_models
    { key: 'configuration_code', label: 'Configuration Code', type: 'text' },
    { key: 'maintenance_program', label: 'Maintenance Program', type: 'text' },
    { key: 'engine_install_history', label: 'Engine Install History', type: 'json' },
    { key: 'thrust_rating_change_log', label: 'Thrust Rating Change Log', type: 'json' },
    { key: 'on_wing_lifecycle_records', label: 'On-Wing Lifecycle Records', type: 'json' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'maintenance', 'grounded', 'retired', 'storage'] },
  ],
  ata_codes: [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'chapter_code', label: 'Chapter Code', type: 'text', required: true },
    { key: 'parent_id', label: 'Parent ATA', type: 'select', placeholder: 'Select parent ATA (optional)' },
    { key: 'franchise_id', label: 'Franchise', type: 'select', placeholder: 'Select franchise (optional)' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
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
    { key: 'part_number', label: 'Item Number', type: 'text', required: true },
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
  work_order_templates: [
    { key: 'template_code', label: 'Template Code', type: 'text', required: true },
    { key: 'template_name', label: 'Template Name', type: 'text', required: true },
    { key: 'model_id', label: 'Model ID', type: 'text', required: true },
    { key: 'aircraft_model', label: 'Aircraft Model', type: 'select', required: true },
    { key: 'maintenance_type', label: 'Maintenance Type', type: 'select', required: true, options: ['inspection','service', 'line', 'base', 'component', 'overhaul', 'repair', 'upgrade', 'modification'] },
    { key: 'version', label: 'Version', type: 'number', required: true, min: 1 },
    { key: 'active', label: 'Active', type: 'boolean' },
    { key: 'policy_snapshot_id', label: 'Policy Snapshot ID', type: 'text' },
    { key: 'scope_json', label: 'Scope JSON', type: 'json' },
    { key: 'tasks_json', label: 'Tasks JSON', type: 'json' },
  ],
};

export const AMRO_MASTER_ENTITY_FORM_FIELDS = ENTITY_FORM_FIELDS;
export const MASTER_ENTITY_SEQUENCE = Object.keys(ENTITY_LABEL) as MasterEntity[];
export const ENTITY_ROUTE_SEGMENT: Record<MasterEntity, string> = {
  aircraft: 'aircraft',
  ata_codes: 'ata-codes',
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
  work_order_templates: 'work-order-templates',
};

export const ROUTE_SEGMENT_ENTITY: Record<string, MasterEntity> = Object.entries(ENTITY_ROUTE_SEGMENT).reduce(
  (accumulator, [entityKey, routeSegment]) => {
    accumulator[routeSegment] = entityKey as MasterEntity;
    return accumulator;
  },
  {} as Record<string, MasterEntity>,
);

export const ENTITY_DEFAULT_VALUES: Record<MasterEntity, FormValues> = {
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
  ata_codes: { code: '', description: '', chapter_code: '', parent_id: '', parent_code_ref: '', level: 1, franchise_id: '', is_active: true },
  flight_logs: { aircraft_id: '', flight_date: new Date().toISOString().slice(0, 10), flight_number: '', departure_airport: '', arrival_airport: '', pilot_name: '', flight_hours: 0, block_hours: 0, flight_cycles: 0, crew_details: '', fuel_burn_kg: 0, oil_uplift_liters: 0, pirep_discrepancy: '', regulatory_authority: 'DGCA', metadata: '{}' },
  parts_inventory: { part_number: '', serial_number: '', description: '', category: '', unit_of_measure: 'EA', min_stock_level: 0, quantity_on_hand: 0, supplier_id: '', warehouse_location: '', status: 'active' },
  suppliers: { supplier_code: '', name: '', contact_name: '', email: '', phone: '', lead_time_days: 0, rating: 0, is_active: true, metadata: '{}' },
  maintenance_facilities: { facility_code: '', name: '', facility_type: 'line', station_code: '', location_city: '', location_country: '', timezone: '', is_active: true, metadata: '{}' },
  work_centers: { facility_id: '', facility_code: '', work_center_code: '', name: '', center_type: 'airframe', station_code: '', capacity_hours_per_day: 8, is_active: true, metadata: '{}' },
  skill_codes: { skill_code: '', description: '', skill_family: '', license_authority: '', is_certification_required: false, validity_period_months: 0, is_active: true, metadata: '{}' },
  manufacturers: { manufacturer_code: '', name: '', country: '', is_active: true, metadata: '{}' },
  assembly_models: { manufacturer_id: '', assembly_type_id: '', model_code: '', name: '', primary_model: '', description: '', is_active: true, metadata: '{}' },
  regulator_profiles: { regulator_code: '', regulator_name: '', jurisdiction: '', policy_version: '', effective_from: new Date().toISOString().slice(0, 10), effective_to: '', is_active: true, metadata: '{}' },
  shift_calendars: { station_code: '', shift_name: '', shift_start_time: '08:00:00', shift_end_time: '16:00:00', capacity: 1, effective_from: new Date().toISOString().slice(0, 10), effective_to: '', is_active: true },
  work_order_templates: { template_code: '', template_name: '', model_id: '', aircraft_model: '', maintenance_type: 'line', version: 1, active: true, policy_snapshot_id: '', scope_json: '[]', tasks_json: '[]' },
};

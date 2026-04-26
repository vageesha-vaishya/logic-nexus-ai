/**
 * AMRO Type Definitions
 * Core domain models for Aircraft Maintenance, Repair, and Overhaul
 */

// Aircraft Status
export type AircraftStatus = 'active' | 'maintenance' | 'grounded' | 'retired' | 'storage';

// Component Lifecycle Status
export type ComponentStatus = 'installed' | 'removed' | 'repair_queue' | 'under_repair' | 'awaiting_installation' | 'condemned' | 'obsolete';

// Work Package Classification
export type MaintenanceType = 'line' | 'base' | 'component' | 'inspection' | 'overhaul' | 'repair' | 'upgrade' | 'modification';

// Work Package Status
export type WorkPackageStatus = 'planning' | 'approved' | 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'closed' | 'cancelled';

// Task Status
export type TaskStatus = 'pending' | 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'rework_required' | 'cancelled';

// Material Status
export type MaterialStatus = 'pending' | 'ordered' | 'received' | 'installed' | 'cancelled' | 'returned';

// Material Action Type
export type MaterialAction = 'install' | 'remove' | 'inspect' | 'repair';

// Signature Method
export type SignatureMethod = 'digital' | 'pin' | 'biometric';

// Domain Models

export interface Aircraft {
  id: string;
  tenant_id: string;
  franchise_id?: string;
  registration: string;
  aircraft_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  line_number?: string;
  msn?: string;
  current_flight_hours: number;
  current_cycles: number;
  current_flight_hours_since_new: number;
  current_cycles_since_new: number;
  owner_id?: string;
  status: AircraftStatus;
  operator_code?: string;
  base_location?: string;
  home_base?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface WorkPackage {
  id: string;
  tenant_id: string;
  franchise_id?: string;
  aircraft_id: string;
  work_order_number: string;
  work_package_number?: string;
  work_order_template_id?: string;
  work_order_title_id?: string;
  title: string;
  description?: string;
  work_type?: string;
  maintenance_type: MaintenanceType;
  status: WorkPackageStatus;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_completion_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_completion_date?: string;
  estimated_labor_hours?: number;
  actual_labor_hours?: number;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_to?: string;
  generated_tasks_count?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  franchise_id?: string;
  work_order_id?: string;
  work_package_id?: string;
  task_number: string;
  title: string;
  description?: string;
  task_category?: string;
  status: TaskStatus;
  sequence_order?: number;
  sequence_number?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_completion_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_completion_date?: string;
  assigned_to?: string;
  qualifications?: Record<string, unknown> | null;
  required_qualification?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Material {
  id: string;
  tenant_id: string;
  work_package_id: string;
  part_number: string;
  part_name: string;
  part_description?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  status: MaterialStatus;
  action: MaterialAction;
  serial_number?: string;
  received_date?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface StaffQualification {
  id: string;
  tenant_id: string;
  user_id: string;
  qualification_name: string;
  certification_number?: string;
  valid_from: string;
  valid_until: string;
  issued_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AmroAssetSummary {
  id: string;
  tenant_id: string;
  franchise_id?: string;
  registration: string;
  aircraft_type: string;
  serial_number: string;
  status: AircraftStatus;
}

export interface AmroQualificationSummary {
  id: string;
  tenant_id: string;
  staff_id: string;
  qualification_name: string;
  rating: string;
  can_certify_release: boolean;
  expiration_date?: string | null;
  is_active: boolean;
}

export interface AmroComplianceSummary {
  totalEvents: number;
  evidenceCapturedEvents: number;
  pendingSignOffTasks: number;
  authorityCoverage: string[];
  activeRulePacks: number;
}

export interface AmroEvidenceSummary {
  id: string;
  entity_type: 'work_package' | 'task' | 'inspection' | 'release';
  entity_id: string;
  hash: string;
  immutable: boolean;
  created_at: string;
}

export interface AmroForecastRecommendation {
  id: string;
  digital_twin_reference: string;
  risk_score: number;
  trigger: 'telemetry' | 'calendar' | 'reliability';
  recommendation: string;
}

// API Request/Response Types

export interface CreateWorkPackageRequest {
  aircraft_id: string;
  title?: string;
  work_order_title_id?: string;
  work_order_template_id?: string;
  description?: string;
  work_type?: string;
  maintenance_type: MaintenanceType;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_completion_date?: string;
  estimated_labor_hours?: number;
  estimated_cost?: number;
}

export interface UpdateWorkPackageRequest {
  title?: string;
  description?: string;
  work_type?: string;
  status?: WorkPackageStatus;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_completion_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_completion_date?: string;
  estimated_labor_hours?: number;
  actual_labor_hours?: number;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_to?: string;
}

export interface CreateTaskRequest {
  work_order_id?: string;
  work_package_id?: string;
  title: string;
  description?: string;
  task_category?: string;
  sequence_order?: number;
  sequence_number?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_completion_date?: string;
  qualifications?: Record<string, unknown>;
  required_qualification?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  task_category?: string;
  status?: TaskStatus;
  sequence_order?: number;
  sequence_number?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_completion_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_completion_date?: string;
  assigned_to?: string;
  qualifications?: Record<string, unknown> | null;
  required_qualification?: string;
}

// Error Response Type

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
}

// Authenticated Request Type

export interface AuthenticatedRequest {
  tenantId: string;
  userId: string;
}

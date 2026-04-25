/**
 * AMRO Enterprise Enhanced Type Definitions
 * Enterprise-grade models for Materials, Tooling, and Compliance Management
 * 
 * This file contains enhanced data models that extend the base AMRO types
 * with enterprise features including inventory integration, calibration tracking,
 * and regulatory compliance management.
 */

// ============================================================================
// MATERIALS MANAGEMENT - Enterprise Types
// ============================================================================

export type MaterialGroup = 'consumable' | 'rotable' | 'expendable' | 'repairable' | 'provision';
export type QuantityUnit = 'EA' | 'KG' | 'L' | 'M' | 'SET' | 'KIT' | 'GAL' | 'QT' | 'PT' | 'OZ';
export type CertificationType = 'FAA_8130' | 'EASA_Form1' | 'CAAC' | 'DGCA' | 'None';
export type ProcurementType = 'stock' | 'purchase' | 'consignment' | 'loan' | 'exchange';
export type PlanningStatus = 'planned' | 'ordered' | 'received' | 'inspected' | 'issued' | 'returned';
export type DocumentType = 'manual' | 'drawing' | 'specification' | 'msds' | 'certificate' | 'report';

export interface SupplierInfo {
  supplier_id: string;
  supplier_name: string;
  lead_time_days: number;
  unit_cost: number;
  currency?: string;
  minimum_order_quantity?: number;
  preferred: boolean;
}

export interface TechnicalDocumentation {
  document_type: DocumentType;
  document_id: string;
  document_name?: string;
  revision: string;
  url?: string;
}

export interface MaterialLineItem {
  // Core Identification
  id: string;                          // UUID for tracking
  part_number: string;                 // Primary part number
  alternate_part_numbers: string[];    // Cross-reference parts
  nsn?: string;                        // NATO Stock Number (optional)
  cage_code?: string;                  // Commercial and Government Entity code

  // Description & Classification
  description: string;
  nomenclature: string;                // Standard naming
  ata_chapter: string;                 // ATA iSpec 2200 chapter (e.g., "29-10-00")
  material_group: MaterialGroup;       // Consumable, Rotable, Expendable, Repairable

  // Quantities & Units
  quantity_required: number;
  quantity_unit: QuantityUnit;         // EA, KG, L, M, SET, KIT
  quantity_per_aircraft: number;       // Standard usage rate
  wastage_factor: number;              // Percentage (e.g., 5%)

  // Inventory & Availability
  stock_available: number;             // Current stock level
  stock_reserved: number;              // Already allocated
  stock_on_order: number;              // In procurement pipeline
  reorder_point: number;               // Trigger for procurement
  warehouse_location?: string;         // Bin/shelf location
  warehouse_id?: string;               // Link to warehouse master

  // Cost & Budget
  unit_cost: number;
  currency: string;                    // USD, EUR, GBP
  total_cost: number;                  // Auto-calculated
  cost_center?: string;

  // Supplier & Procurement
  preferred_supplier_id?: string;
  preferred_supplier_name?: string;
  alternate_suppliers: SupplierInfo[];
  procurement_type: ProcurementType;
  lead_time_days: number;

  // Certification & Traceability
  requires_certification: boolean;
  certification_type: CertificationType;
  batch_lot_number?: string;
  serial_number_required: boolean;
  shelf_life_days?: number;
  manufacture_date?: string;           // ISO date
  expiry_date?: string;                // ISO date

  // Criticality & Planning
  is_critical: boolean;                // AOG (Aircraft on Ground) impact
  is_safety_item: boolean;
  is_ercs_item: boolean;               // Engine Roable Component Summary
  planning_status: PlanningStatus;

  // Task Association
  task_template_ids: string[];         // Which tasks need this material
  installation_phase?: string;         // When is it needed

  // Notes & Documentation
  notes?: string;
  technical_documentation: TechnicalDocumentation[];
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface MaterialShortageReport {
  part_number: string;
  description: string;
  quantity_required: number;
  quantity_available: number;
  shortage_quantity: number;
  estimated_cost: number;
  preferred_supplier?: string;
  lead_time_days: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  aog_impact: boolean;
}

export interface MaterialCostEstimate {
  template_id: string;
  template_name: string;
  materials: Array<{
    part_number: string;
    description: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
  }>;
  subtotal: number;
  wastage_adjustment: number;
  tax: number;
  total_estimated_cost: number;
  currency: string;
  last_updated: string;
}

// ============================================================================
// TOOLING & EQUIPMENT - Enterprise Types
// ============================================================================

export type ToolCategory = 'hand_tool' | 'power_tool' | 'test_equipment' | 'ground_support' | 'special_tool' | 'consumable';
export type CalibrationStatus = 'valid' | 'due_soon' | 'expired' | 'not_required';
export type ToolStatus = 'available' | 'in_use' | 'under_maintenance' | 'calibrating' | 'unserviceable' | 'lost';
export type LifecycleStatus = 'active' | 'pending_repair' | 'retired' | 'disposed';
export type ToolDocumentType = 'manual' | 'drawing' | 'procedure' | 'certificate' | 'calibration_report';

export interface ToolSpecifications {
  measurement_range?: string;          // e.g., "0-500 in-lbs"
  accuracy?: string;                   // e.g., "±2%"
  capacity?: string;                   // e.g., "5000 lbs"
  power_requirements?: string;         // e.g., "110V AC, 60Hz"
  weight?: number;                     // kg
  dimensions?: string;                 // L x W x H
  torque_range?: string;               // For torque tools
  pressure_range?: string;             // For pressure tools
  temperature_range?: string;          // For temperature equipment
}

export interface MaintenanceHistory {
  date: string;                        // ISO date
  action: string;                      // What was done
  performed_by: string;                // User ID or name
  next_action_due?: string;            // ISO date
  cost?: number;
  notes?: string;
}

export interface ToolManual {
  document_id: string;
  document_type: ToolDocumentType;
  title: string;
  revision: string;
  url?: string;
  last_updated?: string;
}

export interface ToolingLineItem {
  // Core Identification
  id: string;
  tool_code: string;                   // Internal tool identifier
  tool_name: string;
  manufacturer: string;
  model_number: string;
  serial_number?: string;              // For specific tool instances
  part_number: string;                 // OEM part number

  // Classification
  tool_category: ToolCategory;
  tool_type: string;                   // Specific type (e.g., "Torque Wrench")
  sil_number?: string;                 // Special Instruction Letter reference
  ata_chapter: string;

  // Specifications
  specifications: ToolSpecifications;

  // Calibration & Certification
  calibration_required: boolean;
  calibration_interval_days: number;   // e.g., 90, 180, 365
  last_calibration_date?: string;
  next_calibration_due?: string;
  calibration_standard?: string;       // Traceable standard
  calibration_certificate?: string;
  calibration_status: CalibrationStatus;

  // Availability & Location
  quantity_required: number;
  quantity_available: number;
  tool_crib_location?: string;
  warehouse_id?: string;
  current_status: ToolStatus;

  // Task Association
  task_template_ids: string[];
  usage_instructions?: string;
  safety_precautions: string[];

  // Maintenance & Lifecycle
  inspection_interval_hours?: number;
  total_service_hours: number;
  lifecycle_status: LifecycleStatus;
  maintenance_history: MaintenanceHistory[];

  // Cost & Depreciation
  purchase_cost?: number;
  currency: string;
  depreciation_method?: string;
  current_value?: number;

  // Compliance
  regulatory_approvals: string[];      // e.g., ["FAA", "EASA"]
  oem_service_bulletins: string[];
  special_requirements: string[];

  // Notes & Documentation
  notes?: string;
  manuals_and_drawings: ToolManual[];
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface ToolAvailabilityResponse {
  tool_id: string;
  tool_code: string;
  tool_name: string;
  quantity_required: number;
  quantity_available: number;
  available_instances: Array<{
    instance_id: string;
    serial_number: string;
    location: string;
    status: ToolStatus;
    calibration_status: CalibrationStatus;
  }>;
  reservation_available: boolean;
  estimated_ready_date?: string;
}

export interface ToolReservation {
  id: string;
  tool_id: string;
  tool_instance_id?: string;
  work_order_template_id: string;
  reserved_by: string;
  reservation_date: string;
  return_date: string;
  status: 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CalibrationLog {
  id: string;
  tool_id: string;
  tool_instance_id: string;
  calibration_date: string;
  next_calibration_due: string;
  calibration_standard: string;
  calibration_result: 'pass' | 'fail' | 'adjusted';
  as_found_data?: string;
  as_left_data?: string;
  out_of_tolerance: boolean;
  oot_investigation?: string;
  calibrated_by: string;
  certificate_number: string;
  notes?: string;
}

export interface CalibrationDueList {
  overdue: ToolingLineItem[];
  due_30_days: ToolingLineItem[];
  due_60_days: ToolingLineItem[];
  due_90_days: ToolingLineItem[];
  total_tools_requiring_calibration: number;
}

// ============================================================================
// COMPLIANCE & REGULATORY - Enterprise Types
// ============================================================================

export type RequirementType = 'AD' | 'SB' | 'SIL' | 'CN' | 'OEB' | 'APMS' | 'custom';
export type RegulatoryAuthority = 'FAA' | 'EASA' | 'CAAC' | 'DGCA' | 'Transport_Canada' | 'ANAC' | 'CASA' | 'other';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type ComplianceStatus = 'not_started' | 'in_progress' | 'complied' | 'exempted' | 'deferred' | 'not_applicable';
export type LicenseType = 'B1' | 'B2' | 'B3' | 'C' | 'A' | 'Support';
export type ComplianceMethod = 'inspection' | 'modification' | 'replacement' | 'operational_check' | 'functional_test';
export type ComplianceDocumentType = 'ad_document' | 'sb_document' | 'work_card' | 'photo' | 'report' | 'certificate';

export interface DigitalSignature {
  signed_by: string;                   // User ID
  signed_date: string;                 // ISO date
  signature_hash: string;              // Cryptographic hash (SHA-256)
  certifying_staff_id: string;
  license_number: string;
  license_type: LicenseType;
  license_expiry: string;              // ISO date
  organization: string;
}

export interface ExemptionInfo {
  exemption_granted: boolean;
  exemption_authority: string;
  exemption_reference: string;
  exemption_expiry: string;            // ISO date
  deviation_justification: string;
}

export interface AuditTrailEntry {
  timestamp: string;                   // ISO date
  action: string;
  performed_by: string;                // User ID
  reason: string;
  before_state: any;
  after_state: any;
  ip_address?: string;
}

export interface ComplianceDocument {
  document_id: string;
  document_type: ComplianceDocumentType;
  title: string;
  revision: string;
  url?: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface ComplianceNotification {
  trigger_days_before: number;
  notified_roles: string[];
  notified_users?: string[];
  notification_method: 'email' | 'sms' | 'in_app' | 'all';
  message_template?: string;
}

export interface ComplianceRequirement {
  // Core Identification
  id: string;
  requirement_code: string;            // Internal identifier
  requirement_type: RequirementType;

  // Regulatory Information
  regulatory_authority: RegulatoryAuthority;
  directive_number: string;            // e.g., "AD 2024-12-05"
  sb_number?: string;                  // Service Bulletin number (if applicable)
  oem: string;                         // Original Equipment Manufacturer
  aircraft_model: string;
  engine_model?: string;               // If applicable
  component_ata: string;               // ATA chapter

  // Description & Scope
  title: string;
  description: string;
  applicability: string;               // Which aircraft/engines/components
  effective_date: string;              // When it becomes mandatory
  compliance_deadline: string;         // Must comply by this date

  // Compliance Requirements
  compliance_action: string;           // What needs to be done
  compliance_method: ComplianceMethod;
  recurring_requirement: boolean;
  recurrence_interval?: string;        // e.g., "Every 500 FH" or "Annual"
  threshold_hours?: number;            // Flight hours/cycles threshold
  grace_period_days: number;

  // Severity & Priority
  severity_level: SeverityLevel;
  safety_impact: boolean;
  grounding_requirement: boolean;      // Does this ground the aircraft?
  fleet_impact: boolean;

  // Compliance Status
  compliance_status: ComplianceStatus;
  compliance_date?: string;
  complied_by?: string;                // User ID
  complied_method?: string;
  compliance_reference?: string;       // Work package ID, task card ID

  // Digital Signature & Approval
  digital_signature?: DigitalSignature;

  // Exemptions & Deviations
  exemption_info?: ExemptionInfo;

  // Audit Trail
  audit_trail: AuditTrailEntry[];

  // Documentation
  supporting_documents: ComplianceDocument[];

  // Task Association
  linked_task_template_ids: string[];
  estimated_labor_hours: number;
  estimated_material_cost: number;

  // Notifications
  notification_schedule: ComplianceNotification[];

  // Notes
  internal_notes?: string;
  regulatory_notes?: string;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface ADSBFeedItem {
  id: string;
  directive_number: string;
  directive_type: RequirementType;
  regulatory_authority: RegulatoryAuthority;
  title: string;
  effective_date: string;
  compliance_deadline: string;
  applicability: string;
  summary: string;
  url?: string;
  applicable_to_fleet: boolean;
  affected_aircraft: string[];
  priority: SeverityLevel;
  imported_at: string;
}

export interface FleetComplianceStatus {
  total_requirements: number;
  complied: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  exempted: number;
  compliance_percentage: number;
  requirements_by_authority: Record<string, number>;
  requirements_by_severity: Record<string, number>;
  upcoming_deadlines: Array<{
    requirement_code: string;
    directive_number: string;
    compliance_deadline: string;
    days_remaining: number;
    severity_level: SeverityLevel;
    aircraft_model: string;
  }>;
}

export interface ComplianceReport {
  report_id: string;
  generated_at: string;
  generated_by: string;
  report_type: 'fleet_status' | 'ad_sb_summary' | 'overdue_items' | 'audit_trail' | 'exemptions';
  date_range?: {
    start: string;
    end: string;
  };
  data: any;
  format: 'json' | 'pdf' | 'csv' | 'xml';
}

// ============================================================================
// WORK PACKAGE TEMPLATE - Enhanced with Enterprise Fields
// ============================================================================

export interface EnhancedWorkPackageTemplate {
  // Existing fields (would be in base type)
  id: string;
  template_code: string;
  template_name: string;
  maintenance_type: string;
  model_id: string | null;
  aircraft_model: string | null;
  version: number;
  active: boolean;
  scope_json: Record<string, unknown>;
  tasks_json: any[];
  
  // Enhanced Materials
  materials_json: MaterialLineItem[];
  
  // Enhanced Tooling
  tooling_json: ToolingLineItem[];
  
  // Enhanced Compliance
  compliance_requirements_json: ComplianceRequirement[];
  
  // Cost Summary
  estimated_material_cost: number;
  estimated_tooling_cost: number;
  estimated_labor_cost: number;
  total_estimated_cost: number;
  currency: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// ============================================================================
// API Request/Response Types for Enterprise Features
// ============================================================================

export interface MaterialSearchRequest {
  query: string;
  ata_chapter?: string;
  material_group?: MaterialGroup;
  warehouse_id?: string;
  in_stock_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface MaterialSearchResponse {
  total: number;
  results: MaterialLineItem[];
  has_more: boolean;
}

export interface ReserveMaterialRequest {
  material_id: string;
  quantity: number;
  work_order_template_id: string;
  reserved_by: string;
  notes?: string;
}

export interface GeneratePurchaseOrderRequest {
  materials: Array<{
    part_number: string;
    quantity: number;
    supplier_id: string;
  }>;
  work_order_template_id: string;
  requested_by: string;
  priority: 'standard' | 'urgent' | 'aog';
}

export interface ToolAvailabilityRequest {
  tool_code: string;
  quantity_required: number;
  required_date: string;
  work_order_template_id: string;
}

export interface ReserveToolRequest {
  tool_id: string;
  tool_instance_id?: string;
  quantity: number;
  work_order_template_id: string;
  reservation_date: string;
  return_date: string;
  reserved_by: string;
  notes?: string;
}

export interface CalibrationLogRequest {
  tool_id: string;
  tool_instance_id: string;
  calibration_date: string;
  next_calibration_due: string;
  calibration_standard: string;
  calibration_result: 'pass' | 'fail' | 'adjusted';
  as_found_data?: string;
  as_left_data?: string;
  out_of_tolerance: boolean;
  oot_investigation?: string;
  calibrated_by: string;
  certificate_number: string;
  notes?: string;
}

export interface ComplianceSignOffRequest {
  requirement_id: string;
  compliance_date: string;
  complied_method: string;
  compliance_reference: string;
  digital_signature: {
    certifying_staff_id: string;
    license_number: string;
    license_type: LicenseType;
    license_expiry: string;
    organization: string;
  };
  notes?: string;
}

export interface ComplianceApplicabilityCheckRequest {
  aircraft_model: string;
  engine_model?: string;
  component_ata?: string;
}

export interface ComplianceExportRequest {
  report_type: 'fleet_status' | 'ad_sb_summary' | 'overdue_items' | 'audit_trail' | 'exemptions';
  date_range?: {
    start: string;
    end: string;
  };
  format: 'json' | 'pdf' | 'csv' | 'xml';
  authority?: RegulatoryAuthority;
  aircraft_model?: string;
}

// ============================================================================
// Analytics & Dashboard Types
// ============================================================================

export interface MaterialAnalytics {
  total_parts_in_use: number;
  total_inventory_value: number;
  parts_below_reorder_point: number;
  parts_out_of_stock: number;
  average_lead_time_days: number;
  cost_by_material_group: Record<string, number>;
  top_suppliers_by_value: Array<{
    supplier_id: string;
    supplier_name: string;
    total_value: number;
    order_count: number;
  }>;
  critical_materials: string[];
  expiry_alerts: Array<{
    part_number: string;
    description: string;
    expiry_date: string;
    days_until_expiry: number;
    quantity: number;
  }>;
}

export interface ToolingAnalytics {
  total_tools: number;
  tools_available: number;
  tools_in_use: number;
  tools_under_maintenance: number;
  calibration_overdue: number;
  calibration_due_30_days: number;
  utilization_rate: number;
  cost_by_category: Record<string, number>;
  tools_requiring_attention: string[];
}

export interface ComplianceAnalytics {
  fleet_compliance_percentage: number;
  overdue_requirements: number;
  due_30_days: number;
  due_60_days: number;
  due_90_days: number;
  requirements_by_type: Record<string, number>;
  requirements_by_authority: Record<string, number>;
  requirements_by_severity: Record<string, number>;
  cost_of_compliance: number;
  exemptions_active: number;
}

// ============================================================================
// Enumerations for Database Constraints
// ============================================================================

export const MATERIAL_GROUP_VALUES: MaterialGroup[] = ['consumable', 'rotable', 'expendable', 'repairable', 'provision'];
export const QUANTITY_UNIT_VALUES: QuantityUnit[] = ['EA', 'KG', 'L', 'M', 'SET', 'KIT', 'GAL', 'QT', 'PT', 'OZ'];
export const CERTIFICATION_TYPE_VALUES: CertificationType[] = ['FAA_8130', 'EASA_Form1', 'CAAC', 'DGCA', 'None'];
export const PROCUREMENT_TYPE_VALUES: ProcurementType[] = ['stock', 'purchase', 'consignment', 'loan', 'exchange'];
export const PLANNING_STATUS_VALUES: PlanningStatus[] = ['planned', 'ordered', 'received', 'inspected', 'issued', 'returned'];
export const DOCUMENT_TYPE_VALUES: DocumentType[] = ['manual', 'drawing', 'specification', 'msds', 'certificate', 'report'];

export const TOOL_CATEGORY_VALUES: ToolCategory[] = ['hand_tool', 'power_tool', 'test_equipment', 'ground_support', 'special_tool', 'consumable'];
export const CALIBRATION_STATUS_VALUES: CalibrationStatus[] = ['valid', 'due_soon', 'expired', 'not_required'];
export const TOOL_STATUS_VALUES: ToolStatus[] = ['available', 'in_use', 'under_maintenance', 'calibrating', 'unserviceable', 'lost'];
export const LIFECYCLE_STATUS_VALUES: LifecycleStatus[] = ['active', 'pending_repair', 'retired', 'disposed'];
export const TOOL_DOCUMENT_TYPE_VALUES: ToolDocumentType[] = ['manual', 'drawing', 'procedure', 'certificate', 'calibration_report'];

export const REQUIREMENT_TYPE_VALUES: RequirementType[] = ['AD', 'SB', 'SIL', 'CN', 'OEB', 'APMS', 'custom'];
export const REGULATORY_AUTHORITY_VALUES: RegulatoryAuthority[] = ['FAA', 'EASA', 'CAAC', 'DGCA', 'Transport_Canada', 'ANAC', 'CASA', 'other'];
export const SEVERITY_LEVEL_VALUES: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'informational'];
export const COMPLIANCE_STATUS_VALUES: ComplianceStatus[] = ['not_started', 'in_progress', 'complied', 'exempted', 'deferred', 'not_applicable'];
export const LICENSE_TYPE_VALUES: LicenseType[] = ['B1', 'B2', 'B3', 'C', 'A', 'Support'];
export const COMPLIANCE_METHOD_VALUES: ComplianceMethod[] = ['inspection', 'modification', 'replacement', 'operational_check', 'functional_test'];
export const COMPLIANCE_DOCUMENT_TYPE_VALUES: ComplianceDocumentType[] = ['ad_document', 'sb_document', 'work_card', 'photo', 'report', 'certificate'];

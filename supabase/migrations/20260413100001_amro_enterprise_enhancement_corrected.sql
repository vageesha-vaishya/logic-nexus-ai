-- AMRO Enterprise Enhancement - CORRECTED Migration
-- Date: 2026-04-13 (CORRECTED VERSION)
-- Purpose: EXTEND existing AMRO tables with enterprise features for Tooling & Compliance
-- IMPORTANT: This migration INTEGRATES with existing parts inventory system, does NOT duplicate

-- ============================================================================
-- CRITICAL NOTE
-- ============================================================================
-- This migration DOES NOT create duplicate tables for materials/parts.
-- The existing system already has:
--   - parts_inventory (stock tracking)
--   - amro_item_master (item definitions)
--   - amro_stock_ledger_transactions (double-entry ledger)
--   - reservations (part reservations)
--   - amro_purchase_orders + amro_purchase_order_items (procurement)
--   - suppliers (supplier master)
--
-- Instead, this migration ADDS:
--   1. Aviation-specific fields to existing parts_inventory
--   2. New TOOLING management tables (genuinely new functionality)
--   3. Enhanced COMPLIANCE tables for AD/SB tracking
-- ============================================================================

-- ============================================================================
-- 1. EXTEND Existing Parts Inventory with Aviation-Specific Fields
-- ============================================================================

-- Add enterprise aviation fields to parts_inventory
ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS nsn TEXT,  -- NATO Stock Number
  ADD COLUMN IF NOT EXISTS cage_code TEXT,  -- Commercial and Government Entity code
  ADD COLUMN IF NOT EXISTS nomenclature TEXT,  -- Standard aviation naming
  ADD COLUMN IF NOT EXISTS ercs_item BOOLEAN DEFAULT FALSE,  -- Engine Rotable Component Summary
  ADD COLUMN IF NOT EXISTS safety_item BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS material_group TEXT CHECK (material_group IN ('consumable', 'rotable', 'expendable', 'repairable', 'provision')),
  ADD COLUMN IF NOT EXISTS warehouse_id UUID,  -- Link to warehouse master table (if exists)
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT,  -- Bin/shelf location (more specific than warehouse_location)
  ADD COLUMN IF NOT EXISTS cost_center TEXT,
  ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS procurement_type TEXT CHECK (procurement_type IN ('stock', 'purchase', 'consignment', 'loan', 'exchange')),
  ADD COLUMN IF NOT EXISTS technical_documentation JSONB DEFAULT '[]',  -- Manual, drawings, MSDS, etc.
  ADD COLUMN IF NOT EXISTS installation_phase TEXT,
  ADD COLUMN IF NOT EXISTS wastage_factor NUMERIC(5,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS quantity_per_aircraft NUMERIC(10,2);  -- Standard usage rate per aircraft

-- Index for new fields
CREATE INDEX IF NOT EXISTS idx_parts_inventory_nsn ON public.parts_inventory(nsn) WHERE nsn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_inventory_material_group ON public.parts_inventory(material_group) WHERE material_group IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_inventory_ercs ON public.parts_inventory(ercs_item) WHERE ercs_item = TRUE;
CREATE INDEX IF NOT EXISTS idx_parts_inventory_safety ON public.parts_inventory(safety_item) WHERE safety_item = TRUE;

COMMENT ON COLUMN public.parts_inventory.nsn IS 'NATO Stock Number for military parts';
COMMENT ON COLUMN public.parts_inventory.cage_code IS 'Commercial and Government Entity code for manufacturer identification';
COMMENT ON COLUMN public.parts_inventory.nomenclature IS 'Standard aviation nomenclature for part naming';
COMMENT ON COLUMN public.parts_inventory.material_group IS 'Material classification: consumable, rotable, expendable, repairable, provision';
COMMENT ON COLUMN public.parts_inventory.ercs_item IS 'Engine Rotable Component Summary item flag';
COMMENT ON COLUMN public.parts_inventory.technical_documentation IS 'Array of technical documents: manuals, drawings, MSDS, specifications';

-- ============================================================================
-- 2. TOOLING & EQUIPMENT - Genuinely New Functionality
-- ============================================================================

-- 2.1 Tooling Registry (master data for tools)
CREATE TABLE IF NOT EXISTS public.amro_tooling_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    
    -- Core Identification
    tool_code TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    model_number TEXT NOT NULL,
    part_number TEXT, -- OEM part number
    
    -- Classification
    tool_category TEXT NOT NULL DEFAULT 'hand_tool' CHECK (tool_category IN ('hand_tool', 'power_tool', 'test_equipment', 'ground_support', 'special_tool', 'consumable')),
    tool_type TEXT NOT NULL, -- Specific type (e.g., "Torque Wrench")
    sil_number TEXT, -- Special Instruction Letter reference
    ata_chapter TEXT,
    
    -- Specifications (JSONB for flexibility)
    specifications JSONB DEFAULT '{}',
    -- Example: {measurement_range, accuracy, capacity, power_requirements, weight, dimensions}
    
    -- Calibration & Certification
    calibration_required BOOLEAN DEFAULT FALSE,
    calibration_interval_days INTEGER DEFAULT 0,
    calibration_standard TEXT,
    
    -- Task Association
    usage_instructions TEXT,
    safety_precautions TEXT[] DEFAULT '{}',
    
    -- Cost & Depreciation
    purchase_cost NUMERIC(12,2),
    currency TEXT DEFAULT 'USD',
    depreciation_method TEXT,
    
    -- Compliance
    regulatory_approvals TEXT[] DEFAULT '{}', -- e.g., ["FAA", "EASA"]
    oem_service_bulletins TEXT[] DEFAULT '{}',
    special_requirements TEXT[] DEFAULT '{}',
    
    -- Notes & Documentation
    notes TEXT,
    manuals_and_drawings JSONB DEFAULT '[]', -- Array of {document_id, document_type, revision}
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_tool_code UNIQUE (tenant_id, tool_code)
);

-- 2.2 Tool Instances (physical tool instances with serial numbers)
CREATE TABLE IF NOT EXISTS public.amro_tooling_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    tool_id UUID NOT NULL REFERENCES public.amro_tooling_registry(id) ON DELETE CASCADE,
    
    -- Instance-specific data
    serial_number TEXT NOT NULL,
    current_status TEXT NOT NULL DEFAULT 'available' CHECK (current_status IN ('available', 'in_use', 'under_maintenance', 'calibrating', 'unserviceable', 'lost')),
    lifecycle_status TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'pending_repair', 'retired', 'disposed')),
    
    -- Calibration
    last_calibration_date DATE,
    next_calibration_due DATE,
    calibration_certificate TEXT,
    calibration_status TEXT NOT NULL DEFAULT 'not_required' CHECK (calibration_status IN ('valid', 'due_soon', 'expired', 'not_required')),
    
    -- Usage tracking
    total_service_hours NUMERIC(10,2) DEFAULT 0,
    inspection_interval_hours NUMERIC(10,2),
    last_inspection_date DATE,
    next_inspection_due DATE,
    
    -- Location
    tool_crib_location TEXT,
    warehouse_id UUID,
    current_assignment_id UUID, -- Work package or template ID
    
    -- Value
    current_value NUMERIC(12,2),
    
    -- Metadata
    acquired_date DATE,
    retired_date DATE,
    retired_reason TEXT,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_tool_instance_serial UNIQUE (tenant_id, tool_id, serial_number)
);

-- 2.3 Tool Reservations (similar to parts reservations but for tools)
CREATE TABLE IF NOT EXISTS public.amro_tool_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES public.amro_tooling_registry(id) ON DELETE CASCADE,
    tool_instance_id UUID REFERENCES public.amro_tooling_instances(id) ON DELETE SET NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    work_order_template_id UUID,
    task_id UUID,
    
    quantity_reserved INTEGER NOT NULL DEFAULT 1,
    reserved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reservation_date TIMESTAMPTZ NOT NULL,
    return_date TIMESTAMPTZ NOT NULL,
    actual_return_date TIMESTAMPTZ,
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'cancelled')),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_reservation_dates CHECK (return_date > reservation_date)
);

-- 2.4 Calibration Logs (tracking calibration history for each tool instance)
CREATE TABLE IF NOT EXISTS public.amro_calibration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES public.amro_tooling_registry(id) ON DELETE CASCADE,
    tool_instance_id UUID NOT NULL REFERENCES public.amro_tooling_instances(id) ON DELETE CASCADE,
    
    -- Calibration details
    calibration_date DATE NOT NULL,
    next_calibration_due DATE NOT NULL,
    calibration_standard TEXT NOT NULL,
    calibration_result TEXT NOT NULL CHECK (calibration_result IN ('pass', 'fail', 'adjusted')),
    
    -- Measurement data
    as_found_data JSONB, -- {measurements: [{parameter, as_found_value, tolerance_min, tolerance_max}]}
    as_left_data JSONB, -- Same structure after adjustment
    out_of_tolerance BOOLEAN DEFAULT FALSE,
    oot_investigation TEXT, -- Required if out_of_tolerance = TRUE
    
    -- Certificate
    certificate_number TEXT NOT NULL,
    calibration_certificate_url TEXT,
    
    -- Personnel
    calibrated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    calibration_organization TEXT,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2.5 Tool Maintenance History
CREATE TABLE IF NOT EXISTS public.amro_tool_maintenance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES public.amro_tooling_registry(id) ON DELETE CASCADE,
    tool_instance_id UUID NOT NULL REFERENCES public.amro_tooling_instances(id) ON DELETE CASCADE,
    
    -- Maintenance details
    maintenance_date DATE NOT NULL,
    maintenance_type TEXT NOT NULL, -- e.g., "preventive", "corrective", "repair"
    description TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    next_action_due DATE,
    cost NUMERIC(12,2),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. COMPLIANCE & REGULATORY - Enhanced Tables for AD/SB Management
-- ============================================================================

-- 3.1 AD/SB Registry (master regulatory data from FAA, EASA, etc.)
CREATE TABLE IF NOT EXISTS public.amro_compliance_ad_sb_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    
    -- Directive identification
    directive_number TEXT NOT NULL, -- e.g., "AD 2024-12-05"
    directive_type TEXT NOT NULL DEFAULT 'AD' CHECK (directive_type IN ('AD', 'SB', 'SIL', 'CN', 'OEB', 'APMS', 'custom')),
    regulatory_authority TEXT NOT NULL CHECK (regulatory_authority IN ('FAA', 'EASA', 'CAAC', 'DGCA', 'Transport_Canada', 'ANAC', 'CASA', 'other')),
    
    -- SB number (if applicable)
    sb_number TEXT,
    
    -- OEM & Applicability
    oem TEXT NOT NULL, -- Original Equipment Manufacturer
    aircraft_model TEXT NOT NULL,
    engine_model TEXT,
    component_ata TEXT, -- ATA chapter
    
    -- Dates
    effective_date DATE NOT NULL,
    compliance_deadline DATE NOT NULL,
    issued_date DATE,
    
    -- Description
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    applicability TEXT NOT NULL, -- Which aircraft/engines/components
    summary TEXT,
    url TEXT, -- Link to original document
    
    -- Fleet applicability
    applicable_to_fleet BOOLEAN DEFAULT FALSE,
    affected_aircraft UUID[] DEFAULT '{}', -- Array of aircraft IDs
    
    -- Priority
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low', 'informational')),
    safety_impact BOOLEAN DEFAULT FALSE,
    grounding_requirement BOOLEAN DEFAULT FALSE,
    fleet_impact BOOLEAN DEFAULT FALSE,
    
    -- Import tracking
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_from TEXT, -- Source system or feed
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_ad_sb_directive UNIQUE (tenant_id, directive_number, regulatory_authority)
);

-- 3.2 Enhanced Compliance Requirements (extends existing compliance_obligations/records)
CREATE TABLE IF NOT EXISTS public.amro_compliance_requirements_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    
    -- Link to existing compliance system
    obligation_id UUID REFERENCES public.compliance_obligations(id) ON DELETE SET NULL,
    compliance_record_id UUID REFERENCES public.compliance_records(id) ON DELETE SET NULL,
    
    -- Core Identification
    requirement_code TEXT NOT NULL,
    requirement_type TEXT NOT NULL DEFAULT 'AD' CHECK (requirement_type IN ('AD', 'SB', 'SIL', 'CN', 'OEB', 'APMS', 'custom')),
    
    -- Link to AD/SB registry
    ad_sb_registry_id UUID REFERENCES public.amro_compliance_ad_sb_registry(id) ON DELETE SET NULL,
    
    -- Regulatory Information
    regulatory_authority TEXT NOT NULL CHECK (regulatory_authority IN ('FAA', 'EASA', 'CAAC', 'DGCA', 'Transport_Canada', 'ANAC', 'CASA', 'other')),
    directive_number TEXT NOT NULL,
    sb_number TEXT,
    oem TEXT NOT NULL,
    aircraft_model TEXT NOT NULL,
    engine_model TEXT,
    component_ata TEXT,
    
    -- Description & Scope
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    applicability TEXT NOT NULL,
    effective_date DATE NOT NULL,
    compliance_deadline DATE NOT NULL,
    
    -- Compliance Requirements
    compliance_action TEXT NOT NULL,
    compliance_method TEXT NOT NULL DEFAULT 'inspection' CHECK (compliance_method IN ('inspection', 'modification', 'replacement', 'operational_check', 'functional_test')),
    recurring_requirement BOOLEAN DEFAULT FALSE,
    recurrence_interval TEXT, -- e.g., "Every 500 FH" or "Annual"
    threshold_hours NUMERIC(10,2), -- Flight hours/cycles threshold
    grace_period_days INTEGER DEFAULT 0,
    
    -- Severity & Priority
    severity_level TEXT NOT NULL DEFAULT 'medium' CHECK (severity_level IN ('critical', 'high', 'medium', 'low', 'informational')),
    safety_impact BOOLEAN DEFAULT FALSE,
    grounding_requirement BOOLEAN DEFAULT FALSE,
    fleet_impact BOOLEAN DEFAULT FALSE,
    
    -- Compliance Status
    compliance_status TEXT NOT NULL DEFAULT 'not_started' CHECK (compliance_status IN ('not_started', 'in_progress', 'complied', 'exempted', 'deferred', 'not_applicable')),
    compliance_date DATE,
    complied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    complied_method TEXT,
    compliance_reference TEXT, -- Work package ID, task card ID
    
    -- Digital Signature & Approval (JSONB for cryptographic data)
    digital_signature JSONB, -- {signed_by, signed_date, signature_hash, certifying_staff_id, license_number, license_type, license_expiry, organization}
    
    -- Exemptions & Deviations
    exemption_info JSONB, -- {exemption_granted, exemption_authority, exemption_reference, exemption_expiry, deviation_justification}
    
    -- Task Association
    linked_task_template_ids UUID[] DEFAULT '{}',
    estimated_labor_hours NUMERIC(10,2),
    estimated_material_cost NUMERIC(12,2),
    
    -- Notifications
    notification_schedule JSONB DEFAULT '[]', -- Array of {trigger_days_before, notified_roles, notification_method}
    
    -- Notes
    internal_notes TEXT,
    regulatory_notes TEXT,
    
    -- Audit trail (JSONB for flexibility, also logged to amro_work_order_audit_log)
    audit_trail JSONB DEFAULT '[]', -- Array of {timestamp, action, performed_by, reason, before_state, after_state}
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_compliance_requirement_code UNIQUE (tenant_id, requirement_code)
);

-- 3.3 Compliance Supporting Documents
CREATE TABLE IF NOT EXISTS public.amro_compliance_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    compliance_requirement_id UUID NOT NULL REFERENCES public.amro_compliance_requirements_enhanced(id) ON DELETE CASCADE,
    
    document_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('ad_document', 'sb_document', 'work_card', 'photo', 'report', 'certificate')),
    title TEXT NOT NULL,
    revision TEXT NOT NULL,
    url TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_compliance_doc UNIQUE (tenant_id, compliance_requirement_id, document_id)
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Tooling Registry Indexes
CREATE INDEX IF NOT EXISTS idx_tooling_registry_tenant ON public.amro_tooling_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tooling_registry_category ON public.amro_tooling_registry(tool_category);
CREATE INDEX IF NOT EXISTS idx_tooling_registry_ata ON public.amro_tooling_registry(ata_chapter);
CREATE INDEX IF NOT EXISTS idx_tooling_registry_code_search ON public.amro_tooling_registry USING gin(to_tsvector('english', tool_code || ' ' || tool_name));

-- Tooling Instances Indexes
CREATE INDEX IF NOT EXISTS idx_tooling_instances_tool ON public.amro_tooling_instances(tool_id);
CREATE INDEX IF NOT EXISTS idx_tooling_instances_status ON public.amro_tooling_instances(current_status);
CREATE INDEX IF NOT EXISTS idx_tooling_instances_calibration_due ON public.amro_tooling_instances(next_calibration_due);
CREATE INDEX IF NOT EXISTS idx_tooling_instances_serial ON public.amro_tooling_instances(serial_number);
CREATE INDEX IF NOT EXISTS idx_tooling_instances_lifecycle ON public.amro_tooling_instances(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_tooling_instances_calibration_overdue ON public.amro_tooling_instances(next_calibration_due) WHERE calibration_status IN ('due_soon', 'expired');

-- Tool Reservations Indexes
CREATE INDEX IF NOT EXISTS idx_tool_reservations_tool ON public.amro_tool_reservations(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_reservations_instance ON public.amro_tool_reservations(tool_instance_id);
CREATE INDEX IF NOT EXISTS idx_tool_reservations_work_order ON public.amro_tool_reservations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tool_reservations_status ON public.amro_tool_reservations(status);
CREATE INDEX IF NOT EXISTS idx_tool_reservations_dates ON public.amro_tool_reservations(reservation_date, return_date);

-- Calibration Logs Indexes
CREATE INDEX IF NOT EXISTS idx_calibration_logs_tool ON public.amro_calibration_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_calibration_logs_instance ON public.amro_calibration_logs(tool_instance_id);
CREATE INDEX IF NOT EXISTS idx_calibration_logs_date ON public.amro_calibration_logs(calibration_date);
CREATE INDEX IF NOT EXISTS idx_calibration_logs_result ON public.amro_calibration_logs(calibration_result);
-- Note: Cannot use CURRENT_DATE in index predicate (not IMMUTABLE)
-- Use application-level filtering for overdue calibrations

-- AD/SB Registry Indexes
CREATE INDEX IF NOT EXISTS idx_ad_sb_registry_tenant ON public.amro_compliance_ad_sb_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_sb_registry_type ON public.amro_compliance_ad_sb_registry(directive_type);
CREATE INDEX IF NOT EXISTS idx_ad_sb_registry_authority ON public.amro_compliance_ad_sb_registry(regulatory_authority);
CREATE INDEX IF NOT EXISTS idx_ad_sb_registry_deadline ON public.amro_compliance_ad_sb_registry(compliance_deadline);
CREATE INDEX IF NOT EXISTS idx_ad_sb_registry_applicable ON public.amro_compliance_ad_sb_registry(applicable_to_fleet) WHERE applicable_to_fleet = TRUE;
CREATE INDEX IF NOT EXISTS idx_ad_sb_registry_search ON public.amro_compliance_ad_sb_registry USING gin(to_tsvector('english', directive_number || ' ' || title));

-- Compliance Requirements Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_req_tenant ON public.amro_compliance_requirements_enhanced(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_req_type ON public.amro_compliance_requirements_enhanced(requirement_type);
CREATE INDEX IF NOT EXISTS idx_compliance_req_authority ON public.amro_compliance_requirements_enhanced(regulatory_authority);
CREATE INDEX IF NOT EXISTS idx_compliance_req_status ON public.amro_compliance_requirements_enhanced(compliance_status);
CREATE INDEX IF NOT EXISTS idx_compliance_req_severity ON public.amro_compliance_requirements_enhanced(severity_level);
CREATE INDEX IF NOT EXISTS idx_compliance_req_deadline ON public.amro_compliance_requirements_enhanced(compliance_deadline);
CREATE INDEX IF NOT EXISTS idx_compliance_req_ad_sb ON public.amro_compliance_requirements_enhanced(ad_sb_registry_id);
CREATE INDEX IF NOT EXISTS idx_compliance_req_overdue ON public.amro_compliance_requirements_enhanced(compliance_deadline) WHERE compliance_status IN ('not_started', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_compliance_req_obligation ON public.amro_compliance_requirements_enhanced(obligation_id);

-- Compliance Documents Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_documents_requirement ON public.amro_compliance_documents(compliance_requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_type ON public.amro_compliance_documents(document_type);

-- ============================================================================
-- 5. TRIGGERS FOR AUTOMATION
-- ============================================================================

-- 5.1 Update updated_at timestamp for tooling registry
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tooling_registry_updated_at
    BEFORE UPDATE ON public.amro_tooling_registry
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5.2 Update updated_at for tooling instances
CREATE TRIGGER trg_tooling_instances_updated_at
    BEFORE UPDATE ON public.amro_tooling_instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5.3 Update updated_at for compliance requirements
CREATE TRIGGER trg_compliance_req_updated_at
    BEFORE UPDATE ON public.amro_compliance_requirements_enhanced
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5.4 Auto-update calibration status based on dates
-- Note: This trigger assumes calibration is required if next_calibration_due is set
CREATE OR REPLACE FUNCTION public.update_tool_calibration_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If next_calibration_due is set, check its status
    IF NEW.next_calibration_due IS NOT NULL THEN
        IF NEW.next_calibration_due < CURRENT_DATE THEN
            NEW.calibration_status := 'expired';
        ELSIF NEW.next_calibration_due < CURRENT_DATE + INTERVAL '30 days' THEN
            NEW.calibration_status := 'due_soon';
        ELSE
            NEW.calibration_status := 'valid';
        END IF;
    ELSE
        NEW.calibration_status := 'not_required';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tool_instance_calibration_status
    BEFORE INSERT OR UPDATE ON public.amro_tooling_instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tool_calibration_status();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.amro_tooling_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_tooling_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_tool_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_calibration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_tool_maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_compliance_ad_sb_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_compliance_requirements_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amro_compliance_documents ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation_tooling ON public.amro_tooling_registry
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_tool_instances ON public.amro_tooling_instances
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_tool_reservations ON public.amro_tool_reservations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_calibration_logs ON public.amro_calibration_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_compliance_req ON public.amro_compliance_requirements_enhanced
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ad_sb ON public.amro_compliance_ad_sb_registry
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.amro_tooling_registry IS 'Master registry for tooling and equipment with calibration requirements';
COMMENT ON TABLE public.amro_tooling_instances IS 'Physical instances of tools with individual serial number tracking';
COMMENT ON TABLE public.amro_tool_reservations IS 'Tool reservation system for work packages and tasks';
COMMENT ON TABLE public.amro_calibration_logs IS 'Calibration history and certificates for tool instances';
COMMENT ON TABLE public.amro_tool_maintenance_history IS 'Maintenance records and lifecycle tracking for tools';
COMMENT ON TABLE public.amro_compliance_ad_sb_registry IS 'Centralized AD/SB registry with regulatory feed integration from FAA, EASA, etc.';
COMMENT ON TABLE public.amro_compliance_requirements_enhanced IS 'Enhanced compliance requirements with digital signatures, extends existing compliance_obligations/records';
COMMENT ON TABLE public.amro_compliance_documents IS 'Supporting documents for compliance requirements (ADs, SBs, work cards, certificates)';

COMMENT ON COLUMN public.parts_inventory.nsn IS 'NATO Stock Number - added for enterprise aviation tracking';
COMMENT ON COLUMN public.parts_inventory.cage_code IS 'CAGE Code - Commercial and Government Entity identifier';
COMMENT ON COLUMN public.parts_inventory.technical_documentation IS 'Technical documentation references (manuals, drawings, MSDS)';

-- ============================================================================
-- 8. SEED DATA (Sample tools and compliance records for testing)
-- ============================================================================

-- Sample tool (only if table is empty)
INSERT INTO public.amro_tooling_registry (
    tenant_id, tool_code, tool_name, manufacturer, model_number, tool_category, tool_type,
    calibration_required, calibration_interval_days, calibration_standard,
    specifications, currency, purchase_cost
)
SELECT 
    (SELECT id FROM public.tenants LIMIT 1), -- Use first tenant
    'TOOL-TW-500',
    'Digital Torque Wrench',
    'Snap-on',
    'ECF500',
    'hand_tool',
    'Torque Wrench',
    TRUE,
    180,
    'ISO 6789',
    '{"measurement_range": "50-500 in-lbs", "accuracy": "±2%", "weight": 1.2}'::jsonb,
    'USD',
    850.00
WHERE NOT EXISTS (SELECT 1 FROM public.amro_tooling_registry LIMIT 1);

-- Sample tool instance
INSERT INTO public.amro_tooling_instances (
    tenant_id, tool_id, serial_number, current_status, lifecycle_status,
    next_calibration_due, calibration_status,
    tool_crib_location
)
SELECT 
    (SELECT id FROM public.tenants LIMIT 1),
    id, -- tool_id from amro_tooling_registry
    'SN-2024-001',
    'available',
    'active',
    CURRENT_DATE + INTERVAL '180 days',
    'valid',
    'Tool Crib A - Shelf 3'
FROM public.amro_tooling_registry 
WHERE tool_code = 'TOOL-TW-500'
AND NOT EXISTS (
    SELECT 1 FROM public.amro_tooling_instances 
    WHERE serial_number = 'SN-2024-001'
);

-- Sample AD/SB record (only if table is empty)
INSERT INTO public.amro_compliance_ad_sb_registry (
    tenant_id, directive_number, directive_type, regulatory_authority,
    oem, aircraft_model, component_ata, effective_date, compliance_deadline,
    title, description, applicability, summary,
    applicable_to_fleet, priority, safety_impact, grounding_requirement
)
SELECT 
    (SELECT id FROM public.tenants LIMIT 1),
    'AD 2024-12-05',
    'AD',
    'FAA',
    'CFM International',
    'A320neo',
    '72-00-00',
    '2024-12-01',
    '2025-06-01',
    'Engine Fuel Pump Inspection',
    'Inspect high-pressure fuel pump for cracking',
    'A320neo family with CFM LEAP-1A engines',
    'Mandatory inspection required to prevent fuel leak',
    TRUE,
    'high',
    TRUE,
    FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.amro_compliance_ad_sb_registry LIMIT 1);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- ============================================================================
-- MIGRATION NOTES FOR DEVELOPERS
-- ============================================================================
-- 
-- RELATIONSHIP TO EXISTING TABLES:
-- 
-- 1. Parts/Materials Management:
--    - USE: public.parts_inventory (existing, enhanced with new columns)
--    - USE: public.amro_item_master (existing item definitions)
--    - USE: public.amro_stock_ledger_transactions (existing double-entry ledger)
--    - USE: public.reservations (existing part reservations)
--    - USE: public.amro_purchase_orders (existing PO system from Apr 10)
--    - USE: public.suppliers (existing supplier master)
--    
-- 2. Tooling Management (NEW):
--    - USE: public.amro_tooling_registry (created in this migration)
--    - USE: public.amro_tooling_instances (created in this migration)
--    - USE: public.amro_tool_reservations (created in this migration)
--    - USE: public.amro_calibration_logs (created in this migration)
--    - USE: public.amro_tool_maintenance_history (created in this migration)
--    
-- 3. Compliance Management (EXTENDED):
--    - USE: public.compliance_obligations (existing base obligations)
--    - USE: public.compliance_records (existing compliance decisions)
--    - USE: public.amro_compliance_ad_sb_registry (created in this migration)
--    - USE: public.amro_compliance_requirements_enhanced (created in this migration, links to existing)
--    - USE: public.amro_compliance_documents (created in this migration)
--
-- API ENDPOINTS:
-- - Materials: Use EXISTING /api/v2/amro/stock-ledger/* and parts routes
-- - Tooling: Use NEW /api/v2/amro/tooling/* routes
-- - Compliance: Use NEW /api/v2/amro/compliance-enterprise/* routes
--
-- DO NOT USE: The original incorrect migration (20260413100000) that created
-- duplicate amro_materials_catalog and amro_purchase_orders tables.
-- This corrected migration properly extends the existing schema.
-- ============================================================================

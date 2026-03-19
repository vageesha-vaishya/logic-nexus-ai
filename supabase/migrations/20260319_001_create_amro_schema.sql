-- DB-VERIFICATION: amro-operational-layer-reviewed
-- DB-ARCH-APPROVAL: phase-a-schema-approved
-- AMRO Operational Database Schema - Phase A
-- Created: 2026-03-19
-- Purpose: Asset Maintenance, Repair, and Overhaul operational layer
-- Scope: Aircraft, components, work packages, maintenance tasks, staff qualifications, and event tracking

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DOMAIN TYPES - Reusable enums to prevent hardcoded magic values
-- ============================================================================
-- Aircraft operational status
CREATE DOMAIN IF NOT EXISTS aircraft_status AS text CHECK (VALUE IN ('active', 'maintenance', 'grounded', 'retired', 'storage'));

-- Component lifecycle status
CREATE DOMAIN IF NOT EXISTS component_status AS text CHECK (VALUE IN ('installed', 'removed', 'repair_queue', 'under_repair', 'awaiting_installation', 'condemned', 'obsolete'));

-- Work package classification types
CREATE DOMAIN IF NOT EXISTS maintenance_type AS text CHECK (VALUE IN ('line', 'base', 'component', 'inspection', 'overhaul', 'repair', 'upgrade', 'modification'));

-- Work package status tracking
CREATE DOMAIN IF NOT EXISTS work_package_status AS text CHECK (VALUE IN ('planning', 'approved', 'scheduled', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled'));

-- Individual task status within work packages
CREATE DOMAIN IF NOT EXISTS task_status AS text CHECK (VALUE IN ('pending', 'not_started', 'in_progress', 'on_hold', 'completed', 'rework_required', 'cancelled'));

-- Material/part status in work packages
CREATE DOMAIN IF NOT EXISTS material_status AS text CHECK (VALUE IN ('pending', 'ordered', 'received', 'installed', 'cancelled', 'returned'));

-- Material action types
CREATE DOMAIN IF NOT EXISTS material_action AS text CHECK (VALUE IN ('install', 'remove', 'inspect', 'repair'));

-- Digital signature methods
CREATE DOMAIN IF NOT EXISTS signature_method AS text CHECK (VALUE IN ('digital', 'pin', 'biometric'));

-- ============================================================================
-- RLS POLICY HELPER PATTERN DOCUMENTATION
-- ============================================================================
-- All AMRO tables follow a standardized two-policy RLS pattern:
-- 1. Platform Admin Policy: Grants full access to users with 'platform_admin' role
-- 2. Tenant Isolation Policy: Restricts access to data matching user's tenant_id via user_roles
--
-- This pattern ensures:
-- - Multi-tenant data isolation at the database level
-- - Platform admins can audit and manage all tenant data
-- - Regular users can only access their tenant's data
-- - All policies use auth.uid() for security and user_roles junction table for authorization
--
-- To apply this pattern to a new table:
-- 1. Ensure table has tenant_id column (uuid, NOT NULL, references public.tenants(id))
-- 2. Enable RLS: ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
-- 3. Create two policies following the template above (see Aircraft policies below for exact syntax)
-- 4. Add indexes on tenant_id and any frequently filtered columns
-- ============================================================================

-- ============================================================================
-- 1. AIRCRAFT TABLE - Core asset registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.aircraft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,

  -- Aircraft registration and identification
  registration text NOT NULL,
  aircraft_type text NOT NULL,
  manufacturer text NOT NULL,
  model text NOT NULL,
  serial_number text NOT NULL UNIQUE,
  line_number text,
  msn text UNIQUE, -- Manufacturer Serial Number

  -- Operational data
  current_flight_hours decimal(15, 2) DEFAULT 0,
  current_cycles integer DEFAULT 0,
  current_flight_hours_since_new decimal(15, 2) DEFAULT 0,
  current_cycles_since_new integer DEFAULT 0,

  -- Ownership
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status and metadata
  status aircraft_status NOT NULL DEFAULT 'active'::aircraft_status,
  operator_code text,
  base_location text,
  home_base uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,

  -- Timestamps and audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_aircraft_tenant_id ON public.aircraft(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_franchise_id ON public.aircraft(franchise_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_registration ON public.aircraft(registration);
CREATE INDEX IF NOT EXISTS idx_aircraft_serial_number ON public.aircraft(serial_number);
CREATE INDEX IF NOT EXISTS idx_aircraft_status ON public.aircraft(status);

-- ============================================================================
-- 2. COMPONENTS TABLE - Serialized rotable/repairable components
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,

  -- Component identification
  part_number text NOT NULL,
  serial_number text NOT NULL,
  alternate_part_numbers text[] DEFAULT ARRAY[]::text[],

  -- Component classification
  component_type text NOT NULL,
  category text NOT NULL,
  manufacturer text NOT NULL,
  model text NOT NULL,
  ata_chapter varchar(10), -- ATA 100 classification (e.g., '70' for hydraulic)

  -- LLP (Life Limit Part) tracking
  is_llp_part boolean DEFAULT false,
  llp_hours decimal(10, 2),
  llp_cycles integer,
  llp_calendar_days integer,

  -- Condition tracking
  status component_status NOT NULL DEFAULT 'installed'::component_status,
  condition_code text, -- GOOD, FAIR, POOR, UNSERVICEABLE, etc.

  -- Lifecycle tracking
  installation_date timestamptz,
  removal_date timestamptz,
  hours_since_new decimal(15, 2) DEFAULT 0,
  cycles_since_new integer DEFAULT 0,

  -- Current location and assignment
  location text,
  work_package_id uuid REFERENCES public.work_packages(id) ON DELETE SET NULL,

  -- Timestamps and audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_components_tenant_id ON public.components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_components_franchise_id ON public.components(franchise_id);
CREATE INDEX IF NOT EXISTS idx_components_aircraft_id ON public.components(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_components_part_number ON public.components(part_number);
CREATE INDEX IF NOT EXISTS idx_components_serial_number ON public.components(serial_number);
CREATE INDEX IF NOT EXISTS idx_components_status ON public.components(status);
CREATE INDEX IF NOT EXISTS idx_components_work_package_id ON public.components(work_package_id);

-- ============================================================================
-- 3. WORK_PACKAGES TABLE - Maintenance work orders and campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,

  -- Work package identification
  work_order_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,

  -- Classification
  work_type text NOT NULL,
  maintenance_type maintenance_type NOT NULL,
  priority integer DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  source varchar(100), -- Where requirement came from

  -- Scheduling and planning
  planned_start_date timestamptz,
  planned_end_date timestamptz,
  actual_start_date timestamptz,
  actual_end_date timestamptz,

  -- Resource estimation
  estimated_labor_hours decimal(10, 2),
  estimated_cost decimal(15, 2),
  actual_labor_hours decimal(10, 2),
  actual_cost decimal(15, 2),

  -- Status tracking
  status work_package_status NOT NULL DEFAULT 'planning'::work_package_status,

  -- Assignments
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Additional metadata
  reference_documents text[] DEFAULT ARRAY[]::text[],
  notes text,
  external_reference text,

  -- Timestamps and audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_packages_tenant_id ON public.work_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_franchise_id ON public.work_packages(franchise_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_aircraft_id ON public.work_packages(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_work_order_number ON public.work_packages(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_packages_status ON public.work_packages(status);
CREATE INDEX IF NOT EXISTS idx_work_packages_assigned_to ON public.work_packages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_packages_maintenance_type ON public.work_packages(maintenance_type);

-- ============================================================================
-- 4. TASKS TABLE - Individual maintenance tasks within work packages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  work_package_id uuid NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,

  -- Task identification
  task_number text NOT NULL,
  title text NOT NULL,
  description text,

  -- Task definition
  task_category text NOT NULL,
  estimated_duration_hours decimal(10, 2),
  complexity_level integer DEFAULT 3 CHECK (complexity_level >= 1 AND complexity_level <= 5),
  procedure_reference varchar(255), -- Maintenance manual reference
  steps jsonb, -- Procedural steps
  qualifications jsonb, -- Required qualifications (replaces required_skill_ids)
  evidence_fields jsonb, -- Evidence fields required for task completion

  -- Scheduling
  sequence_order integer,
  planned_start_date timestamptz,
  planned_end_date timestamptz,
  actual_start_date timestamptz,
  actual_end_date timestamptz,

  -- Status and progress
  status task_status NOT NULL DEFAULT 'pending'::task_status,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  -- Assignment
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Quality and sign-off
  qa_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  qa_verified_at timestamptz,

  -- Additional data
  checklist jsonb DEFAULT '{}'::jsonb,
  notes text,

  -- Timestamps and audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_franchise_id ON public.tasks(franchise_id);
CREATE INDEX IF NOT EXISTS idx_tasks_work_package_id ON public.tasks(work_package_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_task_category ON public.tasks(task_category);

-- Column documentation for JSONB fields
COMMENT ON COLUMN public.tasks.steps IS 'JSON array of procedural steps for task execution. Expected schema:
[
  {
    "step_number": integer,
    "description": string,
    "duration_minutes": integer,
    "required_tool_ids": [string],
    "safety_notes": string
  },
  ...
]';

COMMENT ON COLUMN public.tasks.qualifications IS 'JSON object of required qualifications for task assignment. Expected schema:
{
  "rating": "A&P" | "Powerplant" | "Avionics" | string,
  "scope": string,
  "currency_days": integer,
  "specific_types": [string]
}';

COMMENT ON COLUMN public.tasks.evidence_fields IS 'JSON array of required evidence types for task completion. Expected schema:
[
  {
    "field_type": "photo" | "inspection_checklist" | "measurement" | "signature",
    "required": boolean,
    "field_name": string,
    "description": string
  },
  ...
]';

COMMENT ON COLUMN public.tasks.checklist IS 'JSON object tracking task completion checklist items. Expected schema:
{
  "items": [
    {
      "id": string,
      "name": string,
      "completed": boolean,
      "completed_by": uuid,
      "completed_at": timestamptz
    }
  ]
}';

-- ============================================================================
-- 5. STAFF_QUALIFICATIONS TABLE - Maintenance technician certifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Qualification details
  qualification_code text NOT NULL,
  qualification_name text NOT NULL,
  issuing_authority text NOT NULL,

  -- Certification validity
  issue_date date NOT NULL,
  expiration_date date,
  renewal_date date,
  is_active boolean NOT NULL DEFAULT true,

  -- License/Certificate tracking
  license_number text UNIQUE,
  certificate_number text UNIQUE,

  -- Scope and limitations
  scope text,
  rating varchar(100) NOT NULL, -- e.g., 'A&P', 'Powerplant'
  aircraft_types text[] DEFAULT ARRAY[]::text[],
  component_categories text[] DEFAULT ARRAY[]::text[],
  limitations text,
  can_certify_release boolean DEFAULT false,
  can_defer boolean DEFAULT false,

  -- Document storage
  document_url text,
  supporting_documents text[] DEFAULT ARRAY[]::text[],

  -- Verification
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,

  -- Timestamps and audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_tenant_id ON public.staff_qualifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_franchise_id ON public.staff_qualifications(franchise_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff_id ON public.staff_qualifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_is_active ON public.staff_qualifications(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_expiration_date ON public.staff_qualifications(expiration_date);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_qualification_code ON public.staff_qualifications(qualification_code);

-- ============================================================================
-- 6. MAINTENANCE_EVENTS TABLE - Audit trail of maintenance actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  work_package_id uuid REFERENCES public.work_packages(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,

  -- Event classification
  event_type text NOT NULL,
  event_code text,

  -- Event details
  title text NOT NULL,
  description text,

  -- Actor and authorization
  performed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Event data
  data jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Digital signature and evidence
  signature text,
  signature_timestamp timestamptz,
  signature_method signature_method,
  evidence_hash text,

  -- Compliance tracking
  regulatory_requirement text,
  compliance_authority text,

  -- Timestamps
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_events_tenant_id ON public.maintenance_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_franchise_id ON public.maintenance_events(franchise_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_aircraft_id ON public.maintenance_events(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_component_id ON public.maintenance_events(component_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_work_package_id ON public.maintenance_events(work_package_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_task_id ON public.maintenance_events(task_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_event_type ON public.maintenance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_event_timestamp ON public.maintenance_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_performed_by ON public.maintenance_events(performed_by);

-- Column documentation for JSONB fields
COMMENT ON COLUMN public.maintenance_events.data IS 'JSON object containing event-specific data payload. Structure varies by event_type.
Examples:
- For maintenance completion: {"maintenance_hours": number, "defects_found": number}
- For component replacement: {"old_part_id": uuid, "new_part_id": uuid, "reason": string}
- For quality check: {"inspector_notes": string, "defects": array}';

COMMENT ON COLUMN public.maintenance_events.metadata IS 'JSON object containing event metadata. Expected schema:
{
  "source_system": string,
  "source_ip": string,
  "user_agent": string,
  "api_version": string,
  "request_id": string,
  "tags": [string]
}';

-- ============================================================================
-- 7. WORK_PACKAGE_MATERIALS TABLE - Parts and materials required for work
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_package_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  work_package_id uuid NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,

  -- Material identification
  part_number text NOT NULL,
  description text NOT NULL,
  manufacturer text,
  component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  action material_action,

  -- Quantity and UOM
  quantity integer NOT NULL DEFAULT 1,
  unit_of_measure text NOT NULL DEFAULT 'EA',

  -- Cost tracking
  unit_cost decimal(12, 2),
  total_cost decimal(15, 2),
  currency text DEFAULT 'USD',

  -- Status and sourcing
  status material_status NOT NULL DEFAULT 'pending'::material_status,
  supplier_id text,
  supplier_name text,
  purchase_order_number text,

  -- Dates
  order_date timestamptz,
  required_date timestamptz,
  received_date timestamptz,

  -- Traceability
  batch_lot_number text,
  material_certification text,

  -- Additional tracking
  notes text,
  is_critical boolean DEFAULT false,

  -- Timestamps and audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_package_materials_tenant_id ON public.work_package_materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_package_materials_franchise_id ON public.work_package_materials(franchise_id);
CREATE INDEX IF NOT EXISTS idx_work_package_materials_work_package_id ON public.work_package_materials(work_package_id);
CREATE INDEX IF NOT EXISTS idx_work_package_materials_part_number ON public.work_package_materials(part_number);
CREATE INDEX IF NOT EXISTS idx_work_package_materials_status ON public.work_package_materials(status);
CREATE INDEX IF NOT EXISTS idx_work_package_materials_order_date ON public.work_package_materials(order_date);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all AMRO tables
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_package_materials ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Aircraft RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Aircraft: platform admin full access" ON public.aircraft;
CREATE POLICY "Aircraft: platform admin full access"
  ON public.aircraft
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Aircraft: tenant users access own tenant data" ON public.aircraft;
CREATE POLICY "Aircraft: tenant users access own tenant data"
  ON public.aircraft
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- Components RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Components: platform admin full access" ON public.components;
CREATE POLICY "Components: platform admin full access"
  ON public.components
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Components: tenant users access own tenant data" ON public.components;
CREATE POLICY "Components: tenant users access own tenant data"
  ON public.components
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- Work Packages RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Work packages: platform admin full access" ON public.work_packages;
CREATE POLICY "Work packages: platform admin full access"
  ON public.work_packages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Work packages: tenant users access own tenant data" ON public.work_packages;
CREATE POLICY "Work packages: tenant users access own tenant data"
  ON public.work_packages
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- Tasks RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Tasks: platform admin full access" ON public.tasks;
CREATE POLICY "Tasks: platform admin full access"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Tasks: tenant users access own tenant data" ON public.tasks;
CREATE POLICY "Tasks: tenant users access own tenant data"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- Staff Qualifications RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Staff qualifications: platform admin full access" ON public.staff_qualifications;
CREATE POLICY "Staff qualifications: platform admin full access"
  ON public.staff_qualifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Staff qualifications: tenant users access own tenant data" ON public.staff_qualifications;
CREATE POLICY "Staff qualifications: tenant users access own tenant data"
  ON public.staff_qualifications
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- Maintenance Events RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Maintenance events: platform admin full access" ON public.maintenance_events;
CREATE POLICY "Maintenance events: platform admin full access"
  ON public.maintenance_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Maintenance events: tenant users access own tenant data" ON public.maintenance_events;
CREATE POLICY "Maintenance events: tenant users access own tenant data"
  ON public.maintenance_events
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- Work Package Materials RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Work package materials: platform admin full access" ON public.work_package_materials;
CREATE POLICY "Work package materials: platform admin full access"
  ON public.work_package_materials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Work package materials: tenant users access own tenant data" ON public.work_package_materials;
CREATE POLICY "Work package materials: tenant users access own tenant data"
  ON public.work_package_materials
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

-- ============================================================================
-- End of AMRO Operational Schema Migration
-- ============================================================================

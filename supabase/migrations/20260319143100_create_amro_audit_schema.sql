-- DB-VERIFICATION: amro-audit-layer-reviewed
-- DB-ARCH-APPROVAL: phase-a-audit-schema-approved
-- AMRO Audit Database Schema - Phase A
-- Created: 2026-03-19
-- Purpose: Immutable audit trail for compliance and append-only event tracking
-- Scope: Audit records with blockchain-style hashing, compliance trails for regulatory replay

-- ============================================================================
-- DOMAIN TYPES FOR AUDIT SCHEMA
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'audit_record_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE DOMAIN public.audit_record_type AS text CHECK (VALUE IN (
      'aircraft_registration',
      'aircraft_status_change',
      'component_installation',
      'component_removal',
      'component_repair',
      'maintenance_completion',
      'maintenance_sign_off',
      'work_package_approval',
      'task_assignment',
      'task_completion',
      'quality_inspection',
      'deviation_logged',
      'maintenance_release',
      'system_action'
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'audit_event_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE DOMAIN public.audit_event_type AS text CHECK (VALUE IN (
      'aircraft_registered',
      'aircraft_grounded',
      'aircraft_released',
      'component_replaced',
      'component_repaired',
      'component_inspected',
      'work_package_created',
      'work_package_scheduled',
      'work_package_completed',
      'maintenance_approved',
      'maintenance_signed_off',
      'quality_checked',
      'defect_logged',
      'maintenance_released',
      'compliance_check',
      'audit_event',
      'system_event'
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'audit_actor_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE DOMAIN public.audit_actor_role AS text CHECK (VALUE IN (
      'technician',
      'mechanic',
      'inspector',
      'quality_assurance',
      'supervisor',
      'maintenance_manager',
      'operations_manager',
      'system',
      'api',
      'scheduler',
      'scheduler_system'
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'audit_entity_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE DOMAIN public.audit_entity_type AS text CHECK (VALUE IN (
      'aircraft',
      'component',
      'work_package',
      'task',
      'staff_qualification',
      'maintenance_event',
      'system_config',
      'user_action',
      'batch_operation'
    ));
  END IF;
END
$$;

-- ============================================================================
-- CREATE AUDIT SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS mro_audit AUTHORIZATION postgres;

-- ============================================================================
-- 1. AUDIT RECORDS TABLE - Immutable audit records with blockchain-style hashing
-- ============================================================================
CREATE TABLE IF NOT EXISTS mro_audit.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Record classification
  record_type audit_record_type NOT NULL,

  -- Related entity tracking
  related_entity_id text NOT NULL,
  related_entity_type audit_entity_type NOT NULL,

  -- Actor information
  actor_id text NOT NULL,
  actor_role audit_actor_role NOT NULL,

  -- Action description
  action text NOT NULL,

  -- Contextual data
  context jsonb DEFAULT '{}'::jsonb,

  -- Blockchain-style hashing for immutability verification
  signature bytea,
  previous_hash bytea,

  -- Timestamp (immutable after creation)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mro_audit_records_tenant_id ON mro_audit.records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mro_audit_records_related_entity ON mro_audit.records(related_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mro_audit_records_tenant_created ON mro_audit.records(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mro_audit_records_created_at ON mro_audit.records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mro_audit_records_actor_id ON mro_audit.records(actor_id);

COMMENT ON TABLE mro_audit.records IS 'Immutable audit records with blockchain-style hashing. Records are append-only and cannot be updated or deleted. Uses chain linking via previous_hash for integrity verification.';

COMMENT ON COLUMN mro_audit.records.signature IS 'Digital signature (BYTEA) of the audit action. Generated by the application using cryptographic signing (e.g., HMAC-SHA256, RSA, Ed25519).';

COMMENT ON COLUMN mro_audit.records.previous_hash IS 'Hash of the previous audit record in the chain. Enables detection of records being inserted out of sequence or deleted. Chain starts with null or a genesis hash.';

COMMENT ON COLUMN mro_audit.records.context IS 'JSONB object containing additional context for the audit record. Structure varies by record_type. Examples:
- For aircraft_registration: {"aircraft_id": uuid, "registration": string, "manufacturer": string}
- For component_installation: {"component_id": uuid, "aircraft_id": uuid, "hours_before": number}
- For maintenance_completion: {"work_package_id": uuid, "labor_hours": number, "defects_found": number}';

-- ============================================================================
-- 2. AUDIT TRAILS TABLE - Immutable compliance trail events for replay
-- ============================================================================
CREATE TABLE IF NOT EXISTS mro_audit.trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Event classification
  event_type audit_event_type NOT NULL,

  -- Entity tracking
  entity_type audit_entity_type NOT NULL,
  entity_id text NOT NULL,

  -- User information
  user_id text NOT NULL,
  user_email text NOT NULL,

  -- Event timestamp (for replay ordering)
  timestamp timestamptz NOT NULL,

  -- Action description (human-readable)
  action_description text NOT NULL,

  -- Regulatory context
  regulatory_context jsonb DEFAULT '{}'::jsonb,

  -- Audit creation timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mro_audit_trails_tenant_id ON mro_audit.trails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mro_audit_trails_tenant_created ON mro_audit.trails(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mro_audit_trails_entity ON mro_audit.trails(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mro_audit_trails_created_at ON mro_audit.trails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mro_audit_trails_timestamp ON mro_audit.trails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mro_audit_trails_event_type ON mro_audit.trails(event_type);

COMMENT ON TABLE mro_audit.trails IS 'Immutable compliance trail events for regulatory replay and forensic analysis. Records are append-only and cannot be updated or deleted. Ordered by timestamp for compliance event reconstruction.';

COMMENT ON COLUMN mro_audit.trails.timestamp IS 'Event timestamp (separate from created_at). This is the time the action occurred operationally. created_at tracks when the audit trail was recorded. For compliance replay, timestamp determines event order.';

COMMENT ON COLUMN mro_audit.trails.regulatory_context IS 'JSONB object containing regulatory references and compliance context. Expected schema:
{
  "regulation": string (e.g., "FAA Part 43"),
  "section": string (e.g., "Appendix A", "Appendix B-1"),
  "compliance_requirement": string,
  "audit_authority": string,
  "jurisdiction": string,
  "reference_documents": [string]
}';

-- ============================================================================
-- 3. IMMUTABILITY ENFORCEMENT VIA TRIGGERS
-- ============================================================================

-- Create the immutability enforcement function
CREATE OR REPLACE FUNCTION mro_audit.prevent_audit_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent UPDATE on audit tables
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit records are immutable. Cannot update audit record % in table %',
      OLD.id, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
      USING ERRCODE = '55005';
  END IF;

  -- Prevent DELETE on audit tables
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit records are immutable. Cannot delete audit record % in table %',
      OLD.id, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
      USING ERRCODE = '55005';
  END IF;

  -- Allow INSERT (append-only pattern)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply immutability trigger to records table
DROP TRIGGER IF EXISTS audit_records_immutable ON mro_audit.records;
CREATE TRIGGER audit_records_immutable
  BEFORE UPDATE OR DELETE ON mro_audit.records
  FOR EACH ROW
  EXECUTE FUNCTION mro_audit.prevent_audit_updates();

-- Apply immutability trigger to trails table
DROP TRIGGER IF EXISTS audit_trails_immutable ON mro_audit.trails;
CREATE TRIGGER audit_trails_immutable
  BEFORE UPDATE OR DELETE ON mro_audit.trails
  FOR EACH ROW
  EXECUTE FUNCTION mro_audit.prevent_audit_updates();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on audit tables
ALTER TABLE mro_audit.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mro_audit.trails ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Audit Records RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Audit records: platform admin full access" ON mro_audit.records;
DROP POLICY IF EXISTS "Audit records: platform admin insert" ON mro_audit.records;
DROP POLICY IF EXISTS "Audit records: tenant users select own tenant data" ON mro_audit.records;
DROP POLICY IF EXISTS "Audit records: tenant users insert own tenant data" ON mro_audit.records;

CREATE POLICY "Audit records: platform admin access (all)"
  ON mro_audit.records
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

CREATE POLICY "Audit records: tenant users own tenant data (all)"
  ON mro_audit.records
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
-- Audit Trails RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "Audit trails: platform admin full access" ON mro_audit.trails;
DROP POLICY IF EXISTS "Audit trails: platform admin insert" ON mro_audit.trails;
DROP POLICY IF EXISTS "Audit trails: tenant users select own tenant data" ON mro_audit.trails;
DROP POLICY IF EXISTS "Audit trails: tenant users insert own tenant data" ON mro_audit.trails;

CREATE POLICY "Audit trails: platform admin access (all)"
  ON mro_audit.trails
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

CREATE POLICY "Audit trails: tenant users own tenant data (all)"
  ON mro_audit.trails
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
-- GRANT PERMISSIONS
-- ============================================================================

-- Audit schema usage
GRANT USAGE ON SCHEMA mro_audit TO authenticated;
GRANT USAGE ON SCHEMA mro_audit TO anon;

-- Audit records table permissions
GRANT SELECT, INSERT ON mro_audit.records TO authenticated;
GRANT SELECT, INSERT ON mro_audit.records TO anon;

-- Audit trails table permissions
GRANT SELECT, INSERT ON mro_audit.trails TO authenticated;
GRANT SELECT, INSERT ON mro_audit.trails TO anon;

-- Function permissions (needed for triggers)
GRANT EXECUTE ON FUNCTION mro_audit.prevent_audit_updates() TO authenticated;
GRANT EXECUTE ON FUNCTION mro_audit.prevent_audit_updates() TO anon;

-- ============================================================================
-- End of AMRO Audit Schema Migration
-- ============================================================================

-- Migration: create flypal.flypal_configured_directives
-- Author: GPT-5.3-Codex
-- Date: 2026-05-05
-- DB-VERIFICATION: flypal-configured-directives-table-reviewed
-- DB-ARCH-APPROVAL: pending-review-no-create-table-exception-claimed-by-request

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;

CREATE TABLE IF NOT EXISTS flypal.flypal_configured_directives (
  id bigserial PRIMARY KEY,
  tenant_id uuid,
  assembly_models_name text,
  assembly_models uuid,
  aircraft_template_name text,
  aircraft_template_id uuid,
  registration text,
  serial_number text,
  "directives.directive_no" text,
  "directives.reference_amp" text,
  "directives.category_code" text,
  "directives.ata_code" text,
  "directives.code_form_no + directives.description" text,
  last_done_on date,
  work_order_number text,
  notes text,
  "Frequency" text,
  effective_from text,
  "Current" text,
  "Elapsed" text,
  "Extension" text,
  due_at text,
  "Due At Airframe" text,
  "Remaining" text,
  is_applicable text,
  directive_id uuid,
  is_row_processed_success boolean DEFAULT false,
  failure_reason text,
  processed_on date
);

DO $$
BEGIN
  IF to_regclass('public.directives') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'flypal'
        AND t.relname = 'flypal_configured_directives'
        AND c.conname = 'fk_flypal_configured_directives_directive_id'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_configured_directives_directive_id
        FOREIGN KEY (directive_id)
        REFERENCES public.directives(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.assembly_models') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'flypal'
        AND t.relname = 'flypal_configured_directives'
        AND c.conname = 'fk_flypal_configured_directives_assembly_models'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_configured_directives_assembly_models
        FOREIGN KEY (assembly_models)
        REFERENCES public.assembly_models(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.aircraft_template') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'flypal'
        AND t.relname = 'flypal_configured_directives'
        AND c.conname = 'fk_flypal_configured_directives_aircraft_template_id'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_configured_directives_aircraft_template_id
        FOREIGN KEY (aircraft_template_id)
        REFERENCES public.aircraft_template(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_tenant_id
  ON flypal.flypal_configured_directives (tenant_id);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_directive_id
  ON flypal.flypal_configured_directives (directive_id);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_assembly_models
  ON flypal.flypal_configured_directives (assembly_models);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_aircraft_template_id
  ON flypal.flypal_configured_directives (aircraft_template_id);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_registration
  ON flypal.flypal_configured_directives (registration);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_serial_number
  ON flypal.flypal_configured_directives (serial_number);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_processed_on
  ON flypal.flypal_configured_directives (processed_on);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_processed_success
  ON flypal.flypal_configured_directives (is_row_processed_success);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_tenant_directive_aircraft
  ON flypal.flypal_configured_directives (tenant_id, directive_id, aircraft_template_id);

COMMENT ON TABLE flypal.flypal_configured_directives IS
  'Stores configured directive rows processed for FlyPal tenant aircraft scope.';

COMMENT ON COLUMN flypal.flypal_configured_directives.tenant_id IS 'Tenant scope identifier.';
COMMENT ON COLUMN flypal.flypal_configured_directives.assembly_models_name IS 'Assembly model display name.';
COMMENT ON COLUMN flypal.flypal_configured_directives.assembly_models IS 'Assembly model identifier.';
COMMENT ON COLUMN flypal.flypal_configured_directives.aircraft_template_name IS 'Aircraft template display name.';
COMMENT ON COLUMN flypal.flypal_configured_directives.aircraft_template_id IS 'Aircraft template identifier.';
COMMENT ON COLUMN flypal.flypal_configured_directives.registration IS 'Aircraft registration value.';
COMMENT ON COLUMN flypal.flypal_configured_directives.serial_number IS 'Aircraft serial number value.';
COMMENT ON COLUMN flypal.flypal_configured_directives."directives.directive_no" IS 'Directive number.';
COMMENT ON COLUMN flypal.flypal_configured_directives."directives.reference_amp" IS 'Directive reference AMP.';
COMMENT ON COLUMN flypal.flypal_configured_directives."directives.category_code" IS 'Directive category code.';
COMMENT ON COLUMN flypal.flypal_configured_directives."directives.ata_code" IS 'Directive ATA code.';
COMMENT ON COLUMN flypal.flypal_configured_directives."directives.code_form_no + directives.description" IS 'Combined directive code form number and description.';
COMMENT ON COLUMN flypal.flypal_configured_directives.last_done_on IS 'Last completed date for directive task.';
COMMENT ON COLUMN flypal.flypal_configured_directives.work_order_number IS 'Related work order number.';
COMMENT ON COLUMN flypal.flypal_configured_directives.notes IS 'Operator notes for configured row.';
COMMENT ON COLUMN flypal.flypal_configured_directives."Frequency" IS 'Directive frequency text.';
COMMENT ON COLUMN flypal.flypal_configured_directives.effective_from IS 'Effective-from descriptor.';
COMMENT ON COLUMN flypal.flypal_configured_directives."Current" IS 'Current value text.';
COMMENT ON COLUMN flypal.flypal_configured_directives."Elapsed" IS 'Elapsed value text.';
COMMENT ON COLUMN flypal.flypal_configured_directives."Extension" IS 'Extension value text.';
COMMENT ON COLUMN flypal.flypal_configured_directives.due_at IS 'Due-at descriptor.';
COMMENT ON COLUMN flypal.flypal_configured_directives."Due At Airframe" IS 'Due at airframe text.';
COMMENT ON COLUMN flypal.flypal_configured_directives."Remaining" IS 'Remaining value text.';
COMMENT ON COLUMN flypal.flypal_configured_directives.is_applicable IS 'Applicability text status.';
COMMENT ON COLUMN flypal.flypal_configured_directives.directive_id IS 'Directive identifier.';
COMMENT ON COLUMN flypal.flypal_configured_directives.is_row_processed_success IS 'Row processing success flag.';
COMMENT ON COLUMN flypal.flypal_configured_directives.failure_reason IS 'Reason for processing failure.';
COMMENT ON COLUMN flypal.flypal_configured_directives.processed_on IS 'Date the row was processed.';

COMMIT;

-- ROLLBACK (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS flypal.flypal_configured_directives;
-- COMMIT;

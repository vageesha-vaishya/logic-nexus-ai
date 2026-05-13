-- Migration: recreate flypal.flypal_configured_directives
-- Author: GPT-5.3-Codex
-- Date: 2026-05-05
-- DB-VERIFICATION: flypal-configured-directives-recreate-reviewed
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
  directive_no text,
  reference_amp text,
  category_code text,
  ata_code text,
  code_form_no_and_description text,
  last_done_on date,
  work_order_number text,
  notes text,
  frequency text,
  effective_from text,
  current text,
  elapsed text,
  extension text,
  due_at text,
  due_at_airframe text,
  remaining text,
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
        AND c.conname = 'fk_flypal_cfg_directives_directive_id'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_cfg_directives_directive_id
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
        AND c.conname = 'fk_flypal_cfg_directives_assembly_models'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_cfg_directives_assembly_models
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
        AND c.conname = 'fk_flypal_cfg_directives_aircraft_template_id'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_cfg_directives_aircraft_template_id
        FOREIGN KEY (aircraft_template_id)
        REFERENCES public.aircraft_template(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_tenant_id
  ON flypal.flypal_configured_directives (tenant_id);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_directive_id
  ON flypal.flypal_configured_directives (directive_id);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_aircraft_template_id
  ON flypal.flypal_configured_directives (aircraft_template_id);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_assembly_models
  ON flypal.flypal_configured_directives (assembly_models);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_registration
  ON flypal.flypal_configured_directives (registration);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_serial_number
  ON flypal.flypal_configured_directives (serial_number);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_processed_on
  ON flypal.flypal_configured_directives (processed_on);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_process_status
  ON flypal.flypal_configured_directives (is_row_processed_success);

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_lookup
  ON flypal.flypal_configured_directives (tenant_id, directive_id, aircraft_template_id);

COMMENT ON TABLE flypal.flypal_configured_directives IS
  'Stores tenant aircraft directive configuration and processing outcomes for FlyPal.';

COMMENT ON COLUMN flypal.flypal_configured_directives.tenant_id IS 'Tenant scope identifier.';
COMMENT ON COLUMN flypal.flypal_configured_directives.assembly_models_name IS 'Assembly model name.';
COMMENT ON COLUMN flypal.flypal_configured_directives.assembly_models IS 'Assembly model UUID.';
COMMENT ON COLUMN flypal.flypal_configured_directives.aircraft_template_name IS 'Aircraft template name.';
COMMENT ON COLUMN flypal.flypal_configured_directives.aircraft_template_id IS 'Aircraft template UUID.';
COMMENT ON COLUMN flypal.flypal_configured_directives.registration IS 'Aircraft registration.';
COMMENT ON COLUMN flypal.flypal_configured_directives.serial_number IS 'Aircraft serial number.';
COMMENT ON COLUMN flypal.flypal_configured_directives.directive_no IS 'Directive number.';
COMMENT ON COLUMN flypal.flypal_configured_directives.reference_amp IS 'Reference AMP identifier.';
COMMENT ON COLUMN flypal.flypal_configured_directives.category_code IS 'Directive category code.';
COMMENT ON COLUMN flypal.flypal_configured_directives.ata_code IS 'ATA chapter code.';
COMMENT ON COLUMN flypal.flypal_configured_directives.code_form_no_and_description IS 'Code/form and description composite text.';
COMMENT ON COLUMN flypal.flypal_configured_directives.last_done_on IS 'Date of last completion.';
COMMENT ON COLUMN flypal.flypal_configured_directives.work_order_number IS 'Associated work order number.';
COMMENT ON COLUMN flypal.flypal_configured_directives.notes IS 'Operational notes.';
COMMENT ON COLUMN flypal.flypal_configured_directives.frequency IS 'Directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.effective_from IS 'Effective-from indicator.';
COMMENT ON COLUMN flypal.flypal_configured_directives.current IS 'Current value snapshot.';
COMMENT ON COLUMN flypal.flypal_configured_directives.elapsed IS 'Elapsed value snapshot.';
COMMENT ON COLUMN flypal.flypal_configured_directives.extension IS 'Extension value.';
COMMENT ON COLUMN flypal.flypal_configured_directives.due_at IS 'Due-at value.';
COMMENT ON COLUMN flypal.flypal_configured_directives.due_at_airframe IS 'Due-at airframe value.';
COMMENT ON COLUMN flypal.flypal_configured_directives.remaining IS 'Remaining value.';
COMMENT ON COLUMN flypal.flypal_configured_directives.is_applicable IS 'Applicability status.';
COMMENT ON COLUMN flypal.flypal_configured_directives.directive_id IS 'Directive UUID.';
COMMENT ON COLUMN flypal.flypal_configured_directives.is_row_processed_success IS 'Processing success flag.';
COMMENT ON COLUMN flypal.flypal_configured_directives.failure_reason IS 'Processing failure reason.';
COMMENT ON COLUMN flypal.flypal_configured_directives.processed_on IS 'Processing date.';

COMMIT;

-- ROLLBACK (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS flypal.flypal_configured_directives;
-- COMMIT;

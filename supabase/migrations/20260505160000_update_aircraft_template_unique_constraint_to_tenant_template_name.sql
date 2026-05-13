-- DB-VERIFICATION: aircraft-template-tenant-template-name-unique-constraint-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
DECLARE
  constraint_matches_target boolean;
  duplicate_count bigint;
BEGIN
  IF to_regclass('public.aircraft_template') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft_template does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft_template'
      AND column_name = 'tenant_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft_template'
      AND column_name = 'template_name'
  ) THEN
    RAISE EXCEPTION 'Required columns (tenant_id, template_name) do not exist on public.aircraft_template.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft_template'
      AND c.conname = 'uq_aircraft_template_template_name'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) = 'UNIQUE (tenant_id, template_name)'
  ) INTO constraint_matches_target;

  IF constraint_matches_target THEN
    RETURN;
  END IF;

  -- Standard UNIQUE allows multiple NULL tenant_id values; only validate non-NULL tenant duplicates.
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tenant_id, template_name
    FROM public.aircraft_template
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id, template_name
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique constraint uq_aircraft_template_template_name: % duplicate (tenant_id, template_name) groups exist.',
      duplicate_count;
  END IF;

  ALTER TABLE public.aircraft_template
    DROP CONSTRAINT IF EXISTS uq_aircraft_template_template_name;

  ALTER TABLE public.aircraft_template
    ADD CONSTRAINT uq_aircraft_template_template_name
      UNIQUE (tenant_id, template_name);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft_template'
      AND c.conname = 'uq_aircraft_template_template_name'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) = 'UNIQUE (tenant_id, template_name)'
  ) THEN
    RAISE EXCEPTION 'Verification failed for uq_aircraft_template_template_name on public.aircraft_template.';
  END IF;
END;
$$;

COMMENT ON CONSTRAINT uq_aircraft_template_template_name ON public.aircraft_template IS
  'Enforces unique template_name per tenant (tenant_id, template_name).';

COMMIT;

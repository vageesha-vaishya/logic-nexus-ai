-- Alter directives threshold_hours to interval NOT NULL and replace HH:MM constraint
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

DO $$
DECLARE
  v_data_type text;
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE NOTICE 'Table public.directives does not exist, skipping migration block.';
    RETURN;
  END IF;

  ALTER TABLE public.directives
    DROP CONSTRAINT IF EXISTS directives_threshold_hours_hhmm_chk,
    DROP CONSTRAINT IF EXISTS directives_threshold_hours_interval_chk;

  SELECT c.data_type
  INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'directives'
    AND c.column_name = 'threshold_hours';

  IF v_data_type IS NULL THEN
    RAISE NOTICE 'Column public.directives.threshold_hours does not exist, skipping migration block.';
    RETURN;
  END IF;

  IF v_data_type = 'interval' THEN
    UPDATE public.directives
    SET threshold_hours = coalesce(threshold_hours, interval '0 minutes');
  ELSE
    EXECUTE $sql$
      ALTER TABLE public.directives
      ALTER COLUMN threshold_hours TYPE interval
      USING (
        CASE
          WHEN threshold_hours IS NULL THEN interval '0 minutes'
          WHEN btrim(threshold_hours::text) ~ '^[0-9]+:[0-5][0-9]$' THEN
            make_interval(
              hours => split_part(btrim(threshold_hours::text), ':', 1)::integer,
              mins => split_part(btrim(threshold_hours::text), ':', 2)::integer
            )
          WHEN btrim(threshold_hours::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN
            make_interval(mins => round((btrim(threshold_hours::text))::numeric * 60)::integer)
          ELSE NULL
        END
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.directives
    WHERE threshold_hours IS NULL
  ) THEN
    RAISE EXCEPTION
      'Unable to convert one or more threshold_hours values to interval. Fix data before re-running migration.';
  END IF;

  ALTER TABLE public.directives
    ALTER COLUMN threshold_hours SET NOT NULL;

  ALTER TABLE public.directives
    ADD CONSTRAINT directives_threshold_hours_interval_chk
    CHECK (threshold_hours >= interval '0 minutes');

  COMMENT ON COLUMN public.directives.threshold_hours IS
    'Directive threshold stored as interval and required (NOT NULL).';
END
$$;

COMMIT;

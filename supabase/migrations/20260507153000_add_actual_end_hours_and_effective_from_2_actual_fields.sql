-- DB-VERIFICATION: tasks-and-flypal-configured-directives-column-addition-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Table public.tasks does not exist.';
  END IF;

  IF to_regclass('flypal.flypal_configured_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_configured_directives does not exist.';
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS actual_end_hours interval NULL;

ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS effective_from_2_actual_end_hours interval NULL,
  ADD COLUMN IF NOT EXISTS effective_from_2_actual_end_date date NULL;

COMMENT ON COLUMN public.tasks.actual_end_hours IS
  'Actual end hour reading stored as an interval value.';

COMMENT ON COLUMN flypal.flypal_configured_directives.effective_from_2_actual_end_hours IS
  'Second effective-from actual end hour reading as interval.';

COMMENT ON COLUMN flypal.flypal_configured_directives.effective_from_2_actual_end_date IS
  'Second effective-from actual end date.';

COMMIT;

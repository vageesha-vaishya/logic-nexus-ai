-- DB-VERIFICATION: task-templates-and-tasks-interval-work-order-alignment-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- ============================================================================
-- 1) task_templates: numeric -> interval alignment
-- ============================================================================
DO $$
DECLARE
  estimated_type text;
  threshold_type text;
BEGIN
  SELECT data_type
  INTO estimated_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'task_templates'
    AND column_name = 'estimated_man_hours';

  IF estimated_type IS NOT NULL AND estimated_type <> 'interval' THEN
    EXECUTE $sql$
      ALTER TABLE public.task_templates
      ALTER COLUMN estimated_man_hours TYPE interval
      USING (
        CASE
          WHEN estimated_man_hours IS NULL THEN NULL
          WHEN btrim(estimated_man_hours::text) ~ '^-?\d+(\.\d+)?$' THEN
            make_interval(secs => round((btrim(estimated_man_hours::text))::numeric * 3600)::bigint)
          WHEN btrim(estimated_man_hours::text) ~ '^\d+:[0-5]\d(:[0-5]\d)?$' THEN
            make_interval(
              hours => split_part(btrim(estimated_man_hours::text), ':', 1)::integer,
              mins => split_part(btrim(estimated_man_hours::text), ':', 2)::integer,
              secs => coalesce(nullif(split_part(btrim(estimated_man_hours::text), ':', 3), ''), '0')::integer
            )
          WHEN btrim(estimated_man_hours::text) ~ '^-?\d+\s+days?.*$' THEN
            btrim(estimated_man_hours::text)::interval
          ELSE NULL
        END
      )
    $sql$;
  END IF;

  SELECT data_type
  INTO threshold_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'task_templates'
    AND column_name = 'threshold_hours';

  IF threshold_type IS NOT NULL AND threshold_type <> 'interval' THEN
    EXECUTE $sql$
      ALTER TABLE public.task_templates
      ALTER COLUMN threshold_hours TYPE interval
      USING (
        CASE
          WHEN threshold_hours IS NULL THEN NULL
          WHEN btrim(threshold_hours::text) ~ '^-?\d+(\.\d+)?$' THEN
            make_interval(secs => round((btrim(threshold_hours::text))::numeric * 3600)::bigint)
          WHEN btrim(threshold_hours::text) ~ '^\d+:[0-5]\d(:[0-5]\d)?$' THEN
            make_interval(
              hours => split_part(btrim(threshold_hours::text), ':', 1)::integer,
              mins => split_part(btrim(threshold_hours::text), ':', 2)::integer,
              secs => coalesce(nullif(split_part(btrim(threshold_hours::text), ':', 3), ''), '0')::integer
            )
          WHEN btrim(threshold_hours::text) ~ '^-?\d+\s+days?.*$' THEN
            btrim(threshold_hours::text)::interval
          ELSE NULL
        END
      )
    $sql$;
  END IF;
END $$;

ALTER TABLE public.task_templates
  DROP CONSTRAINT IF EXISTS ck_task_templates_threshold_hours_non_negative;

ALTER TABLE public.task_templates
  ADD CONSTRAINT ck_task_templates_threshold_hours_non_negative
  CHECK (threshold_hours IS NULL OR threshold_hours >= interval '0 seconds');

COMMENT ON COLUMN public.task_templates.estimated_man_hours IS
  'Estimated man-hours as interval (supports HH:MM:SS and duration-safe arithmetic).';
COMMENT ON COLUMN public.task_templates.threshold_hours IS
  'Threshold hours as interval (supports HH:MM:SS and duration-safe arithmetic).';

-- ============================================================================
-- 2) tasks: rename work_package_id -> work_order_id, keep compatibility alias
--    and convert estimated_duration_hours numeric -> interval.
-- ============================================================================
DO $$
DECLARE
  has_work_package boolean;
  has_work_order boolean;
  duration_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'work_package_id'
  )
  INTO has_work_package;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'work_order_id'
  )
  INTO has_work_order;

  IF has_work_package AND NOT has_work_order THEN
    EXECUTE 'ALTER TABLE public.tasks RENAME COLUMN work_package_id TO work_order_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'work_package_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.tasks ADD COLUMN work_package_id uuid';
  END IF;

  EXECUTE 'UPDATE public.tasks SET work_package_id = work_order_id WHERE work_package_id IS NULL';

  SELECT data_type
  INTO duration_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tasks'
    AND column_name = 'estimated_duration_hours';

  IF duration_type IS NOT NULL AND duration_type <> 'interval' THEN
    EXECUTE $sql$
      ALTER TABLE public.tasks
      ALTER COLUMN estimated_duration_hours TYPE interval
      USING (
        CASE
          WHEN estimated_duration_hours IS NULL THEN NULL
          WHEN btrim(estimated_duration_hours::text) ~ '^-?\d+(\.\d+)?$' THEN
            make_interval(secs => round((btrim(estimated_duration_hours::text))::numeric * 3600)::bigint)
          WHEN btrim(estimated_duration_hours::text) ~ '^\d+:[0-5]\d(:[0-5]\d)?$' THEN
            make_interval(
              hours => split_part(btrim(estimated_duration_hours::text), ':', 1)::integer,
              mins => split_part(btrim(estimated_duration_hours::text), ':', 2)::integer,
              secs => coalesce(nullif(split_part(btrim(estimated_duration_hours::text), ':', 3), ''), '0')::integer
            )
          WHEN btrim(estimated_duration_hours::text) ~ '^-?\d+\s+days?.*$' THEN
            btrim(estimated_duration_hours::text)::interval
          ELSE NULL
        END
      )
    $sql$;
  END IF;
END $$;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_work_package_id_fkey;
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_work_order_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_work_package_id_compat_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_work_package_id_compat_fkey
  FOREIGN KEY (work_package_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_work_order_alias_consistency;
ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_work_order_alias_consistency
  CHECK (
    work_package_id IS NULL
    OR work_order_id IS NULL
    OR work_package_id = work_order_id
  );

CREATE OR REPLACE FUNCTION public.sync_tasks_work_order_alias_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.work_order_id := COALESCE(NEW.work_order_id, NEW.work_package_id);
  NEW.work_package_id := COALESCE(NEW.work_package_id, NEW.work_order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tasks_work_order_alias_columns ON public.tasks;
CREATE TRIGGER trg_sync_tasks_work_order_alias_columns
  BEFORE INSERT OR UPDATE OF work_order_id, work_package_id
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tasks_work_order_alias_columns();

CREATE INDEX IF NOT EXISTS idx_tasks_work_order_id
  ON public.tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_work_package_id_compat
  ON public.tasks(work_package_id);

COMMENT ON COLUMN public.tasks.work_order_id IS
  'Canonical FK to public.work_orders(id). Replaces legacy work_package_id naming.';
COMMENT ON COLUMN public.tasks.work_package_id IS
  'Compatibility alias for work_order_id during phased cutover. Kept in sync by trigger.';
COMMENT ON COLUMN public.tasks.estimated_duration_hours IS
  'Estimated task duration stored as interval for duration-safe arithmetic.';

COMMIT;

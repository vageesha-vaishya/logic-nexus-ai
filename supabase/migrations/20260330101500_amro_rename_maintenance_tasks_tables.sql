BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tasks'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
  ) THEN
    ALTER TABLE public.maintenance_tasks RENAME TO task_templates;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tasks_temp'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'task_templates_temp'
  ) THEN
    ALTER TABLE public.maintenance_tasks_temp RENAME TO task_templates_temp;
  END IF;
END $$;

COMMIT;

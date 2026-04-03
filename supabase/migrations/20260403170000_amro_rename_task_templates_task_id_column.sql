DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'task_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'task_template_id'
  ) THEN
    ALTER TABLE public.task_templates
      RENAME COLUMN task_id TO task_template_id;
  END IF;

  IF to_regclass('public.task_templates_task_id_seq') IS NOT NULL
    AND to_regclass('public.task_templates_task_template_id_seq') IS NULL THEN
    ALTER SEQUENCE public.task_templates_task_id_seq
      RENAME TO task_templates_task_template_id_seq;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND constraint_name = 'task_templates_task_id_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND constraint_name = 'task_templates_task_template_id_key'
  ) THEN
    ALTER TABLE public.task_templates
      RENAME CONSTRAINT task_templates_task_id_key TO task_templates_task_template_id_key;
  END IF;
END
$migration$;

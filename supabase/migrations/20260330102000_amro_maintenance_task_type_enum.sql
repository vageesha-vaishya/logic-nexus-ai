DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'maintenance_task_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.maintenance_task_type AS ENUM ('Inspection', 'Service');
  END IF;
END $$;

ALTER TYPE public.maintenance_task_type ADD VALUE IF NOT EXISTS 'Inspection';
ALTER TYPE public.maintenance_task_type ADD VALUE IF NOT EXISTS 'Service';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
  ) THEN
    ALTER TABLE public.task_templates
      ADD COLUMN IF NOT EXISTS maintenance_task_type public.maintenance_task_type;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'task_templates_temp'
  ) THEN
    ALTER TABLE public.task_templates_temp
      ADD COLUMN IF NOT EXISTS maintenance_task_type public.maintenance_task_type,
      ADD COLUMN IF NOT EXISTS model text;
  END IF;
END $$;

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'calendar_unit'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.calendar_unit AS ENUM ('Mt', 'Yr', 'Dy');
  END IF;
END $$;

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS calendar_unit public.calendar_unit,
  ADD COLUMN IF NOT EXISTS repeat_interval boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tasks'
      AND column_name = 'interval_hours'
  ) THEN
    ALTER TABLE public.maintenance_tasks RENAME COLUMN interval_hours TO threshold_hours;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tasks'
      AND column_name = 'interval_cycles'
  ) THEN
    ALTER TABLE public.maintenance_tasks RENAME COLUMN interval_cycles TO threshold_cycles;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tasks'
      AND column_name = 'interval_months'
  ) THEN
    ALTER TABLE public.maintenance_tasks RENAME COLUMN interval_months TO threshold_calendar;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tasks'
      AND column_name = 'threshold_hours'
      AND data_type <> 'numeric'
  ) THEN
    ALTER TABLE public.maintenance_tasks
      ALTER COLUMN threshold_hours TYPE numeric(10,2)
      USING threshold_hours::numeric;
  END IF;
END $$;

COMMIT;

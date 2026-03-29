BEGIN;

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS assembly_models uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'maintenance_tasks'
      AND constraint_name = 'maintenance_tasks_assembly_models_fkey'
  ) THEN
    ALTER TABLE public.maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_assembly_models_fkey
      FOREIGN KEY (assembly_models)
      REFERENCES public.assembly_models(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMIT;

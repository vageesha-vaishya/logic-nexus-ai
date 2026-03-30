BEGIN;

ALTER TABLE public.task_templates
  ADD COLUMN IF NOT EXISTS assembly_models uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'task_templates'
      AND constraint_name = 'maintenance_tasks_assembly_models_fkey'
  ) THEN
    ALTER TABLE public.task_templates
      ADD CONSTRAINT maintenance_tasks_assembly_models_fkey
      FOREIGN KEY (assembly_models)
      REFERENCES public.assembly_models(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMIT;

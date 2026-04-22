-- AMRO tasks: add assembly linkage columns

BEGIN;
    
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assembly_type_id uuid,
  ADD COLUMN IF NOT EXISTS assembly_id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_assembly_type_id;

ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_assembly_type_id
    FOREIGN KEY (assembly_type_id)
    REFERENCES public.assembly_types(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_assembly_type_id
  ON public.tasks(assembly_type_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assembly_id
  ON public.tasks(assembly_id);

COMMIT;

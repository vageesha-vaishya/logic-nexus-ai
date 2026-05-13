BEGIN;

ALTER TABLE IF EXISTS public.task_templates
  ADD COLUMN IF NOT EXISTS is_rii boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_in_c_of_a boolean NULL DEFAULT false;

COMMIT;

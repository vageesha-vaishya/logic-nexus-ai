BEGIN;

ALTER TABLE IF EXISTS public.task_templates
  ADD COLUMN IF NOT EXISTS threshold_rins integer NULL,
  ADD COLUMN IF NOT EXISTS threshold_hobbs integer NULL;

COMMIT;

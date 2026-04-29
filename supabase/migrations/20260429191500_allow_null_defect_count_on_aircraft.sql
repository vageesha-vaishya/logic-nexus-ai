-- Allow aircraft.defect_count to be nullable while preserving existing default behavior.
ALTER TABLE IF EXISTS public.aircraft
  ALTER COLUMN defect_count DROP NOT NULL;

-- Rollback reference (manual):
-- UPDATE public.aircraft SET defect_count = 0 WHERE defect_count IS NULL;
-- ALTER TABLE public.aircraft ALTER COLUMN defect_count SET NOT NULL;

-- Normalize service_type_mappings to reference service_types via FK

BEGIN;

-- Add FK column
ALTER TABLE public.service_type_mappings
  ADD COLUMN IF NOT EXISTS service_type_id uuid;

-- Backfill service_type_id by matching existing text to service_types code or name
UPDATE public.service_type_mappings stm
SET service_type_id = st.id
FROM public.service_types st
WHERE stm.service_type_id IS NULL
  AND (
    lower(st.code) = lower(stm.service_type)
    OR lower(st.name) = lower(stm.service_type)
  );

-- Enforce NOT NULL once backfilled
ALTER TABLE public.service_type_mappings
  ALTER COLUMN service_type_id SET NOT NULL;

-- Create unique constraint/index on tenant_id, service_type_id, service_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'service_type_mappings_unique_fk'
  ) THEN
    CREATE UNIQUE INDEX service_type_mappings_unique_fk
      ON public.service_type_mappings(tenant_id, service_type_id, service_id);
  END IF;
END$$;

-- Drop old unique constraint/index on (tenant_id, service_type, service_id) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'service_type_mappings_unique_pair'
  ) THEN
    DROP INDEX public.service_type_mappings_unique_pair;
  END IF;
END$$;

-- Drop legacy text column to ensure mapping only relies on modules/tables
ALTER TABLE public.service_type_mappings
  DROP COLUMN IF EXISTS service_type;

COMMIT;
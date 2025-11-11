-- Seed/align ocean sub-service types and optional mappings
-- Adds/updates service_types for Break Bulk, LCL, and RORO with codes

-- Step 1: Ensure service_types has `code` column
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;

-- Step 2: Populate codes for ALL existing records (so we can make it NOT NULL)
UPDATE public.service_types 
SET code = LOWER(REPLACE(name, ' ', '_')) 
WHERE code IS NULL OR code = '';

-- Step 3: Make code NOT NULL first
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Step 4: Now create a complete unique constraint (not partial)
DROP INDEX IF EXISTS service_types_code_unique;
ALTER TABLE public.service_types DROP CONSTRAINT IF EXISTS service_types_code_key;
ALTER TABLE public.service_types ADD CONSTRAINT service_types_code_key UNIQUE (code);

-- Step 5: Now we can safely upsert ocean sub-service types
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

-- Step 6: Add service_type_id to quotation_version_option_legs if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_option_legs'
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotation_version_option_legs
      ADD COLUMN service_type_id uuid REFERENCES public.service_types(id);
    
    CREATE INDEX quotation_version_option_legs_service_type_idx
      ON public.quotation_version_option_legs(service_type_id);
  END IF;
END $$;

-- Step 7: Link services to new service types where names indicate LCL/RORO/Break Bulk
DO $$
DECLARE
  lcl_id uuid;
  roro_id uuid;
  bb_id uuid;
BEGIN
  -- Get the IDs of the newly created service types
  SELECT id INTO lcl_id FROM public.service_types WHERE code = 'ocean_lcl' LIMIT 1;
  SELECT id INTO roro_id FROM public.service_types WHERE code = 'ocean_roro' LIMIT 1;
  SELECT id INTO bb_id FROM public.service_types WHERE code = 'ocean_breakbulk' LIMIT 1;

  -- Update services table if service_type_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type_id'
  ) THEN
    -- Update based on service_name containing keywords
    UPDATE public.services 
    SET service_type_id = lcl_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%lcl%';

    UPDATE public.services 
    SET service_type_id = roro_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%roro%';

    UPDATE public.services 
    SET service_type_id = bb_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND (LOWER(service_name) LIKE '%break bulk%' OR LOWER(service_name) LIKE '%break-bulk%');
  END IF;
END $$;
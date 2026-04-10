-- Remove redundant columns from aircraft table and add assembly_models reference
-- Columns being removed: aircraft_type, manufacturer, model, aircraft_model, manufacturer_id
-- New column: assembly_models uuid (references assembly_models table)

BEGIN;

-- Step 1: Add the new assembly_models column if it doesn't exist
ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS assembly_models uuid;

-- Step 2: Migrate existing data - map to assembly_models where possible
-- This attempts to match existing aircraft records to assembly_models based on manufacturer and model
DO $$
DECLARE
  v_has_aircraft_type boolean;
  v_has_manufacturer boolean;
  v_has_model boolean;
  v_has_aircraft_model boolean;
  v_has_manufacturer_id boolean;
BEGIN
  -- Check which legacy columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_type'
  ) INTO v_has_aircraft_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer'
  ) INTO v_has_manufacturer;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'model'
  ) INTO v_has_model;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_model'
  ) INTO v_has_aircraft_model;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer_id'
  ) INTO v_has_manufacturer_id;

  -- Only attempt migration if at least one legacy column exists
  IF v_has_aircraft_type OR v_has_manufacturer OR v_has_model OR v_has_aircraft_model OR v_has_manufacturer_id THEN
    -- Update aircraft records to link to assembly_models
    -- Priority: Try exact UUID match first, then text-based matching
    UPDATE public.aircraft ac
    SET assembly_models = COALESCE(
      -- If aircraft_model is already a valid UUID pointing to assembly_models, use it
      CASE
        WHEN v_has_aircraft_model AND ac.aircraft_model ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (
          SELECT am.id FROM public.assembly_models am
          WHERE am.id::text = ac.aircraft_model
          LIMIT 1
        )
        ELSE NULL
      END,
      -- Try matching by manufacturer + model code/name
      (
        SELECT am.id
        FROM public.assembly_models am
        LEFT JOIN public.manufacturers m ON m.id = am.manufacturer_id
        WHERE am.tenant_id = ac.tenant_id
          AND (
            -- Match by model code
            (v_has_model AND lower(btrim(am.model_code)) = lower(btrim(ac.model)))
            OR (v_has_aircraft_model AND lower(btrim(am.model_code)) = lower(btrim(ac.aircraft_model)))
            -- Match by model name
            OR (v_has_model AND lower(btrim(am.name)) = lower(btrim(ac.model)))
            OR (v_has_aircraft_model AND lower(btrim(am.name)) = lower(btrim(ac.aircraft_model)))
            -- Match by manufacturer + model combination
            OR (
              v_has_manufacturer AND v_has_model
              AND lower(btrim(m.name)) = lower(btrim(ac.manufacturer))
              AND (
                lower(btrim(am.model_code)) = lower(btrim(ac.model))
                OR lower(btrim(am.name)) = lower(btrim(ac.model))
              )
            )
            OR (
              v_has_manufacturer_id AND v_has_model
              AND am.manufacturer_id = ac.manufacturer_id
              AND (
                lower(btrim(am.model_code)) = lower(btrim(ac.model))
                OR lower(btrim(am.name)) = lower(btrim(ac.model))
              )
            )
          )
        ORDER BY am.is_active DESC, am.updated_at DESC NULLS LAST
        LIMIT 1
      )
    )
    WHERE ac.assembly_models IS NULL
      AND (
        (v_has_aircraft_model AND ac.aircraft_model IS NOT NULL AND btrim(ac.aircraft_model) <> '')
        OR (v_has_model AND ac.model IS NOT NULL AND btrim(ac.model) <> '')
      );
  END IF;
END $$;

-- Step 3: Add foreign key constraint to assembly_models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aircraft_assembly_models_fkey'
      AND conrelid = 'public.aircraft'::regclass
  ) THEN
    ALTER TABLE public.aircraft
      ADD CONSTRAINT aircraft_assembly_models_fkey
        FOREIGN KEY (assembly_models)
        REFERENCES public.assembly_models(id)
        ON DELETE SET NULL;
  END IF;
END $$;

-- Step 4: Create index on assembly_models
CREATE INDEX IF NOT EXISTS idx_aircraft_assembly_models
  ON public.aircraft(assembly_models);

-- Step 5: Drop legacy columns if they exist
DO $$
BEGIN
  -- Drop aircraft_type column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_type'
  ) THEN
    ALTER TABLE public.aircraft DROP COLUMN aircraft_type;
  END IF;

  -- Drop manufacturer column (text)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE public.aircraft DROP COLUMN manufacturer;
  END IF;

  -- Drop model column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'model'
  ) THEN
    ALTER TABLE public.aircraft DROP COLUMN model;
  END IF;

  -- Drop aircraft_model column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_model'
  ) THEN
    ALTER TABLE public.aircraft DROP COLUMN aircraft_model;
  END IF;

  -- Drop manufacturer_id column and its index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer_id'
  ) THEN
    -- Drop the index first
    DROP INDEX IF EXISTS idx_aircraft_manufacturer_id;
    -- Drop the foreign key constraint
    ALTER TABLE public.aircraft DROP CONSTRAINT IF EXISTS aircraft_manufacturer_id_fkey;
    -- Drop the column
    ALTER TABLE public.aircraft DROP COLUMN manufacturer_id;
  END IF;
END $$;

COMMIT;
